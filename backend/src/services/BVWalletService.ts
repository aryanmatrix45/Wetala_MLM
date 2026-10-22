import crypto from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { BVWallet, IBVWallet } from '../models/BVWallet.model';
import { BVTransaction, IBVTransaction } from '../models/BVTransaction.model';
import { BVWalletLedger } from '../models/BVWalletLedger.model';
import { AdminNotification, NotificationType } from '../models/AdminNotification.model';
import { Member, IMember } from '../models/Member.model';
import { Purchase, IPurchase } from '../models/Purchase.model';
import { AuditService } from './AuditService';
import { BinaryTreeService } from './tree/BinaryTreeService';
import { BVService } from './BVService';
import { CompanyEarningService, CompanyEarningError } from './CompanyEarningService';
import { BVLedger } from '../models/BVLedger.model';
import { BVReturnRequest, IBVReturnRequest } from '../models/BVReturnRequest.model';
import { CompanyEarning } from '../models/CompanyEarning.model';
import { DecimalUtil } from '../utils/decimal';
import {
  HTTP_STATUS,
  BV_WALLET,
  BV_OWNER_TYPE,
  BVOwnerType,
  BV_TXN_TYPE,
  BV_TXN_STATUS,
  BV_LEDGER_ENTRY,
  BVLedgerEntryType,
  BV_SOURCE_TYPE,
  BV_RETURN_STATUS,
  COMPANY_EARNING_TYPE,
} from '../config/constants';

/**
 * BV Wallet: transferable BV credit balances.
 *
 * This is the only code that changes BVWallet balances. Transfers are instant: the sender's debit,
 * the recipient's credit, both ledger entries and the notification are written in one MongoDB
 * transaction. The debit is a conditional $inc (availableBV >= amount), so concurrent requests
 * across PM2 cluster workers can never overspend.
 *
 * Transfers cannot be undone by members. The Super Admin can reverse a transfer once, which writes
 * a new REVERSAL transaction moving the BV back; the original amounts are never edited.
 *
 * Every Super Admin -> member transfer is a BV sale: BV x the current BV rate is added to Super
 * Admin earnings in the same transaction (CompanyEarningService), and the member's purchasedBV /
 * purchasedPaise go up. Member -> member transfers move BV that was already paid for and earn nothing.
 *
 * Other ways BV enters or leaves a wallet:
 *  - WELCOME_BONUS: the weekly welcome bonus share is credited as BV (WelcomeBonusService). It goes
 *    into the wallet's bonusBV part, which can pay for orders but can never be transferred or returned
 *  - PURCHASE: a member pays for an order with its own BV value (e.g. a 1,250 BV package costs
 *    1,250 BV; rupee prices are never converted), welcome bonus BV first; the order then waits for
 *    Super Admin approval
 *  - PURCHASE_REFUND: the BV comes back, to the same parts it was paid from, if that order is
 *    rejected or refunded
 *  - BINARY_ACTIVATION: up to 100 BV locked once at binary activation and fed into the upline legs
 *  - RETURN_REQUESTED / RETURN_APPROVED / RETURN_RELEASED: a member returns BV it bought from the
 *    Super Admin. The BV is held while the request waits; approval moves it to the Super Admin wallet
 *    and deducts its value (at the member's average purchase price) from earnings; rejection or
 *    cancellation gives it back. Only regular BV, and only up to what the member bought, can be returned.
 *
 * Wallet BV itself is not earned volume: it never changes Member.personalBv. Earned BV comes from
 * the order once the Super Admin approves it. A wallet balance can, however,
 * unlock binary participation (personal BV + wallet balance >= BV_WALLET.ACTIVATION_BV).
 */

export class BVWalletError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number = HTTP_STATUS.BAD_REQUEST, details?: Record<string, unknown>) {
    super(message);
    this.name = 'BVWalletError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface BVOwner {
  ownerType: BVOwnerType;
  ownerId: string;
}

interface BVParty extends BVOwner {
  name: string;
}

export interface BVActor {
  role: string;
  email: string;
  operatorName?: string;
  ip?: string;
  userAgent?: string;
}

export const ADMIN_BV_OWNER: BVOwner = { ownerType: BV_OWNER_TYPE.ADMIN, ownerId: BV_WALLET.ADMIN_OWNER_ID };

const randomCode = (bytes: number) => crypto.randomBytes(bytes).toString('hex').toUpperCase();
const newTransactionId = () => `BVT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomCode(5)}`;
const newEntryId = () => `BVL-${Date.now()}-${randomCode(4)}`;
const walletIdFor = (ownerId: string) => `BVW-${ownerId}`;
const formatBV = (amount: number) => `${amount.toLocaleString('en-IN')} BV`;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const maskMobile = (mobile?: string) => {
  const digits = (mobile || '').replace(/\D/g, '');
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : '';
};

const maskEmail = (email?: string) => {
  const [user, domain] = (email || '').split('@');
  return domain ? `${user.slice(0, 1)}***@${domain}` : '';
};

export const runInTransaction = <T>(fn: (session: ClientSession) => Promise<T>): Promise<T> =>
  mongoose.connection.transaction(fn) as Promise<T>;

const parseAmount = (value: unknown, max: number): number => {
  const amount = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1) {
    throw new BVWalletError('BV amount must be a whole number of at least 1.');
  }
  if (amount > max) {
    throw new BVWalletError(`BV amount cannot exceed ${formatBV(max)} per transaction.`);
  }
  return amount;
};

const parseText = (value: unknown, label: string, maxLength: number, required: boolean): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new BVWalletError(`${label} is required.`);
  if (text.length > maxLength) throw new BVWalletError(`${label} cannot be longer than ${maxLength} characters.`);
  return text;
};

const parseTransactionId = (value: unknown): string => {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^BVT-\d{8}-[0-9A-F]{10}$/.test(id)) throw new BVWalletError('Transaction not found.', HTTP_STATUS.NOT_FOUND);
  return id;
};

const parseRequestKey = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) {
    throw new BVWalletError('Invalid request key. Please reopen the transfer form and try again.');
  }
  return value;
};

const isEligibleMember = (member: Pick<IMember, 'status' | 'approvalStatus' | 'isActive'>) =>
  member.status === 'active' && member.approvalStatus === 'approved' && member.isActive !== false;

const ELIGIBLE_MEMBER_FILTER = { status: 'active', approvalStatus: 'approved', isActive: true } as const;

const safeAudit = async (params: Parameters<typeof AuditService.log>[0]) => {
  try {
    await AuditService.log({ ...params, entity: 'BV_WALLET' });
  } catch (error) {
    console.error('[BVWalletService] Failed to write audit log:', error);
  }
};

const actorLabel = (actor: BVActor) => (actor.operatorName ? `${actor.email} (${actor.operatorName})` : actor.email);

const newReturnRequestId = () => `BVR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomCode(4)}`;

