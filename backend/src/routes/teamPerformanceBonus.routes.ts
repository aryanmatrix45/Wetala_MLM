import { Router, Request, Response } from 'express';
import {
  TeamPerformanceBonusService,
  TeamPerformanceBonusError,
} from '../services/compensation/TeamPerformanceBonusService';
import { Member } from '../models/Member.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Team Performance Bonus pays into wallets, so every endpoint needs a login
router.use(authenticate);

/** Rule errors keep their status; anything else is a 500 */
const statusFor = (error: unknown) =>
  error instanceof TeamPerformanceBonusError ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;

const actorOf = (req: AuthenticatedRequest) => ({
  email: req.user?.email || 'unknown',
  role: req.user?.role || 'unknown',
});

/** Members see only themselves; the Super Admin may ask for any member (default: first member) */
const resolveMemberId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.role !== ROLES.SUPERADMIN) return (req.user?.memberId || '').toUpperCase();
  const requested = req.params.memberId;
  if (requested && requested !== 'undefined' && requested !== 'null') return requested.toUpperCase();
  const firstMember = await Member.findOne().sort({ createdAt: 1 });
  return firstMember ? firstMember.memberId : '';
};

const fail = (res: Response, error: any, fallback: string) =>
  res.status(statusFor(error)).json({ status: false, message: error?.message || fallback });

/**
 * Team Performance Bonus configuration (RP conversion and slabs)
 * GET /api/team-performance/admin/config
 */
router.get('/admin/config', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await TeamPerformanceBonusService.getConfig();
    res.json({ status: true, data: config });
  } catch (error: any) {
    fail(res, error, 'Failed to load Team Performance Bonus configuration');
  }
});

/**
 * Replace the RP conversion and slab list (create, edit, activate and deactivate all go through here)
 * PUT /api/team-performance/admin/config  { rpBvUnit, slabs: [{ slabId, leftRp, rightRp, percent, lifetimeLimit, isActive }] }
 */
router.put('/admin/config', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await TeamPerformanceBonusService.updateConfig(
      { rpBvUnit: req.body?.rpBvUnit, slabs: req.body?.slabs },
      actorOf(req),
      req.ip || ''
    );
    res.json({ status: true, message: 'Team Performance Bonus configuration saved', data: config });
  } catch (error: any) {
    fail(res, error, 'Failed to save Team Performance Bonus configuration');
  }
});

/**
 * Member-wise BV, RP and consumed RP for the SuperAdmin
 * GET /api/team-performance/admin/members?limit=500
 */
router.get('/admin/members', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await TeamPerformanceBonusService.listMemberRewardPoints(Number(req.query.limit) || 500);
    res.json({ status: true, data });
  } catch (error: any) {
    fail(res, error, 'Failed to load member reward points');
  }
});

/**
 * Settlement periods and their pools
 * GET /api/team-performance/admin/periods
 */
router.get('/admin/periods', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const data = await TeamPerformanceBonusService.listPeriods();
    res.json({ status: true, data });
  } catch (error: any) {
    fail(res, error, 'Failed to load settlement periods');
  }
});

/**
 * One period with its payouts
 * GET /api/team-performance/admin/periods/:periodId
 */
router.get('/admin/periods/:periodId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await TeamPerformanceBonusService.getPeriod(req.params.periodId);
    if (!data) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Settlement period not found' });
    }
    res.json({ status: true, data });
  } catch (error: any) {
    fail(res, error, 'Failed to load settlement period');
  }
});

/**
 * Preview a period's pools and payouts without paying anyone
 * POST /api/team-performance/admin/settlements/preview  { periodStart, periodEnd, overrideTurnover? }
 */
router.post('/admin/settlements/preview', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await TeamPerformanceBonusService.previewSettlement(req.body || {});
    res.json({ status: true, data });
  } catch (error: any) {
    fail(res, error, 'Failed to preview Team Performance Bonus settlement');
  }
});

/**
 * Settle a finished period. Running it again never pays anyone twice.
 * POST /api/team-performance/admin/settlements  { periodStart, periodEnd, overrideTurnover? }
 */
router.post('/admin/settlements', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await TeamPerformanceBonusService.executeSettlement(req.body || {}, actorOf(req), req.ip || '');
    res.json({
      status: true,
      message: result.alreadySettled
        ? `The period ${result.period.periodId} was already settled`
        : `Settlement ${result.period.periodId} processed`,
      alreadySettled: result.alreadySettled,
      data: result.period,
    });
  } catch (error: any) {
    fail(res, error, 'Failed to settle Team Performance Bonus');
  }
});

/**
 * A member's dashboard: BV, RP, slab progress, qualifications, lifetime eligibility and payouts
 * GET /api/team-performance/member-status/:memberId?
 */
router.get('/member-status/:memberId?', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memberId = await resolveMemberId(req);
    if (!memberId) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'No members found in system' });
    }
    if (req.user?.role !== ROLES.SUPERADMIN && req.params.memberId && req.params.memberId.toUpperCase() !== memberId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'You can only view your own bonus' });
    }
    const data = await TeamPerformanceBonusService.getMemberStatus(memberId);
    res.json({ status: true, data });
  } catch (error: any) {
    fail(res, error, 'Failed to load Team Performance Bonus status');
  }
});

export default router;
