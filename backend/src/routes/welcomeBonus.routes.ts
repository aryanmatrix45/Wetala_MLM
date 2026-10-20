import { Router, Request, Response } from 'express';
import { WelcomeBonusService } from '../services/compensation/WelcomeBonusService';
import { WelcomeBonusSettlement } from '../models/WelcomeBonusSettlement.model';
import { WelcomeBonusTransaction } from '../models/WelcomeBonusTransaction.model';
import { Member } from '../models/Member.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Every welcome bonus endpoint needs a login: settlement credits spendable BV, so it is Super Admin only
router.use(authenticate);

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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch Welcome Bonus admin summary',
    });
  }
});

/**
 * Preview current / upcoming weekly Welcome Bonus settlement
 * GET /api/welcome-bonus/preview
 */
router.get('/preview', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const overrideGBV = req.query.overrideGBV ? parseFloat(req.query.overrideGBV as string) : undefined;
    const preview = await WelcomeBonusService.previewWeeklySettlement({ overrideGBV });
    res.json({
      status: true,
      data: preview,
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to generate Welcome Bonus settlement preview',
    });
  }
});

/**
 * Execute weekly Welcome Bonus settlement
 * POST /api/welcome-bonus/settle
 */
router.post('/settle', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { overrideGBV, settlementId } = req.body;
    const result = await WelcomeBonusService.executeWeeklySettlement({
      overrideGBV: typeof overrideGBV === 'number' ? overrideGBV : undefined,
      settlementId: typeof settlementId === 'string' && settlementId.trim() ? settlementId.trim() : undefined,
    });

    res.json({
      status: true,
      message: `Weekly settlement ${result.settlement.settlementId} processed successfully`,
      settlement: result.settlement,
      transactionsCount: result.transactions.length,
      transactions: result.transactions,
    });
  } catch (error: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: false,
      message: error.message || 'Failed to fetch Welcome Bonus history',
    });
  }
});

export default router;