const formatRupees = (paise: number) =>
  `₹${DecimalUtil.fromPaise(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type WalletCounter =
  | 'bonusBV'
  | 'totalGenerated'
  | 'totalReceived'
  | 'totalSent'
  | 'totalWelcomeBonus'
  | 'totalSpent'
  | 'totalActivationLocked'
  | 'totalSold'
  | 'purchasedBV'
  | 'purchasedPaise'
  | 'returnedBV'
  | 'returnedPaise'
  | 'pendingReturnBV'
  | 'pendingReturnPaise';

/** Regular BV: the balance minus the welcome bonus part. Only regular BV can be transferred or returned. */
const regularBVOf = (w: Pick<IBVWallet, 'availableBV' | 'bonusBV'>) => Math.max(0, (w.availableBV || 0) - (w.bonusBV || 0));

/**
 * How much of what a member bought from the Super Admin it can still return, and for how much.
 * Requests waiting for approval already hold their BV and value, so they are taken out first.
 */
const returnCapacity = (w: IBVWallet) => {
  const remainingBV = Math.max(0, (w.purchasedBV || 0) - (w.returnedBV || 0) - (w.pendingReturnBV || 0));
  const remainingPaise = Math.max(0, (w.purchasedPaise || 0) - (w.returnedPaise || 0) - (w.pendingReturnPaise || 0));
  return { remainingBV, remainingPaise, returnableBV: Math.min(regularBVOf(w), remainingBV) };
};

/** Value of returning `bv` at the member's average purchase price; the last BV takes the exact remainder. */
const returnValuePaise = (bv: number, remainingBV: number, remainingPaise: number) =>
  remainingBV <= 0 ? 0 : bv >= remainingBV ? remainingPaise : Math.round((bv * remainingPaise) / remainingBV);

/** $expr guard: the member still has at least `bv` of bought-and-not-returned BV. */
const purchasedCapacityGuard = (bv: number) => ({
  $gte: [
    {
      $subtract: [
        { $ifNull: ['$purchasedBV', 0] },
        { $add: [{ $ifNull: ['$returnedBV', 0] }, { $ifNull: ['$pendingReturnBV', 0] }] },
      ],
    },
    bv,
  ],
});

/** Rate errors come from CompanyEarningService; surface them like any other wallet error. */
const asWalletError = (error: unknown) =>
  error instanceof CompanyEarningError ? new BVWalletError(error.message, error.statusCode) : error;

export class BVWalletService {
  // ---------------------------------------------------------------------------
  // Wallet & ledger primitives
  // ---------------------------------------------------------------------------

  /** Creates the wallet if it does not exist yet. Kept outside transactions to avoid upsert races. */
  static async ensureWallet(owner: BVOwner): Promise<IBVWallet> {
    const ownerId = owner.ownerId.toUpperCase();
    try {
      await BVWallet.updateOne(
        { ownerId },
        { $setOnInsert: { walletId: walletIdFor(ownerId), ownerType: owner.ownerType } },
        { upsert: true }
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
    const wallet = await BVWallet.findOne({ ownerId });
    if (!wallet) throw new BVWalletError('BV wallet could not be created.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    return wallet;
  }

  /**
   * Atomically applies a balance change and writes the matching ledger entry.
   * `totals.bonusBV` moves the welcome bonus part of the balance along with it.
   * Returns null when a guard fails (insufficient BV or bonus BV for a debit, regular BV for a
   * regular-only debit, a caller guard, or wallet frozen).
   */
  private static async moveBalance(
    session: ClientSession,
    ownerId: string,
    entryType: BVLedgerEntryType,
    txn: IBVTransaction,
    delta: number,
    totals: Partial<Record<WalletCounter, number>> = {},
    options: { requireNotFrozen?: boolean; regularOnly?: boolean; guards?: Record<string, unknown>[] } = {}
  ): Promise<IBVWallet | null> {
    const filter: Record<string, unknown> = { ownerId };
    if (delta < 0) filter.availableBV = { $gte: -delta };
    const bonusDelta = totals.bonusBV || 0;
    if (bonusDelta < 0) filter.bonusBV = { $gte: -bonusDelta };
    if (options.requireNotFrozen) filter.isFrozen = false;
    const exprs = [...(options.guards || [])];
    if (options.regularOnly && delta < 0) {
      exprs.push({ $gte: [{ $subtract: ['$availableBV', { $ifNull: ['$bonusBV', 0] }] }, -delta] });
    }
    if (exprs.length) filter.$expr = exprs.length === 1 ? exprs[0] : { $and: exprs };

    const wallet = await BVWallet.findOneAndUpdate(
      filter,
      { $inc: { availableBV: delta, sequence: 1, ...totals } },
      { session, returnDocument: 'after' }
    );
    if (!wallet) return null;

    await BVWalletLedger.create(
      [
        {
          entryId: newEntryId(),
          walletId: wallet.walletId,
          ownerId,
          transactionId: txn.transactionId,
          entryType,
          amount: txn.amount,
          availableDelta: delta,
          bonusDelta,
          availableBefore: wallet.availableBV - delta,
          availableAfter: wallet.availableBV,
          walletSequence: wallet.sequence,
        },
      ],
      { session }
    );
    return wallet;
  }

  private static async notify(
    session: ClientSession,
    params: { type: NotificationType; title: string; message: string; recipientId: string; txn: IBVTransaction }
  ) {
    const toAdmin = params.recipientId === BV_WALLET.ADMIN_OWNER_ID;
    await AdminNotification.create(
      [
        {
          notificationId: `NOTIF-${Date.now()}-${randomCode(3)}`,
          type: params.type,
          title: params.title,
          message: params.message,
          senderId: params.txn.senderId,
          senderName: params.txn.senderName,
          recipientRole: toAdmin ? 'admin' : 'member',
          recipientId: toAdmin ? 'admin' : params.recipientId,
          referenceId: params.txn.transactionId,
          amount: params.txn.amount,
          metadata: { module: 'BV_WALLET', unit: 'BV', transactionId: params.txn.transactionId, txnType: params.txn.type },
        },
      ],
      { session }
    );
  }

  private static async insufficientBalanceError(ownerId: string, amount: number, options: { regularOnly?: boolean } = {}): Promise<BVWalletError> {
    const wallet = await BVWallet.findOne({ ownerId });
    if (wallet?.isFrozen) {
      return new BVWalletError(
        `This BV wallet is frozen${wallet.frozenReason ? `: ${wallet.frozenReason}` : ''}. Contact support.`,
        HTTP_STATUS.FORBIDDEN
      );
    }
    const available = wallet?.availableBV || 0;
    if (options.regularOnly && (wallet?.bonusBV || 0) > 0) {
      const regular = regularBVOf(wallet!);
      return new BVWalletError(
        `You can send up to ${formatBV(regular)}. ${formatBV(wallet!.bonusBV)} of your balance is welcome bonus BV, which can only be used for your own orders.`,
        HTTP_STATUS.BAD_REQUEST,
        { availableBV: available, sendableBV: regular }
      );
    }
    return new BVWalletError(
      `Insufficient BV balance. Available: ${formatBV(available)}, requested: ${formatBV(amount)}.`,
      HTTP_STATUS.BAD_REQUEST,
      { availableBV: available }
    );
  }

  /**
   * Resolves who BV is being sent to: always an active member, never the sender. Members give BV
   * back to the company through a return request, not a transfer.
   */
  private static async resolveRecipient(recipientId: string, sender: BVOwner): Promise<BVParty> {
    if (!recipientId) throw new BVWalletError('Select who you want to send BV to.');
    if (recipientId === sender.ownerId) throw new BVWalletError('You cannot transfer BV to yourself.');
    if (recipientId === BV_WALLET.ADMIN_OWNER_ID) {
      throw new BVWalletError('To give BV back to the company, use "Return BV" in your BV Wallet.');
    }

    const member = await Member.findOne({ memberId: recipientId });
    if (!member || !isEligibleMember(member)) {
      throw new BVWalletError('Recipient not found or not an active member.', HTTP_STATUS.NOT_FOUND);
    }
    return { ownerType: BV_OWNER_TYPE.MEMBER, ownerId: member.memberId, name: member.name };
  }

  // ---------------------------------------------------------------------------
  // Generation (Super Admin only; authorization is enforced by the route)
  // ---------------------------------------------------------------------------

  static async generate(input: { amount: unknown; title: unknown; note: unknown; actor: BVActor }) {
    const amount = parseAmount(input.amount, BV_WALLET.MAX_GENERATE_BV);
    const title = parseText(input.title, 'Name / title', BV_WALLET.TITLE_MAX_LENGTH, true);
    const note = parseText(input.note, 'Note', BV_WALLET.NOTE_MAX_LENGTH, true);

    await this.ensureWallet(ADMIN_BV_OWNER);
    const transactionId = newTransactionId();

    const result = await runInTransaction(async (session) => {
      const [txn] = await BVTransaction.create(
        [
          {
            transactionId,
            type: BV_TXN_TYPE.GENERATION,
            status: BV_TXN_STATUS.COMPLETED,
            senderType: BV_OWNER_TYPE.ADMIN,
            senderId: BV_WALLET.ADMIN_OWNER_ID,
            senderName: BV_WALLET.ADMIN_DISPLAY_NAME,
            amount,
            title,
            note,
            initiatedBy: input.actor,
          },
        ],
        { session }
      );
      const wallet = await this.moveBalance(session, BV_WALLET.ADMIN_OWNER_ID, BV_LEDGER_ENTRY.GENERATE, txn, amount, {
        totalGenerated: amount,
      });
      if (!wallet) throw new BVWalletError('Super Admin BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      return { transaction: txn, wallet };
    });

    await safeAudit({
      action: 'BV_GENERATED',
      entity: 'BV_WALLET',
      entityId: transactionId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { amount, title, note, availableBV: result.wallet.availableBV },
      reason: note,
      ipAddress: input.actor.ip,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Instant transfers
  // ---------------------------------------------------------------------------

  static async transfer(input: {
    sender: BVOwner;
    recipientId: unknown;
    amount: unknown;
    title: unknown;
    note: unknown;
    requestKey?: unknown;
    confirmRepeat?: unknown;
    actor: BVActor;
  }): Promise<{ transaction: IBVTransaction; senderWallet: IBVWallet | null; duplicate: boolean }> {
    const sender = { ...input.sender, ownerId: input.sender.ownerId.toUpperCase() };
    const isAdminSender = sender.ownerType === BV_OWNER_TYPE.ADMIN;
    const amount = parseAmount(input.amount, isAdminSender ? BV_WALLET.MAX_ADMIN_TRANSFER_BV : BV_WALLET.MAX_MEMBER_TRANSFER_BV);
    const title = parseText(input.title, 'Title', BV_WALLET.TITLE_MAX_LENGTH, true);
    const note = parseText(input.note, 'Note', BV_WALLET.NOTE_MAX_LENGTH, false);
    const requestKey = parseRequestKey(input.requestKey);
    const recipientId = typeof input.recipientId === 'string' ? input.recipientId.trim().toUpperCase() : '';

    const findDuplicate = () =>
      requestKey ? BVTransaction.findOne({ senderId: sender.ownerId, requestKey }) : Promise.resolve(null);
    const existing = await findDuplicate();
    if (existing) return { transaction: existing, senderWallet: await BVWallet.findOne({ ownerId: sender.ownerId }), duplicate: true };

    const recipient = await this.resolveRecipient(recipientId, sender);

    let senderName: string = BV_WALLET.ADMIN_DISPLAY_NAME;
    if (!isAdminSender) {
      const senderMember = await Member.findOne({ memberId: sender.ownerId });
      if (!senderMember || !isEligibleMember(senderMember)) {
        throw new BVWalletError('Your account must be active to send BV.', HTTP_STATUS.FORBIDDEN);
      }
      // KYC requirement disabled during development; re-enable before production
      // if (senderMember.kyc?.status !== 'approved') {
      //   throw new BVWalletError('Your KYC must be approved before you can send BV.', HTTP_STATUS.FORBIDDEN);
      // }
      senderName = senderMember.name;
    }

    // Transfers are final, so an identical send moments after another needs an explicit "send again"
    if (input.confirmRepeat !== true) {
      const recent = await BVTransaction.findOne({
        type: BV_TXN_TYPE.TRANSFER,
        senderId: sender.ownerId,
        recipientId: recipient.ownerId,
        amount,
        createdAt: { $gte: new Date(Date.now() - BV_WALLET.REPEAT_WARNING_WINDOW_MS) },
      }).sort({ createdAt: -1 });
      if (recent) {
        throw new BVWalletError(
          `You already sent ${formatBV(amount)} to ${recipient.name} at ${recent.createdAt.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata',
          })}. Send it again?`,
          HTTP_STATUS.CONFLICT,
          { possibleDuplicate: true, previousTransactionId: recent.transactionId }
        );
      }
    }

    // A Super Admin transfer is a sale at the current BV rate; selling is blocked until a rate is set
    let ratePaise: number | undefined;
    let valuePaise: number | undefined;
    if (isAdminSender) {
      const rate = await CompanyEarningService.requireCurrentRate().catch((error) => {
        throw asWalletError(error);
      });
      ratePaise = rate.ratePaise;
      valuePaise = amount * rate.ratePaise;
    }

    await this.ensureWallet(sender);
    await this.ensureWallet(recipient);
    const transactionId = newTransactionId();

    let result: { transaction: IBVTransaction; senderWallet: IBVWallet };
    try {
      result = await runInTransaction(async (session) => {
        const [txn] = await BVTransaction.create(
          [
            {
              transactionId,
              type: BV_TXN_TYPE.TRANSFER,
              status: BV_TXN_STATUS.COMPLETED,
              senderType: sender.ownerType,
              senderId: sender.ownerId,
              senderName,
              recipientType: recipient.ownerType,
              recipientId: recipient.ownerId,
              recipientName: recipient.name,
              amount,
              title,
              note,
              requestKey,
              ratePaise,
              valuePaise,
              initiatedBy: input.actor,
            },
          ],
          { session }
        );

        // Members can only send regular BV; welcome bonus BV stays with the member
        const senderWallet = await this.moveBalance(
          session,
          sender.ownerId,
          BV_LEDGER_ENTRY.DEBIT_OUT,
          txn,
          -amount,
          isAdminSender ? { totalSent: amount, totalSold: amount } : { totalSent: amount },
          { requireNotFrozen: true, regularOnly: !isAdminSender }
        );
        if (!senderWallet) throw await this.insufficientBalanceError(sender.ownerId, amount, { regularOnly: !isAdminSender });

        const recipientWallet = await this.moveBalance(
          session,
          recipient.ownerId,
          BV_LEDGER_ENTRY.CREDIT_IN,
          txn,
          amount,
          isAdminSender
            ? { totalReceived: amount, purchasedBV: amount, purchasedPaise: valuePaise! }
            : { totalReceived: amount }
        );
        if (!recipientWallet) throw new BVWalletError('Recipient BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);

        if (isAdminSender) {
          await CompanyEarningService.record(session, {
            type: COMPANY_EARNING_TYPE.BV_SALE,
            sourceId: transactionId,
            memberId: recipient.ownerId,
            memberName: recipient.name,
            bv: amount,
            ratePaise,
            amountPaise: valuePaise!,
            note: [title, note].filter(Boolean).join(' · '),
            performedBy: { email: input.actor.email, operatorName: input.actor.operatorName },
          });
        }

        await this.notify(session, {
          type: 'BV_RECEIVED',
          title: 'BV Received',
          message: `${senderName} (${sender.ownerId}) sent you ${formatBV(amount)} ("${title}"). It is now in your BV Wallet.`,
          recipientId: recipient.ownerId,
          txn,
        });
        return { transaction: txn, senderWallet };
      });
    } catch (error: any) {
      // Two identical requests raced: the loser returns the winner's transfer
      if (error?.code === 11000 && requestKey && error?.keyPattern?.requestKey) {
        const duplicate = await findDuplicate();
        if (duplicate) return { transaction: duplicate, senderWallet: await BVWallet.findOne({ ownerId: sender.ownerId }), duplicate: true };
      }
      throw error;
    }

    if (recipient.ownerType === BV_OWNER_TYPE.MEMBER) await this.activateFromWalletIfEligible(recipient.ownerId);

    await safeAudit({
      action: 'BV_TRANSFERRED',
      entity: 'BV_WALLET',
      entityId: transactionId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { senderId: sender.ownerId, recipientId: recipient.ownerId, amount, title, note, ratePaise, valuePaise },
      ipAddress: input.actor.ip,
    });

    return { ...result, duplicate: false };
  }

  /**
   * Super Admin correction: moves a completed transfer's BV back from the recipient to the sender.
   * Writes a new REVERSAL transaction; the original keeps its amounts and is marked REVERSED.
   * Only possible while the recipient still has the BV as regular BV, and only once per transfer.
   * Reversing a Super Admin sale also takes its amount back out of earnings; that needs the member
   * not to have returned (or asked to return) the BV it bought.
   */
  static async reverseTransfer(input: { transactionId: unknown; reason: unknown; actor: BVActor }) {
    const transactionId = parseTransactionId(input.transactionId);
    const reason = parseText(input.reason, 'Reason', BV_WALLET.NOTE_MAX_LENGTH, true);

    const original = await BVTransaction.findOne({ transactionId });
    if (!original) throw new BVWalletError('Transaction not found.', HTTP_STATUS.NOT_FOUND);
    if (original.type !== BV_TXN_TYPE.TRANSFER) throw new BVWalletError('Only transfers can be reversed.');
    if (original.status === BV_TXN_STATUS.REVERSED) {
      throw new BVWalletError(`This transfer was already reversed (${original.reversedBy}).`, HTTP_STATUS.CONFLICT);
    }

    const reversalId = newTransactionId();
    const result = await runInTransaction(async (session) => {
      const now = new Date();
      const claimed = await BVTransaction.findOneAndUpdate(
        { transactionId, type: BV_TXN_TYPE.TRANSFER, status: BV_TXN_STATUS.COMPLETED },
        { $set: { status: BV_TXN_STATUS.REVERSED, reversedBy: reversalId, reversedAt: now, reversalReason: reason } },
        { session, returnDocument: 'after' }
      );
      if (!claimed) throw new BVWalletError('This transfer was already reversed.', HTTP_STATUS.CONFLICT);
      const isSale = claimed.senderType === BV_OWNER_TYPE.ADMIN && typeof claimed.valuePaise === 'number';
      const saleValuePaise = isSale ? claimed.valuePaise! : 0;

      const [reversal] = await BVTransaction.create(
        [
          {
            transactionId: reversalId,
            type: BV_TXN_TYPE.REVERSAL,
            status: BV_TXN_STATUS.COMPLETED,
            senderType: claimed.recipientType || BV_OWNER_TYPE.MEMBER,
            senderId: claimed.recipientId,
            senderName: claimed.recipientName,
            recipientType: claimed.senderType,
            recipientId: claimed.senderId,
            recipientName: claimed.senderName,
            amount: claimed.amount,
            title: `Reversal of ${claimed.transactionId}`,
            note: reason,
            reversalOf: claimed.transactionId,
            ratePaise: claimed.ratePaise,
            valuePaise: claimed.valuePaise,
            initiatedBy: input.actor,
          },
        ],
        { session }
      );

      // Undo the original totals rather than inflating "sent"/"received" with the correction
      const debited = await this.moveBalance(
        session,
        claimed.recipientId,
        BV_LEDGER_ENTRY.DEBIT_OUT,
        reversal,
        -claimed.amount,
        isSale
          ? { totalReceived: -claimed.amount, purchasedBV: -claimed.amount, purchasedPaise: -saleValuePaise }
          : { totalReceived: -claimed.amount },
        { regularOnly: true, guards: isSale ? [purchasedCapacityGuard(claimed.amount)] : [] }
      );
      if (!debited) {
        const wallet = await BVWallet.findOne({ ownerId: claimed.recipientId });
        const regular = wallet ? regularBVOf(wallet) : 0;
        if (wallet && isSale && regular >= claimed.amount) {
          throw new BVWalletError(
            `${claimed.recipientName} has already returned (or asked to return) part of the BV it bought, so ${formatBV(claimed.amount)} cannot be reversed.`,
            HTTP_STATUS.BAD_REQUEST
          );
        }
        throw new BVWalletError(
          `${claimed.recipientName} only has ${formatBV(regular)} of transferable BV, so ${formatBV(claimed.amount)} cannot be reversed.`,
          HTTP_STATUS.BAD_REQUEST,
          { availableBV: wallet?.availableBV || 0, regularBV: regular }
        );
      }
      const credited = await this.moveBalance(
        session,
        claimed.senderId,
        BV_LEDGER_ENTRY.CREDIT_IN,
        reversal,
        claimed.amount,
        isSale ? { totalSent: -claimed.amount, totalSold: -claimed.amount } : { totalSent: -claimed.amount }
      );
      if (!credited) throw new BVWalletError('Sender BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);

      if (isSale) {
        const sale = await CompanyEarning.findOne({ type: COMPANY_EARNING_TYPE.BV_SALE, sourceId: claimed.transactionId }).session(session);
        await CompanyEarningService.record(session, {
          type: COMPANY_EARNING_TYPE.BV_SALE_REVERSED,
          sourceId: claimed.transactionId,
          memberId: claimed.recipientId,
          memberName: claimed.recipientName,
          bv: claimed.amount,
          ratePaise: claimed.ratePaise,
          amountPaise: -(sale?.amountPaise ?? saleValuePaise),
          note: reason,
          relatedEntryId: sale?.entryId,
          performedBy: { email: input.actor.email, operatorName: input.actor.operatorName },
        });
      }

      const amountText = `${formatBV(claimed.amount)} ("${claimed.title}", ${claimed.transactionId})`;
      if (claimed.recipientId !== BV_WALLET.ADMIN_OWNER_ID) {
        await this.notify(session, {
          type: 'BV_TRANSFER_REVERSED',
          title: 'BV Transfer Reversed',
          message: `The Super Admin reversed ${amountText} you received from ${claimed.senderName} (${claimed.senderId}). Reason: ${reason}`,
          recipientId: claimed.recipientId,
          txn: reversal,
        });
      }
      if (claimed.senderId !== BV_WALLET.ADMIN_OWNER_ID) {
        await this.notify(session, {
          type: 'BV_TRANSFER_REVERSED',
          title: 'BV Transfer Reversed',
          message: `The Super Admin reversed your transfer of ${amountText} to ${claimed.recipientName} (${claimed.recipientId}). The BV is back in your wallet. Reason: ${reason}`,
          recipientId: claimed.senderId,
          txn: reversal,
        });
      }
      return { original: claimed, reversal };
    });

    if (result.original.senderType === BV_OWNER_TYPE.MEMBER) await this.activateFromWalletIfEligible(result.original.senderId);

    await safeAudit({
      action: 'BV_TRANSFER_REVERSED',
      entity: 'BV_WALLET',
      entityId: transactionId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { reversalId, amount: result.original.amount, from: result.original.recipientId, to: result.original.senderId },
      reason,
      ipAddress: input.actor.ip,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Returns to the company (member request, Super Admin approval)
  // ---------------------------------------------------------------------------

  static returnToPublic(request: IBVReturnRequest, options: { includeAudit?: boolean } = {}) {
    return {
      requestId: request.requestId,
      memberId: request.memberId,
      memberName: request.memberName,
      amount: request.amount,
      value: DecimalUtil.fromPaise(request.valuePaise),
      valuePerBV: request.amount > 0 ? DecimalUtil.round(request.valuePaise / request.amount / 100, 4) : 0,
      status: request.status,
      note: request.note,
      decisionReason: request.decisionReason || '',
      decidedAt: request.decidedAt,
      createdAt: request.createdAt,
      ...(options.includeAudit ? { decidedBy: request.decidedBy, holdTransactionId: request.holdTransactionId, settleTransactionId: request.settleTransactionId } : {}),
    };
  }

  /**
   * A member asks to return BV it bought from the Super Admin. The BV is held from its wallet at
   * once (so it can't be spent or sent meanwhile) and valued at its average purchase price. Only
   * regular BV, up to what it bought and has not already returned, can be returned.
   */
  static async requestReturn(input: { memberId: string; amount: unknown; note: unknown; requestKey?: unknown; actor: BVActor }) {
    const memberId = input.memberId.toUpperCase();
    const amount = parseAmount(input.amount, BV_WALLET.MAX_ADMIN_TRANSFER_BV);
    const note = parseText(input.note, 'Note', BV_WALLET.NOTE_MAX_LENGTH, false);
    const requestKey = parseRequestKey(input.requestKey);

    const member = await Member.findOne({ memberId });
    if (!member || !isEligibleMember(member)) {
      throw new BVWalletError('Your account must be active to return BV.', HTTP_STATUS.FORBIDDEN);
    }

    const findDuplicate = () => (requestKey ? BVReturnRequest.findOne({ memberId, requestKey }) : Promise.resolve(null));
    const existing = await findDuplicate();
    if (existing) return { request: existing, duplicate: true };

    await this.ensureWallet({ ownerType: BV_OWNER_TYPE.MEMBER, ownerId: memberId });
    const requestId = newReturnRequestId();
    const holdTransactionId = newTransactionId();

    let request: IBVReturnRequest;
    try {
      request = await runInTransaction(async (session) => {
        const wallet = await BVWallet.findOne({ ownerId: memberId }).session(session);
        if (!wallet) throw new BVWalletError('BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        if (wallet.isFrozen) {
          throw new BVWalletError(`This BV wallet is frozen${wallet.frozenReason ? `: ${wallet.frozenReason}` : ''}. Contact support.`, HTTP_STATUS.FORBIDDEN);
        }

        const capacity = returnCapacity(wallet);
        if (amount > capacity.returnableBV) {
          throw new BVWalletError(
            capacity.returnableBV > 0
              ? `You can return up to ${formatBV(capacity.returnableBV)}. Only BV you bought from the company and still hold can be returned; welcome bonus BV and BV received from other members cannot.`
              : 'You have no BV to return. Only BV you bought from the company and still hold can be returned; welcome bonus BV and BV received from other members cannot.',
            HTTP_STATUS.BAD_REQUEST,
            { returnableBV: capacity.returnableBV }
          );
        }
        const valuePaise = returnValuePaise(amount, capacity.remainingBV, capacity.remainingPaise);

        const [txn] = await BVTransaction.create(
          [
            {
              transactionId: holdTransactionId,
              type: BV_TXN_TYPE.RETURN_REQUESTED,
              status: BV_TXN_STATUS.COMPLETED,
              senderType: BV_OWNER_TYPE.MEMBER,
              senderId: memberId,
              senderName: member.name,
              recipientType: BV_OWNER_TYPE.SYSTEM,
              recipientId: BV_WALLET.SYSTEM_OWNER_ID,
              recipientName: 'Return to company (awaiting approval)',
              amount,
              title: `Return request ${requestId}`,
              note,
              returnRequestId: requestId,
              ratePaise: Math.round(valuePaise / amount),
              valuePaise,
              initiatedBy: input.actor,
            },
          ],
          { session }
        );

        const debited = await this.moveBalance(
          session,
          memberId,
          BV_LEDGER_ENTRY.DEBIT_OUT,
          txn,
          -amount,
          { pendingReturnBV: amount, pendingReturnPaise: valuePaise },
          { requireNotFrozen: true, regularOnly: true, guards: [purchasedCapacityGuard(amount)] }
        );
        if (!debited) throw new BVWalletError('Your BV balance changed. Please check your returnable BV and try again.', HTTP_STATUS.CONFLICT);

        const [created] = await BVReturnRequest.create(
          [
            {
              requestId,
              memberId,
              memberName: member.name,
              amount,
              valuePaise,
              status: BV_RETURN_STATUS.PENDING,
              note,
              requestKey,
              holdTransactionId,
            },
          ],
          { session }
        );

        await this.notify(session, {
          type: 'BV_RETURN_REQUESTED',
          title: 'BV Return Requested',
          message: `${member.name} (${memberId}) asked to return ${formatBV(amount)} to the company (refund value ${formatRupees(valuePaise)}). Request ${requestId}.`,
          recipientId: BV_WALLET.ADMIN_OWNER_ID,
          txn,
        });
        return created;
      });
    } catch (error: any) {
      // Two identical submits raced: the loser returns the winner's request
      if (error?.code === 11000 && requestKey && error?.keyPattern?.requestKey) {
        const duplicate = await findDuplicate();
        if (duplicate) return { request: duplicate, duplicate: true };
      }
      throw error;
    }

    await safeAudit({
      action: 'BV_RETURN_REQUESTED',
      entity: 'BV_WALLET',
      entityId: requestId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { memberId, amount, valuePaise: request.valuePaise, holdTransactionId },
      ipAddress: input.actor.ip,
    });

    return { request, duplicate: false };
  }

  /**
   * Super Admin approves a return after refunding the member outside the app: the held BV goes to
   * the Super Admin wallet and its value is deducted from Super Admin earnings.
   */
  static async approveReturn(input: { requestId: unknown; actor: BVActor }) {
    const requestId = typeof input.requestId === 'string' ? input.requestId.trim().toUpperCase() : '';
    if (!requestId) throw new BVWalletError('Return request not found.', HTTP_STATUS.NOT_FOUND);
    const settleTransactionId = newTransactionId();

    const result = await runInTransaction(async (session) => {
      const request = await BVReturnRequest.findOneAndUpdate(
        { requestId, status: BV_RETURN_STATUS.PENDING },
        {
          $set: {
            status: BV_RETURN_STATUS.APPROVED,
            settleTransactionId,
            decidedBy: { role: input.actor.role, email: input.actor.email, operatorName: input.actor.operatorName },
            decidedAt: new Date(),
          },
        },
        { session, returnDocument: 'after' }
      );
      if (!request) throw await this.returnNotPendingError(requestId);

      const [txn] = await BVTransaction.create(
        [
          {
            transactionId: settleTransactionId,
            type: BV_TXN_TYPE.RETURN_APPROVED,
            status: BV_TXN_STATUS.COMPLETED,
            senderType: BV_OWNER_TYPE.SYSTEM,
            senderId: BV_WALLET.SYSTEM_OWNER_ID,
            senderName: `Return from ${request.memberName} (${request.memberId})`,
            recipientType: BV_OWNER_TYPE.ADMIN,
            recipientId: BV_WALLET.ADMIN_OWNER_ID,
            recipientName: BV_WALLET.ADMIN_DISPLAY_NAME,
            amount: request.amount,
            title: `Return ${requestId} approved`,
            note: request.note,
            returnRequestId: requestId,
            ratePaise: Math.round(request.valuePaise / request.amount),
            valuePaise: request.valuePaise,
            initiatedBy: input.actor,
          },
        ],
        { session }
      );

      const credited = await this.moveBalance(session, BV_WALLET.ADMIN_OWNER_ID, BV_LEDGER_ENTRY.CREDIT_IN, txn, request.amount, {
        totalReceived: request.amount,
      });
      if (!credited) throw new BVWalletError('Super Admin BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);

      // The held BV is now returned: move it from pending to returned on the member's wallet
      const settled = await BVWallet.updateOne(
        { ownerId: request.memberId, pendingReturnBV: { $gte: request.amount } },
        {
          $inc: {
            pendingReturnBV: -request.amount,
            pendingReturnPaise: -request.valuePaise,
            returnedBV: request.amount,
            returnedPaise: request.valuePaise,
          },
        },
        { session }
      );
      if (!settled.modifiedCount) throw new BVWalletError(`BV wallet for ${request.memberId} has no pending return to settle.`, HTTP_STATUS.CONFLICT);

      await CompanyEarningService.record(session, {
        type: COMPANY_EARNING_TYPE.BV_RETURNED,
        sourceId: requestId,
        memberId: request.memberId,
        memberName: request.memberName,
        bv: request.amount,
        ratePaise: Math.round(request.valuePaise / request.amount),
        amountPaise: -request.valuePaise,
        note: request.note,
        performedBy: { email: input.actor.email, operatorName: input.actor.operatorName },
      });

      await this.notify(session, {
        type: 'BV_RETURN_APPROVED',
        title: 'BV Return Approved',
        message: `Your return of ${formatBV(request.amount)} (${requestId}) was approved. Refund value: ${formatRupees(request.valuePaise)}.`,
        recipientId: request.memberId,
        txn,
      });
      return request;
    });

    await safeAudit({
      action: 'BV_RETURN_APPROVED',
      entity: 'BV_WALLET',
      entityId: requestId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { memberId: result.memberId, amount: result.amount, valuePaise: result.valuePaise, settleTransactionId },
      ipAddress: input.actor.ip,
    });
    return result;
  }

  /** Super Admin rejects a return: the held BV goes back to the member. */
  static async rejectReturn(input: { requestId: unknown; reason: unknown; actor: BVActor }) {
    const reason = parseText(input.reason, 'Reason', BV_WALLET.NOTE_MAX_LENGTH, true);
    return this.releaseReturn({ requestId: input.requestId, status: BV_RETURN_STATUS.REJECTED, reason, actor: input.actor });
  }

  /** The member withdraws its own pending return: the held BV goes back. */
  static async cancelReturn(input: { requestId: unknown; memberId: string; actor: BVActor }) {
    return this.releaseReturn({
      requestId: input.requestId,
      status: BV_RETURN_STATUS.CANCELLED,
      reason: 'Cancelled by the member',
      actor: input.actor,
      memberId: input.memberId.toUpperCase(),
    });
  }

  private static async returnNotPendingError(requestId: string, memberId?: string) {
    const current = await BVReturnRequest.findOne(memberId ? { requestId, memberId } : { requestId });
    if (!current) return new BVWalletError('Return request not found.', HTTP_STATUS.NOT_FOUND);
    return new BVWalletError(`This return request is already ${current.status.toLowerCase()}.`, HTTP_STATUS.CONFLICT);
  }

  private static async releaseReturn(input: {
    requestId: unknown;
    status: typeof BV_RETURN_STATUS.REJECTED | typeof BV_RETURN_STATUS.CANCELLED;
    reason: string;
    actor: BVActor;
    memberId?: string;
  }) {
    const requestId = typeof input.requestId === 'string' ? input.requestId.trim().toUpperCase() : '';
    if (!requestId) throw new BVWalletError('Return request not found.', HTTP_STATUS.NOT_FOUND);
    const settleTransactionId = newTransactionId();
    const rejected = input.status === BV_RETURN_STATUS.REJECTED;

    const result = await runInTransaction(async (session) => {
      const request = await BVReturnRequest.findOneAndUpdate(
        { requestId, status: BV_RETURN_STATUS.PENDING, ...(input.memberId ? { memberId: input.memberId } : {}) },
        {
          $set: {
            status: input.status,
            settleTransactionId,
            decisionReason: input.reason,
            decidedBy: { role: input.actor.role, email: input.actor.email, operatorName: input.actor.operatorName },
            decidedAt: new Date(),
          },
        },
        { session, returnDocument: 'after' }
      );
      if (!request) throw await this.returnNotPendingError(requestId, input.memberId);

      const [txn] = await BVTransaction.create(
        [
          {
            transactionId: settleTransactionId,
            type: BV_TXN_TYPE.RETURN_RELEASED,
            status: BV_TXN_STATUS.COMPLETED,
            senderType: BV_OWNER_TYPE.SYSTEM,
            senderId: BV_WALLET.SYSTEM_OWNER_ID,
            senderName: rejected ? 'Return rejected' : 'Return cancelled',
            recipientType: BV_OWNER_TYPE.MEMBER,
            recipientId: request.memberId,
            recipientName: request.memberName,
            amount: request.amount,
            title: `Return ${requestId} ${rejected ? 'rejected' : 'cancelled'}`,
            note: input.reason,
            returnRequestId: requestId,
            initiatedBy: input.actor,
          },
        ],
        { session }
      );

      const credited = await this.moveBalance(session, request.memberId, BV_LEDGER_ENTRY.CREDIT_IN, txn, request.amount, {
        pendingReturnBV: -request.amount,
        pendingReturnPaise: -request.valuePaise,
      });
      if (!credited) throw new BVWalletError(`BV wallet for ${request.memberId} not found.`, HTTP_STATUS.INTERNAL_SERVER_ERROR);

      if (rejected) {
        await this.notify(session, {
          type: 'BV_RETURN_REJECTED',
          title: 'BV Return Rejected',
          message: `Your return of ${formatBV(request.amount)} (${requestId}) was rejected and the BV is back in your wallet. Reason: ${input.reason}`,
          recipientId: request.memberId,
          txn,
        });
      }
      return request;
    });

    await this.activateFromWalletIfEligible(result.memberId);
    await safeAudit({
      action: rejected ? 'BV_RETURN_REJECTED' : 'BV_RETURN_CANCELLED',
      entity: 'BV_WALLET',
      entityId: requestId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { memberId: result.memberId, amount: result.amount, settleTransactionId },
      reason: input.reason,
      ipAddress: input.actor.ip,
    });
    return result;
  }

  static async listReturnRequests(params: { memberId?: string; status?: unknown; search?: unknown; page?: unknown; limit?: unknown; includeAudit?: boolean }) {
    const conditions: Record<string, unknown>[] = [];
    if (params.memberId) conditions.push({ memberId: params.memberId.toUpperCase() });
    const status = typeof params.status === 'string' ? params.status.toUpperCase() : '';
    if (Object.values(BV_RETURN_STATUS).includes(status as any)) conditions.push({ status });
    const search = typeof params.search === 'string' ? params.search.trim().slice(0, 100) : '';
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: 'i' };
      conditions.push({ $or: [{ requestId: regex }, { memberId: regex }, { memberName: regex }] });
    }

    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));
    const filter = conditions.length ? { $and: conditions } : {};

    const [items, total] = await Promise.all([
      BVReturnRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      BVReturnRequest.countDocuments(filter),
    ]);
    return {
      items: items.map((r) => this.returnToPublic(r, { includeAudit: params.includeAudit })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---------------------------------------------------------------------------
  // Welcome bonus (called by WelcomeBonusService inside its settlement transaction)
  // ---------------------------------------------------------------------------

  static async creditWelcomeBonus(
    session: ClientSession,
    input: { memberId: string; memberName: string; settlementId: string; amount: number }
  ): Promise<IBVTransaction> {
    const memberId = input.memberId.toUpperCase();
    const [txn] = await BVTransaction.create(
      [
        {
          transactionId: newTransactionId(),
          type: BV_TXN_TYPE.WELCOME_BONUS,
          status: BV_TXN_STATUS.COMPLETED,
          senderType: BV_OWNER_TYPE.SYSTEM,
          senderId: BV_WALLET.SYSTEM_OWNER_ID,
          senderName: 'Welcome Bonus',
          recipientType: BV_OWNER_TYPE.MEMBER,
          recipientId: memberId,
          recipientName: input.memberName,
          amount: input.amount,
          bonusAmount: input.amount,
          title: `Welcome bonus (${input.settlementId})`,
          note: 'Weekly welcome bonus share',
          settlementId: input.settlementId,
          initiatedBy: { role: 'system', email: 'SYSTEM' },
        },
      ],
      { session }
    );
    // Welcome bonus BV is kept apart: it pays for the member's own orders but can't be sent or returned
    const wallet = await this.moveBalance(session, memberId, BV_LEDGER_ENTRY.CREDIT_IN, txn, input.amount, {
      totalWelcomeBonus: input.amount,
      bonusBV: input.amount,
    });
    if (!wallet) throw new BVWalletError(`BV wallet for ${memberId} not found.`, HTTP_STATUS.INTERNAL_SERVER_ERROR);

    await this.notify(session, {
      type: 'BV_WELCOME_BONUS',
      title: 'Welcome Bonus Credited',
      message: `${formatBV(input.amount)} welcome bonus (${input.settlementId}) was added to your BV Wallet. It can be used for your own product and package orders.`,
      recipientId: memberId,
      txn,
    });
    return txn;
  }

  // ---------------------------------------------------------------------------
  // Orders paid with BV
  // ---------------------------------------------------------------------------

  /**
   * Creates an order paid from the member's BV Wallet. The BV is debited and the order is created in
   * one transaction; the order then waits for Super Admin approval (PAYMENT_SUBMITTED stage).
   */
  static async createPurchaseWithBV(input: {
    purchase: Record<string, unknown> & { totalBV: number; purchaseId: string };
    memberId: string;
    memberName: string;
    requestKey?: unknown;
    actor: BVActor;
  }): Promise<{ purchase: IPurchase; duplicate: boolean }> {
    const memberId = input.memberId.toUpperCase();
    const requestKey = parseRequestKey(input.requestKey);

    const findDuplicate = () => (requestKey ? Purchase.findOne({ memberId, requestKey }) : Promise.resolve(null));
    const existing = await findDuplicate();
    if (existing) return { purchase: existing, duplicate: true };

    // Paid with the order's own BV value; rupee prices play no part
    const bvAmount = Number(input.purchase.totalBV) || 0;
    if (!Number.isInteger(bvAmount) || bvAmount < 1) {
      throw new BVWalletError('This order has no BV value, so it cannot be paid with BV. Please pay by bank / UPI.');
    }

    await this.ensureWallet({ ownerType: BV_OWNER_TYPE.MEMBER, ownerId: memberId });
    const bvTransactionId = newTransactionId();

    let purchase: IPurchase;
    try {
      purchase = await runInTransaction(async (session) => {
        const [order] = await Purchase.create(
          [
            {
              ...input.purchase,
              paymentMethod: 'BV_WALLET',
              paymentMode: 'BV_WALLET',
              paymentStatus: 'SUBMITTED',
              approvalStage: 'PAYMENT_SUBMITTED',
              paymentSubmittedAt: new Date(),
              payerName: input.memberName,
              utrNumber: bvTransactionId,
              bvAmount,
              bvTransactionId,
              requestKey,
            },
          ],
          { session }
        );

        // Welcome bonus BV is spent first: it can't be used any other way
        const current = await BVWallet.findOne({ ownerId: memberId }).session(session);
        const bonusUsed = Math.min(current?.bonusBV || 0, bvAmount);

        const [txn] = await BVTransaction.create(
          [
            {
              transactionId: bvTransactionId,
              type: BV_TXN_TYPE.PURCHASE,
              status: BV_TXN_STATUS.COMPLETED,
              senderType: BV_OWNER_TYPE.MEMBER,
              senderId: memberId,
              senderName: input.memberName,
              recipientType: BV_OWNER_TYPE.SYSTEM,
              recipientId: BV_WALLET.SYSTEM_OWNER_ID,
              recipientName: 'Company order',
              amount: bvAmount,
              bonusAmount: bonusUsed,
              title: `Order ${order.purchaseId}`,
              note: order.items.map((i) => `${i.quantity} x ${i.name}`).join(', ').slice(0, BV_WALLET.NOTE_MAX_LENGTH),
              purchaseId: order.purchaseId,
              initiatedBy: input.actor,
            },
          ],
          { session }
        );

        const wallet = await this.moveBalance(
          session,
          memberId,
          BV_LEDGER_ENTRY.DEBIT_OUT,
          txn,
          -bvAmount,
          { totalSpent: bvAmount, bonusBV: -bonusUsed },
          { requireNotFrozen: true }
        );
        if (!wallet) throw await this.insufficientBalanceError(memberId, bvAmount);
        return order;
      });
    } catch (error: any) {
      if (error?.code === 11000 && requestKey && error?.keyPattern?.requestKey) {
        const duplicate = await findDuplicate();
        if (duplicate) return { purchase: duplicate, duplicate: true };
      }
      throw error;
    }

    await safeAudit({
      action: 'BV_PURCHASE_PAID',
      entity: 'BV_WALLET',
      entityId: bvTransactionId,
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      newValues: { memberId, purchaseId: purchase.purchaseId, bvAmount, totalAmount: purchase.totalAmount },
      ipAddress: input.actor.ip,
    });

    return { purchase, duplicate: false };
  }

  /**
   * Returns the BV of a BV-paid order to the member (order rejected or refunded). Runs inside the
   * caller's transaction so the order's status change and the refund commit together. Idempotent.
   */
  static async refundPurchaseInSession(session: ClientSession, purchase: IPurchase, reason: string): Promise<IBVTransaction | null> {
    if (purchase.paymentMethod !== 'BV_WALLET') return null;

    const existing = await BVTransaction.findOne({ type: BV_TXN_TYPE.PURCHASE_REFUND, purchaseId: purchase.purchaseId }).session(session);
    if (existing) return existing;
    const paid = await BVTransaction.findOne({ type: BV_TXN_TYPE.PURCHASE, purchaseId: purchase.purchaseId }).session(session);
    if (!paid) return null;
    // Back to the parts it was paid from, so a refund can't turn welcome bonus BV into regular BV
    const bonusRefund = paid.bonusAmount || 0;

    const [txn] = await BVTransaction.create(
      [
        {
          transactionId: newTransactionId(),
          type: BV_TXN_TYPE.PURCHASE_REFUND,
          status: BV_TXN_STATUS.COMPLETED,
          senderType: BV_OWNER_TYPE.SYSTEM,
          senderId: BV_WALLET.SYSTEM_OWNER_ID,
          senderName: 'Company order',
          recipientType: BV_OWNER_TYPE.MEMBER,
          recipientId: paid.senderId,
          recipientName: paid.senderName,
          amount: paid.amount,
          bonusAmount: bonusRefund,
          title: `Refund for order ${purchase.purchaseId}`,
          note: reason.slice(0, BV_WALLET.NOTE_MAX_LENGTH),
          purchaseId: purchase.purchaseId,
          initiatedBy: { role: 'system', email: 'SYSTEM' },
        },
      ],
      { session }
    );

    const wallet = await this.moveBalance(session, paid.senderId, BV_LEDGER_ENTRY.CREDIT_IN, txn, paid.amount, {
      totalSpent: -paid.amount,
      bonusBV: bonusRefund,
    });
    if (!wallet) throw new BVWalletError(`BV wallet for ${paid.senderId} not found.`, HTTP_STATUS.INTERNAL_SERVER_ERROR);

    await Purchase.updateOne({ purchaseId: purchase.purchaseId }, { $set: { bvRefundTransactionId: txn.transactionId } }, { session });
    await this.notify(session, {
      type: 'BV_PURCHASE_REFUND',
      title: 'BV Refunded',
      message: `${formatBV(paid.amount)} for order ${purchase.purchaseId} was returned to your BV Wallet. Reason: ${reason}`,
      recipientId: paid.senderId,
      txn,
    });
    return txn;
  }

  // ---------------------------------------------------------------------------
  // Binary activation from the wallet balance
  // ---------------------------------------------------------------------------

  /**
   * Binary activation and the 100 BV lock.
   *
   * Once a member's personal BV plus BV Wallet balance reaches BV_WALLET.ACTIVATION_BV (100), binary
   * participation is activated and 100 BV is locked for it, exactly once:
   *  - taken from personal BV first (BV from approved orders, already credited to the upline legs);
   *  - any shortfall is debited from the BV Wallet and credited to every upline leg as ACTIVATION
   *    volume, so it is used in binary matching like any other team BV.
   * The locked BV is deducted from the member's Total BV and can never be transferred or spent.
   * Activation is permanent. Best effort: called after BV changes commit, never fails the caller.
   */
  static async activateFromWalletIfEligible(memberId: string): Promise<boolean> {
    try {
      const id = memberId.toUpperCase();
      const member = await Member.findOne({ memberId: id });
      if (!member) return false;

      // Already locked: only finish feeding the wallet part into the tree if an earlier attempt stopped
      if ((member.activationLockedBV || 0) >= BV_WALLET.ACTIVATION_BV) {
        if (!member.activationBvDistributed && (member.activationLockFromWalletBV || 0) > 0) {
          await this.distributeActivationBV(id);
        }
        return false;
      }

      const wallet = await BVWallet.findOne({ ownerId: id });
      const walletBV = wallet && !wallet.isFrozen ? wallet.availableBV : 0;
      const personalBV = member.personalBv || 0;
      if (personalBV + walletBV < BV_WALLET.ACTIVATION_BV) return false;

      const fromPersonal = Math.min(personalBV, BV_WALLET.ACTIVATION_BV);
      const fromWallet = BV_WALLET.ACTIVATION_BV - fromPersonal;
      const transactionId = fromWallet > 0 ? newTransactionId() : undefined;

      const locked = await runInTransaction(async (session) => {
        const claim = await Member.updateOne(
          { memberId: id, $or: [{ activationLockedBV: { $exists: false } }, { activationLockedBV: { $lt: BV_WALLET.ACTIVATION_BV } }] },
          {
            $set: {
              isBinaryActive: true,
              binaryActivatedAt: member.binaryActivatedAt || new Date(),
              activationSource: member.activationSource || (fromWallet > 0 ? 'BV_WALLET' : 'PERSONAL_BV'),
              activationLockedBV: BV_WALLET.ACTIVATION_BV,
              activationLockFromPersonalBV: fromPersonal,
              activationLockFromWalletBV: fromWallet,
              activationLockTransactionId: transactionId,
              activationLockedAt: new Date(),
              activationBvDistributed: fromWallet === 0,
            },
          },
          { session }
        );
        if (!claim.modifiedCount) return false;
        if (fromWallet === 0) return true;

        // Welcome bonus BV is locked first, the same order as paying for an order
        const current = await BVWallet.findOne({ ownerId: id }).session(session);
        const bonusUsed = Math.min(current?.bonusBV || 0, fromWallet);

        const [txn] = await BVTransaction.create(
          [
            {
              transactionId,
              type: BV_TXN_TYPE.BINARY_ACTIVATION,
              status: BV_TXN_STATUS.COMPLETED,
              senderType: BV_OWNER_TYPE.MEMBER,
              senderId: id,
              senderName: member.name,
              recipientType: BV_OWNER_TYPE.SYSTEM,
              recipientId: BV_WALLET.SYSTEM_OWNER_ID,
              recipientName: 'Binary activation',
              amount: fromWallet,
              bonusAmount: bonusUsed,
              title: 'Binary activation lock',
              note: `${formatBV(fromWallet)} locked from the BV Wallet to activate binary income${fromPersonal > 0 ? ` (plus ${formatBV(fromPersonal)} of personal BV)` : ''}.`,
              initiatedBy: { role: 'system', email: 'SYSTEM' },
            },
          ],
          { session }
        );
        const debited = await this.moveBalance(
          session,
          id,
          BV_LEDGER_ENTRY.DEBIT_OUT,
          txn,
          -fromWallet,
          { totalActivationLocked: fromWallet, bonusBV: -bonusUsed },
          { requireNotFrozen: true }
        );
        if (!debited) throw await this.insufficientBalanceError(id, fromWallet);
        await this.notify(session, {
          type: 'BV_BINARY_ACTIVATION',
          title: 'Binary Income Activated',
          message: `${formatBV(BV_WALLET.ACTIVATION_BV)} is locked to activate your binary income. ${formatBV(fromWallet)} was taken from your BV Wallet and added to your upline team volume.`,
          recipientId: id,
          txn,
        });
        return true;
      });
      if (!locked) return false;

      // The lock is committed; placement and feeding the tree are retried on the next check if they fail
      try {
        if (!member.parentId && member.sponsorId) {
          await BinaryTreeService.placeMemberInBinaryTree(id);
        }
        if (fromWallet > 0) await this.distributeActivationBV(id);
      } catch (error) {
        console.error(`[BVWalletService] Activation BV for ${id} is locked but not yet in the binary tree:`, error);
      }

      await safeAudit({
        action: 'BINARY_ACTIVATION_BV_LOCKED',
        entity: 'BV_WALLET',
        entityId: walletIdFor(id),
        performedBy: 'SYSTEM',
        performedByRole: 'system',
        newValues: { memberId: id, lockedBV: BV_WALLET.ACTIVATION_BV, fromPersonal, fromWallet, transactionId },
      });
      return true;
    } catch (error) {
      console.error(`[BVWalletService] Binary activation lock failed for ${memberId}:`, error);
      return false;
    }
  }

  /** Credits the wallet part of the activation lock to the upline legs, once. */
  private static async distributeActivationBV(memberId: string): Promise<void> {
    const member = await Member.findOne({ memberId });
    const amount = member?.activationLockFromWalletBV || 0;
    const reference = member?.activationLockTransactionId;
    if (!member || amount <= 0 || !reference || member.activationBvDistributed) return;
    // Needs a tree position to have uplines; retried on the next activation check
    if (!member.parentId) return;

    const alreadyCredited = await BVLedger.exists({ referenceId: reference, sourceType: BV_SOURCE_TYPE.ACTIVATION });
    if (!alreadyCredited) {
      await BVService.distributeVolumeToAncestors(memberId, amount, BV_SOURCE_TYPE.ACTIVATION, reference);
    }
    await Member.updateOne({ memberId }, { $set: { activationBvDistributed: true } });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  static toPublic(txn: IBVTransaction, options: { viewerId?: string; includeAudit?: boolean } = {}) {
    const viewerId = options.viewerId?.toUpperCase();
    let direction: 'GENERATED' | 'SENT' | 'RECEIVED' | undefined;
    if (viewerId) {
      if (txn.type === BV_TXN_TYPE.GENERATION) direction = 'GENERATED';
      else direction = txn.senderId === viewerId ? 'SENT' : 'RECEIVED';
    }

    return {
      transactionId: txn.transactionId,
      type: txn.type,
      status: txn.status,
      direction,
      amount: txn.amount,
      title: txn.title,
      note: txn.note,
      sender: { type: txn.senderType, id: txn.senderId, name: txn.senderName },
      recipient: txn.recipientId ? { type: txn.recipientType, id: txn.recipientId, name: txn.recipientName } : null,
      purchaseId: txn.purchaseId,
      settlementId: txn.settlementId,
      returnRequestId: txn.returnRequestId,
      bonusAmount: txn.bonusAmount || 0,
      rate: typeof txn.ratePaise === 'number' ? DecimalUtil.fromPaise(txn.ratePaise) : null,
      value: typeof txn.valuePaise === 'number' ? DecimalUtil.fromPaise(txn.valuePaise) : null,
      reversalOf: txn.reversalOf,
      reversedBy: txn.reversedBy,
      reversedAt: txn.reversedAt,
      reversalReason: txn.reversalReason,
      createdAt: txn.createdAt,
      ...(options.includeAudit
        ? {
            initiatedBy: {
              role: txn.initiatedBy?.role,
              email: txn.initiatedBy?.email,
              operatorName: txn.initiatedBy?.operatorName,
              ip: txn.initiatedBy?.ip,
            },
          }
        : {}),
    };
  }

  static async getWalletSummary(owner: BVOwner) {
    await this.ensureWallet(owner);
    // Activation may lock BV out of the wallet, so read the balance after it
    if (owner.ownerType === BV_OWNER_TYPE.MEMBER) await this.activateFromWalletIfEligible(owner.ownerId);
    const wallet = await this.ensureWallet(owner);
    const isAdmin = owner.ownerType === BV_OWNER_TYPE.ADMIN;
    const capacity = returnCapacity(wallet);
    return {
      walletId: wallet.walletId,
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      availableBV: wallet.availableBV,
      bonusBV: wallet.bonusBV || 0,
      regularBV: regularBVOf(wallet),
      sendableBV: isAdmin ? wallet.availableBV : regularBVOf(wallet),
      totalSold: wallet.totalSold || 0,
      returns: isAdmin
        ? undefined
        : {
            purchasedBV: wallet.purchasedBV || 0,
            purchasedValue: DecimalUtil.fromPaise(wallet.purchasedPaise || 0),
            returnedBV: wallet.returnedBV || 0,
            returnedValue: DecimalUtil.fromPaise(wallet.returnedPaise || 0),
            pendingReturnBV: wallet.pendingReturnBV || 0,
            pendingReturnValue: DecimalUtil.fromPaise(wallet.pendingReturnPaise || 0),
            returnableBV: capacity.returnableBV,
            // Average price paid per BV for what is still returnable
            valuePerBV: capacity.remainingBV > 0 ? DecimalUtil.round(capacity.remainingPaise / capacity.remainingBV / 100, 4) : 0,
            returnableValue: DecimalUtil.fromPaise(returnValuePaise(capacity.returnableBV, capacity.remainingBV, capacity.remainingPaise)),
          },
      totalGenerated: wallet.totalGenerated,
      totalReceived: wallet.totalReceived,
      totalSent: wallet.totalSent,
      totalWelcomeBonus: wallet.totalWelcomeBonus || 0,
      totalSpent: wallet.totalSpent || 0,
      totalActivationLocked: wallet.totalActivationLocked || 0,
      isFrozen: wallet.isFrozen,
      frozenReason: wallet.frozenReason,
      limits: {
        maxTransferBV: owner.ownerType === BV_OWNER_TYPE.ADMIN ? BV_WALLET.MAX_ADMIN_TRANSFER_BV : BV_WALLET.MAX_MEMBER_TRANSFER_BV,
        maxGenerateBV: BV_WALLET.MAX_GENERATE_BV,
        activationBV: BV_WALLET.ACTIVATION_BV,
      },
    };
  }

  static async listTransactions(params: {
    viewerId?: string; // restricts to this owner's history; omitted for the admin's global view
    memberId?: string; // admin filter: any transaction involving this member
    type?: unknown;
    status?: unknown;
    direction?: unknown;
    from?: unknown;
    to?: unknown;
    search?: unknown;
    page?: unknown;
    limit?: unknown;
    includeAudit?: boolean;
  }) {
    const conditions: Record<string, unknown>[] = [];
    const viewerId = params.viewerId?.toUpperCase();

    if (viewerId) {
      const direction = typeof params.direction === 'string' ? params.direction.toUpperCase() : '';
      if (direction === 'SENT') conditions.push({ senderId: viewerId, type: { $ne: BV_TXN_TYPE.GENERATION } });
      else if (direction === 'RECEIVED') conditions.push({ recipientId: viewerId });
      else if (direction === 'GENERATED') conditions.push({ senderId: viewerId, type: BV_TXN_TYPE.GENERATION });
      else conditions.push({ $or: [{ senderId: viewerId }, { recipientId: viewerId }] });
    }

    const memberId = typeof params.memberId === 'string' ? params.memberId.trim().toUpperCase() : '';
    if (memberId) conditions.push({ $or: [{ senderId: memberId }, { recipientId: memberId }] });

    const type = typeof params.type === 'string' ? params.type.toUpperCase() : '';
    if (Object.values(BV_TXN_TYPE).includes(type as any)) conditions.push({ type });

    const status = typeof params.status === 'string' ? params.status.toUpperCase() : '';
    if (Object.values(BV_TXN_STATUS).includes(status as any)) conditions.push({ status });

    const createdAt: Record<string, Date> = {};
    const from = typeof params.from === 'string' && params.from ? new Date(params.from) : null;
    const to = typeof params.to === 'string' && params.to ? new Date(params.to) : null;
    if (from && !isNaN(from.getTime())) createdAt.$gte = from;
    if (to && !isNaN(to.getTime())) {
      // A bare date means "through the end of that day"
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(params.to))) to.setUTCHours(23, 59, 59, 999);
      createdAt.$lte = to;
    }
    if (Object.keys(createdAt).length) conditions.push({ createdAt });

    const search = typeof params.search === 'string' ? params.search.trim().slice(0, 100) : '';
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: 'i' };
      conditions.push({
        $or: [
          { transactionId: regex },
          { title: regex },
          { senderName: regex },
          { recipientName: regex },
          { senderId: regex },
          { recipientId: regex },
        ],
      });
    }

    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));
    const filter = conditions.length ? { $and: conditions } : {};

    const [items, total] = await Promise.all([
      BVTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      BVTransaction.countDocuments(filter),
    ]);

    return {
      items: items.map((txn) => this.toPublic(txn, { viewerId, includeAudit: params.includeAudit })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---------------------------------------------------------------------------
  // Recipient lookup
  // ---------------------------------------------------------------------------

  private static toRecipientView(member: Pick<IMember, 'memberId' | 'name' | 'mobile' | 'email'>) {
    return {
      memberId: member.memberId,
      name: member.name,
      mobile: maskMobile(member.mobile),
      email: maskEmail(member.email),
    };
  }

  /** Search members by Member ID, mobile or email (exact) or name (partial). Results are masked. */
  static async searchRecipients(query: unknown, excludeOwnerId: string) {
    const term = typeof query === 'string' ? query.trim().slice(0, 100) : '';
    if (term.length < 3) throw new BVWalletError('Enter at least 3 characters to search.');

    const or: Record<string, unknown>[] = [{ memberId: term.toUpperCase() }, { email: term.toLowerCase() }];
    if (/^[A-Za-z]+\d+$/.test(term)) or.push({ memberId: { $regex: `^${escapeRegex(term.toUpperCase())}` } });
    const digits = term.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length === term.replace(/[\s+()-]/g, '').length) {
      const last10 = digits.slice(-10);
      or.push({ mobile: last10 }, { phone: last10 }, { mobile: digits });
    }
    if (/[A-Za-z]/.test(term)) or.push({ name: { $regex: escapeRegex(term), $options: 'i' } });

    const members = await Member.find({
      $or: or,
      memberId: { $ne: excludeOwnerId.toUpperCase() },
      ...ELIGIBLE_MEMBER_FILTER,
    })
      .select('memberId name mobile email')
      .sort({ name: 1 })
      .limit(10)
      .lean();

    return members.map((m) => this.toRecipientView(m as any));
  }

  /** Recipient check before sending. Only active members can receive transfers. */
  static async getRecipient(recipientId: unknown, excludeOwnerId: string) {
    const id = typeof recipientId === 'string' ? recipientId.trim().toUpperCase() : '';
    if (!id || id === excludeOwnerId.toUpperCase()) throw new BVWalletError('Recipient not found.', HTTP_STATUS.NOT_FOUND);
    const member = await Member.findOne({ memberId: id, ...ELIGIBLE_MEMBER_FILTER }).select('memberId name mobile email').lean();
    if (!member) throw new BVWalletError('Recipient not found or not an active member.', HTTP_STATUS.NOT_FOUND);
    return this.toRecipientView(member as any);
  }

  // ---------------------------------------------------------------------------
  // Admin oversight
  // ---------------------------------------------------------------------------

  static async getMemberWallet(memberId: unknown) {
    const id = typeof memberId === 'string' ? memberId.trim().toUpperCase() : '';
    const member = id ? await Member.findOne({ memberId: id }).select('memberId name status') : null;
    if (!member) throw new BVWalletError('Member not found.', HTTP_STATUS.NOT_FOUND);
    const wallet = await this.getWalletSummary({ ownerType: BV_OWNER_TYPE.MEMBER, ownerId: id });
    return { member: { memberId: member.memberId, name: member.name, status: member.status }, wallet };
  }

  static async setFrozen(input: { memberId: unknown; frozen: unknown; reason: unknown; actor: BVActor }) {
    const id = typeof input.memberId === 'string' ? input.memberId.trim().toUpperCase() : '';
    if (!id || !(await Member.exists({ memberId: id }))) throw new BVWalletError('Member not found.', HTTP_STATUS.NOT_FOUND);
    const frozen = input.frozen === true || input.frozen === 'true';
    const reason = parseText(input.reason, 'Reason', BV_WALLET.NOTE_MAX_LENGTH, frozen);

    await this.ensureWallet({ ownerType: BV_OWNER_TYPE.MEMBER, ownerId: id });
    const wallet = await BVWallet.findOneAndUpdate(
      { ownerId: id },
      { $set: { isFrozen: frozen, frozenReason: frozen ? reason : '' } },
      { returnDocument: 'after' }
    );

    await safeAudit({
      action: frozen ? 'BV_WALLET_FROZEN' : 'BV_WALLET_UNFROZEN',
      entity: 'BV_WALLET',
      entityId: walletIdFor(id),
      performedBy: actorLabel(input.actor),
      performedByRole: input.actor.role,
      reason,
      ipAddress: input.actor.ip,
    });
    return wallet;
  }

  /**
   * Verifies that balances agree with the records:
   *  - all wallet BV = generated + welcome bonus credited + order refunds - BV spent on orders
   *    - BV locked at activation - BV held by return requests awaiting approval
   *  - BV held by return requests = the wallets' pendingReturnBV
   *  - each wallet's balance (and welcome bonus part) equals the sum of its ledger entries, with no
   *    missing entries; the welcome bonus part is never negative or more than the balance
   */
  static async reconcile() {
    const issues: string[] = [];

    const flows = await BVTransaction.aggregate([
      {
        $match: {
          type: {
            $in: [
              BV_TXN_TYPE.GENERATION,
              BV_TXN_TYPE.WELCOME_BONUS,
              BV_TXN_TYPE.PURCHASE,
              BV_TXN_TYPE.PURCHASE_REFUND,
              BV_TXN_TYPE.BINARY_ACTIVATION,
              BV_TXN_TYPE.RETURN_REQUESTED,
              BV_TXN_TYPE.RETURN_APPROVED,
              BV_TXN_TYPE.RETURN_RELEASED,
            ],
          },
        },
      },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const flow = (type: string) => flows.find((f) => f._id === type)?.total || 0;
    const totalGenerated = flow(BV_TXN_TYPE.GENERATION);
    const totalWelcomeBonus = flow(BV_TXN_TYPE.WELCOME_BONUS);
    const totalSpentOnOrders = flow(BV_TXN_TYPE.PURCHASE);
    const totalRefunded = flow(BV_TXN_TYPE.PURCHASE_REFUND);
    const totalActivationLocked = flow(BV_TXN_TYPE.BINARY_ACTIVATION);
    const totalHeldForReturns = flow(BV_TXN_TYPE.RETURN_REQUESTED) - flow(BV_TXN_TYPE.RETURN_APPROVED) - flow(BV_TXN_TYPE.RETURN_RELEASED);
    const expectedInWallets =
      totalGenerated + totalWelcomeBonus + totalRefunded - totalSpentOnOrders - totalActivationLocked - totalHeldForReturns;

    const wallets = await BVWallet.find().select('walletId ownerId availableBV bonusBV pendingReturnBV sequence').lean();
    const totalInWallets = wallets.reduce((sum, w) => sum + w.availableBV, 0);
    if (expectedInWallets !== totalInWallets) {
      issues.push(
        `Wallets hold ${totalInWallets} BV but records give ${expectedInWallets} BV ` +
          `(generated ${totalGenerated} + welcome bonus ${totalWelcomeBonus} + refunds ${totalRefunded} - spent ${totalSpentOnOrders} - locked for binary activation ${totalActivationLocked} - held for returns ${totalHeldForReturns}).`
      );
    }
    const totalPendingInWallets = wallets.reduce((sum, w) => sum + (w.pendingReturnBV || 0), 0);
    if (totalPendingInWallets !== totalHeldForReturns) {
      issues.push(`Return requests hold ${totalHeldForReturns} BV but wallets record ${totalPendingInWallets} BV pending return.`);
    }

    const ledgerTotals = await BVWalletLedger.aggregate([
      {
        $group: {
          _id: '$walletId',
          available: { $sum: '$availableDelta' },
          bonus: { $sum: '$bonusDelta' },
          entries: { $sum: 1 },
          lastSequence: { $max: '$walletSequence' },
        },
      },
    ]);
    const ledgerByWallet = new Map(ledgerTotals.map((l) => [l._id as string, l]));

    for (const w of wallets) {
      const ledger = ledgerByWallet.get(w.walletId);
      const ledgerAvailable = ledger?.available || 0;
      if (ledgerAvailable !== w.availableBV) {
        issues.push(`${w.walletId}: balance ${w.availableBV} BV does not match ledger total ${ledgerAvailable} BV.`);
      }
      const bonus = w.bonusBV || 0;
      if ((ledger?.bonus || 0) !== bonus) {
        issues.push(`${w.walletId}: welcome bonus part ${bonus} BV does not match ledger total ${ledger?.bonus || 0} BV.`);
      }
      if (bonus < 0 || bonus > w.availableBV) {
        issues.push(`${w.walletId}: welcome bonus part ${bonus} BV is outside the balance of ${w.availableBV} BV.`);
      }
      if ((ledger?.entries || 0) !== w.sequence || (ledger?.lastSequence || 0) !== w.sequence) {
        issues.push(`${w.walletId}: ledger has ${ledger?.entries || 0} entries but wallet sequence is ${w.sequence}.`);
      }
    }

    return {
      ok: issues.length === 0,
      totalGenerated,
      totalWelcomeBonus,
      totalSpentOnOrders,
      totalRefunded,
      totalActivationLocked,
      totalHeldForReturns,
      totalInWallets,
      walletsChecked: wallets.length,
      issues: issues.slice(0, 50),
      checkedAt: new Date(),
    };
  }

  static async getAdminOverview() {
    const adminWallet = await this.getWalletSummary(ADMIN_BV_OWNER);
    const [members] = await BVWallet.aggregate([
      { $match: { ownerType: BV_OWNER_TYPE.MEMBER } },
      {
        $group: {
          _id: null,
          available: { $sum: '$availableBV' },
          bonus: { $sum: { $ifNull: ['$bonusBV', 0] } },
          holders: { $sum: { $cond: [{ $gt: ['$availableBV', 0] }, 1, 0] } },
          frozen: { $sum: { $cond: ['$isFrozen', 1, 0] } },
        },
      },
    ]);
    const reconciliation = await this.reconcile();

    return {
      adminWallet,
      totalGenerated: reconciliation.totalGenerated,
      memberCirculationBV: members?.available || 0,
      memberBonusBV: members?.bonus || 0,
      memberHolders: members?.holders || 0,
      frozenWallets: members?.frozen || 0,
      reconciliation,
    };
  }
}

export default BVWalletService;
