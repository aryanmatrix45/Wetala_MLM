import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { SponsorTreeService } from '../tree/SponsorTreeService';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE } from '../../config/constants';

export class UplineBonusService {
  /**
   * Process 2% Upline Bonus across configured upline generations.
   */
  static async processUplineBonus(
    purchaserMemberId: string,
    purchaseAmount: number,
    purchaseBV: number,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger[]> {
    const config = rules.uplineBonus;
    if (!config.isEnabled || config.uplineBonusRate <= 0) {
      return [];
    }

    const purchaser = await Member.findOne({ memberId: purchaserMemberId });
    if (!purchaser || !purchaser.sponsorId) {
      return [];
    }

    const uplineChain = await SponsorTreeService.getSponsorUplineChain(purchaserMemberId, config.maxUplineLevels || 1);
    const commissions: ICommissionLedger[] = [];

    const baseValue = config.calculationBase === 'BV' ? purchaseBV : purchaseAmount;
    if (baseValue <= 0) {
      return [];
    }

    for (let level = 0; level < uplineChain.length; level++) {
      const upline = uplineChain[level];
      if (!upline.isActive || upline.status === 'blocked') continue;

      const rate = config.uplineBonusRate;
      const rawBonus = DecimalUtil.multiplyRate(baseValue, rate);
      if (rawBonus <= 0) continue;

      const tdsDeduction = DecimalUtil.multiplyPercent(rawBonus, 5);
      const adminFee = DecimalUtil.multiplyPercent(rawBonus, 5);
      const netPayable = DecimalUtil.sub(rawBonus, DecimalUtil.add(tdsDeduction, adminFee));

      const ledgerId = `COMM-UPL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const commission = await CommissionLedger.create({
        ledgerId,
        userId: upline._id.toString(),
        memberId: upline.memberId,
        type: COMMISSION_TYPE.UPLINE_BONUS,
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
          sourceMemberId: purchaserMemberId,
          calculationBase: config.calculationBase,
          baseAmount: baseValue,
          rateApplied: rate,
          percentageApplied: rate * 100,
          tierApplied: `Generation ${level + 1} Upline`,
          notes: `Upline Bonus from ${purchaser.name} (${purchaserMemberId}) @ ${(rate * 100).toFixed(0)}%`,
        },
        isReversed: false,
      });

      await WalletService.creditCommission(
        upline.memberId,
        netPayable,
        ledgerId,
        `Upline Bonus from ${purchaser.name} (${purchaserMemberId})`
      );

      commissions.push(commission);
    }

    return commissions;
  }
}
