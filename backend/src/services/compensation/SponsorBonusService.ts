import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { SponsorTreeService } from '../tree/SponsorTreeService';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE } from '../../config/constants';

export class SponsorBonusService {
  /**
   * Process Sponsor Bonus when a sponsored direct member achieves binary income or volume.
   * Based on configurable rate (e.g. 20%) and calculation base.
   */
  static async processSponsorBonus(
    earnerMemberId: string,
    qualifyingAmountOrIncome: number,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger[]> {
    const config = rules.sponsorBinaryBonus;
    if (!config.isEnabled || qualifyingAmountOrIncome <= 0) {
      return [];
    }

    const earner = await Member.findOne({ memberId: earnerMemberId });
    if (!earner || !earner.sponsorId) {
      return [];
    }

    // Get sponsor upline chain according to configured depth (default 1 = direct sponsor)
    const sponsors = await SponsorTreeService.getSponsorUplineChain(earnerMemberId, config.sponsorDepth || 1);
    const commissions: ICommissionLedger[] = [];

    for (let level = 0; level < sponsors.length; level++) {
      const sponsor = sponsors[level];
      if (!sponsor.isActive || sponsor.status === 'blocked') continue;

      // Rate can apply directly or scaled by level
      const rate = config.sponsorBinaryRate;
      let rawBonus = DecimalUtil.multiplyRate(qualifyingAmountOrIncome, rate);

      if (config.maxPayout && rawBonus > config.maxPayout) {
        rawBonus = config.maxPayout;
      }

      if (rawBonus <= 0) continue;

      const tdsDeduction = DecimalUtil.multiplyPercent(rawBonus, 5);
      const adminFee = DecimalUtil.multiplyPercent(rawBonus, 5);
      const netPayable = DecimalUtil.sub(rawBonus, DecimalUtil.add(tdsDeduction, adminFee));

      const ledgerId = `COMM-SPO-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const commission = await CommissionLedger.create({
        ledgerId,
        userId: sponsor._id.toString(),
        memberId: sponsor.memberId,
        type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
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
          sourceMemberId: earnerMemberId,
          calculationBase: config.calculationBase,
          baseAmount: qualifyingAmountOrIncome,
          rateApplied: rate,
          percentageApplied: rate * 100,
          tierApplied: `Level ${level + 1} Sponsor`,
          notes: `Sponsor Binary Bonus from ${earner.name} (${earnerMemberId}) @ ${(rate * 100).toFixed(0)}%`,
        },
        isReversed: false,
      });

      await WalletService.creditCommission(
        sponsor.memberId,
        netPayable,
        ledgerId,
        `Sponsor Bonus from ${earner.name} (${earnerMemberId})`
      );

      commissions.push(commission);
    }

    return commissions;
  }
}
