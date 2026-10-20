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
import {
  HTTP_STATUS,
  BV_WALLET,
  BV_OWNER_TYPE,
  BVOwnerType,
  BV_TXN_TYPE,
  BV_TXN_STATUS,
  BV_LEDGER_ENTRY,
  BVLedgerEntryType,
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
 * Other ways BV enters or leaves a wallet:
 *  - WELCOME_BONUS: the weekly welcome bonus share is credited as BV (WelcomeBonusService)
 *  - PURCHASE: a member pays for an order with its own BV value (e.g. a 1,250 BV package costs
 *    1,250 BV; rupee prices are never converted); the order then waits for Super Admin approval
 *  - PURCHASE_REFUND: the BV comes back if that order is rejected or refunded
 *
 * Wallet BV itself is not earned volume: it never changes Member.personalBv, BinaryVolume or BVLedger.
 * Earned BV comes from the order once the Super Admin approves it. A wallet balance can, however,
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
const ADMIN_PARTY: BVParty = { ...ADMIN_BV_OWNER, name: BV_WALLET.ADMIN_DISPLAY_NAME };

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
   * Returns null when the guard fails (insufficient BV for a debit, or wallet frozen).
   */
  private static async moveBalance(
    session: ClientSession,
    ownerId: string,
    entryType: BVLedgerEntryType,
    txn: IBVTransaction,
    delta: number,
    totals: Partial<Record<'totalGenerated' | 'totalReceived' | 'totalSent' | 'totalWelcomeBonus' | 'totalSpent', number>> = {},
    options: { requireNotFrozen?: boolean } = {}
  ): Promise<IBVWallet | null> {
    const filter: Record<string, unknown> = { ownerId };
    if (delta < 0) filter.availableBV = { $gte: -delta };
    if (options.requireNotFrozen) filter.isFrozen = false;

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

  private static async insufficientBalanceError(ownerId: string, amount: number): Promise<BVWalletError> {
    const wallet = await BVWallet.findOne({ ownerId });
    if (wallet?.isFrozen) {
      return new BVWalletError(
        `This BV wallet is frozen${wallet.frozenReason ? `: ${wallet.frozenReason}` : ''}. Contact support.`,
        HTTP_STATUS.FORBIDDEN
      );
    }
    const available = wallet?.availableBV || 0;
    return new BVWalletError(
      `Insufficient BV balance. Available: ${formatBV(available)}, requested: ${formatBV(amount)}.`,
      HTTP_STATUS.BAD_REQUEST,
      { availableBV: available }
    );
  }

  /** Resolves who BV is being sent to. Members may pick the Super Admin; nobody may pick themselves. */
  private static async resolveRecipient(recipientId: string, sender: BVOwner): Promise<BVParty> {
    if (!recipientId) throw new BVWalletError('Select who you want to send BV to.');
    if (recipientId === sender.ownerId) throw new BVWalletError('You cannot transfer BV to yourself.');
    if (recipientId === BV_WALLET.ADMIN_OWNER_ID) return ADMIN_PARTY;

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
              initiatedBy: input.actor,
            },
          ],
          { session }
        );

        const senderWallet = await this.moveBalance(
          session,
          sender.ownerId,
          BV_LEDGER_ENTRY.DEBIT_OUT,
          txn,
          -amount,
          { totalSent: amount },
          { requireNotFrozen: true }
        );
        if (!senderWallet) throw await this.insufficientBalanceError(sender.ownerId, amount);

        const recipientWallet = await this.moveBalance(session, recipient.ownerId, BV_LEDGER_ENTRY.CREDIT_IN, txn, amount, {
          totalReceived: amount,
        });
        if (!recipientWallet) throw new BVWalletError('Recipient BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);

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
      newValues: { senderId: sender.ownerId, recipientId: recipient.ownerId, amount, title, note },
      ipAddress: input.actor.ip,
    });

    return { ...result, duplicate: false };
  }

  /**
   * Super Admin correction: moves a completed transfer's BV back from the recipient to the sender.
   * Writes a new REVERSAL transaction; the original keeps its amounts and is marked REVERSED.
   * Only possible while the recipient still has the BV, and only once per transfer.
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
            initiatedBy: input.actor,
          },
        ],
        { session }
      );

      // Undo the original totals rather than inflating "sent"/"received" with the correction
      const debited = await this.moveBalance(session, claimed.recipientId, BV_LEDGER_ENTRY.DEBIT_OUT, reversal, -claimed.amount, {
        totalReceived: -claimed.amount,
      });
      if (!debited) {
        const wallet = await BVWallet.findOne({ ownerId: claimed.recipientId });
        throw new BVWalletError(
          `${claimed.recipientName} only has ${formatBV(wallet?.availableBV || 0)} available, so ${formatBV(claimed.amount)} cannot be reversed.`,
          HTTP_STATUS.BAD_REQUEST,
          { availableBV: wallet?.availableBV || 0 }
        );
      }
      const credited = await this.moveBalance(session, claimed.senderId, BV_LEDGER_ENTRY.CREDIT_IN, reversal, claimed.amount, {
        totalSent: -claimed.amount,
      });
      if (!credited) throw new BVWalletError('Sender BV wallet not found.', HTTP_STATUS.INTERNAL_SERVER_ERROR);

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
          title: `Welcome bonus (${input.settlementId})`,
          note: 'Weekly welcome bonus share',
          settlementId: input.settlementId,
          initiatedBy: { role: 'system', email: 'SYSTEM' },
        },
      ],
      { session }
    );
    const wallet = await this.moveBalance(session, memberId, BV_LEDGER_ENTRY.CREDIT_IN, txn, input.amount, {
      totalWelcomeBonus: input.amount,
    });
    if (!wallet) throw new BVWalletError(`BV wallet for ${memberId} not found.`, HTTP_STATUS.INTERNAL_SERVER_ERROR);

    await this.notify(session, {
      type: 'BV_WELCOME_BONUS',
      title: 'Welcome Bonus Credited',
      message: `${formatBV(input.amount)} welcome bonus (${input.settlementId}) was added to your BV Wallet.`,
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
          { totalSpent: bvAmount },
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
   * Activates binary participation (and places the member in the tree if needed) once personal BV
   * plus BV Wallet balance reaches BV_WALLET.ACTIVATION_BV. Activation is permanent and does not
   * consume the BV. Best effort: called after wallet credits commit, never fails the caller.
   */
  static async activateFromWalletIfEligible(memberId: string): Promise<boolean> {
    try {
      const id = memberId.toUpperCase();
      const member = await Member.findOne({ memberId: id });
      if (!member || member.isBinaryActive) return false;

      const wallet = await BVWallet.findOne({ ownerId: id });
      const total = (member.personalBv || 0) + (wallet?.availableBV || 0);
      if (total < BV_WALLET.ACTIVATION_BV) return false;

      const activated = await Member.updateOne(
        { memberId: id, isBinaryActive: { $ne: true } },
        { $set: { isBinaryActive: true, activationSource: 'BV_WALLET', binaryActivatedAt: member.binaryActivatedAt || new Date() } }
      );
      if (!activated.modifiedCount) return false;

      if (!member.parentId && member.sponsorId) {
        await BinaryTreeService.placeMemberInBinaryTree(id);
      }

      await safeAudit({
        action: 'BINARY_ACTIVATED_FROM_BV_WALLET',
        entity: 'BV_WALLET',
        entityId: walletIdFor(id),
        performedBy: 'SYSTEM',
        performedByRole: 'system',
        newValues: { memberId: id, personalBv: member.personalBv || 0, walletBV: wallet?.availableBV || 0 },
      });
      return true;
    } catch (error) {
      console.error(`[BVWalletService] Wallet activation check failed for ${memberId}:`, error);
      return false;
    }
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
    const wallet = await this.ensureWallet(owner);
    if (owner.ownerType === BV_OWNER_TYPE.MEMBER) await this.activateFromWalletIfEligible(owner.ownerId);
    return {
      walletId: wallet.walletId,
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      availableBV: wallet.availableBV,
      totalGenerated: wallet.totalGenerated,
      totalReceived: wallet.totalReceived,
      totalSent: wallet.totalSent,
      totalWelcomeBonus: wallet.totalWelcomeBonus || 0,
      totalSpent: wallet.totalSpent || 0,
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

  /** Recipient check before sending. 'ADMIN' resolves to the Super Admin for members. */
  static async getRecipient(recipientId: unknown, excludeOwnerId: string) {
    const id = typeof recipientId === 'string' ? recipientId.trim().toUpperCase() : '';
    if (!id || id === excludeOwnerId.toUpperCase()) throw new BVWalletError('Recipient not found.', HTTP_STATUS.NOT_FOUND);
    if (id === BV_WALLET.ADMIN_OWNER_ID) {
      return { memberId: BV_WALLET.ADMIN_OWNER_ID, name: BV_WALLET.ADMIN_DISPLAY_NAME, mobile: '', email: '' };
    }
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
   *  - each wallet's balance equals the sum of its ledger entries, with no missing entries
   */
  static async reconcile() {
    const issues: string[] = [];

    const flows = await BVTransaction.aggregate([
      {
        $match: {
          type: { $in: [BV_TXN_TYPE.GENERATION, BV_TXN_TYPE.WELCOME_BONUS, BV_TXN_TYPE.PURCHASE, BV_TXN_TYPE.PURCHASE_REFUND] },
        },
      },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const flow = (type: string) => flows.find((f) => f._id === type)?.total || 0;
    const totalGenerated = flow(BV_TXN_TYPE.GENERATION);
    const totalWelcomeBonus = flow(BV_TXN_TYPE.WELCOME_BONUS);
    const totalSpentOnOrders = flow(BV_TXN_TYPE.PURCHASE);
    const totalRefunded = flow(BV_TXN_TYPE.PURCHASE_REFUND);
    const expectedInWallets = totalGenerated + totalWelcomeBonus + totalRefunded - totalSpentOnOrders;

    const wallets = await BVWallet.find().select('walletId ownerId availableBV sequence').lean();
    const totalInWallets = wallets.reduce((sum, w) => sum + w.availableBV, 0);
    if (expectedInWallets !== totalInWallets) {
      issues.push(
        `Wallets hold ${totalInWallets} BV but records give ${expectedInWallets} BV ` +
          `(generated ${totalGenerated} + welcome bonus ${totalWelcomeBonus} + refunds ${totalRefunded} - spent ${totalSpentOnOrders}).`
      );
    }

    const ledgerTotals = await BVWalletLedger.aggregate([
      {
        $group: {
          _id: '$walletId',
          available: { $sum: '$availableDelta' },
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
      memberHolders: members?.holders || 0,
      frozenWallets: members?.frozen || 0,
      reconciliation,
    };
  }
}

export default BVWalletService;
