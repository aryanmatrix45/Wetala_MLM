import { Response } from 'express';
import mongoose from 'mongoose';
import { Admin } from '../models/Admin.model';
import { HTTP_STATUS, ROLES, BV_OWNER_TYPE } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { BVWalletService, BVWalletError, BVOwner, BVActor, ADMIN_BV_OWNER } from '../services/BVWalletService';

const OPERATOR_NAME_MAX_LENGTH = 60;

/** The wallet owner is always derived from the JWT, never from the request body. */
const ownerFromRequest = (req: AuthenticatedRequest): BVOwner | null => {
  if (req.user?.role === ROLES.SUPERADMIN) return ADMIN_BV_OWNER;
  if (req.user?.memberId) return { ownerType: BV_OWNER_TYPE.MEMBER, ownerId: req.user.memberId.toUpperCase() };
  return null;
};

const actorFromRequest = (req: AuthenticatedRequest, operatorName?: string): BVActor => ({
  role: req.user?.role || '',
  email: req.user?.email || '',
  operatorName,
  ip: req.ip || '',
  userAgent: (req.get('user-agent') || '').slice(0, 200),
});

/** The Super Admin account is shared, so every BV-moving admin action records who performed it. */
const requireOperatorName = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new BVWalletError('Enter your name (operator) so this action is recorded against you.');
  if (name.length > OPERATOR_NAME_MAX_LENGTH) {
    throw new BVWalletError(`Operator name cannot be longer than ${OPERATOR_NAME_MAX_LENGTH} characters.`);
  }
  return name;
};

/** Re-checks the Super Admin password for sensitive actions (generation, reversal). */
const requireAdminPassword = async (req: AuthenticatedRequest) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password) throw new BVWalletError('Enter the Super Admin password to confirm.');
  const admin = mongoose.Types.ObjectId.isValid(req.user?.id || '') ? await Admin.findById(req.user!.id).select('+password') : null;
  // 403 rather than 401 so a mistyped password does not end the admin's session in the frontend
  if (!admin || !admin.isActive || !(await admin.comparePassword(password))) {
    throw new BVWalletError('Incorrect password.', HTTP_STATUS.FORBIDDEN);
  }
};

const handleError = (res: Response, error: any, context: string) => {
  if (error instanceof BVWalletError) {
    res.status(error.statusCode).json({ status: false, message: error.message, ...(error.details || {}) });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: error.message });
    return;
  }
  console.error(`[BVWalletController.${context}] Error:`, error);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Something went wrong. Please try again.' });
};

type OwnerHandler = (req: AuthenticatedRequest, res: Response, owner: BVOwner) => Promise<void>;

/** Wraps a handler that needs a wallet owner (admin or member). */
const withOwner =
  (context: string, handler: OwnerHandler) =>
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const owner = ownerFromRequest(req);
    if (!owner) {
      res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'A member or Super Admin account is required.' });
      return;
    }
    try {
      await handler(req, res, owner);
    } catch (error) {
      handleError(res, error, context);
    }
  };

const withAdmin =
  (context: string, handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      handleError(res, error, context);
    }
  };

