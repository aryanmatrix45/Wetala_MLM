import { Purchase, IPurchase } from '../../models/Purchase.model';
import { Member } from '../../models/Member.model';
import { CompensationEvent } from '../../models/CompensationEvent.model';
import { CompensationRule, ICompensationRule } from '../../models/CompensationRule.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { BVService } from '../BVService';
import { WalletService } from '../WalletService';
import { WelcomeBonusService } from './WelcomeBonusService';
import { BVWalletService } from '../BVWalletService';
import { TeamPerformanceBonusService } from './TeamPerformanceBonusService';
import { RewardService } from './RewardService';
import { BinaryTreeService } from '../tree/BinaryTreeService';
import { DecimalUtil } from '../../utils/decimal';
import {
  COMPENSATION_EVENT_TYPE,
  COMPENSATION_EVENT_STATUS,
  BV_SOURCE_TYPE,
  COMMISSION_TYPE,
  PURCHASE_TYPE,
  PURCHASE_STATUS,
} from '../../config/constants';

export interface CompensationProcessingResult {
  isSuccess: boolean;
  eventId: string;
  isIdempotentSkip?: boolean;
  commissionsGenerated: ICommissionLedger[];
  error?: string;
}

export class CompensationEngine {
  /**
   * Fetch active compensation rules from database, or fallback to default
   */
  static async getActiveRules(): Promise<ICompensationRule> {
    let rules = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
    if (!rules) {
      rules = await CompensationRule.create({
        ruleSetId: 'DEFAULT_RULES',
        version: 1,
        isActive: true,
        welcomeBonus: {
          isEnabled: true,
          ratePercent: 4, // 4% on Company Weekly GBV Pool
          maxMultiplier: 2, // 2x max Welcome Bonus multiplier
          settlementFrequency: 'WEEKLY',
          limitMode: 'MULTIPLIER',
          fixedAmount: 0,
          minLifetimeBv: 1250,
          minSponsoredCount: 2,
          notes: '4% on Company Weekly GBV pool divided equally among members with 1,250 lifetime BV and 2 sponsored members, capped at 2x lifetime BV.',
        },
        binaryBonus: {
          isEnabled: true,
          rateInRupees: 250,        // ₹250 per pair
          pairBvUnit: 1250,         // 1250 BV per pair
          volumeCarryForwardMode: 'FLUSH', // BV that has not paired by IST midnight is cleared
          excessCapPolicy: 'FLUSH',
          firstPairRatio: '2:1_or_1:2',
          subsequentPairRatio: '1:1',
          firstPayoutDominantBv: 2500,
          firstPayoutOppositeBv: 1250,
          secondPayoutNewBv: 1250,
        },
        sponsorBinaryBonus: {
          isEnabled: true,
          sponsorBinaryRate: 0.20, // 20%
          sponsorDepth: 1,
          calculationBase: 'BINARY_COMMISSION',
        },
        teamPerformanceBonus: {
          isEnabled: true,
          calculationBase: 'CTO_POOL',
          tiers: [
            { tierId: 'TPB-1', pairCount: 10, leftThreshold: 10, rightThreshold: 10, royaltyBonusPercent: 3, limitAmount: 10000 },
            { tierId: 'TPB-2', pairCount: 100, leftThreshold: 100, rightThreshold: 100, royaltyBonusPercent: 3, limitAmount: 30000 },
            { tierId: 'TPB-3', pairCount: 400, leftThreshold: 400, rightThreshold: 400, royaltyBonusPercent: 2, limitAmount: 100000 },
            { tierId: 'TPB-4', pairCount: 1600, leftThreshold: 1600, rightThreshold: 1600, royaltyBonusPercent: 2, limitAmount: 300000 },
            { tierId: 'TPB-5', pairCount: 5000, leftThreshold: 5000, rightThreshold: 5000, royaltyBonusPercent: 1, limitAmount: 500000 },
            { tierId: 'TPB-6', pairCount: 25000, leftThreshold: 25000, rightThreshold: 25000, royaltyBonusPercent: 1, limitAmount: 1500000 },
          ],
          notes: 'Team Performance Bonus based on balanced pairs sharing CTO pool with individual payout limits.',
        },
        rewards: {
          isEnabled: true,
          tiers: [
            { tierId: 'RW-1', rankName: 'FRESHER', teamTarget: 5, leftRequirement: 5, rightRequirement: 5, rewardAmount: 1000, rewardTitle: 'Fresher' },
            { tierId: 'RW-2', rankName: 'STAR', teamTarget: 10, leftRequirement: 10, rightRequirement: 10, rewardAmount: 2000, rewardTitle: 'Star' },
            { tierId: 'RW-3', rankName: 'BRONZE', teamTarget: 50, leftRequirement: 50, rightRequirement: 50, rewardAmount: 10000, rewardTitle: 'Bronze' },
            { tierId: 'RW-4', rankName: 'SILVER', teamTarget: 100, leftRequirement: 100, rightRequirement: 100, rewardAmount: 20000, rewardTitle: 'Silver' },
            { tierId: 'RW-5', rankName: 'PEARL', teamTarget: 200, leftRequirement: 200, rightRequirement: 200, rewardAmount: 40000, rewardTitle: 'Pearl' },
            { tierId: 'RW-6', rankName: 'GOLD', teamTarget: 400, leftRequirement: 400, rightRequirement: 400, rewardAmount: 80000, rewardTitle: 'Gold' },
            { tierId: 'RW-7', rankName: 'RUBY', teamTarget: 800, leftRequirement: 800, rightRequirement: 800, rewardAmount: 160000, rewardTitle: 'Ruby' },
            { tierId: 'RW-8', rankName: 'DIAMOND', teamTarget: 1600, leftRequirement: 1600, rightRequirement: 1600, rewardAmount: 320000, rewardTitle: 'Diamond' },
            { tierId: 'RW-9', rankName: 'DOUBLE DIAMOND', teamTarget: 2500, leftRequirement: 2500, rightRequirement: 2500, rewardAmount: 500000, rewardTitle: 'Double Diamond' },
            { tierId: 'RW-10', rankName: 'CROWN DIAMOND', teamTarget: 5000, leftRequirement: 5000, rightRequirement: 5000, rewardAmount: 1000000, rewardTitle: 'Crown Diamond' },
            { tierId: 'RW-11', rankName: 'PLATINUM', teamTarget: 10000, leftRequirement: 10000, rightRequirement: 10000, rewardAmount: 2000000, rewardTitle: 'Platinum' },
            { tierId: 'RW-12', rankName: 'TOPAZ', teamTarget: 15000, leftRequirement: 15000, rightRequirement: 15000, rewardAmount: 3000000, rewardTitle: 'Topaz' },
            { tierId: 'RW-13', rankName: 'KOHINOOR', teamTarget: 25000, leftRequirement: 25000, rightRequirement: 25000, rewardAmount: 5000000, rewardTitle: 'Kohinoor' },
            { tierId: 'RW-14', rankName: 'DOUBLE KOHINOOR', teamTarget: 5000, leftRequirement: 50000, rightRequirement: 50000, rewardAmount: 10000000, rewardTitle: 'Double Kohinoor' },
            { tierId: 'RW-15', rankName: 'TRIPLE KOHINOOR', teamTarget: 100000, leftRequirement: 100000, rightRequirement: 100000, rewardAmount: 20000000, rewardTitle: 'Triple Kohinoor' },
          ],
        },
        payoutDeductions: {
          isEnabled: false,
          tdsPercent: 0,
          adminFeePercent: 0,
          notes: 'No TDS or admin fee: the full income amount is credited to the wallet.',
        },
      });
    }
    return rules;
  }

