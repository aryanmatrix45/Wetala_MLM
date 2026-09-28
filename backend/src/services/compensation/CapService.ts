import { CommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { COMMISSION_TYPE, EXCESS_CAP_POLICY } from '../../config/constants';
import { DecimalUtil } from '../../utils/decimal';

export interface CapEvaluationResult {
  rawAmount: number;
  capAmount: number;
  alreadyEarnedToday: number;
  remainingCap: number;
  payableAmount: number;
  excessAmount: number;
  excessPolicy: string;
}

export class CapService {
  /**
   * Calculate daily binary payout capping for a member on a given date.
   */
  static async calculateCappedCommission(
    memberId: string,
    calculatedAmount: number,
    rules: ICompensationRule,
    date: Date = new Date()
  ): Promise<CapEvaluationResult> {
    const dailyCap = rules.binaryBonus.dailyBinaryPayoutCap || 4000;
    const excessPolicy = rules.binaryBonus.excessCapPolicy || EXCESS_CAP_POLICY.FLUSH;

    // Start and end of the day in UTC/local
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Sum payable binary commissions already earned today
    const todayCommissions = await CommissionLedger.find({
      memberId,
      type: COMMISSION_TYPE.BINARY_BONUS,
      status: { $in: ['APPROVED', 'PAID'] },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    let alreadyEarnedInPaise = 0;
    for (const comm of todayCommissions) {
      alreadyEarnedInPaise += comm.payableAmountInPaise || DecimalUtil.toPaise(comm.payableAmount);
    }

    const alreadyEarnedToday = DecimalUtil.fromPaise(alreadyEarnedInPaise);
    const dailyCapInPaise = DecimalUtil.toPaise(dailyCap);
    const remainingCapInPaise = Math.max(0, dailyCapInPaise - alreadyEarnedInPaise);
    const remainingCap = DecimalUtil.fromPaise(remainingCapInPaise);

    const calculatedInPaise = DecimalUtil.toPaise(calculatedAmount);

    let payableInPaise = 0;
    let excessInPaise = 0;

    if (calculatedInPaise <= remainingCapInPaise) {
      payableInPaise = calculatedInPaise;
      excessInPaise = 0;
    } else {
      payableInPaise = remainingCapInPaise;
      excessInPaise = calculatedInPaise - remainingCapInPaise;
    }

    return {
      rawAmount: calculatedAmount,
      capAmount: dailyCap,
      alreadyEarnedToday,
      remainingCap,
      payableAmount: DecimalUtil.fromPaise(payableInPaise),
      excessAmount: DecimalUtil.fromPaise(excessInPaise),
      excessPolicy,
    };
  }
}