export const BVWalletController = {
  /** GET /api/bv-wallet/me */
  getMyWallet: withOwner('getMyWallet', async (_req, res, owner) => {
    const data = await BVWalletService.getWalletSummary(owner);
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** GET /api/bv-wallet/recipients/search?q= */
  searchRecipients: withOwner('searchRecipients', async (req, res, owner) => {
    const data = await BVWalletService.searchRecipients(req.query.q, owner.ownerId);
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** GET /api/bv-wallet/recipients/:recipientId  ('ADMIN' resolves to the Super Admin) */
  getRecipient: withOwner('getRecipient', async (req, res, owner) => {
    const data = await BVWalletService.getRecipient(req.params.recipientId, owner.ownerId);
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** GET /api/bv-wallet/transactions?type&status&direction&from&to&page&limit */
  getMyTransactions: withOwner('getMyTransactions', async (req, res, owner) => {
    const { type, status, direction, from, to, page, limit } = req.query;
    const data = await BVWalletService.listTransactions({ type, status, direction, from, to, page, limit, viewerId: owner.ownerId });
    res.status(HTTP_STATUS.OK).json({ status: true, ...data, data: data.items, items: undefined });
  }),

  /** POST /api/bv-wallet/transfers  { recipientId, amount, title, note, requestKey, confirmRepeat?, operatorName? } */
  transfer: withOwner('transfer', async (req, res, owner) => {
    const operatorName = owner.ownerType === BV_OWNER_TYPE.ADMIN ? requireOperatorName(req.body?.operatorName) : undefined;
    const result = await BVWalletService.transfer({
      sender: owner,
      recipientId: req.body?.recipientId,
      amount: req.body?.amount,
      title: req.body?.title,
      note: req.body?.note,
      requestKey: req.body?.requestKey,
      confirmRepeat: req.body?.confirmRepeat,
      actor: actorFromRequest(req, operatorName),
    });

    res.status(result.duplicate ? HTTP_STATUS.OK : HTTP_STATUS.CREATED).json({
      status: true,
      duplicate: result.duplicate || undefined,
      message: result.duplicate
        ? 'This transfer was already sent.'
        : `${result.transaction.amount.toLocaleString('en-IN')} BV sent to ${result.transaction.recipientName}.`,
      data: {
        transaction: BVWalletService.toPublic(result.transaction, { viewerId: owner.ownerId }),
        availableBV: result.senderWallet?.availableBV,
      },
    });
  }),

  // ---------------------------------------------------------------------------
  // Super Admin
  // ---------------------------------------------------------------------------

  /** POST /api/bv-wallet/admin/generate  { amount, title, note, operatorName, password } */
  generate: withAdmin('generate', async (req, res) => {
    const operatorName = requireOperatorName(req.body?.operatorName);
    await requireAdminPassword(req);

    const result = await BVWalletService.generate({
      amount: req.body?.amount,
      title: req.body?.title,
      note: req.body?.note,
      actor: actorFromRequest(req, operatorName),
    });
    res.status(HTTP_STATUS.CREATED).json({
      status: true,
      message: `${result.transaction.amount.toLocaleString('en-IN')} BV generated.`,
      data: {
        transaction: BVWalletService.toPublic(result.transaction, { viewerId: ADMIN_BV_OWNER.ownerId, includeAudit: true }),
        availableBV: result.wallet.availableBV,
      },
    });
  }),

  /** POST /api/bv-wallet/admin/transactions/:transactionId/reverse  { reason, operatorName, password } */
  reverseTransfer: withAdmin('reverseTransfer', async (req, res) => {
    const operatorName = requireOperatorName(req.body?.operatorName);
    await requireAdminPassword(req);

    const result = await BVWalletService.reverseTransfer({
      transactionId: req.params.transactionId,
      reason: req.body?.reason,
      actor: actorFromRequest(req, operatorName),
    });
    res.status(HTTP_STATUS.OK).json({
      status: true,
      message: `Reversed: ${result.original.amount.toLocaleString('en-IN')} BV returned from ${result.original.recipientName} to ${result.original.senderName}.`,
      data: {
        original: BVWalletService.toPublic(result.original, { includeAudit: true }),
        reversal: BVWalletService.toPublic(result.reversal, { includeAudit: true }),
      },
    });
  }),

  /** GET /api/bv-wallet/admin/overview */
  getAdminOverview: withAdmin('getAdminOverview', async (_req, res) => {
    const data = await BVWalletService.getAdminOverview();
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** GET /api/bv-wallet/admin/transactions?type&status&memberId&search&from&to&page&limit */
  getAllTransactions: withAdmin('getAllTransactions', async (req, res) => {
    const { type, status, memberId, search, from, to, page, limit } = req.query;
    const data = await BVWalletService.listTransactions({
      type,
      status,
      search,
      from,
      to,
      page,
      limit,
      memberId: typeof memberId === 'string' ? memberId : undefined,
      includeAudit: true,
    });
    res.status(HTTP_STATUS.OK).json({ status: true, ...data, data: data.items, items: undefined });
  }),

  /** GET /api/bv-wallet/admin/wallets/:memberId */
  getMemberWallet: withAdmin('getMemberWallet', async (req, res) => {
    const data = await BVWalletService.getMemberWallet(req.params.memberId);
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** POST /api/bv-wallet/admin/wallets/:memberId/freeze  { frozen, reason } */
  setWalletFrozen: withAdmin('setWalletFrozen', async (req, res) => {
    const wallet = await BVWalletService.setFrozen({
      memberId: req.params.memberId,
      frozen: req.body?.frozen,
      reason: req.body?.reason,
      actor: actorFromRequest(req),
    });
    res.status(HTTP_STATUS.OK).json({
      status: true,
      message: wallet?.isFrozen ? 'BV wallet frozen.' : 'BV wallet unfrozen.',
      data: { ownerId: wallet?.ownerId, isFrozen: wallet?.isFrozen, frozenReason: wallet?.frozenReason },
    });
  }),

  /** GET /api/bv-wallet/admin/reconcile */
  reconcile: withAdmin('reconcile', async (_req, res) => {
    const data = await BVWalletService.reconcile();
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),
};

export default BVWalletController;
