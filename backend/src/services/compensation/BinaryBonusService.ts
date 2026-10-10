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
  BINARY_POSITION,
} from '../../config/constants';
import { AdminNotification } from '../../models/AdminNotification.model';

export type BinaryPayoutStage = 'FIRST_PAYOUT' | 'SECOND_PAYOUT' | 'SUBSEQUENT';

export interface BinaryCycleDetail {
  cycleIndex: number;
  stage: BinaryPayoutStage;
  payoutSequence: number;
  ratio: '2:1' | '1:2' | '1:1';
  dominantSide?: 'LEFT' | 'RIGHT' | null;
  leftBVUsed: number;
  rightBVUsed: number;
  leftBVReserved?: number;
  rightBVReserved?: number;
  cycleAmount: number; // ₹250
  notes: string;
}

export interface BinaryIncomeCalculationResult {
  totalGeneratedIncome: number; // e.g. ₹250, ₹500
  payableIncome: number;        // Capped amount according to package daily cap
  cycles: BinaryCycleDetail[];  // List of all completed cycles/payouts in this run
  cyclesCount: number;
  leftAvailableBV: number;
  rightAvailableBV: number;
  reservedBV: number;
  reservedSide: 'LEFT' | 'RIGHT' | null;
  payoutCount: number;
  dailyCapAmount: number;
  alreadyEarnedToday: number;
  excessAmount: number;
  isSponsorQualified: boolean;
  commissionLedger?: ICommissionLedger | null;
}

