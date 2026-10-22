import crypto from 'crypto';
import { ClientSession } from 'mongoose';
import { BVRate, IBVRate } from '../models/BVRate.model';
import { CompanyEarning, ICompanyEarning } from '../models/CompanyEarning.model';
import { BVReturnRequest } from '../models/BVReturnRequest.model';
import { IPurchase } from '../models/Purchase.model';
import { AuditService } from './AuditService';
import { BusinessDate } from '../utils/businessDate';
import { DecimalUtil } from '../utils/decimal';
import {
  HTTP_STATUS,
  BV_RATE,
  BV_RETURN_STATUS,
  COMPANY_EARNING_TYPE,
  CompanyEarningType,
} from '../config/constants';

/**
 * Super Admin earnings and the BV rate.
 *
 * Earnings are recorded by the code that moves the money's counterpart, inside the same MongoDB
 * transaction, so an earning never exists without its BV movement or order (and vice versa):
 *  - BVWalletService: BV sales, reversed sales and approved returns
 *  - PurchaseController: bank / UPI orders marked as paid, and their refunds
 * Everything here works in integer paise; rupee figures are only produced for display.
 */

export class CompanyEarningError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = HTTP_STATUS.BAD_REQUEST) {
    super(message);
    this.name = 'CompanyEarningError';
    this.statusCode = statusCode;
  }
}

export interface EarningActor {
  email: string;
  operatorName?: string;
}

const randomCode = (bytes: number) => crypto.randomBytes(bytes).toString('hex').toUpperCase();
const newEntryId = () => `CE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomCode(5)}`;
const newRateId = () => `RATE-${Date.now()}-${randomCode(3)}`;