  /**
   * Main Pipeline: Process a PURCHASE_COMPLETED business event.
   * Strict Idempotency guaranteed through CompensationEvent.
   */
  static async processPurchaseCompleted(purchaseId: string): Promise<CompensationProcessingResult> {
    const eventId = `EVENT-PURCHASE-${purchaseId}`;

    // 1. Strict Idempotency Check
    const existingEvent = await CompensationEvent.findOne({ eventId });
    if (existingEvent) {
      if (existingEvent.status === COMPENSATION_EVENT_STATUS.PROCESSED) {
        console.log(`[CompensationEngine] Idempotency guard: Event ${eventId} already processed.`);
        return {
          isSuccess: true,
          eventId,
          isIdempotentSkip: true,
          commissionsGenerated: [],
        };
      }
    }

    // 2. Fetch and Validate Purchase
    const purchase = await Purchase.findOne({ purchaseId });
    if (!purchase) {
      throw new Error(`Purchase ${purchaseId} not found.`);
    }

    // STRICT FINANCIAL GUARD: Only purchases verified and marked as PAID can credit BV or generate commissions
    if (purchase.paymentStatus !== 'PAID') {
      throw new Error(
        `Cannot credit volume or commission: Purchase ${purchaseId} is in paymentStatus '${purchase.paymentStatus}' (approvalStage: '${purchase.approvalStage}'). Volume and commissions can only be credited after Super Admin marks the purchase as PAID.`
      );
    }

    const member = await Member.findOne({ memberId: purchase.memberId });
    if (!member) {
      throw new Error(`Member ${purchase.memberId} associated with purchase not found.`);
    }

    // Record Event in PENDING state
    const event = existingEvent || (await CompensationEvent.create({
      eventId,
      eventType: purchase.type === PURCHASE_TYPE.REPURCHASE ? COMPENSATION_EVENT_TYPE.REPURCHASE_COMPLETED : COMPENSATION_EVENT_TYPE.PURCHASE_COMPLETED,
      sourceId: purchaseId,
      userId: member._id.toString(),
      memberId: member.memberId,
      status: COMPENSATION_EVENT_STATUS.PENDING,
      payload: {
        purchaseId: purchase.purchaseId,
        memberId: purchase.memberId,
        type: purchase.type,
        totalAmount: purchase.totalAmount,
        totalBV: purchase.totalBV,
      },
    }));

    const commissionsGenerated: ICommissionLedger[] = [];

    try {
      const rules = await this.getActiveRules();
      const bvAmount = purchase.totalBV;

      // 3. Generate Personal BV
      const bvSource = purchase.type === PURCHASE_TYPE.JOINING ? BV_SOURCE_TYPE.JOINING_PACKAGE : BV_SOURCE_TYPE.REPURCHASE;
      await BVService.creditPersonalBV(
        member.memberId,
        member._id.toString(),
        bvAmount,
        bvSource,
        purchase.purchaseId,
        `${purchase.type} Purchase: ${bvAmount} BV`
      );

      // 4. Distribute Volume Up Binary Ancestors
      const binaryAncestors = await BVService.distributeVolumeToAncestors(
        member.memberId,
        bvAmount,
        bvSource,
        purchase.purchaseId
      );

      // Binary activation: lock 100 BV the first time personal BV + BV Wallet reaches it
      await BVWalletService.activateFromWalletIfEligible(member.memberId);

      // 5. Evaluate Individual Compensation Bonuses

      // A. Welcome bonus needs nothing here: lifetime BV is read from the ledgers (LifetimeBvService)

      // B. Binary matching income is not paid here: the order's BV now waits on each ancestor's
      //    leg and is matched and paid by the daily binary settlement once the IST day ends, which
      //    also pays the direct sponsor's 20% sponsor income.
      for (const { ancestorMemberId } of binaryAncestors) {
        // C. Team Performance Bonus: updates the ancestor's RP and records new slab qualifications.
        //    Payouts are made by the period settlement, not per purchase.
        await TeamPerformanceBonusService.evaluateMember(ancestorMemberId);

        // D. Lifetime Milestone Rewards
        const rewardComms = await RewardService.evaluateRewards(
          ancestorMemberId,
          rules,
          eventId
        );
        commissionsGenerated.push(...rewardComms);
      }

      // 6. Update Purchase Status & Mark Event Processed
      purchase.status = PURCHASE_STATUS.COMPLETED;
      purchase.paymentStatus = 'PAID';
      purchase.completedAt = new Date();
      await purchase.save();

      event.status = COMPENSATION_EVENT_STATUS.PROCESSED;
      event.result = {
        commissionsCount: commissionsGenerated.length,
        totalCommissionsPayable: commissionsGenerated.reduce((sum, c) => sum + c.payableAmount, 0),
        processedAncestorsCount: binaryAncestors.length,
      };
      event.processedAt = new Date();
      await event.save();

      return {
        isSuccess: true,
        eventId,
        commissionsGenerated,
      };
    } catch (error: any) {
      console.error(`[CompensationEngine] Error processing event ${eventId}:`, error);
      event.status = COMPENSATION_EVENT_STATUS.FAILED;
      event.error = error.message;
      await event.save();

      return {
        isSuccess: false,
        eventId,
        commissionsGenerated,
        error: error.message,
      };
    }
  }

