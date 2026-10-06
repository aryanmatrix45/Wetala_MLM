import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { BinaryVolume } from '../../models/BinaryVolume.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { DeductionUtil } from '../../utils/deduction.util';
import { COMMISSION_TYPE } from '../../config/constants';

export class RewardService {
  /**
   * Evaluate and grant lifetime milestone rewards based on matched pairs or threshold counts.
   * Only rewards with confirmed non-null reward amounts are credited.
   * Prevents granting the same tier reward more than once.
   */
  static async evaluateRewards(
    memberId: string,
    rules: ICompensationRule,
    sourceEventId: string
  ): Promise<ICommissionLedger[]> {
    const config = rules.rewards;
    if (!config.isEnabled || !config.tiers || config.tiers.length === 0) {
      return [];
    }

    const member = await Member.findOne({ memberId });
    if (!member || !member.isActive) {
      return [];
    }

    const vol = await BinaryVolume.findOne({ memberId });
    // Pairs can be matched pairs or threshold count (e.g. matchedPairs or total units)
    const leftCount = vol ? Math.floor(vol.leftTotalBV / 1000) : 0;
    const rightCount = vol ? Math.floor(vol.rightTotalBV / 1000) : 0;

    const grantedRewards: ICommissionLedger[] = [];

    for (const tier of config.tiers) {
      // Must have confirmed non-null reward amount
      if (tier.rewardAmount === null || tier.rewardAmount <= 0) {
        continue;
      }

      // Check qualification
      if (leftCount >= tier.leftRequirement && rightCount >= tier.rightRequirement) {
        // Verify not already granted
        const existingReward = await CommissionLedger.findOne({
          memberId,
          type: COMMISSION_TYPE.REWARD,
          'calculationDetails.tierApplied': `${tier.leftRequirement}:${tier.rightRequirement}`,
        });

        if (existingReward) {
          continue; // already awarded
        }

        const rawAmount = tier.rewardAmount;
        const deductions = DeductionUtil.calculateDeductions(rawAmount, rules);

        const ledgerId = `COMM-REW-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        const commission = await CommissionLedger.create({
          ledgerId,
          userId: member._id.toString(),
          memberId,
          type: COMMISSION_TYPE.REWARD,
          sourceEventId,
          grossAmount: rawAmount,
          grossAmountInPaise: DecimalUtil.toPaise(rawAmount),
          tdsDeduction: deductions.tdsDeduction,
          tdsDeductionInPaise: DecimalUtil.toPaise(deductions.tdsDeduction),
          adminFee: deductions.adminFee,
          adminFeeInPaise: DecimalUtil.toPaise(deductions.adminFee),
          payableAmount: deductions.netPayable,
          payableAmountInPaise: DecimalUtil.toPaise(deductions.netPayable),
          status: 'APPROVED',
          calculationDetails: {
            sourceEventId,
            tierApplied: `${tier.leftRequirement}:${tier.rightRequirement}`,
            tdsRateApplied: deductions.tdsRate,
            adminFeeRateApplied: deductions.adminFeeRate,
            notes: `Lifetime Milestone Reward: ${tier.rewardTitle} (${tier.leftRequirement}:${tier.rightRequirement})`,
          },
          isReversed: false,
        });

        await WalletService.creditCommission(
          memberId,
          deductions.netPayable,
          ledgerId,
          `Lifetime Reward: ${tier.rewardTitle} (₹${rawAmount})`
        );

        grantedRewards.push(commission);
      }
    }

    return grantedRewards;
  }
}