const EXPORT_MAX_ROWS = 10_000;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatRupees = (paise: number) =>
  `₹${DecimalUtil.fromPaise(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Parses a rupee rate per BV ("1", "1.25") into paise; at most two decimals. */
const parseRatePaise = (value: unknown): number => {
  const rupees = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof rupees !== 'number' || !Number.isFinite(rupees) || rupees <= 0) {
    throw new CompanyEarningError('Enter a BV rate greater than ₹0.');
  }
  if (rupees > BV_RATE.MAX_RUPEES_PER_BV) {
    throw new CompanyEarningError(`BV rate cannot be more than ₹${BV_RATE.MAX_RUPEES_PER_BV.toLocaleString('en-IN')} per BV.`);
  }
  const paise = Math.round(rupees * 100);
  if (Math.abs(paise - rupees * 100) > 1e-6) throw new CompanyEarningError('BV rate can have at most two decimal places.');
  return paise;
};

/** IST date range filter: 'YYYY-MM-DD' strings are whole business days. */
const dateRange = (from: unknown, to: unknown): Record<string, Date> | null => {
  const range: Record<string, Date> = {};
  if (BusinessDate.isValid(from)) range.$gte = BusinessDate.startOf(from);
  if (BusinessDate.isValid(to)) range.$lte = BusinessDate.endOf(to);
  return Object.keys(range).length ? range : null;
};

export class CompanyEarningService {
  // ---------------------------------------------------------------------------
  // BV rate
  // ---------------------------------------------------------------------------

  static rateToPublic(rate: IBVRate | null) {
    if (!rate) return null;
    return {
      rateId: rate.rateId,
      rate: DecimalUtil.fromPaise(rate.ratePaise),
      ratePaise: rate.ratePaise,
      note: rate.note,
      setBy: rate.setBy,
      createdAt: rate.createdAt,
    };
  }

  static async getCurrentRate(session?: ClientSession): Promise<IBVRate | null> {
    return BVRate.findOne().sort({ createdAt: -1, _id: -1 }).session(session || null);
  }

  /** The rate a Super Admin sale must use; selling is blocked until a rate is set. */
  static async requireCurrentRate(session?: ClientSession): Promise<IBVRate> {
    const rate = await this.getCurrentRate(session);
    if (!rate) {
      throw new CompanyEarningError('Set the BV rate (Company Earnings → BV rate) before sending BV to members.', HTTP_STATUS.CONFLICT);
    }
    return rate;
  }

  static async setRate(input: { rate: unknown; note: unknown; actor: EarningActor & { role?: string; ip?: string } }) {
    const ratePaise = parseRatePaise(input.rate);
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (note.length > BV_RATE.NOTE_MAX_LENGTH) {
      throw new CompanyEarningError(`Note cannot be longer than ${BV_RATE.NOTE_MAX_LENGTH} characters.`);
    }

    const current = await this.getCurrentRate();
    if (current && current.ratePaise === ratePaise) {
      throw new CompanyEarningError(`The BV rate is already ${formatRupees(ratePaise)} per BV.`);
    }

    const rate = await BVRate.create({
      rateId: newRateId(),
      ratePaise,
      note,
      setBy: { email: input.actor.email, operatorName: input.actor.operatorName || '' },
    });

    try {
      await AuditService.log({
        action: 'BV_RATE_CHANGED',
        entity: 'COMPANY_EARNINGS',
        entityId: rate.rateId,
        performedBy: input.actor.operatorName ? `${input.actor.email} (${input.actor.operatorName})` : input.actor.email,
        performedByRole: input.actor.role,
        oldValues: current ? { ratePaise: current.ratePaise } : undefined,
        newValues: { ratePaise, note },
        reason: note,
        ipAddress: input.actor.ip,
      });
    } catch (error) {
      console.error('[CompanyEarningService] Failed to write audit log:', error);
    }
    return rate;
  }

  static async rateHistory(limit = 50) {
    const rates = await BVRate.find().sort({ createdAt: -1, _id: -1 }).limit(limit);
    return rates.map((r) => this.rateToPublic(r));
  }

  // ---------------------------------------------------------------------------
  // Recording (always inside the caller's transaction)
  // ---------------------------------------------------------------------------

  /** Adds an earnings entry. Idempotent: the same event (type + source) is only ever recorded once. */
  static async record(
    session: ClientSession,
    input: {
      type: CompanyEarningType;
      sourceId: string;
      memberId: string;
      memberName: string;
      bv: number;
      ratePaise?: number;
      amountPaise: number;
      paymentMode?: string;
      note?: string;
      relatedEntryId?: string;
      performedBy: EarningActor;
    }
  ): Promise<ICompanyEarning> {
    const existing = await CompanyEarning.findOne({ type: input.type, sourceId: input.sourceId }).session(session);
    if (existing) return existing;

    const [entry] = await CompanyEarning.create(
      [
        {
          entryId: newEntryId(),
          type: input.type,
          sourceId: input.sourceId,
          memberId: input.memberId,
          memberName: input.memberName,
          bv: input.bv,
          ratePaise: input.ratePaise,
          amountPaise: input.amountPaise,
          amount: DecimalUtil.fromPaise(input.amountPaise),
          paymentMode: input.paymentMode,
          note: (input.note || '').slice(0, 500),
          relatedEntryId: input.relatedEntryId,
          performedBy: { email: input.performedBy.email, operatorName: input.performedBy.operatorName || '' },
        },
      ],
      { session }
    );
    return entry;
  }

  /** Orders paid by bank / UPI add their total. BV-paid orders add nothing (the BV was already sold). */
  static async recordOrderPaid(session: ClientSession, purchase: IPurchase, performedBy: EarningActor) {
    if (purchase.paymentMethod === 'BV_WALLET') return null;
    const amountPaise = DecimalUtil.toPaise(purchase.totalAmount || 0);
    if (amountPaise <= 0) return null;

    return this.record(session, {
      type: COMPANY_EARNING_TYPE.ORDER_PAID,
      sourceId: purchase.purchaseId,
      memberId: purchase.memberId,
      memberName: purchase.memberName || '',
      bv: purchase.totalBV || 0,
      amountPaise,
      paymentMode: purchase.paymentMode,
      note: purchase.items.map((i) => `${i.quantity} x ${i.name}`).join(', '),
      performedBy,
    });
  }

  /** Takes back what the order added. Orders that added nothing (BV-paid, or paid before earnings existed) are skipped. */
  static async recordOrderRefunded(session: ClientSession, purchase: IPurchase, reason: string, performedBy: EarningActor) {
    const paid = await CompanyEarning.findOne({ type: COMPANY_EARNING_TYPE.ORDER_PAID, sourceId: purchase.purchaseId }).session(session);
    if (!paid) return null;

    return this.record(session, {
      type: COMPANY_EARNING_TYPE.ORDER_REFUNDED,
      sourceId: purchase.purchaseId,
      memberId: paid.memberId,
      memberName: paid.memberName,
      bv: paid.bv,
      amountPaise: -paid.amountPaise,
      paymentMode: paid.paymentMode,
      note: reason,
      relatedEntryId: paid.entryId,
      performedBy,
    });
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  static toPublic(entry: ICompanyEarning) {
    return {
      entryId: entry.entryId,
      type: entry.type,
      sourceId: entry.sourceId,
      memberId: entry.memberId,
      memberName: entry.memberName,
      bv: entry.bv,
      rate: entry.ratePaise !== undefined && entry.ratePaise !== null ? DecimalUtil.fromPaise(entry.ratePaise) : null,
      amount: DecimalUtil.fromPaise(entry.amountPaise),
      amountPaise: entry.amountPaise,
      paymentMode: entry.paymentMode || '',
      note: entry.note,
      relatedEntryId: entry.relatedEntryId,
      performedBy: entry.performedBy,
      createdAt: entry.createdAt,
    };
  }

  private static async netPaise(createdAt?: Record<string, Date>): Promise<number> {
    const [row] = await CompanyEarning.aggregate([
      { $match: createdAt ? { createdAt } : {} },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]);
    return row?.total || 0;
  }

  static async summary() {
    const today = BusinessDate.today();
    const [byTypeRows, todayPaise, weekPaise, monthPaise, pending, rate] = await Promise.all([
      CompanyEarning.aggregate([
        { $group: { _id: '$type', amountPaise: { $sum: '$amountPaise' }, bv: { $sum: '$bv' }, count: { $sum: 1 } } },
      ]),
      this.netPaise({ $gte: BusinessDate.startOf(today) }),
      this.netPaise({ $gte: BusinessDate.startOf(BusinessDate.weekStartOf(today)) }),
      this.netPaise({ $gte: BusinessDate.startOf(`${today.slice(0, 8)}01`) }),
      BVReturnRequest.aggregate([
        { $match: { status: BV_RETURN_STATUS.PENDING } },
        { $group: { _id: null, count: { $sum: 1 }, bv: { $sum: '$amount' }, valuePaise: { $sum: '$valuePaise' } } },
      ]),
      this.getCurrentRate(),
    ]);

    const byType = (type: CompanyEarningType) => byTypeRows.find((r) => r._id === type) || { amountPaise: 0, bv: 0, count: 0 };
    const sales = byType(COMPANY_EARNING_TYPE.BV_SALE);
    const reversed = byType(COMPANY_EARNING_TYPE.BV_SALE_REVERSED);
    const returned = byType(COMPANY_EARNING_TYPE.BV_RETURNED);
    const ordersPaid = byType(COMPANY_EARNING_TYPE.ORDER_PAID);
    const ordersRefunded = byType(COMPANY_EARNING_TYPE.ORDER_REFUNDED);

    const bvSalesPaise = sales.amountPaise + reversed.amountPaise;
    const totalPaise = byTypeRows.reduce((sum, r) => sum + r.amountPaise, 0);

    return {
      total: DecimalUtil.fromPaise(totalPaise),
      today: DecimalUtil.fromPaise(todayPaise),
      thisWeek: DecimalUtil.fromPaise(weekPaise),
      thisMonth: DecimalUtil.fromPaise(monthPaise),
      bvSales: {
        amount: DecimalUtil.fromPaise(bvSalesPaise),
        bv: sales.bv - reversed.bv,
        count: sales.count - reversed.count,
      },
      bvReturns: { amount: DecimalUtil.fromPaise(returned.amountPaise), bv: returned.bv, count: returned.count },
      orders: {
        amount: DecimalUtil.fromPaise(ordersPaid.amountPaise + ordersRefunded.amountPaise),
        count: ordersPaid.count - ordersRefunded.count,
        refunded: DecimalUtil.fromPaise(ordersRefunded.amountPaise),
      },
      netBVSold: sales.bv - reversed.bv - returned.bv,
      pendingReturns: {
        count: pending[0]?.count || 0,
        bv: pending[0]?.bv || 0,
        amount: DecimalUtil.fromPaise(pending[0]?.valuePaise || 0),
      },
      currentRate: this.rateToPublic(rate),
      periods: { today, weekStart: BusinessDate.weekStartOf(today), monthStart: `${today.slice(0, 8)}01` },
    };
  }

  private static buildFilter(params: { type?: unknown; memberId?: unknown; search?: unknown; from?: unknown; to?: unknown }) {
    const conditions: Record<string, unknown>[] = [];

    const type = typeof params.type === 'string' ? params.type.toUpperCase() : '';
    if (Object.values(COMPANY_EARNING_TYPE).includes(type as CompanyEarningType)) conditions.push({ type });

    const memberId = typeof params.memberId === 'string' ? params.memberId.trim().toUpperCase() : '';
    if (memberId) conditions.push({ memberId });

    const createdAt = dateRange(params.from, params.to);
    if (createdAt) conditions.push({ createdAt });

    const search = typeof params.search === 'string' ? params.search.trim().slice(0, 100) : '';
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: 'i' };
      conditions.push({ $or: [{ memberId: regex }, { memberName: regex }, { sourceId: regex }, { entryId: regex }, { note: regex }] });
    }

    return conditions.length ? { $and: conditions } : {};
  }

  static async list(params: { type?: unknown; memberId?: unknown; search?: unknown; from?: unknown; to?: unknown; page?: unknown; limit?: unknown }) {
    const filter = this.buildFilter(params);
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));

    const [items, total, totals] = await Promise.all([
      CompanyEarning.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      CompanyEarning.countDocuments(filter),
      CompanyEarning.aggregate([{ $match: filter }, { $group: { _id: null, amountPaise: { $sum: '$amountPaise' } } }]),
    ]);

    return {
      items: items.map((e) => this.toPublic(e)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      filteredAmount: DecimalUtil.fromPaise(totals[0]?.amountPaise || 0),
    };
  }

  /** CSV of the filtered entries, newest first (capped at EXPORT_MAX_ROWS). */
  static async exportCsv(params: { type?: unknown; memberId?: unknown; search?: unknown; from?: unknown; to?: unknown }) {
    const entries = await CompanyEarning.find(this.buildFilter(params)).sort({ createdAt: -1, _id: -1 }).limit(EXPORT_MAX_ROWS).lean();

    // Text cells that a spreadsheet could read as a formula get a leading quote
    const text = (value: unknown) => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const istDateTime = (d: Date) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

    const header = ['Date (IST)', 'Entry ID', 'Type', 'Member ID', 'Member name', 'BV', 'Rate (₹ per BV)', 'Amount (₹)', 'Source', 'Payment mode', 'Operator', 'Note'];
    const rows = entries.map((e) =>
      [
        text(istDateTime(e.createdAt)),
        text(e.entryId),
        text(e.type),
        text(e.memberId),
        text(e.memberName),
        String(e.bv || 0),
        e.ratePaise ? (e.ratePaise / 100).toFixed(2) : '',
        (e.amountPaise / 100).toFixed(2),
        text(e.sourceId),
        text(e.paymentMode || ''),
        text(e.performedBy?.operatorName || e.performedBy?.email || ''),
        text(e.note || ''),
      ].join(',')
    );
    // BOM so Excel opens the ₹ sign and names correctly
    return `﻿${[header.join(','), ...rows].join('\r\n')}\r\n`;
  }
}

export default CompanyEarningService;
