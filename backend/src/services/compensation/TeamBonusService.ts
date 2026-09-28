import { Member } from '../../models/Member.model';
import { BinaryVolume } from '../../models/BinaryVolume.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE } from '../../config/constants';

export class TeamBonusService {
  /**
   * Process Team Bonus based on qualified volume tiers
   */
  static async processTeamBonus(
    memberId: string,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger | null> {
    const config = rules.teamBonus;
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

    // Find the highest qualifying tier where both left and right volume criteria are met
    // Sort tiers descending by volume requirements
    const sortedTiers = [...config.tiers].sort((a, b) => b.leftVolume - a.leftVolume);

    let qualifiedTier: (typeof config.tiers)[0] | null = null;
    for (const tier of sortedTiers) {
      if (left >= tier.leftVolume && right >= tier.rightVolume) {
        qualifiedTier = tier;
        break;
      }
    }

    if (!qualifiedTier) {
      return null;
    }

    // Determine calculation base
    let baseVolume = 0;
    switch (config.calculationBase) {
      case 'MATCHED_BV':
        baseVolume = DecimalUtil.min(left, right);
        break;
      case 'LEFT_BV':
        baseVolume = left;
        break;
      case 'RIGHT_BV':
        baseVolume = right;
        break;
      case 'TOTAL_TEAM_BV':
      default:
        baseVolume = left + right;
        break;
    }

    if (baseVolume <= 0) {
      return null;
    }

    const rawBonus = DecimalUtil.multiplyRate(baseVolume, qualifiedTier.rate);
    if (rawBonus <= 0) {
      return null;
    }

    const tdsDeduction = DecimalUtil.multiplyPercent(rawBonus, 5);
    const adminFee = DecimalUtil.multiplyPercent(rawBonus, 5);
    const netPayable = DecimalUtil.sub(rawBonus, DecimalUtil.add(tdsDeduction, adminFee));

    const ledgerId = `COMM-TEAM-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const commission = await CommissionLedger.create({
      ledgerId,
      userId: member._id.toString(),
      memberId,
      type: COMMISSION_TYPE.TEAM_BONUS,
      sourceEventId,
      sourcePurchaseId,
      grossAmount: rawBonus,
      grossAmountInPaise: DecimalUtil.toPaise(rawBonus),
      tdsDeduction,
      tdsDeductionInPaise: DecimalUtil.toPaise(tdsDeduction),
      adminFee,
      adminFeeInPaise: DecimalUtil.toPaise(adminFee),
      payableAmount: netPayable,
      payableAmountInPaise: DecimalUtil.toPaise(netPayable),
      status: 'APPROVED',
      calculationDetails: {
        sourcePurchaseId,
        sourceEventId,
        calculationBase: config.calculationBase,
        baseBV: baseVolume,
        rateApplied: qualifiedTier.rate,
        percentageApplied: qualifiedTier.rate * 100,
        tierApplied: `${qualifiedTier.leftVolume}:${qualifiedTier.rightVolume} (${(qualifiedTier.rate * 100).toFixed(0)}%)`,
        leftVolume: left,
        rightVolume: right,
        notes: `Qualified Tier ${qualifiedTier.leftVolume}:${qualifiedTier.rightVolume} with Left: ${left}, Right: ${right}`,
      },
      isReversed: false,
    });

    await WalletService.creditCommission(
      memberId,
      netPayable,
      ledgerId,
      `Team Volume Bonus (${qualifiedTier.leftVolume}:${qualifiedTier.rightVolume})`
    );

    return commission;
  }
}