export class BinaryBonusService {
  /**
   * Calculate sequential binary income according to client rules:
   * 1. Sponsor Requirement: Member must have at least 1 personally sponsored active member
   *    in their Left binary subtree AND at least 1 personally sponsored active member in their Right binary subtree.
   * 2. First Payout (₹250): Requires 2,500:1,250 or 1,250:2,500 BV.
   *    Consume only 1,250 BV from the opposite side; carry forward / reserve the 2,500 BV for the Second Payout.
   * 3. Second Payout (₹250): Requires the 2,500 BV carried forward from the 1st payout + 1,250 NEW available BV
   *    on the opposite side. Consumes the 1,250 BV and the 2,500 reserved BV.
   * 4. Third & Subsequent Payouts (₹250 each): Permanent 1,250:1,250 matching ratio. Consumes 1,250 from both sides.
   *    Excess BV carries forward indefinitely.
   * 5. Package Daily Capping: Enforced via CapService.
   */
  static async calculateBinaryIncomeForMember(
    memberId: string,
    rules: ICompensationRule,
    date: Date = new Date(),
    sourceEventId?: string,
    sourcePurchaseId?: string
  ): Promise<BinaryIncomeCalculationResult> {
    const cleanId = (memberId || '').toUpperCase().trim();
    const emptyResult: BinaryIncomeCalculationResult = {
      totalGeneratedIncome: 0,
      payableIncome: 0,
      cycles: [],
      cyclesCount: 0,
      leftAvailableBV: 0,
      rightAvailableBV: 0,
      reservedBV: 0,
      reservedSide: null,
      payoutCount: 0,
      dailyCapAmount: 0,
      alreadyEarnedToday: 0,
      excessAmount: 0,
      isSponsorQualified: false,
      commissionLedger: null,
    };

    if (!rules.binaryBonus?.isEnabled) {
      return emptyResult;
    }

    const member = await Member.findOne({ memberId: cleanId });
    if (!member || !member.isActive || member.status === 'blocked') {
      return emptyResult;
    }

    // Members can participate in binary income. Those who have not bought any package
    // are capped at the default entry limit of ₹4,000/day via CapService.
    // Personal BV requirement is waived or set to 0 for free/active participants.

    // 1. SPONSOR REQUIREMENT:
    // Required sponsor condition must be satisfied on BOTH Left and Right sides of binary tree
    const sponsorCheck = await BinaryTreeService.checkSponsorLegEligibility(cleanId);
    if (!sponsorCheck.isQualified) {
      // Fetch live volume just to return current balance without generating payouts
      const currentVol = await BinaryVolume.findOne({ memberId: cleanId });
      return {
        ...emptyResult,
        leftAvailableBV: currentVol?.leftAvailableBV || 0,
        rightAvailableBV: currentVol?.rightAvailableBV || 0,
        reservedBV: currentVol?.reservedBV || 0,
        reservedSide: (currentVol?.reservedSide as any) || null,
        payoutCount: currentVol?.payoutCount || 0,
        isSponsorQualified: false,
      };
    }

    let vol = await BinaryVolume.findOne({ memberId: cleanId });
    if (!vol) {
      vol = await BinaryVolume.create({
        memberId: cleanId,
        userId: member._id.toString(),
        leftTotalBV: 0,
        rightTotalBV: 0,
        matchedTotalBV: 0,
        leftAvailableBV: 0,
        rightAvailableBV: 0,
        leftCarryForwardBV: 0,
        rightCarryForwardBV: 0,
        payoutCount: 0,
        reservedSide: null,
        reservedBV: 0,
        consumedBinaryMemberIds: [],
      });
    }

    let leftAvail = vol.leftAvailableBV || 0;
    let rightAvail = vol.rightAvailableBV || 0;
    let currentPayoutCount = vol.payoutCount || 0;
    let reservedSide: 'LEFT' | 'RIGHT' | null = (vol.reservedSide as any) || null;
    let reservedBV = vol.reservedBV || 0;

    const ratePerCycle = rules.binaryBonus.rateInRupees || 250;
    const cycles: BinaryCycleDetail[] = [];

    // Sequential Payout Evaluation Loop
    let progress = true;
    while (progress) {
      progress = false;

      // ==========================================
      // STAGE 1: FIRST PAYOUT (₹250)
      // Requires 2500:1250 or 1250:2500
      // 2500 BV is reserved; 1250 BV is consumed.
      // ==========================================
      if (currentPayoutCount === 0) {
        const canLeftDominant = leftAvail >= 2500 && rightAvail >= 1250;
        const canRightDominant = rightAvail >= 2500 && leftAvail >= 1250;

        if (canLeftDominant || canRightDominant) {
          let isLeftDominant = false;
          if (canLeftDominant && canRightDominant) {
            // Dominant side is the one with higher available volume; default Left if equal
            isLeftDominant = leftAvail >= rightAvail;
          } else if (canLeftDominant) {
            isLeftDominant = true;
          } else {
            isLeftDominant = false;
          }

          if (isLeftDominant) {
            leftAvail -= 2500;
            rightAvail -= 1250;
            reservedSide = 'LEFT';
            reservedBV = 2500;
            currentPayoutCount = 1;

            cycles.push({
              cycleIndex: cycles.length + 1,
              stage: 'FIRST_PAYOUT',
              payoutSequence: 1,
              ratio: '2:1',
              dominantSide: 'LEFT',
              leftBVUsed: 0, // 2500 BV reserved, not consumed
              rightBVUsed: 1250,
              leftBVReserved: 2500,
              rightBVReserved: 0,
              cycleAmount: ratePerCycle,
              notes: 'First Payout (2:1): Right 1250 BV consumed, Left 2500 BV reserved for Second Payout',
            });
            progress = true;
            continue;
          } else {
            rightAvail -= 2500;
            leftAvail -= 1250;
            reservedSide = 'RIGHT';
            reservedBV = 2500;
            currentPayoutCount = 1;

            cycles.push({
              cycleIndex: cycles.length + 1,
              stage: 'FIRST_PAYOUT',
              payoutSequence: 1,
              ratio: '1:2',
              dominantSide: 'RIGHT',
              leftBVUsed: 1250,
              rightBVUsed: 0, // 2500 BV reserved, not consumed
              leftBVReserved: 0,
              rightBVReserved: 2500,
              cycleAmount: ratePerCycle,
              notes: 'First Payout (1:2): Left 1250 BV consumed, Right 2500 BV reserved for Second Payout',
            });
            progress = true;
            continue;
          }
        }
      }

      // ==========================================
      // STAGE 2: SECOND PAYOUT (₹250)
      // Requires the 2500 BV reserved from 1st payout
      // PLUS 1250 NEW available BV on the opposite side.
      // Consumes 1250 new BV and the 2500 reserved BV.
      // ==========================================
      else if (currentPayoutCount === 1) {
        if (reservedSide === 'LEFT' && reservedBV >= 2500) {
          if (rightAvail >= 1250) {
            rightAvail -= 1250;
            const consumedReserved = reservedBV;
            reservedBV = 0;
            reservedSide = null;
            currentPayoutCount = 2;

            cycles.push({
              cycleIndex: cycles.length + 1,
              stage: 'SECOND_PAYOUT',
              payoutSequence: 2,
              ratio: '2:1',
              dominantSide: 'LEFT',
              leftBVUsed: consumedReserved, // 2500 reserved BV consumed
              rightBVUsed: 1250,
              cycleAmount: ratePerCycle,
              notes: 'Second Payout: Right 1250 new BV consumed, Left 2500 carried forward BV consumed',
            });
            progress = true;
            continue;
          }
        } else if (reservedSide === 'RIGHT' && reservedBV >= 2500) {
          if (leftAvail >= 1250) {
            leftAvail -= 1250;
            const consumedReserved = reservedBV;
            reservedBV = 0;
            reservedSide = null;
            currentPayoutCount = 2;

            cycles.push({
              cycleIndex: cycles.length + 1,
              stage: 'SECOND_PAYOUT',
              payoutSequence: 2,
              ratio: '1:2',
              dominantSide: 'RIGHT',
              leftBVUsed: 1250,
              rightBVUsed: consumedReserved, // 2500 reserved BV consumed
              cycleAmount: ratePerCycle,
              notes: 'Second Payout: Left 1250 new BV consumed, Right 2500 carried forward BV consumed',
            });
            progress = true;
            continue;
          }
        }
      }

      // ==========================================
      // STAGE 3: THIRD AND SUBSEQUENT PAYOUTS (₹250)
      // Permanent 1250:1250 matching ratio.
      // Consumes 1250 from both sides.
      // Excess volume carries forward.
      // ==========================================
      else if (currentPayoutCount >= 2) {
        if (leftAvail >= 1250 && rightAvail >= 1250) {
          leftAvail -= 1250;
          rightAvail -= 1250;
          currentPayoutCount += 1;

          cycles.push({
            cycleIndex: cycles.length + 1,
            stage: 'SUBSEQUENT',
            payoutSequence: currentPayoutCount,
            ratio: '1:1',
            dominantSide: null,
            leftBVUsed: 1250,
            rightBVUsed: 1250,
            cycleAmount: ratePerCycle,
            notes: `Subsequent Payout #${currentPayoutCount}: Left 1250 BV consumed, Right 1250 BV consumed (1:1)`,
          });
          progress = true;
          continue;
        }
      }
    }

    if (cycles.length === 0) {
      return {
        ...emptyResult,
        leftAvailableBV: leftAvail,
        rightAvailableBV: rightAvail,
        reservedBV,
        reservedSide,
        payoutCount: currentPayoutCount,
        isSponsorQualified: true,
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

    // 6. Update BinaryVolume tracker atomically
    vol.leftAvailableBV = leftAvail;
    vol.rightAvailableBV = rightAvail;
    vol.leftCarryForwardBV = leftAvail;
    vol.rightCarryForwardBV = rightAvail;
    vol.payoutCount = currentPayoutCount;
    vol.reservedSide = reservedSide;
    vol.reservedBV = reservedBV;
    vol.lastMatchedAt = date;

    if (cycles.some((c) => c.stage === 'FIRST_PAYOUT') && !vol.firstPayoutAt) {
      vol.firstPayoutAt = date;
    }
    if (cycles.some((c) => c.stage === 'SECOND_PAYOUT') && !vol.secondPayoutAt) {
      vol.secondPayoutAt = date;
    }

    const totalBVConsumedInRun = cycles.reduce((sum, c) => sum + (c.leftBVUsed || 0) + (c.rightBVUsed || 0), 0);
    vol.matchedTotalBV = DecimalUtil.add(vol.matchedTotalBV || 0, totalBVConsumedInRun);
    vol.consumedTotalBV = DecimalUtil.add(vol.consumedTotalBV || 0, totalBVConsumedInRun);
    await vol.save();

    // Update matched pairs on member model
    member.matchedPairs = currentPayoutCount;
    await member.save();

    // 7. Record detailed, immutable entries in BVLedger for each completed cycle
    const eventRef = sourcePurchaseId || sourceEventId || 'BINARY-MATCH';
    for (const cycle of cycles) {
      if (cycle.stage === 'FIRST_PAYOUT') {
        if (cycle.dominantSide === 'LEFT') {
          // Right consumed 1250 BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.RIGHT,
            openingBV: rightAvail + 1250,
            earnedBV: 0,
            consumedBV: 1250,
            carriedForwardBV: rightAvail,
            flushedBV: 0,
            closingBV: rightAvail,
            payoutSequence: 1,
            description: 'First Payout (2:1): 1,250 BV consumed on RIGHT leg',
            isImmutable: true,
          });
          // Left reserved 2500 BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.LEFT,
            openingBV: leftAvail + 2500,
            earnedBV: 0,
            consumedBV: 0,
            reservedBV: 2500,
            carriedForwardBV: leftAvail,
            flushedBV: 0,
            closingBV: leftAvail,
            payoutSequence: 1,
            description: 'First Payout (2:1): 2,500 BV reserved on LEFT leg for Second Payout',
            isImmutable: true,
          });
        } else {
          // Left consumed 1250 BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.LEFT,
            openingBV: leftAvail + 1250,
            earnedBV: 0,
            consumedBV: 1250,
            carriedForwardBV: leftAvail,
            flushedBV: 0,
            closingBV: leftAvail,
            payoutSequence: 1,
            description: 'First Payout (1:2): 1,250 BV consumed on LEFT leg',
            isImmutable: true,
          });
          // Right reserved 2500 BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.RIGHT,
            openingBV: rightAvail + 2500,
            earnedBV: 0,
            consumedBV: 0,
            reservedBV: 2500,
            carriedForwardBV: rightAvail,
            flushedBV: 0,
            closingBV: rightAvail,
            payoutSequence: 1,
            description: 'First Payout (1:2): 2,500 BV reserved on RIGHT leg for Second Payout',
            isImmutable: true,
          });
        }
      } else if (cycle.stage === 'SECOND_PAYOUT') {
        if (cycle.dominantSide === 'LEFT') {
          // Right consumed 1250 new BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.RIGHT,
            openingBV: rightAvail + 1250,
            earnedBV: 0,
            consumedBV: 1250,
            carriedForwardBV: rightAvail,
            flushedBV: 0,
            closingBV: rightAvail,
            payoutSequence: 2,
            description: 'Second Payout: 1,250 new BV consumed on RIGHT leg',
            isImmutable: true,
          });
          // Left consumed 2500 reserved BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.LEFT,
            openingBV: leftAvail,
            earnedBV: 0,
            consumedBV: 2500,
            reservedBV: 0,
            carriedForwardBV: leftAvail,
            flushedBV: 0,
            closingBV: leftAvail,
            payoutSequence: 2,
            description: 'Second Payout: 2,500 carried forward BV consumed on LEFT leg',
            isImmutable: true,
          });
        } else {
          // Left consumed 1250 new BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.LEFT,
            openingBV: leftAvail + 1250,
            earnedBV: 0,
            consumedBV: 1250,
            carriedForwardBV: leftAvail,
            flushedBV: 0,
            closingBV: leftAvail,
            payoutSequence: 2,
            description: 'Second Payout: 1,250 new BV consumed on LEFT leg',
            isImmutable: true,
          });
          // Right consumed 2500 reserved BV
          await BVLedger.create({
            ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            userId: member._id.toString(),
            memberId: cleanId,
            sourceType: BV_SOURCE_TYPE.MATCHED,
            referenceId: eventRef,
            position: BINARY_POSITION.RIGHT,
            openingBV: rightAvail,
            earnedBV: 0,
            consumedBV: 2500,
            reservedBV: 0,
            carriedForwardBV: rightAvail,
            flushedBV: 0,
            closingBV: rightAvail,
            payoutSequence: 2,
            description: 'Second Payout: 2,500 carried forward BV consumed on RIGHT leg',
            isImmutable: true,
          });
        }
      } else {
        // Stage 3 Subsequent 1250:1250
        await BVLedger.create({
          ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          userId: member._id.toString(),
          memberId: cleanId,
          sourceType: BV_SOURCE_TYPE.MATCHED,
          referenceId: eventRef,
          position: BINARY_POSITION.LEFT,
          openingBV: leftAvail + 1250,
          earnedBV: 0,
          consumedBV: 1250,
          carriedForwardBV: leftAvail,
          flushedBV: 0,
          closingBV: leftAvail,
          payoutSequence: cycle.payoutSequence,
          description: `Subsequent Payout #${cycle.payoutSequence}: 1,250 BV consumed on LEFT leg (1:1)`,
          isImmutable: true,
        });
        await BVLedger.create({
          ledgerId: `BV-CYC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          userId: member._id.toString(),
          memberId: cleanId,
          sourceType: BV_SOURCE_TYPE.MATCHED,
          referenceId: eventRef,
          position: BINARY_POSITION.RIGHT,
          openingBV: rightAvail + 1250,
          earnedBV: 0,
          consumedBV: 1250,
          carriedForwardBV: rightAvail,
          flushedBV: 0,
          closingBV: rightAvail,
          payoutSequence: cycle.payoutSequence,
          description: `Subsequent Payout #${cycle.payoutSequence}: 1,250 BV consumed on RIGHT leg (1:1)`,
          isImmutable: true,
        });
      }
    }

    let commissionLedger: ICommissionLedger | null = null;

    // 8. If payable amount allowed by daily cap is greater than 0, create commission ledger and credit wallet
    if (payableIncome > 0) {
      const deductions = DeductionUtil.calculateDeductions(payableIncome, rules);
      const ledgerId = `COMM-BIN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      commissionLedger = await CommissionLedger.create({
        ledgerId,
        userId: member._id.toString(),
        memberId: cleanId,
        type: COMMISSION_TYPE.BINARY_BONUS,
        sourceEventId: sourceEventId || 'BINARY-SEQUENTIAL',
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
          calculationBase: 'SEQUENTIAL_PAYOUT_BV_CARRY_FORWARD',
          cycles,
          cyclesCount: cycles.length,
          totalGeneratedIncome,
          rateApplied: ratePerCycle,
          dailyCapAmount,
          alreadyEarnedToday,
          dailyCapRemaining: capResult.remainingCap,
          excessAmount,
          excessPolicyApplied: capResult.excessPolicy,
          payoutCount: currentPayoutCount,
          leftAvailableBV: leftAvail,
          rightAvailableBV: rightAvail,
          reservedBV,
          reservedSide,
          tdsRateApplied: deductions.tdsRate,
          adminFeeRateApplied: deductions.adminFeeRate,
          notes: `Sequential Binary Payouts: ${cycles.length} completed payout(s) @ ₹${ratePerCycle} = ₹${totalGeneratedIncome}. Payable (Capped): ₹${payableIncome}. Remaining BV: L=${leftAvail}, R=${rightAvail}, Reserved=${reservedBV} (${reservedSide || 'None'}).`,
        },
        isReversed: false,
      });

      await WalletService.creditCommission(
        cleanId,
        deductions.netPayable,
        ledgerId,
        `Binary Matching Bonus (${cycles.length} payouts @ ₹${ratePerCycle} = ₹${totalGeneratedIncome}, Capped Payable: ₹${payableIncome})`
      );

      // Trigger Sponsor Binary Bonus (20% to direct sponsor, uncapped)
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

    // 9. If capping limit exceeded, alert member
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
          const totalEarnedTodayCalculated = totalGeneratedIncome + alreadyEarnedToday;
          await AdminNotification.create({
            notificationId: `NOTIF-CAP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            type: 'SYSTEM_ALERT',
            title: 'Capping Limits Exceeded',
            message: `You are earning ₹${totalEarnedTodayCalculated.toLocaleString()} today, which exceeds your daily capping limit of ₹${dailyCapAmount.toLocaleString()}/day! Please upgrade your package to earn more binary income.`,
            recipientRole: 'member',
            recipientId: cleanId,
            senderId: 'SYSTEM',
            senderName: 'Binary Engine',
            amount: excessAmount,
            isRead: false,
            metadata: {
              perDayIncome: totalEarnedTodayCalculated,
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
      leftAvailableBV: leftAvail,
      rightAvailableBV: rightAvail,
      reservedBV,
      reservedSide,
      payoutCount: currentPayoutCount,
      dailyCapAmount,
      alreadyEarnedToday,
      excessAmount,
      isSponsorQualified: true,
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
