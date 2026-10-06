import { BinaryVolume } from '../../models/BinaryVolume.model';
import { Member } from '../../models/Member.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { BVLedger } from '../../models/BVLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { CapService } from './CapService';
import { WalletService } from '../WalletService';
import { BinaryTreeService } from '../tree/BinaryTreeService';
import { DecimalUtil } from '../../utils/decimal';
import { DeductionUtil } from '../../utils/deduction.util';
import { SponsorBonusService } from './SponsorBonusService';
import {
  COMMISSION_TYPE,
  BV_SOURCE_TYPE,
} from '../../config/constants';
import { AdminNotification } from '../../models/AdminNotification.model';

export interface BinaryCycleDetail {
  cycleIndex: number;
  ratio: '2:1' | '1:2';
  leftMemberIds: string[];
  rightMemberIds: string[];
  cycleAmount: number; // ₹250
}

export interface BinaryIncomeCalculationResult {
  totalGeneratedIncome: number; // e.g. ₹1,250 (5 cycles * 250)
  payableIncome: number;        // Capped amount according to package daily cap
  cycles: BinaryCycleDetail[];  // List of all completed cycles
  cyclesCount: number;
  consumedMemberIds: string[];
  remainingUnusedLeft: string[];
  remainingUnusedRight: string[];
  dailyCapAmount: number;
  alreadyEarnedToday: number;
  excessAmount: number;
}

