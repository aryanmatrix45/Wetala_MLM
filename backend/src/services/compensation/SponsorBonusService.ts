import { ClientSession } from 'mongoose';
import { IMember, Member } from '../../models/Member.model';
import { CommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { BinaryDailyClosing, IBinaryDailyClosing } from '../../models/BinaryDailyClosing.model';
import { WalletTransaction } from '../../models/WalletTransaction.model';
import { WalletService } from '../WalletService';
import { DecimalUtil } from '../../utils/decimal';
import { COMMISSION_TYPE } from '../../config/constants';
import { canEarnBonus } from '../../utils/binaryEligibility';

export interface SponsorBonusPlan {
  sponsorId: string;
  sponsorUserId: string;
  sponsorName: string;
  rate: number;
  amount: number;
  ledgerId: string;
}

/**
 * Sponsor income: when a member's day closes with binary income, the member's direct sponsor gets
 * 20% of what the member was credited that day (after the member's daily cap). It is paid by the
 * company on top: the member keeps all of its own income. Direct sponsor only, uncapped, no deductions.
 *
 * Worked out and recorded by the daily binary settlement in the same transaction as the member's own
 * binary commission; the wallet credit follows and is retried like binary income.
 */
export class SponsorBonusService {
  /** The sponsor income due on a member's binary income for a day, or null when none is due */
  static async planForDay(
    earner: IMember,
    creditedAmount: number,
    businessDate: string,
    rules: ICompensationRule
  ): Promise<SponsorBonusPlan | null> {
    const config = rules.sponsorBinaryBonus;
    if (!config || config.isEnabled === false || creditedAmount <= 0 || !earner.sponsorId) return null;

    const sponsor = await Member.findOne({ memberId: earner.sponsorId.toUpperCase() }).select('memberId name role status isActive isBinaryActive personalBv parentId sponsorId');
    if (!sponsor || !canEarnBonus(sponsor) || sponsor.status !== 'active') return null;
    // Only distributors earn commissions (never the Super Admin / admin accounts)
    if (sponsor.role && sponsor.role !== 'member') return null;

    const rate = typeof config.sponsorBinaryRate === 'number' && config.sponsorBinaryRate >= 0 ? config.sponsorBinaryRate : 0.2;
    const amount = DecimalUtil.multiplyRate(creditedAmount, rate);
    if (amount <= 0) return null;

    return {
      sponsorId: sponsor.memberId,
      sponsorUserId: sponsor._id.toString(),
      sponsorName: sponsor.name,
      rate,
      amount,
      // One per sponsor, member and day: re-running a day can never pay the sponsor twice
      ledgerId: `COMM-SPO-${businessDate.replace(/-/g, '')}-${sponsor.memberId}-${earner.memberId}`,
    };
  }

  /** Writes the sponsor's commission row; runs inside the settlement's transaction */
  static async recordCommission(
    session: ClientSession,
    plan: SponsorBonusPlan,
    source: { earner: IMember; businessDate: string; closingId: string; creditedAmount: number }
  ): Promise<void> {
    const paise = DecimalUtil.toPaise(plan.amount);
    const percent = DecimalUtil.round(plan.rate * 100);
    await CommissionLedger.create(
      [
        {
          ledgerId: plan.ledgerId,
          userId: plan.sponsorUserId,
          memberId: plan.sponsorId,
          type: COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
          sourceEventId: `BINARY-DAILY-${source.businessDate}`,
          grossAmount: plan.amount,
          grossAmountInPaise: paise,
          tdsDeduction: 0,
          tdsDeductionInPaise: 0,
          adminFee: 0,
          adminFeeInPaise: 0,
          payableAmount: plan.amount,
          payableAmountInPaise: paise,
          status: 'APPROVED',
          calculationDetails: {
            calculationBase: 'DAILY_BINARY_CLOSING',
            businessDate: source.businessDate,
            closingId: source.closingId,
            sourceMemberId: source.earner.memberId,
            sourceMemberName: source.earner.name,
            baseAmount: source.creditedAmount,
            rateApplied: plan.rate,
            percentageApplied: percent,
            tierApplied: 'Direct Sponsor',
            notes: `Sponsor income for ${source.businessDate}: ${percent}% of ₹${source.creditedAmount} binary income of ${source.earner.name} (${source.earner.memberId}). Paid in addition; their income is not reduced.`,
          },
          isReversed: false,
        },
      ],
      { session }
    );
  }

  /** Pays a closing's sponsor income into the sponsor's wallet, once. Safe to call again after a failure. */
  static async creditWallet(closing: IBinaryDailyClosing): Promise<void> {
    const { sponsorId, sponsorCommissionLedgerId, sponsorBonusAmount } = closing;
    if (closing.sponsorWalletCredited || !sponsorId || !sponsorCommissionLedgerId || !(sponsorBonusAmount > 0)) return;
    try {
      const alreadyPaid = await WalletTransaction.exists({ referenceId: sponsorCommissionLedgerId, memberId: sponsorId });
      if (!alreadyPaid) {
        await WalletService.creditCommission(
          sponsorId,
          sponsorBonusAmount,
          sponsorCommissionLedgerId,
          `Sponsor income for ${closing.businessDate}: ${DecimalUtil.round((closing.sponsorBonusRate || 0) * 100)}% of ${closing.memberName || closing.memberId}'s binary income`
        );
      }
      await BinaryDailyClosing.updateOne({ _id: closing._id }, { $set: { sponsorWalletCredited: true } });
      closing.sponsorWalletCredited = true;
    } catch (error: any) {
      console.error(`[SponsorBonus] Wallet credit failed for ${sponsorId} on ${closing.businessDate}:`, error.message);
    }
  }
}
