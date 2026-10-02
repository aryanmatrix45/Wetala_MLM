import { Request, Response } from 'express';
import { CompensationRule } from '../models/CompensationRule.model';
import { CommissionLedger } from '../models/CommissionLedger.model';
import { AuditService } from '../services/AuditService';
import { CapService } from '../services/compensation/CapService';
import { DecimalUtil } from '../utils/decimal';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const CompensationController = {
  /**
   * Get active compensation rules
   * GET /api/compensation/rules
   */
  async getRules(_req: Request, res: Response): Promise<void> {
    try {
      let rules: any = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
      if (!rules) {
        rules = await CompensationRule.findOne().sort({ version: -1 });
        if (rules) {
          rules.isActive = true;
          await rules.save();
        }
      }
      if (!rules) {
        // Return default initialized rules
        const { CompensationEngine } = await import('../services/compensation/CompensationEngine');
        rules = await CompensationEngine.getActiveRules();
      }
      res.status(HTTP_STATUS.OK).json({ status: true, data: rules });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin update compensation rules with audit logging
   * PUT /api/compensation/rules
   */
  async updateRules(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const existingRules = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
      const currentVersion = existingRules ? existingRules.version : 0;

      // Create new version for immutability / change history
      const newVersion = currentVersion + 1;
      const updatedData = { ...req.body, version: newVersion, isActive: true };
      delete updatedData._id;

      if (existingRules) {
        existingRules.isActive = false;
        await existingRules.save();
      }

      const newRules = await CompensationRule.create(updatedData);

      // Audit Log
      await AuditService.log({
        action: 'UPDATE_COMPENSATION_RULES',
        entity: 'COMPENSATION_RULE',
        entityId: newRules._id.toString(),
        performedBy: req.user ? req.user.email : 'SUPERADMIN',
        oldValues: existingRules ? existingRules.toObject() : null,
        newValues: newRules.toObject(),
        reason: req.body.reason || 'Admin compensation configuration change',
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Compensation rules updated to version ${newVersion}`,
        data: newRules,
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Compensation Simulator (Admin Only)
   * POST /api/compensation/simulate
   * Does NOT modify production data.
   */
  async simulateCompensation(req: Request, res: Response): Promise<void> {
    try {
      const {
        leftBV = 0,
        rightBV = 0,
        binaryRate = 0.20,
        dailyCap = 4000,
        alreadyEarnedToday = 0,
        teamVolume = 0,
        purchaseAmount = 0,
      } = req.body;

      // 1. Binary Matching Simulation
      const matchedBV = DecimalUtil.min(leftBV, rightBV);
      const remainingLeftBV = DecimalUtil.sub(leftBV, matchedBV);
      const remainingRightBV = DecimalUtil.sub(rightBV, matchedBV);
      const rawBinaryCommission = DecimalUtil.multiplyRate(matchedBV, binaryRate);

      // Daily Cap Calculation
      const remainingCap = Math.max(0, DecimalUtil.sub(dailyCap, alreadyEarnedToday));
      let payableBinaryCommission = 0;
      let excessCommission = 0;

      if (rawBinaryCommission <= remainingCap) {
        payableBinaryCommission = rawBinaryCommission;
        excessCommission = 0;
      } else {
        payableBinaryCommission = remainingCap;
        excessCommission = DecimalUtil.sub(rawBinaryCommission, remainingCap);
      }

      // 2. Team Bonus Tier Simulation (1000:15%, 2500:10%, etc.)
      const tiers = [
        { leftVolume: 1000, rightVolume: 1000, rate: 0.15 },
        { leftVolume: 2500, rightVolume: 2500, rate: 0.10 },
        { leftVolume: 7500, rightVolume: 7500, rate: 0.07 },
        { leftVolume: 25000, rightVolume: 25000, rate: 0.06 },
        { leftVolume: 35000, rightVolume: 35000, rate: 0.05 },
        { leftVolume: 70000, rightVolume: 70000, rate: 0.04 },
        { leftVolume: 150000, rightVolume: 150000, rate: 0.03 },
        { leftVolume: 300000, rightVolume: 300000, rate: 0.02 },
      ].sort((a, b) => b.leftVolume - a.leftVolume);

      let qualifiedTeamTier: (typeof tiers)[0] | null = null;
      for (const t of tiers) {
        if (leftBV >= t.leftVolume && rightBV >= t.rightVolume) {
          qualifiedTeamTier = t;
          break;
        }
      }

      const teamBonusAmount = qualifiedTeamTier
        ? DecimalUtil.multiplyRate(matchedBV || teamVolume, qualifiedTeamTier.rate)
        : 0;

      // 3. Self Purchase Repurchase Bonus (8%)
      const selfPurchaseBonus = purchaseAmount > 0 ? DecimalUtil.multiplyPercent(purchaseAmount, 8) : 0;

      // 4. Franchise Tier Simulation
      const franchiseTiers = [
        { threshold: 50000, rate: 0.05 },
        { threshold: 100000, rate: 0.08 },
        { threshold: 500000, rate: 0.10 },
        { threshold: 1000000, rate: 0.12 },
      ].sort((a, b) => b.threshold - a.threshold);

      let qualifiedFranchiseTier: (typeof franchiseTiers)[0] | null = null;
      for (const f of franchiseTiers) {
        if (purchaseAmount >= f.threshold) {
          qualifiedFranchiseTier = f;
          break;
        }
      }

      const franchiseBonus = qualifiedFranchiseTier
        ? DecimalUtil.multiplyRate(purchaseAmount, qualifiedFranchiseTier.rate)
        : 0;

      res.status(HTTP_STATUS.OK).json({
        status: true,
        simulation: {
          binaryMatching: {
            leftBV,
            rightBV,
            matchedBV,
            remainingLeftBV,
            remainingRightBV,
            rateApplied: binaryRate,
            percentage: binaryRate * 100,
            rawCommission: rawBinaryCommission,
            dailyCap,
            alreadyEarnedToday,
            remainingCap,
            payableCommission: payableBinaryCommission,
            excessCommission,
          },
          teamBonus: {
            qualifiedTier: qualifiedTeamTier ? `${qualifiedTeamTier.leftVolume}:${qualifiedTeamTier.rightVolume}` : 'None',
            rateApplied: qualifiedTeamTier ? qualifiedTeamTier.rate * 100 : 0,
            calculatedBonus: teamBonusAmount,
          },
          selfPurchaseBonus: {
            rate: '8%',
            calculatedBonus: selfPurchaseBonus,
          },
          franchiseBonus: {
            qualifiedTier: qualifiedFranchiseTier ? `₹${qualifiedFranchiseTier.threshold}` : 'None',
            rateApplied: qualifiedFranchiseTier ? qualifiedFranchiseTier.rate * 100 : 0,
            calculatedBonus: franchiseBonus,
          },
          totalSimulatedCommission: DecimalUtil.add(
            payableBinaryCommission,
            DecimalUtil.add(teamBonusAmount, DecimalUtil.add(selfPurchaseBonus, franchiseBonus))
          ),
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Commission Explanation API
   * GET /api/compensation/commission/:commissionId
   * Explains why a user received this commission with complete arithmetic steps.
   */
  async getCommissionExplanation(req: Request, res: Response): Promise<void> {
    try {
      const { commissionId } = req.params;
      const commission = await CommissionLedger.findOne({
        $or: [{ ledgerId: commissionId }, { _id: commissionId }],
      });

      if (!commission) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Commission ledger record not found.' });
        return;
      }

      const details = commission.calculationDetails || {};
      const explanation = {
        commissionId: commission.ledgerId,
        memberId: commission.memberId,
        commissionType: commission.type,
        status: commission.status,
        date: commission.createdAt,
        breakdown: {
          sourcePurchaseId: commission.sourcePurchaseId || 'N/A',
          sourceEventId: commission.sourceEventId,
          sourceMemberId: details.sourceMemberId || 'N/A',
          leftVolume: details.leftVolume !== undefined ? `${details.leftVolume} BV` : 'N/A',
          rightVolume: details.rightVolume !== undefined ? `${details.rightVolume} BV` : 'N/A',
          matchedVolume: details.matchedVolume !== undefined ? `${details.matchedVolume} BV` : 'N/A',
          calculationBase: details.calculationBase || 'N/A',
          rateApplied: details.rateApplied ? `${(details.rateApplied * 100).toFixed(0)}%` : details.percentageApplied ? `${details.percentageApplied}%` : 'N/A',
          rawGrossAmount: `₹${commission.grossAmount}`,
          dailyCapRemaining: details.dailyCapRemaining !== undefined ? `₹${details.dailyCapRemaining}` : 'N/A',
          excessAmount: details.excessAmount !== undefined ? `₹${details.excessAmount}` : '₹0',
          excessHandling: details.excessPolicyApplied || 'FLUSH',
          deductions: {
            tds5Percent: `₹${commission.tdsDeduction}`,
            adminFee5Percent: `₹${commission.adminFee}`,
            totalDeductions: `₹${DecimalUtil.add(commission.tdsDeduction, commission.adminFee)}`,
          },
          netPayableCommission: `₹${commission.payableAmount}`,
          notes: details.notes || 'Commission processed according to company rules.',
        },
      };

      res.status(HTTP_STATUS.OK).json({ status: true, data: explanation });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Query Commission Ledger with filters
   * GET /api/commissions
   */
  async getCommissions(req: Request, res: Response): Promise<void> {
    try {
      const { memberId, type, status, limit = 50, page = 1 } = req.query;
      const query: any = {};

      if (memberId) query.memberId = memberId;
      if (type) query.type = type;
      if (status) query.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [commissions, total] = await Promise.all([
        CommissionLedger.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        CommissionLedger.countDocuments(query),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: commissions,
        pagination: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
