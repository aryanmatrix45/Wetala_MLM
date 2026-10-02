import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE, PURCHASE_TYPE, PurchaseType, BINARY_POSITION } from '../../config/constants';

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

    const member = await Member.findOne({ memberId });
    if (!member || !member.isActive) {
      return null;
    }

    // Check Left & Right completion requirement if enabled
    if (config.requiresLeftAndRight) {
      const directRecruits = await Member.find({ sponsorId: memberId, isActive: true });
      const hasLeft = directRecruits.some(r => r.binaryPosition === BINARY_POSITION.LEFT || (r.position as string) === 'left' || (r.position as string) === 'LEFT');
      const hasRight = directRecruits.some(r => r.binaryPosition === BINARY_POSITION.RIGHT || (r.position as string) === 'right' || (r.position as string) === 'RIGHT');
      if (!hasLeft || !hasRight) {
        return null; // Left & Right not yet complete
      }
    }

    // 4% on every new package
    const rate = config.ratePercent > 0 ? config.ratePercent : 4;
    let rawAmount = DecimalUtil.multiplyPercent(purchaseAmount, rate);

    // Limit: Active package limit
    const activePackageLimit = member.packageBv ? (member.dailyCapping || member.packageBv) : 4000;
    if (config.limitMode === 'ACTIVE_PACKAGE' && rawAmount > activePackageLimit) {
      rawAmount = activePackageLimit;
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
        percentageApplied: rate,
        notes: `Welcome Bonus (4% on new package, Left & Right completed). Limit: Active Package (₹${activePackageLimit}).`,
      },
      isReversed: false,
    });

    await WalletService.creditCommission(
      memberId,
      netPayable,
      ledgerId,
      `Welcome Bonus (4% on Package)`
    );

    return commission;
  }
}
