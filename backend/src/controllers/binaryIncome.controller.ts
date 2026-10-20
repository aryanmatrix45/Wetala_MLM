import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { Member } from '../models/Member.model';
import { BinaryVolume } from '../models/BinaryVolume.model';
import { BVLedger } from '../models/BVLedger.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { BinaryDailyClosing } from '../models/BinaryDailyClosing.model';
import { BinarySettlementRun } from '../models/BinarySettlementRun.model';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { BinaryBonusService } from '../services/compensation/BinaryBonusService';
import { BinarySettlementError, DailyBinarySettlementService } from '../services/compensation/DailyBinarySettlementService';
import { BusinessDate } from '../utils/businessDate';
import { COMMISSION_TYPE, HTTP_STATUS, ROLES } from '../config/constants';

const isSuperAdmin = (req: AuthenticatedRequest) => req.user?.role?.toLowerCase() === ROLES.SUPERADMIN;

const pageParams = (req: AuthenticatedRequest, defaultLimit = 30) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const fail = (res: Response, error: any) => {
  const status = error instanceof BinarySettlementError ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  res.status(status).json({ status: false, message: error.message });
};

/** Members may see their own binary data and their downline's; the Super Admin sees everyone's. */
async function resolveViewableMember(req: AuthenticatedRequest, res: Response): Promise<string | null> {
  const memberId = String(req.params.memberId || '').toUpperCase().trim();
  if (!memberId) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID is required' });
    return null;
  }
  if (isSuperAdmin(req)) return memberId;

  const viewerId = req.user?.memberId?.toUpperCase().trim();
  if (viewerId && (viewerId === memberId || (await BinaryTreeService.isDescendantOf(memberId, viewerId)))) {
    return memberId;
  }
  res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'You can only view your own or your downline’s binary income.' });
  return null;
}

/** "Rahul Kumar" -> "Rahul K." for members viewing the leaderboard */
const maskName = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Member';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

