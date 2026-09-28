import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE } from '../../config/constants';

export class FranchiseService {
  /**
   * Process Franchise / Stockist Incentive for bulk inventory purchase
   */
  static async processFranchiseIncentive(
    franchiseMemberId: string,
    purchaseAmount: number,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<{ franchiseCommission: ICommissionLedger | null; uplineCommission: ICommissionLedger | null }> {
    const config = rules.franchisePolicy;
    if (!config.isEnabled || !config.tiers || config.tiers.length === 0) {
      return { franchiseCommission: null, uplineCommission: null };
    }

    const member = await Member.findOne({ memberId: franchiseMemberId });
    if (!member || !member.isActive) {
      return { franchiseCommission: null, uplineCommission: null };
    }

    // Sort descending by threshold
    const sortedTiers = [...config.tiers].sort((a, b) => b.threshold - a.threshold);
    let matchedTier: (typeof config.tiers)[0] | null = null;

    for (const tier of sortedTiers) {
      if (purchaseAmount >= tier.threshold) {
        matchedTier = tier;
        break;
      }
    }

    if (!matchedTier) {
      return { franchiseCommission: null, uplineCommission: null };
    }

    // 1. Franchise Incentive
    const rawFranchiseAmount = DecimalUtil.multiplyRate(purchaseAmount, matchedTier.rate);
    const tdsDeduction = DecimalUtil.multiplyPercent(rawFranchiseAmount, 5);
    const adminFee = DecimalUtil.multiplyPercent(rawFranchiseAmount, 5);
    const netPayable = DecimalUtil.sub(rawFranchiseAmount, DecimalUtil.add(tdsDeduction, adminFee));

    const ledgerId = `COMM-FRAN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const franchiseCommission = await CommissionLedger.create({
      ledgerId,
      userId: member._id.toString(),
      memberId: franchiseMemberId,
      type: COMMISSION_TYPE.FRANCHISE_BONUS,
      sourceEventId,
      sourcePurchaseId,
      grossAmount: rawFranchiseAmount,
      grossAmountInPaise: DecimalUtil.toPaise(rawFranchiseAmount),
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
        calculationBase: 'STOCK_PURCHASE',
        baseAmount: purchaseAmount,
        rateApplied: matchedTier.rate,
        percentageApplied: matchedTier.rate * 100,
        tierApplied: `₹${matchedTier.threshold} (${(matchedTier.rate * 100).toFixed(0)}%)`,
        notes: `Franchise ${config.incentiveType} incentive for ₹${purchaseAmount} purchase`,
      },
      isReversed: false,
    });

    await WalletService.creditCommission(
      franchiseMemberId,
      netPayable,
      ledgerId,
      `Franchise Stockist Bonus (${(matchedTier.rate * 100).toFixed(0)}%)`
    );

    // 2. Franchise Upline Bonus (2%)
    let uplineCommission: ICommissionLedger | null = null;
    if (config.uplineBonusRate > 0 && member.sponsorId) {
      const uplineMember = await Member.findOne({ memberId: member.sponsorId });
      if (uplineMember && uplineMember.isActive) {
        const rawUplineAmount = DecimalUtil.multiplyRate(purchaseAmount, config.uplineBonusRate);
        const uplineTds = DecimalUtil.multiplyPercent(rawUplineAmount, 5);
        const uplineFee = DecimalUtil.multiplyPercent(rawUplineAmount, 5);
        const uplineNet = DecimalUtil.sub(rawUplineAmount, DecimalUtil.add(uplineTds, uplineFee));

        const uplineLedgerId = `COMM-UPL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        uplineCommission = await CommissionLedger.create({
          ledgerId: uplineLedgerId,
          userId: uplineMember._id.toString(),
          memberId: uplineMember.memberId,
          type: COMMISSION_TYPE.UPLINE_BONUS,
          sourceEventId,
          sourcePurchaseId,
          grossAmount: rawUplineAmount,
          grossAmountInPaise: DecimalUtil.toPaise(rawUplineAmount),
          tdsDeduction: uplineTds,
          tdsDeductionInPaise: DecimalUtil.toPaise(uplineTds),
          adminFee: uplineFee,
          adminFeeInPaise: DecimalUtil.toPaise(uplineFee),
          payableAmount: uplineNet,
          payableAmountInPaise: DecimalUtil.toPaise(uplineNet),
          status: 'APPROVED',
          calculationDetails: {
            sourcePurchaseId,
            sourceEventId,
            sourceMemberId: franchiseMemberId,
            calculationBase: 'FRANCHISE_PURCHASE',
            baseAmount: purchaseAmount,
            rateApplied: config.uplineBonusRate,
            percentageApplied: config.uplineBonusRate * 100,
            notes: `Franchise 2% Upline Bonus from ${franchiseMemberId}`,
          },
          isReversed: false,
        });

        await WalletService.creditCommission(
          uplineMember.memberId,
          uplineNet,
          uplineLedgerId,
          `Franchise Upline Bonus from ${franchiseMemberId}`
        );
      }
    }

    return { franchiseCommission, uplineCommission };
  }
}
