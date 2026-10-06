import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { SponsorTreeService } from '../tree/SponsorTreeService';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { DeductionUtil } from '../../utils/deduction.util';
import { COMMISSION_TYPE } from '../../config/constants';

export class SponsorBonusService {
  /**
   * Process Sponsor Bonus when a sponsored direct member achieves binary income or volume.
   * Based on configurable rate (e.g. 20%) and calculation base.
   * 100% Uncapped (no package daily capping applies).
   * Deductions (TDS & Admin Fee) are configurable by Admin and can be 0%.
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

      // Rate can apply directly or scaled by level (default 20% = 0.20)
      const rate = config.sponsorBinaryRate;
      let rawBonus = DecimalUtil.multiplyRate(qualifyingAmountOrIncome, rate);

      if (config.maxPayout && rawBonus > config.maxPayout) {
        rawBonus = config.maxPayout;
      }

      if (rawBonus <= 0) continue;

      // Dynamic Admin-Configurable Deductions (can be set to anything, even 0%)
      const deductions = DeductionUtil.calculateDeductions(rawBonus, rules, {
        tdsPercent: config.tdsPercent,
        adminFeePercent: config.adminFeePercent,
      });

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
          sourceMemberId: earnerMemberId,
          calculationBase: config.calculationBase,
          baseAmount: qualifyingAmountOrIncome,
          rateApplied: rate,
          percentageApplied: rate * 100,
          tierApplied: `Level ${level + 1} Sponsor`,
          tdsRateApplied: deductions.tdsRate,
          adminFeeRateApplied: deductions.adminFeeRate,
          notes: `Sponsor Binary Bonus from ${earner.name} (${earnerMemberId}) @ ${(rate * 100).toFixed(0)}%. Net: ₹${deductions.netPayable} (TDS ${deductions.tdsRate}%, Admin ${deductions.adminFeeRate}%). Uncapped.`,
        },
        isReversed: false,
      });

      await WalletService.creditCommission(
        sponsor.memberId,
        deductions.netPayable,
        ledgerId,
        `Sponsor Bonus (20%) from ${earner.name} (${earnerMemberId})`
      );

      commissions.push(commission);
    }

    return commissions;
  }
}