export const BinaryIncomeController = {
  /**
   * Binary summary for the dashboard: lifetime leg totals, carry forward, and the live estimate
   * for today. Read only.
   * GET /api/binary/volume/:memberId
   */
  async getVolume(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const memberId = await resolveViewableMember(req, res);
      if (!memberId) return;

      const rules = await CompensationEngine.getActiveRules();
      const [preview, vol, legs, incomeAgg] = await Promise.all([
        BinaryBonusService.previewToday(memberId, rules),
        BinaryVolume.findOne({ memberId }),
        BinaryTreeService.getMemberLegsLevelOrder(memberId),
        CommissionLedger.aggregate([
          { $match: { memberId, type: COMMISSION_TYPE.BINARY_BONUS, status: { $in: ['APPROVED', 'PAID'] } } },
          { $group: { _id: null, total: { $sum: '$payableAmount' } } },
        ]),
      ]);
      if (!preview) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }
      const member = await Member.findOne({ memberId }).select('name personalBv activationLockedBV');
      const q = preview.qualification;
      const currentLeft = preview.opening.left + preview.newLeftBV;
      const currentRight = preview.opening.right + preview.newRightBV;

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId,
          memberName: member?.name || '',
          personalBv: member?.personalBv || 0,
          activationLockedBV: member?.activationLockedBV || 0,
          isSelfBinaryActive: q.isSelfActive,
          isSponsorQualified: q.isSponsorQualified,
          hasLeftSponsor: q.hasLeftSponsor,
          hasRightSponsor: q.hasRightSponsor,
          leftQualifyingMembers: q.leftSponsorMembers,
          rightQualifyingMembers: q.rightSponsorMembers,
          leftTotalBV: vol?.leftTotalBV || 0,
          rightTotalBV: vol?.rightTotalBV || 0,
          leftMemberCount: legs.leftMemberIds.length,
          rightMemberCount: legs.rightMemberIds.length,
          // Unmatched BV right now: carry forward plus today's new BV
          carryLeftBV: Math.max(0, currentLeft),
          carryRightBV: Math.max(0, currentRight),
          reservedBV: preview.opening.reservedBV,
          reservedSide: preview.opening.reservedSide,
          payoutCount: preview.opening.payoutCount,
          matchedCycles: preview.opening.payoutCount,
          matchedBV: vol?.matchedTotalBV || 0,
          ratePerCycle: preview.ratePerMatch,
          totalBinaryIncome: incomeAgg[0]?.total || 0,
          dailyCap: preview.dailyCap,
          // Today's estimate; paid after the IST day ends
          today: {
            businessDate: preview.businessDate,
            newLeftBV: preview.newLeftBV,
            newRightBV: preview.newRightBV,
            matches: preview.matches,
            generatedAmount: preview.generatedAmount,
            creditedAmount: preview.creditedAmount,
            flushedAmount: preview.flushedAmount,
          },
          earnedToday: preview.creditedAmount,
          dailyCapUtilization: preview.dailyCap > 0 ? Math.min(100, Math.round((preview.generatedAmount / preview.dailyCap) * 100)) : 0,
          remainingCap: preview.dailyCap > 0 ? Math.max(0, preview.dailyCap - preview.creditedAmount) : null,
          isCapExceeded: preview.flushedAmount > 0,
          lastMatchedAt: vol?.lastMatchedAt || null,
          lastSettledDate: vol?.lastSettledDate || null,
        },
      });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * Live estimate for the current IST day: new BV per leg, carry forward, matches, cap and flush.
   * GET /api/binary/today/:memberId
   */
  async getToday(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const memberId = await resolveViewableMember(req, res);
      if (!memberId) return;
      const rules = await CompensationEngine.getActiveRules();
      const preview = await BinaryBonusService.previewToday(memberId, rules);
      if (!preview) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }
      res.status(HTTP_STATUS.OK).json({ status: true, data: preview });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * Daily binary history for a member, newest first, with totals for the range.
   * GET /api/binary/daily/:memberId?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=30
   */
  async getDailyHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const memberId = await resolveViewableMember(req, res);
      if (!memberId) return;
      const { page, limit, skip } = pageParams(req);
      const query: Record<string, any> = { memberId };
      const { from, to } = req.query;
      if (BusinessDate.isValid(from) || BusinessDate.isValid(to)) {
        query.businessDate = {};
        if (BusinessDate.isValid(from)) query.businessDate.$gte = from;
        if (BusinessDate.isValid(to)) query.businessDate.$lte = to;
      }

      const [records, total, totals] = await Promise.all([
        BinaryDailyClosing.find(query).sort({ businessDate: -1 }).skip(skip).limit(limit).select('-cycles -userId'),
        BinaryDailyClosing.countDocuments(query),
        BinaryDailyClosing.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              days: { $sum: 1 },
              matches: { $sum: '$matches' },
              newLeftBV: { $sum: '$newLeftBV' },
              newRightBV: { $sum: '$newRightBV' },
              generatedAmount: { $sum: '$generatedAmount' },
              creditedAmount: { $sum: '$creditedAmount' },
              flushedAmount: { $sum: '$flushedAmount' },
            },
          },
        ]),
      ]);

      const { _id, ...summary } = totals[0] || { _id: null };
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: records,
        totals: { days: 0, matches: 0, newLeftBV: 0, newRightBV: 0, generatedAmount: 0, creditedAmount: 0, flushedAmount: 0, ...summary },
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * BV movement ledger for a member (team credits, reversals, daily matching) with a summary.
   * GET /api/binary/ledger/:memberId?page=1&limit=50&leg=LEFT|RIGHT
   */
  async getLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const memberId = await resolveViewableMember(req, res);
      if (!memberId) return;
      const { page, limit, skip } = pageParams(req, 50);
      const query: Record<string, unknown> = { memberId };
      const leg = String(req.query.leg || '').toUpperCase();
      if (leg === 'LEFT' || leg === 'RIGHT') query.position = leg;

      const rules = await CompensationEngine.getActiveRules();
      const [preview, vol, records, total] = await Promise.all([
        BinaryBonusService.previewToday(memberId, rules),
        BinaryVolume.findOne({ memberId }),
        BVLedger.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        BVLedger.countDocuments(query),
      ]);
      if (!preview) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }
      const member = await Member.findOne({ memberId }).select('name personalBv activationLockedBV');
      const q = preview.qualification;

      res.status(HTTP_STATUS.OK).json({
        status: true,
        summary: {
          memberId,
          memberName: member?.name || '',
          isSelfBinaryActive: q.isSelfActive,
          personalBv: member?.personalBv || 0,
          activationLockedBV: member?.activationLockedBV || 0,
          isSponsorQualified: q.isSponsorQualified,
          hasLeftSponsor: q.hasLeftSponsor,
          hasRightSponsor: q.hasRightSponsor,
          leftQualifyingMembers: q.leftSponsorMembers,
          rightQualifyingMembers: q.rightSponsorMembers,
          leftTotalBV: vol?.leftTotalBV || 0,
          rightTotalBV: vol?.rightTotalBV || 0,
          leftAvailableBV: preview.opening.left,
          rightAvailableBV: preview.opening.right,
          leftCarryForwardBV: preview.opening.left,
          rightCarryForwardBV: preview.opening.right,
          leftPendingBV: preview.newLeftBV,
          rightPendingBV: preview.newRightBV,
          reservedBV: preview.opening.reservedBV,
          reservedSide: preview.opening.reservedSide,
          consumedTotalBV: vol?.consumedTotalBV || vol?.matchedTotalBV || 0,
          payoutCount: preview.opening.payoutCount,
          dailyCapping: preview.dailyCap,
          lastSettledDate: vol?.lastSettledDate || null,
        },
        data: records,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * Top binary earners. period=day (one date, default yesterday), week (7 days) or month (30 days),
   * all ending on `date`. Members see masked names; the Super Admin sees member IDs.
   * GET /api/binary/leaderboard?period=day|week|month&date=YYYY-MM-DD&limit=20
   */
  async getLeaderboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const period = ['day', 'week', 'month'].includes(String(req.query.period)) ? String(req.query.period) : 'day';
      const yesterday = BusinessDate.addDays(BusinessDate.today(), -1);
      const to = BusinessDate.isValid(req.query.date) && req.query.date <= yesterday ? req.query.date : yesterday;
      const from = period === 'week' ? BusinessDate.addDays(to, -6) : period === 'month' ? BusinessDate.addDays(to, -29) : to;
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

      const ranking = await BinaryDailyClosing.aggregate([
        { $match: { businessDate: { $gte: from, $lte: to }, creditedAmount: { $gt: 0 } } },
        {
          $group: {
            _id: '$memberId',
            memberName: { $last: '$memberName' },
            creditedAmount: { $sum: '$creditedAmount' },
            matches: { $sum: '$matches' },
            flushedAmount: { $sum: '$flushedAmount' },
          },
        },
        { $sort: { creditedAmount: -1, matches: -1, _id: 1 } },
      ]);

      const admin = isSuperAdmin(req);
      const viewerId = req.user?.memberId?.toUpperCase();
      const rows = ranking.map((r, i) => ({
        rank: i + 1,
        memberId: admin || r._id === viewerId ? r._id : undefined,
        memberName: admin || r._id === viewerId ? r.memberName : maskName(r.memberName),
        isMe: r._id === viewerId,
        creditedAmount: r.creditedAmount,
        matches: r.matches,
        ...(admin ? { flushedAmount: r.flushedAmount } : {}),
      }));

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          period,
          from,
          to,
          leaders: rows.slice(0, limit),
          me: rows.find((r) => r.isMe) || null,
          totalEarners: rows.length,
        },
      });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * Super Admin: daily settlement runs, newest first.
   * GET /api/binary/settlements?page=1&limit=30
   */
  async listSettlements(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = pageParams(req);
      const [runs, total] = await Promise.all([
        BinarySettlementRun.find().sort({ businessDate: -1 }).skip(skip).limit(limit),
        BinarySettlementRun.countDocuments(),
      ]);
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: runs,
        lastSettleableDate: BusinessDate.addDays(BusinessDate.today(), -1),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * Super Admin: one day's settlement with every member's closing (highest credited first).
   * GET /api/binary/settlements/:date?search=&page=1&limit=50
   */
  async getSettlement(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const businessDate = String(req.params.date || '');
      if (!BusinessDate.isValid(businessDate)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Date must be in YYYY-MM-DD format.' });
        return;
      }
      const { page, limit, skip } = pageParams(req, 50);
      const query: Record<string, unknown> = { businessDate };
      const search = String(req.query.search || '').trim();
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [{ memberId: search.toUpperCase() }, { memberName: { $regex: escaped, $options: 'i' } }];
      }
      const onlyEarners = String(req.query.earnersOnly || '') === 'true';
      if (onlyEarners) query.creditedAmount = { $gt: 0 };

      const [run, closings, total, totals] = await Promise.all([
        BinarySettlementRun.findOne({ businessDate }),
        BinaryDailyClosing.find(query).sort({ creditedAmount: -1, matches: -1, memberId: 1 }).skip(skip).limit(limit).select('-cycles -userId'),
        BinaryDailyClosing.countDocuments(query),
        DailyBinarySettlementService.summarizeDate(businessDate),
      ]);
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: { run, totals, closings },
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      fail(res, error);
    }
  },

  /**
   * Super Admin: settle a finished day now (default yesterday). Safe to repeat: members already
   * closed are skipped and failed wallet credits are retried.
   * POST /api/binary/settle-daily { date?: 'YYYY-MM-DD' }
   */
  async settleDaily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const date = req.body?.date ? String(req.body.date) : BusinessDate.addDays(BusinessDate.today(), -1);
      const run = await DailyBinarySettlementService.executeDailySettlement(date, req.user?.email || 'SUPERADMIN');
      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Binary settlement for ${date} completed: ${run.totals.earners} earner(s), ₹${run.totals.creditedAmount.toLocaleString('en-IN')} credited, ₹${run.totals.flushedAmount.toLocaleString('en-IN')} flushed.`,
        data: run,
      });
    } catch (error: any) {
      fail(res, error);
    }
  },
};