  /**
   * Commission Reversal: In the event of refund or chargeback, reverse commissions
   * by adding reverse ledger transactions without deleting original records.
   */
  static async reversePurchaseCommission(
    purchaseId: string,
    reason: string = 'Refund'
  ): Promise<{ reversedCount: number; reversedTotalAmount: number }> {
    const originalCommissions = await CommissionLedger.find({
      sourcePurchaseId: purchaseId,
      isReversed: false,
    });

    let reversedCount = 0;
    let reversedTotalAmount = 0;

    for (const comm of originalCommissions) {
      // 1. Debit member wallet to claw back payable commission
      await WalletService.debitWallet(
        comm.memberId,
        comm.payableAmount,
        'ADJUSTMENT',
        `REV-${comm.ledgerId}`,
        `Reversal of ${comm.type} for cancelled purchase ${purchaseId}: ${reason}`
      );

      // 2. Mark original commission as reversed
      const reversalLedgerId = `REV-${comm.ledgerId}`;
      comm.isReversed = true;
      comm.reversalLedgerId = reversalLedgerId;
      comm.reversedAt = new Date();
      comm.reversalReason = reason;
      comm.status = 'REVERSED';
      await comm.save();

      // 3. Create negative reversal ledger entry
      await CommissionLedger.create({
        ledgerId: reversalLedgerId,
        userId: comm.userId,
        memberId: comm.memberId,
        type: COMMISSION_TYPE.REVERSAL,
        sourceEventId: `REV-${comm.sourceEventId}`,
        sourcePurchaseId: purchaseId,
        grossAmount: -comm.grossAmount,
        grossAmountInPaise: -comm.grossAmountInPaise,
        tdsDeduction: -comm.tdsDeduction,
        tdsDeductionInPaise: -comm.tdsDeductionInPaise,
        adminFee: -comm.adminFee,
        adminFeeInPaise: -comm.adminFeeInPaise,
        payableAmount: -comm.payableAmount,
        payableAmountInPaise: -comm.payableAmountInPaise,
        status: 'REVERSED',
        calculationDetails: {
          sourcePurchaseId: purchaseId,
          notes: `Reversal of Commission ${comm.ledgerId}: ${reason}`,
        },
        isReversed: true,
      });

      reversedCount++;
      reversedTotalAmount = DecimalUtil.add(reversedTotalAmount, comm.payableAmount);
    }

    return { reversedCount, reversedTotalAmount };
  }
}
