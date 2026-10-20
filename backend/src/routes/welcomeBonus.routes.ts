import { Router, Request, Response } from 'express';
import { WelcomeBonusService, WelcomeBonusError } from '../services/compensation/WelcomeBonusService';
import { WelcomeBonusSettlement } from '../models/WelcomeBonusSettlement.model';
import { WelcomeBonusTransaction } from '../models/WelcomeBonusTransaction.model';
import { Member } from '../models/Member.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Every welcome bonus endpoint needs a login: settlement credits spendable BV, so it is Super Admin only
router.use(authenticate);

/** Rule errors (week not finished, bonus switched off...) keep their status; anything else is a 500 */
const statusFor = (error: unknown) =>
  error instanceof WelcomeBonusError ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;

/** Members always get their own record; the Super Admin may ask for any member (default: first member). */
const resolveMemberId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.role !== ROLES.SUPERADMIN) return (req.user?.memberId || '').toUpperCase();
  const requested = req.params.memberId;
  if (requested && requested !== 'undefined' && requested !== 'null') return requested.toUpperCase();
  const firstMember = await Member.findOne().sort({ createdAt: 1 });
  return firstMember ? firstMember.memberId : '';
};

/**
 * Get Welcome Bonus Governance & Live Engine Overview for Super Admin / Admin
 * GET /api/welcome-bonus/admin-summary
 */
router.get('/admin-summary', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const summary = await WelcomeBonusService.getAdminDashboardSummary();
    res.json({
      status: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to fetch Welcome Bonus admin summary',
    });
  }
});

/**
 * Preview a week's Welcome Bonus settlement (default: the last finished week)
 * GET /api/welcome-bonus/preview?weekStart=YYYY-MM-DD
 */
router.get('/preview', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const overrideGBV = req.query.overrideGBV ? parseFloat(req.query.overrideGBV as string) : undefined;
    const preview = await WelcomeBonusService.previewWeeklySettlement({ weekStart: req.query.weekStart, overrideGBV });
    res.json({
      status: true,
      data: preview,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to generate Welcome Bonus settlement preview',
    });
  }
});

/**
 * Settle a finished week's Welcome Bonus (default: the last finished week)
 * POST /api/welcome-bonus/settle  { weekStart?: 'YYYY-MM-DD' (a Monday), overrideGBV?: number }
 */
router.post('/settle', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { overrideGBV, weekStart } = req.body;
    const result = await WelcomeBonusService.executeWeeklySettlement({
      weekStart,
      overrideGBV: typeof overrideGBV === 'number' ? overrideGBV : undefined,
    });

    res.json({
      status: true,
      message: result.alreadySettled
        ? `The week starting ${result.settlement.weekStart || result.settlement.settlementId} was already settled`
        : `Weekly settlement ${result.settlement.settlementId} processed: ${result.transactions.length} members paid`,
      alreadySettled: result.alreadySettled,
      settlement: result.settlement,
      transactionsCount: result.transactions.length,
      transactions: result.transactions,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to execute Welcome Bonus settlement',
    });
  }
});

/**
 * List all Welcome Bonus settlements
 * GET /api/welcome-bonus/settlements
 */
router.get('/settlements', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const settlements = await WelcomeBonusSettlement.find().sort({ createdAt: -1 });
    res.json({
      status: true,
      data: settlements,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to fetch settlements',
    });
  }
});

/**
 * Get single settlement details with individual transactions
 * GET /api/welcome-bonus/settlements/:settlementId
 */
router.get('/settlements/:settlementId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { settlementId } = req.params;
    const settlement = await WelcomeBonusSettlement.findOne({ settlementId });
    if (!settlement) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: `Settlement ${settlementId} not found`,
      });
    }

    const transactions = await WelcomeBonusTransaction.find({ settlementId }).sort({ createdAt: 1 });

    res.json({
      status: true,
      settlement,
      transactions,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to fetch settlement details',
    });
  }
});

/**
 * Get Welcome Bonus status for a Member (Dashboard View)
 * GET /api/welcome-bonus/member-status/:memberId?
 */
router.get('/member-status/:memberId?', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memberId = await resolveMemberId(req);

    if (!memberId) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: false,
        message: 'No members found in system',
      });
    }

    const status = await WelcomeBonusService.getMemberDashboardStatus(memberId);
    res.json({
      status: true,
      data: status,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to fetch member Welcome Bonus status',
    });
  }
});

/**
 * Get Welcome Bonus payout history for a Member
 * GET /api/welcome-bonus/history/:memberId?
 */
router.get('/history/:memberId?', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memberId = await resolveMemberId(req);

    const history = await WelcomeBonusTransaction.find({ memberId }).sort({ createdAt: -1 });
    res.json({
      status: true,
      memberId,
      data: history,
    });
  } catch (error: any) {
    res.status(statusFor(error)).json({
      status: false,
      message: error.message || 'Failed to fetch Welcome Bonus history',
    });
  }
});

export default router;