export class BinaryBonusService {
  /**
   * Calculate binary income according to exact cycle rules:
   * 1. Binary payout rate is ₹250 per completed cycle, not a percentage.
   * 2. For each cycle, first require 1:1 (one unused member from left + one unused member from right).
   * 3. Then require one additional unused member from either side, making final ratio 2:1 or 1:2.
   * 4. Members consumed top-to-bottom / level-order from each side.
   * 5. Continue creating cycles until one side has no unused members.
   * 6. Track consumed member IDs; never reuse a consumed member for this ancestor.
   * 7. Daily capping: Apply member's package daily cap.
   * 8. Member flushing: All member IDs consumed across all calculated cycles of the day
   *    must be flushed/marked as consumed, even if beyond the daily cap.
   * 9. Returns: totalGeneratedIncome, payableIncome, cycles
   */
  static async calculateBinaryIncomeForMember(
    memberId: string,
    rules: ICompensationRule,
    date: Date = new Date(),
    sourceEventId?: string,
    sourcePurchaseId?: string
  ): Promise<BinaryIncomeCalculationResult & { commissionLedger?: ICommissionLedger | null }> {
    const cleanId = (memberId || '').toUpperCase().trim();
    const emptyResult: BinaryIncomeCalculationResult & { commissionLedger: null } = {
      totalGeneratedIncome: 0,
      payableIncome: 0,
      cycles: [],
      cyclesCount: 0,
      consumedMemberIds: [],
      remainingUnusedLeft: [],
      remainingUnusedRight: [],
      dailyCapAmount: 0,
      alreadyEarnedToday: 0,
      excessAmount: 0,
      commissionLedger: null,
    };

    if (!rules.binaryBonus?.isEnabled) {
      return emptyResult;
    }

    const member = await Member.findOne({ memberId: cleanId });
    if (!member || !member.isActive || member.status === 'blocked') {
      return emptyResult;
    }

    let vol = await BinaryVolume.findOne({ memberId: cleanId });
    if (!vol) {
      vol = await BinaryVolume.create({
        memberId: cleanId,
        userId: member._id.toString(),
        consumedBinaryMemberIds: [],
      });
    }

    // 1. Traverse Left leg and Right leg active members in level-order (BFS, top-to-bottom)
    const { leftMemberIds, rightMemberIds } = await BinaryTreeService.getMemberLegsLevelOrder(cleanId);

    // 2. Filter out member IDs that were already consumed by this ancestor in previous cycles
    const consumedSet = new Set<string>(vol.consumedBinaryMemberIds || []);
    const unusedLeft: string[] = leftMemberIds.filter((id) => !consumedSet.has(id));
    const unusedRight: string[] = rightMemberIds.filter((id) => !consumedSet.has(id));

    const ratePerCycle = rules.binaryBonus.rateInRupees || 250;
    const cycles: BinaryCycleDetail[] = [];
    const cycleConsumedIds: string[] = [];

    // 3. Cycle Creation Loop:
    // Continue creating cycles until one side has no unused members
    while (unusedLeft.length > 0 && unusedRight.length > 0) {
      // Rule 2 & 3:
      // First require 1:1 (one from left + one from right)
      // PLUS one additional member from either side (making 2:1 or 1:2)
      const canDo2to1 = unusedLeft.length >= 2 && unusedRight.length >= 1;
      const canDo1to2 = unusedLeft.length >= 1 && unusedRight.length >= 2;

      if (!canDo2to1 && !canDo1to2) {
        // Both sides have only 1 member; cannot complete the sequence (2:1 or 1:2)
        break;
      }

      let ratio: '2:1' | '1:2';
      let cycleLeft: string[];
      let cycleRight: string[];

      if (canDo2to1 && canDo1to2) {
        // If both ratios are possible, take extra member from whichever side has more unused members
        if (unusedLeft.length >= unusedRight.length) {
          ratio = '2:1';
          cycleLeft = [unusedLeft.shift()!, unusedLeft.shift()!];
          cycleRight = [unusedRight.shift()!];
        } else {
          ratio = '1:2';
          cycleLeft = [unusedLeft.shift()!];
          cycleRight = [unusedRight.shift()!, unusedRight.shift()!];
        }
      } else if (canDo2to1) {
        ratio = '2:1';
        cycleLeft = [unusedLeft.shift()!, unusedLeft.shift()!];
        cycleRight = [unusedRight.shift()!];
      } else {
        ratio = '1:2';
        cycleLeft = [unusedLeft.shift()!];
        cycleRight = [unusedRight.shift()!, unusedRight.shift()!];
      }

      cycleConsumedIds.push(...cycleLeft, ...cycleRight);
      cycles.push({
        cycleIndex: cycles.length + 1,
        ratio,
        leftMemberIds: cycleLeft,
        rightMemberIds: cycleRight,
        cycleAmount: ratePerCycle,
      });
    }

    if (cycles.length === 0) {
      return {
        ...emptyResult,
        remainingUnusedLeft: unusedLeft,
        remainingUnusedRight: unusedRight,
      };
    }

    // 4. Calculate total generated binary income
    const totalGeneratedIncome = cycles.length * ratePerCycle;

    // 5. Evaluate member's package daily cap
    const capResult = await CapService.calculateCappedCommission(
      cleanId,
      totalGeneratedIncome,
      rules,
      date
    );

    const payableIncome = capResult.payableAmount;
    const excessAmount = capResult.excessAmount;
    const dailyCapAmount = capResult.capAmount;
    const alreadyEarnedToday = capResult.alreadyEarnedToday;

    // 6. MEMBER FLUSHING (Rule 11):
    // All left and right member IDs that were consumed during this calculation
    // must be permanently marked as consumed, including members from cycles beyond the daily cap!
    if (!vol.consumedBinaryMemberIds) {
      vol.consumedBinaryMemberIds = [];
    }
    vol.consumedBinaryMemberIds.push(...cycleConsumedIds);
    vol.lastMatchedAt = date;

    const pairBvUnit = rules.binaryBonus.pairBvUnit || 1250;
    vol.matchedTotalBV = DecimalUtil.add(vol.matchedTotalBV || 0, cycles.length * pairBvUnit);
    await vol.save();

    // Update matched pairs on member model
    member.matchedPairs = (member.matchedPairs || 0) + cycles.length;
    await member.save();

    // Record audit entry in BVLedger
    await BVLedger.create({
      ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userId: member._id.toString(),
      memberId: cleanId,
      sourceType: BV_SOURCE_TYPE.MATCHED,
      referenceId: sourceEventId || 'CYCLE-MATCH',
      openingBV: (leftMemberIds.length + rightMemberIds.length) * pairBvUnit,
      earnedBV: 0,
      consumedBV: cycleConsumedIds.length * pairBvUnit,
      carriedForwardBV: (unusedLeft.length + unusedRight.length) * pairBvUnit,
      flushedBV: excessAmount > 0 ? cycles.length * pairBvUnit : 0,
      closingBV: (unusedLeft.length + unusedRight.length) * pairBvUnit,
      description: `Binary Cycles: ${cycles.length} cycle(s) (2:1 / 1:2) completed. Consumed ${cycleConsumedIds.length} members. Unused: L=${unusedLeft.length}, R=${unusedRight.length}.`,
      isImmutable: true,
    });

    let commissionLedger: ICommissionLedger | null = null;

    // 7. If payable amount allowed by daily cap is greater than 0, create commission ledger and credit wallet
    if (payableIncome > 0) {
      // Dynamic Admin-Configurable Deductions (can be set to anything, even 0%)
      const deductions = DeductionUtil.calculateDeductions(payableIncome, rules);

      const ledgerId = `COMM-BIN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      commissionLedger = await CommissionLedger.create({
        ledgerId,
        userId: member._id.toString(),
        memberId: cleanId,
        type: COMMISSION_TYPE.BINARY_BONUS,
        sourceEventId: sourceEventId || 'CYCLE-MATCH',
        sourcePurchaseId,
        grossAmount: totalGeneratedIncome,
        grossAmountInPaise: DecimalUtil.toPaise(totalGeneratedIncome),
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
          calculationBase: 'CYCLE_BASED_2_1_OR_1_2',
          cycles,
          cyclesCount: cycles.length,
          totalGeneratedIncome,
          rateApplied: ratePerCycle,
          dailyCapAmount,
          alreadyEarnedToday,
          dailyCapRemaining: capResult.remainingCap,
          excessAmount,
          excessPolicyApplied: capResult.excessPolicy,
          consumedMemberIds: cycleConsumedIds,
          remainingUnusedLeft: unusedLeft.length,
          remainingUnusedRight: unusedRight.length,
          tdsRateApplied: deductions.tdsRate,
          adminFeeRateApplied: deductions.adminFeeRate,
          notes: `Binary Cycles: ${cycles.length} completed cycles @ ₹${ratePerCycle} = ₹${totalGeneratedIncome}. Payable (Capped): ₹${payableIncome}. Consumed ${cycleConsumedIds.length} members. Deductions: TDS ${deductions.tdsRate}%, Admin ${deductions.adminFeeRate}%.`,
        },
        isReversed: false,
      });

      await WalletService.creditCommission(
        cleanId,
        deductions.netPayable,
        ledgerId,
        `Binary Matching Bonus (${cycles.length} cycles @ ₹${ratePerCycle} = ₹${totalGeneratedIncome}, Capped Payable: ₹${payableIncome})`
      );

      // 7B. Trigger Sponsor Binary Bonus (20% to direct sponsor, uncapped, single-leg qualified)
      try {
        await SponsorBonusService.processSponsorBonus(
          cleanId,
          payableIncome,
          rules,
          ledgerId,
          sourcePurchaseId
        );
      } catch (sponsorErr: any) {
        console.error('Failed to process sponsor binary bonus for earner:', cleanId, sponsorErr.message);
      }
    }

    // 8. If member earns binary income more than their package daily cap on this day, notify member
    if (excessAmount > 0) {
      try {
        const todayStart = new Date(date);
        todayStart.setHours(0, 0, 0, 0);

        const existingNotif = await AdminNotification.findOne({
          recipientId: cleanId,
          type: 'SYSTEM_ALERT',
          title: 'Capping Limits Exceeded',
          createdAt: { $gte: todayStart },
        });

        if (!existingNotif) {
          await AdminNotification.create({
            notificationId: `NOTIF-CAP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            type: 'SYSTEM_ALERT',
            title: 'Capping Limits Exceeded',
            message: `Daily capping limit (₹${dailyCapAmount.toLocaleString()}/day) exceeded! Upgrade your package to earn more binary income.`,
            recipientRole: 'member',
            recipientId: cleanId,
            senderId: 'SYSTEM',
            senderName: 'Binary Engine',
            amount: excessAmount,
            isRead: false,
            metadata: {
              perDayIncome: totalGeneratedIncome + alreadyEarnedToday,
              dailyCap: dailyCapAmount,
              excessAmount,
              action: 'UPGRADE_PACKAGE',
            },
          });
        }
      } catch (err: any) {
        console.error('Failed to create capping alert notification:', err.message);
      }
    }

    return {
      totalGeneratedIncome,
      payableIncome,
      cycles,
      cyclesCount: cycles.length,
      consumedMemberIds: cycleConsumedIds,
      remainingUnusedLeft: unusedLeft,
      remainingUnusedRight: unusedRight,
      dailyCapAmount,
      alreadyEarnedToday,
      excessAmount,
      commissionLedger,
    };
  }

  /**
   * Process binary matching and commission for a specific member triggered by MLM events
   */
  static async processMemberBinaryBonus(
    memberId: string,
    rules: ICompensationRule,
    sourceEventId: string,
    sourcePurchaseId?: string
  ): Promise<ICommissionLedger | null> {
    const result = await this.calculateBinaryIncomeForMember(
      memberId,
      rules,
      new Date(),
      sourceEventId,
      sourcePurchaseId
    );
    return result.commissionLedger || null;
  }
}

