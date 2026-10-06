import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { BinaryVolume } from '../../models/BinaryVolume.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { DeductionUtil } from '../../utils/deduction.util';
import { COMMISSION_TYPE } from '../../config/constants';

export class TeamPerformanceService {
  /**
   * Process Team Performance Bonus based on balanced milestone thresholds.
   * Configurable and disabled by default until company confirms exact payout formula.
   */
  static async processTeamPerformanceBonus(
    memberId: string,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger | null> {
    const config = rules.teamPerformanceBonus;

    // Disabled until formula confirmed
    if (!config.isEnabled || !config.tiers || config.tiers.length === 0) {
      return null;
    }

    const member = await Member.findOne({ memberId });
    if (!member || !member.isActive) {
      return null;
    }

    const vol = await BinaryVolume.findOne({ memberId });
    if (!vol) {
      return null;
    }

    const left = vol.leftTotalBV;
    const right = vol.rightTotalBV;

    // Sort descending by threshold
    const sortedTiers = [...config.tiers].sort((a, b) => b.leftThreshold - a.leftThreshold);
    let qualifiedTier: (typeof config.tiers)[0] | null = null;

    for (const tier of sortedTiers) {
      if (left >= tier.leftThreshold && right >= tier.rightThreshold) {
        qualifiedTier = tier;
        break;
      }
    }

    if (!qualifiedTier) {
      return null;
    }

    let rawBonus = 0;
    if (qualifiedTier.royaltyBonusPercent > 0) {
      // In company pool calculation, qualifies for royaltyBonusPercent of CTO, up to limitAmount
      rawBonus = qualifiedTier.limitAmount || 10000;
    }

    if (rawBonus <= 0) {
      return null;
    }

    const deductions = DeductionUtil.calculateDeductions(rawBonus, rules);

    const ledgerId = `COMM-PERF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const commission = await CommissionLedger.create({
      ledgerId,
      userId: member._id.toString(),
      memberId,
      type: COMMISSION_TYPE.TEAM_PERFORMANCE_BONUS,
      sourceEventId,
      sourcePurchaseId,
      grossAmount: rawBonus,
      grossAmountInPaise: DecimalUtil.toPaise(rawBonus),
      tdsDeduction: deductions.tdsDeduction,
      tdsDeductionInPaise: DecimalUtil.toPaise(deductions.tdsDeduction),
      adminFee: deductions.adminFee,
      adminFeeInPaise: DecimalUtil.toPaise(deductions.adminFee),
      payableAmount: deductions.netPayable,
      payableAmountInPaise: DecimalUtil.toPaise(deductions.netPayable),
      status: 'APPROVED',
      calculationDetails: {
        sourcePurchaseId,
        sourceEventId,
        tierApplied: `${qualifiedTier.leftThreshold}:${qualifiedTier.rightThreshold}`,
        tdsRateApplied: deductions.tdsRate,
        adminFeeRateApplied: deductions.adminFeeRate,
        notes: `Team Performance Bonus for milestone ${qualifiedTier.leftThreshold}:${qualifiedTier.rightThreshold}`,
      },
      isReversed: false,
    });

    await WalletService.creditCommission(
      memberId,
      deductions.netPayable,
      ledgerId,
      `Team Performance Bonus (${qualifiedTier.leftThreshold}:${qualifiedTier.rightThreshold})`
    );

    return commission;
  }
}
