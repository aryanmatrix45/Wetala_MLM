import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { SponsorTreeService } from '../services/tree/SponsorTreeService';
import { Member } from '../models/Member.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { HTTP_STATUS, COMMISSION_TYPE, ROLES } from '../config/constants';
import { DecimalUtil } from '../utils/decimal';
import { BusinessDate } from '../utils/businessDate';

/** Sponsor income is personal: members see only their own; the Super Admin may look at anyone's */
const resolveIncomeViewer = (req: AuthenticatedRequest, res: Response): string | null => {
  const memberId = String(req.params.memberId || '').trim().toUpperCase();
  if (!memberId) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID is required.' });
    return null;
  }
  if (req.user?.role?.toLowerCase() === ROLES.SUPERADMIN) return memberId;
  if ((req.user?.memberId || '').toUpperCase() === memberId) return memberId;
  res.status(HTTP_STATUS.FORBIDDEN).json({ status: false, message: 'You can only view your own sponsor income.' });
  return null;
};

/** One sponsor income credit as the UI shows it */
const toPayoutRow = (c: any) => ({
  ledgerId: c.ledgerId,
  businessDate: c.calculationDetails?.businessDate || BusinessDate.of(c.createdAt),
  sourceMemberId: c.calculationDetails?.sourceMemberId || 'Direct Team',
  sourceMemberName: c.calculationDetails?.sourceMemberName || '',
  baseAmount: c.calculationDetails?.baseAmount || 0,
  ratePercent: c.calculationDetails?.percentageApplied ?? DecimalUtil.round((c.calculationDetails?.rateApplied || 0) * 100),
  grossAmount: c.grossAmount,
  netPayable: c.payableAmount ?? c.grossAmount,
  createdAt: c.createdAt,
  notes: c.calculationDetails?.notes,
});

export const SponsorController = {
  /**
   * Get unilevel sponsor referral tree
   * GET /api/sponsor/tree?root=MEM0001&depth=3
   */
  async getTree(req: Request, res: Response): Promise<void> {
    try {
      const rootId = (req.query.root as string) || 'MEM0001';
      const depth = parseInt((req.query.depth as string) || '3', 10);

      const tree = await SponsorTreeService.getSponsorTree(rootId, depth);
      if (!tree) {
        const firstMember = await Member.findOne().sort({ createdAt: 1 });
        if (firstMember) {
          const fallback = await SponsorTreeService.getSponsorTree(firstMember.memberId, depth);
          res.status(HTTP_STATUS.OK).json({ status: true, data: fallback });
          return;
        }
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Sponsor tree root not found.' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({ status: true, data: tree });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get direct referrals for a sponsor
   * GET /api/sponsor/directs/:memberId
   */
  async getDirectReferrals(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const directs = await SponsorTreeService.getDirectReferrals(memberId);
      res.status(HTTP_STATUS.OK).json({ status: true, data: directs });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Sponsor income summary: totals, each directly sponsored member's binary income and the sponsor
   * income it generated, and the latest daily credits.
   * GET /api/sponsor/income/summary/:memberId
   */
  async getSponsorIncomeSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const cleanId = resolveIncomeViewer(req, res);
      if (!cleanId) return;

      const member = await Member.findOne({ memberId: cleanId }).select('memberId name');
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found.' });
        return;
      }

      const rules = await CompensationEngine.getActiveRules();
      const config = rules.sponsorBinaryBonus;
      const appliedRatePercent = DecimalUtil.round((config?.sponsorBinaryRate ?? 0.2) * 100);

      const earned = { memberId: cleanId, type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS, isReversed: false };
      const month = BusinessDate.today().slice(0, 7);
      const [directMembers, bySource, monthRows, recent] = await Promise.all([
        Member.find({ sponsorId: cleanId }).sort({ createdAt: -1 }).lean(),
        CommissionLedger.aggregate([
          { $match: earned },
          {
            $group: {
              _id: '$calculationDetails.sourceMemberId',
              gross: { $sum: '$grossAmount' },
              net: { $sum: { $ifNull: ['$payableAmount', '$grossAmount'] } },
              lastAt: { $max: '$createdAt' },
            },
          },
        ]),
        CommissionLedger.aggregate([
          {
            $match: {
              ...earned,
              $or: [
                { 'calculationDetails.businessDate': { $gte: `${month}-01`, $lte: `${month}-31` } },
                // Older rows were written before sponsor income was tied to a business day
                { 'calculationDetails.businessDate': { $exists: false }, createdAt: { $gte: BusinessDate.startOf(`${month}-01`) } },
              ],
            },
          },
          { $group: { _id: null, net: { $sum: { $ifNull: ['$payableAmount', '$grossAmount'] } } } },
        ]),
        CommissionLedger.find(earned).sort({ createdAt: -1 }).limit(10).lean(),
      ]);

      const directIds = directMembers.map((d) => d.memberId);
      const binaryRows = await CommissionLedger.aggregate([
        { $match: { memberId: { $in: directIds }, type: COMMISSION_TYPE.BINARY_BONUS, isReversed: false } },
        { $group: { _id: '$memberId', total: { $sum: { $ifNull: ['$payableAmount', '$grossAmount'] } } } },
      ]);
      const binaryByMember = new Map(binaryRows.map((r) => [r._id as string, r.total as number]));
      const sponsorBySource = new Map(bySource.map((r) => [r._id as string, r]));

      const directTeamBreakdown = directMembers.map((direct) => {
        const generated = sponsorBySource.get(direct.memberId);
        return {
          memberId: direct.memberId,
          name: direct.name,
          email: direct.email,
          mobile: direct.mobile,
          position: direct.position || 'N/A',
          status: direct.status || 'active',
          packageName: direct.packageName || 'Starter',
          joinDate: direct.createdAt,
          binaryEarnings: DecimalUtil.round(binaryByMember.get(direct.memberId) || 0),
          sponsorBonusGenerated: DecimalUtil.round(generated?.gross || 0),
          sponsorBonusNet: DecimalUtil.round(generated?.net || 0),
          lastBonusAt: generated?.lastAt ? new Date(generated.lastAt).toISOString() : null,
        };
      });

      const totalGrossBonus = DecimalUtil.round(bySource.reduce((sum, r) => sum + (r.gross || 0), 0));
      const totalNetCredited = DecimalUtil.round(bySource.reduce((sum, r) => sum + (r.net || 0), 0));

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId: cleanId,
          memberName: member.name,
          kpis: {
            totalGrossBonus,
            totalNetCredited,
            thisMonth: DecimalUtil.round(monthRows[0]?.net || 0),
            directTeamCount: directMembers.length,
            earningDirectsCount: directTeamBreakdown.filter((d) => d.binaryEarnings > 0).length,
            appliedRatePercent,
            isEnabled: config?.isEnabled !== false,
            isUncapped: true,
            noLegRequirement: true,
          },
          directTeamBreakdown,
          recentPayouts: recent.map(toPayoutRow),
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Sponsor income credits, newest first
   * GET /api/sponsor/income/history/:memberId?page=1&limit=20
   */
  async getSponsorIncomeHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const cleanId = resolveIncomeViewer(req, res);
      if (!cleanId) return;
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '20', 10) || 20));
      const filter = { memberId: cleanId, type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS, isReversed: false };

      const [total, records] = await Promise.all([
        CommissionLedger.countDocuments(filter),
        CommissionLedger.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: { total, page, totalPages: Math.ceil(total / limit), records: records.map(toPayoutRow) },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
