import { Purchase, IPurchase } from '../../models/Purchase.model';
import { Member } from '../../models/Member.model';
import { CompensationEvent } from '../../models/CompensationEvent.model';
import { CompensationRule, ICompensationRule } from '../../models/CompensationRule.model';
import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { BVService } from '../BVService';
import { WalletService } from '../WalletService';
import { WelcomeBonusService } from './WelcomeBonusService';
import { BinaryBonusService } from './BinaryBonusService';
import { SponsorBonusService } from './SponsorBonusService';
import { SelfPurchaseBonusService } from './SelfPurchaseBonusService';
import { TeamBonusService } from './TeamBonusService';
import { TeamPerformanceService } from './TeamPerformanceService';
import { RewardService } from './RewardService';
import { FranchiseService } from './FranchiseService';
import { UplineBonusService } from './UplineBonusService';
import { RoyaltyService } from './RoyaltyService';
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
          requiresLeftAndRight: true,
          ratePercent: 4, // 4% on Company Weekly GBV Pool
          maxMultiplier: 2, // 2x max Welcome Bonus multiplier
          settlementFrequency: 'WEEKLY',
          limitMode: 'MULTIPLIER',
          fixedAmount: 0,
          notes: '4% on Company Weekly GBV pool divided equally among eligible members with Left + Right, capped at 2x qualifying BV.',
        },
        binaryBonus: {
          isEnabled: true,
          rateInRupees: 250,        // ₹250 per pair
          pairBvUnit: 1250,         // 1250 BV per pair
          volumeCarryForwardMode: 'CARRY_FORWARD',
          excessCapPolicy: 'FLUSH',
          firstPairRatio: '2:1_or_1:2',
          subsequentPairRatio: '1:1',
          firstPayoutDominantBv: 2500,
          firstPayoutOppositeBv: 1250,
          secondPayoutNewBv: 1250,
        },
        teamBonus: {
          isEnabled: true,
          calculationBase: 'MATCHED_BV',
          tiers: [
            { tierId: 'TB-1', leftVolume: 1000, rightVolume: 1000, rate: 0.15 },
            { tierId: 'TB-2', leftVolume: 2500, rightVolume: 2500, rate: 0.10 },
            { tierId: 'TB-3', leftVolume: 7500, rightVolume: 7500, rate: 0.07 },
            { tierId: 'TB-4', leftVolume: 20000, rightVolume: 20000, rate: 0.06 },
            { tierId: 'TB-5', leftVolume: 35000, rightVolume: 35000, rate: 0.05 },
            { tierId: 'TB-6', leftVolume: 70000, rightVolume: 70000, rate: 0.04 },
            { tierId: 'TB-7', leftVolume: 150000, rightVolume: 150000, rate: 0.03 },
            { tierId: 'TB-8', leftVolume: 300000, rightVolume: 300000, rate: 0.02 },
          ],
        },
        selfPurchaseBonus: {
          isEnabled: true,
          ratePercent: 0.08, // 8%
          calculationBase: 'BV',
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
        franchisePolicy: {
          isEnabled: true,
          incentiveType: 'MARGIN',
          tiers: [
            { threshold: 50000, rate: 0.05 },
            { threshold: 100000, rate: 0.08 },
            { threshold: 500000, rate: 0.10 },
            { threshold: 1000000, rate: 0.12 },
          ],
          uplineBonusRate: 0.02, // 2%
        },
        uplineBonus: {
          isEnabled: true,
          uplineBonusRate: 0.02, // 2%
          maxUplineLevels: 1,
          calculationBase: 'BV',
        },
        royalty: {
          isEnabled: false,
          poolPercent: 0,
          eligibleRanks: [],
          minTeamVolume: 0,
          notes: 'TODO: Confirm exact Royalty pool formula with business owner.',
        },
        consultancyBonus: {
          isEnabled: false,
          qualifyingAmount: 2500,
          productQuantity: 1,
          qualifyingMonths: 3,
          freeProductMonth: 4,
          notes: 'TODO: Confirm exact Consultancy Bonus rules with business owner.',
        },
        retailProfit: {
          isEnabled: true,
          maxPercentage: 50,
          calculationBase: 'MRP',
        },
        payoutDeductions: {
          isEnabled: true,
          tdsPercent: 5,
          adminFeePercent: 5,
          notes: 'Standard deductions: TDS (can be 0-100%) and Admin fee (can be 0-100%). Net credited to wallet.',
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
      const purchaseAmount = purchase.totalAmount;

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

      // 5. Evaluate Individual Compensation Bonuses

      // A. Welcome Bonus Qualifying Volume & 2x Cap Update (Standalone Weekly Settlement System)
      if (purchase.type === PURCHASE_TYPE.JOINING) {
        const mult = rules.welcomeBonus?.maxMultiplier || 2;
        const qBv = bvAmount || member.packageBv || 1250;
        await Member.updateOne(
          { memberId: member.memberId },
          {
            $set: {
              qualifyingBv: qBv,
              welcomeBonusCap: qBv * mult,
            },
          }
        );
      }

      // B. Self Purchase Bonus (Repurchase Only - 8%)
      if (purchase.type === PURCHASE_TYPE.REPURCHASE || purchase.type === PURCHASE_TYPE.RETAIL) {
        const selfComm = await SelfPurchaseBonusService.processSelfPurchaseBonus(
          member.memberId,
          purchaseAmount,
          bvAmount,
          purchase.type,
          rules,
          eventId,
          purchase.purchaseId
        );
        if (selfComm) commissionsGenerated.push(selfComm);
      }

      // C. Binary Matching Bonus for Ancestors whose volume changed
      for (const { ancestorMemberId } of binaryAncestors) {
        const binComm = await BinaryBonusService.processMemberBinaryBonus(
          ancestorMemberId,
          rules,
          eventId,
          purchase.purchaseId
        );

        if (binComm) {
          commissionsGenerated.push(binComm);

          // D. Sponsor Binary Bonus (20% to sponsors of members earning binary income)
          const sponsorComms = await SponsorBonusService.processSponsorBonus(
            ancestorMemberId,
            binComm.grossAmount,
            rules,
            eventId,
            purchase.purchaseId
          );
          commissionsGenerated.push(...sponsorComms);
        }

        // E. Team Bonus Tiers for Ancestors
        const teamComm = await TeamBonusService.processTeamBonus(
          ancestorMemberId,
          rules,
          eventId,
          purchase.purchaseId
        );
        if (teamComm) commissionsGenerated.push(teamComm);

        // F. Team Performance Bonus
        const perfComm = await TeamPerformanceService.processTeamPerformanceBonus(
          ancestorMemberId,
          rules,
          eventId,
          purchase.purchaseId
        );
        if (perfComm) commissionsGenerated.push(perfComm);

        // G. Lifetime Milestone Rewards
        const rewardComms = await RewardService.evaluateRewards(
          ancestorMemberId,
          rules,
          eventId
        );
        commissionsGenerated.push(...rewardComms);
      }

      // H. Upline Bonus (2% from purchaser to sponsors)
      const uplineComms = await UplineBonusService.processUplineBonus(
        member.memberId,
        purchaseAmount,
        bvAmount,
        rules,
        eventId,
        purchase.purchaseId
      );
      commissionsGenerated.push(...uplineComms);

      // I. Franchise Policy (if large volume purchase)
      if (purchaseAmount >= 50000) {
        const franchiseResult = await FranchiseService.processFranchiseIncentive(
          member.memberId,
          purchaseAmount,
          rules,
          eventId,
          purchase.purchaseId
        );
        if (franchiseResult.franchiseCommission) commissionsGenerated.push(franchiseResult.franchiseCommission);
        if (franchiseResult.uplineCommission) commissionsGenerated.push(franchiseResult.uplineCommission);
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
