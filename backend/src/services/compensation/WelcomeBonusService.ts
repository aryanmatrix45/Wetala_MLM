import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE, PURCHASE_TYPE, PurchaseType } from '../../config/constants';

export class WelcomeBonusService {
  /**
   * Process Welcome Bonus for qualifying joining package purchase.
   * NOTE: "Company turns 4:1" rule is configurable and disabled by default
   * until business confirms exact formula.
   */
  static async processWelcomeBonus(
    memberId: string,
    packageId: string,
    purchaseAmount: number,
    purchaseBV: number,
    purchaseType: PurchaseType,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger | null> {
    const config = rules.welcomeBonus;

    // Must be enabled
    if (!config.isEnabled) {
      return null;
    }

    // Must be a joining purchase
    if (purchaseType !== PURCHASE_TYPE.JOINING) {
      return null;
    }

    // Must match applicable package if specified
    if (config.applicablePackageIds && config.applicablePackageIds.length > 0) {
      if (!config.applicablePackageIds.includes(packageId)) {
        return null;
      }
    }

    const member = await Member.findOne({ memberId });
    if (!member || !member.isActive) {
      return null;
    }

    // Calculate raw bonus based on percentage or fixed amount
    let rawAmount = 0;
    if (config.fixedAmount > 0) {
      rawAmount = config.fixedAmount;
    } else if (config.ratePercent > 0) {
      rawAmount = DecimalUtil.multiplyPercent(purchaseAmount, config.ratePercent);
    }

    if (config.maxPayout > 0 && rawAmount > config.maxPayout) {
      rawAmount = config.maxPayout;
    }

    if (rawAmount <= 0) {
      return null;
    }

    const tdsDeduction = DecimalUtil.multiplyPercent(rawAmount, 5);
    const adminFee = DecimalUtil.multiplyPercent(rawAmount, 5);
    const netPayable = DecimalUtil.sub(rawAmount, DecimalUtil.add(tdsDeduction, adminFee));

    const ledgerId = `COMM-WEL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const commission = await CommissionLedger.create({
      ledgerId,
      userId: member._id.toString(),
      memberId,
      type: COMMISSION_TYPE.WELCOME_BONUS,
      sourceEventId,
      sourcePurchaseId,
      grossAmount: rawAmount,
      grossAmountInPaise: DecimalUtil.toPaise(rawAmount),
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
        calculationBase: 'JOINING_PURCHASE',
        baseAmount: purchaseAmount,
        baseBV: purchaseBV,
        percentageApplied: config.ratePercent,
        notes: `Welcome Bonus: Ratio ${config.companyRatio}, Rate ${config.ratePercent}%. (TODO: Confirm exact 4:1 formula with company)`,
      },
      isReversed: false,
    });

    await WalletService.creditCommission(
      memberId,
      netPayable,
      ledgerId,
      `Welcome Bonus (${config.companyRatio})`
    );

    return commission;
  }
}
