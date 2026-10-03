import { CommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { Member } from '../../models/Member.model';
import { COMMISSION_TYPE, EXCESS_CAP_POLICY, ROLES } from '../../config/constants';
import { DecimalUtil } from '../../utils/decimal';

export interface CapEvaluationResult {
  rawAmount: number;
  capAmount: number;
  alreadyEarnedToday: number;
  remainingCap: number;
  payableAmount: number;
  excessAmount: number;
  excessPolicy: string;
  isCappingApplied?: boolean;
}

export class CapService {
  /**
   * Calculate daily binary payout capping for a member on a given date.
   * Superadmin and Admin roles are exempt from binary capping (uncapped earnings).
   */
  static async calculateCappedCommission(
    memberId: string,
    calculatedAmount: number,
    rules: ICompensationRule,
    date: Date = new Date()
  ): Promise<CapEvaluationResult> {
    const cleanId = (memberId || '').toUpperCase().trim();
    const member = await Member.findOne({ memberId: cleanId }).select('role dailyCapping');
    const isAdmin = member && (
      member.role === ROLES.ADMIN ||
      member.role === ROLES.SUPERADMIN ||
      member.role?.toLowerCase() === 'admin' ||
      member.role?.toLowerCase() === 'superadmin'
    );

    // If member is Admin or Super Admin, binary cap is completely disabled (uncapped)
    if (isAdmin) {
      return {
        rawAmount: calculatedAmount,
        capAmount: 0,
        alreadyEarnedToday: 0,
        remainingCap: 999999999,
        payableAmount: calculatedAmount,
        excessAmount: 0,
        excessPolicy: EXCESS_CAP_POLICY.FLUSH,
        isCappingApplied: false,
      };
    }

    const dailyCap = (member && member.dailyCapping && member.dailyCapping > 0)
      ? member.dailyCapping
      : (rules.binaryBonus.dailyBinaryPayoutCap || 4000);
    const excessPolicy = rules.binaryBonus.excessCapPolicy || EXCESS_CAP_POLICY.FLUSH;

    // Start and end of the day in UTC/local
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Sum payable binary commissions already earned today
    const todayCommissions = await CommissionLedger.find({
      memberId: cleanId,
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
      isCappingApplied: true,
    };
  }
}
