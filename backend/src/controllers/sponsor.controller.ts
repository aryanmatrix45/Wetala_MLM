import { Request, Response } from 'express';
import { SponsorTreeService } from '../services/tree/SponsorTreeService';
import { Member } from '../models/Member.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { HTTP_STATUS, COMMISSION_TYPE } from '../config/constants';
import { DecimalUtil } from '../utils/decimal';
import { DeductionUtil } from '../utils/deduction.util';

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
   * Get Sponsor Binary Income Summary and direct referrals breakdown
   * GET /api/sponsor/income/summary/:memberId
   */
  async getSponsorIncomeSummary(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const cleanId = (memberId || '').trim().toUpperCase();

      const member = await Member.findOne({ memberId: cleanId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found.' });
        return;
      }

      // Fetch active compensation rules to get configured rate & deduction settings
      const rules = await CompensationEngine.getActiveRules();
      const sponsorBonusConfig = rules.sponsorBinaryBonus || { isEnabled: true, sponsorBinaryRate: 0.20 };
      const appliedRatePercent = (sponsorBonusConfig.sponsorBinaryRate || 0.20) * 100;

      // Deductions configuration: admin configurable, can be set to 0%
      const deductionsConfig = rules.payoutDeductions;
      const isDeductionsEnabled = deductionsConfig?.isEnabled ?? true;
      const tdsPercent = isDeductionsEnabled
        ? (sponsorBonusConfig.tdsPercent !== undefined ? sponsorBonusConfig.tdsPercent : (deductionsConfig?.tdsPercent ?? 5))
        : 0;
      const adminFeePercent = isDeductionsEnabled
        ? (sponsorBonusConfig.adminFeePercent !== undefined ? sponsorBonusConfig.adminFeePercent : (deductionsConfig?.adminFeePercent ?? 5))
        : 0;
      const netPercent = Math.max(0, 100 - (tdsPercent + adminFeePercent));

      // Fetch all sponsor bonus commissions earned by this member
      const sponsorCommissions = await CommissionLedger.find({
        memberId: cleanId,
        type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
        isReversed: false,
      }).sort({ createdAt: -1 });

      let totalGrossBonus = 0;
      let totalTdsDeducted = 0;
      let totalAdminFeeDeducted = 0;
      let totalNetCredited = 0;

      sponsorCommissions.forEach((comm) => {
        totalGrossBonus = DecimalUtil.add(totalGrossBonus, comm.grossAmount || 0);
        totalTdsDeducted = DecimalUtil.add(totalTdsDeducted, comm.tdsDeduction || 0);
        totalAdminFeeDeducted = DecimalUtil.add(totalAdminFeeDeducted, comm.adminFee || 0);
        totalNetCredited = DecimalUtil.add(totalNetCredited, comm.payableAmount || 0);
      });

      // Fetch direct referrals sponsored by this member
      const directMembers = await Member.find({ sponsorId: cleanId }).sort({ createdAt: -1 });

      // Build performance map for each direct referral
      const directTeamBreakdown = await Promise.all(
        directMembers.map(async (direct) => {
          // Find binary earnings of this direct member
          const binaryCommissions = await CommissionLedger.find({
            memberId: direct.memberId,
            type: COMMISSION_TYPE.BINARY_BONUS,
            isReversed: false,
          });

          let directBinaryEarnings = 0;
          binaryCommissions.forEach((b) => {
            directBinaryEarnings = DecimalUtil.add(directBinaryEarnings, b.payableAmount || b.grossAmount || 0);
          });

          // Find sponsor commissions generated from this direct member
          const generatedCommissions = sponsorCommissions.filter(
            (sc) => sc.calculationDetails?.sourceMemberId === direct.memberId
          );

          let generatedGross = 0;
          let generatedNet = 0;
          let lastBonusAt: string | null = null;

          if (generatedCommissions.length > 0) {
            generatedCommissions.forEach((gc) => {
              generatedGross = DecimalUtil.add(generatedGross, gc.grossAmount || 0);
              generatedNet = DecimalUtil.add(generatedNet, gc.payableAmount || 0);
            });
            lastBonusAt = generatedCommissions[0].createdAt.toISOString();
          }

          return {
            memberId: direct.memberId,
            name: direct.name,
            email: direct.email,
            mobile: direct.mobile,
            position: direct.position || 'N/A',
            status: direct.status || 'active',
            packageName: direct.packageName || 'Starter',
            joinDate: direct.createdAt,
            binaryEarnings: directBinaryEarnings,
            sponsorBonusGenerated: generatedGross,
            sponsorBonusNet: generatedNet,
            lastBonusAt,
          };
        })
      );

      const earningDirectsCount = directTeamBreakdown.filter((d) => d.binaryEarnings > 0).length;

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId: cleanId,
          memberName: member.name,
          kpis: {
            totalGrossBonus,
            totalTdsDeducted,
            totalAdminFeeDeducted,
            totalNetCredited,
            directTeamCount: directMembers.length,
            earningDirectsCount,
            appliedRatePercent,
            isUncapped: true,
            noLegRequirement: true,
            deductions: {
              isEnabled: isDeductionsEnabled,
              tdsPercent,
              adminFeePercent,
              netPercent,
            },
          },
          directTeamBreakdown,
          recentPayouts: sponsorCommissions.slice(0, 10).map((c) => ({
            ledgerId: c.ledgerId,
            sourceMemberId: c.calculationDetails?.sourceMemberId || 'Direct Team',
            grossAmount: c.grossAmount,
            tdsDeduction: c.tdsDeduction,
            adminFee: c.adminFee,
            netPayable: c.payableAmount,
            createdAt: c.createdAt,
            notes: c.calculationDetails?.notes,
          })),
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get detailed history of sponsor binary bonus ledger entries
   * GET /api/sponsor/income/history/:memberId
   */
  async getSponsorIncomeHistory(req: Request, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const cleanId = (memberId || '').trim().toUpperCase();
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const skip = (page - 1) * limit;

      const total = await CommissionLedger.countDocuments({
        memberId: cleanId,
        type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
        isReversed: false,
      });

      const records = await CommissionLedger.find({
        memberId: cleanId,
        type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
        isReversed: false,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          records,
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
