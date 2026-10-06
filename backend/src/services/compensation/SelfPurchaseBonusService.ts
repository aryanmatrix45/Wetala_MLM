import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { DeductionUtil } from '../../utils/deduction.util';
import { COMMISSION_TYPE, PURCHASE_TYPE, PurchaseType } from '../../config/constants';

export class SelfPurchaseBonusService {
  /**
   * Process 8% Self Purchase Bonus on Repurchase transactions.
   */
  static async processSelfPurchaseBonus(
    memberId: string,
    purchaseAmount: number,
    purchaseBV: number,
    purchaseType: PurchaseType,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger | null> {
    const config = rules.selfPurchaseBonus;

    // Must be enabled
    if (!config.isEnabled) {
      return null;
    }

    // Must be repurchase or retail purchase (not joining)
    if (purchaseType !== PURCHASE_TYPE.REPURCHASE && purchaseType !== PURCHASE_TYPE.RETAIL) {
      return null;
    }

    const member = await Member.findOne({ memberId });
    if (!member || !member.isActive) {
      return null;
    }

    // Determine calculation base
    const baseValue = config.calculationBase === 'BV' ? purchaseBV : purchaseAmount;
    if (baseValue <= 0) {
      return null;
    }

    const rate = config.ratePercent; // 8% = 0.08
    const rawBonus = DecimalUtil.multiplyRate(baseValue, rate);
    if (rawBonus <= 0) {
      return null;
    }

    const deductions = DeductionUtil.calculateDeductions(rawBonus, rules);

    const ledgerId = `COMM-SELF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const commission = await CommissionLedger.create({
      ledgerId,
      userId: member._id.toString(),
      memberId,
      type: COMMISSION_TYPE.SELF_PURCHASE_BONUS,
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
        calculationBase: config.calculationBase,
        baseAmount: baseValue,
        baseBV: purchaseBV,
        rateApplied: rate,
        percentageApplied: rate * 100,
        tdsRateApplied: deductions.tdsRate,
        adminFeeRateApplied: deductions.adminFeeRate,
        notes: `Self Purchase Bonus: ${(rate * 100).toFixed(0)}% on ${config.calculationBase} (₹${baseValue})`,
      },
      isReversed: false,
    });

    await WalletService.creditCommission(
      memberId,
      deductions.netPayable,
      ledgerId,
      `Self Purchase Cashback (${(rate * 100).toFixed(0)}%)`
    );

    return commission;
  }
}
