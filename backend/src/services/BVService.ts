import { BVLedger, IBVLedger } from '../models/BVLedger.model';
import { BinaryVolume, IBinaryVolume } from '../models/BinaryVolume.model';
import { Member } from '../models/Member.model';
import { CompensationRule } from '../models/CompensationRule.model';
import { Purchase, IPurchase } from '../models/Purchase.model';
import { BinaryTreeService } from './tree/BinaryTreeService';
import { BusinessDate } from '../utils/businessDate';
import {
  BV_SOURCE_TYPE,
  BVSourceType,
  BINARY_POSITION,
  BinaryPosition,
  BV_SETTLEMENT_STATUS,
} from '../config/constants';

const newLedgerId = () => `BV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

export class BVService {
  /**
   * Get or create BinaryVolume tracker for a member
   */
  static async getOrCreateBinaryVolume(memberId: string, userId: string): Promise<IBinaryVolume> {
    let vol = await BinaryVolume.findOne({ memberId });
    if (!vol) {
      try {
        vol = await BinaryVolume.create({
          memberId,
          userId,
          leftTotalBV: 0,
          rightTotalBV: 0,
          matchedTotalBV: 0,
          leftAvailableBV: 0,
          rightAvailableBV: 0,
          leftCarryForwardBV: 0,
          rightCarryForwardBV: 0,
        });
      } catch (error: any) {
        // Another request created it first
        if (error?.code !== 11000) throw error;
        vol = (await BinaryVolume.findOne({ memberId }))!;
      }
    }
    return vol;
  }

  /** Opening balance for the member's own (personal, no leg) BV ledger rows */
  private static async lastPersonalClosing(memberId: string): Promise<number> {
    const lastEntry = await BVLedger.findOne({ memberId, position: null }).sort({ createdAt: -1 });
    return lastEntry ? lastEntry.closingBV : 0;
  }

  /**
   * Record personal BV for the purchaser in the immutable BVLedger
   */
  static async creditPersonalBV(
    memberId: string,
    userId: string,
    bvAmount: number,
    sourceType: BVSourceType,
    referenceId: string,
    description: string
  ): Promise<IBVLedger> {
    const openingBV = await this.lastPersonalClosing(memberId);
    const closingBV = openingBV + bvAmount;

    const ledger = await BVLedger.create({
      ledgerId: newLedgerId(),
      userId,
      memberId,
      sourceType,
      referenceId,
      openingBV,
      earnedBV: bvAmount,
      consumedBV: 0,
      carriedForwardBV: 0,
      flushedBV: 0,
      closingBV,
      description,
      isImmutable: true,
    });

    // Update member's cumulative personal BV and check binary tree participation threshold (100 BV)
    const member = await Member.findOne({ memberId });
    if (member) {
      const wasUnplaced = !member.parentId;
      member.personalBv = (member.personalBv || 0) + bvAmount;
      member.qualifyingBv = member.personalBv;
      const activeRule = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
      const mult = activeRule?.welcomeBonus?.maxMultiplier ?? 2;
      member.welcomeBonusCap = member.personalBv * mult;
      if (member.personalBv >= 100) {
        if (!member.isBinaryActive) {
          member.isBinaryActive = true;
          if (!member.binaryActivatedAt) {
            member.binaryActivatedAt = new Date();
          }
        }
      }
      await member.save();

      // If member reached >= 100 BV and is not yet placed in the binary tree, place them now upon activation!
      if (member.personalBv >= 100 && wasUnplaced && member.sponsorId) {
        await BinaryTreeService.placeMemberInBinaryTree(member.memberId);
      }
    }

    return ledger;
  }

  /**
   * Distribute volume UP the binary tree to all ancestors.
   *
   * Each ancestor gets a PENDING BVLedger row on the leg the volume arrived on, stamped with
   * today's IST business date. Nothing is matched here: the daily binary settlement takes all
   * PENDING rows of the day into that member's closing. Lifetime leg totals are updated at once
   * with an atomic $inc so concurrent orders cannot lose volume.
   */
  static async distributeVolumeToAncestors(
    purchaserMemberId: string,
    bvAmount: number,
    sourceType: BVSourceType,
    referenceId: string
  ): Promise<Array<{ ancestorMemberId: string; leg: BinaryPosition }>> {
    if (bvAmount <= 0) return [];

    const ancestors = await BinaryTreeService.getBinaryAncestors(purchaserMemberId);
    const updatedAncestors: Array<{ ancestorMemberId: string; leg: BinaryPosition }> = [];
    const businessDate = BusinessDate.today();

    for (const { memberId: ancestorId, leg } of ancestors) {
      const ancestorMember = await Member.findOne({ memberId: ancestorId });
      if (!ancestorMember) continue;

      await this.getOrCreateBinaryVolume(ancestorMember.memberId, ancestorMember._id.toString());
      const isLeft = leg === BINARY_POSITION.LEFT;
      const vol = await BinaryVolume.findOneAndUpdate(
        { memberId: ancestorMember.memberId },
        { $inc: isLeft ? { leftTotalBV: bvAmount } : { rightTotalBV: bvAmount } },
        { returnDocument: 'after' }
      );
      if (!vol) continue;

      // Sync high-level Member cache
      await Member.updateOne(
        { memberId: ancestorMember.memberId },
        { $set: { leftBv: vol.leftTotalBV, rightBv: vol.rightTotalBV } }
      );

      // Opening / closing on a team row are the leg's lifetime total before and after this credit
      const closingBV = isLeft ? vol.leftTotalBV : vol.rightTotalBV;
      await BVLedger.create({
        ledgerId: newLedgerId(),
        userId: ancestorMember._id.toString(),
        memberId: ancestorMember.memberId,
        sourceMemberId: purchaserMemberId,
        sourceType,
        referenceId,
        position: leg,
        openingBV: closingBV - bvAmount,
        earnedBV: bvAmount,
        consumedBV: 0,
        carriedForwardBV: 0,
        flushedBV: 0,
        closingBV,
        businessDate,
        settlementStatus: BV_SETTLEMENT_STATUS.PENDING,
        description: `Team BV credited from ${purchaserMemberId} on ${leg} leg (${sourceType})`,
        isImmutable: true,
      });

      updatedAncestors.push({ ancestorMemberId: ancestorId, leg });
    }

    return updatedAncestors;
  }

  /**
   * Takes back the earned BV of a refunded order: the member's personal BV and the volume added to
   * every upline leg. Uses the order's own BVLedger credits as the record of what was given, so it
   * only reverses what was actually credited. Runs once per order (Purchase.bvVolumeReversed).
   * Upline reversals are PENDING rows that the next daily settlement subtracts from that leg's
   * unmatched BV; volume already used by an earlier day's matching cannot be un-matched.
   */
  static async reversePurchaseVolume(purchase: IPurchase): Promise<{ personalBvReversed: number; uplineEntriesReversed: number }> {
    const result = { personalBvReversed: 0, uplineEntriesReversed: 0 };
    const claim = await Purchase.updateOne(
      { purchaseId: purchase.purchaseId, bvVolumeReversed: { $ne: true } },
      { $set: { bvVolumeReversed: true } }
    );
    if (!claim.modifiedCount) return result;

    const creditTypes = [BV_SOURCE_TYPE.JOINING_PACKAGE, BV_SOURCE_TYPE.REPURCHASE, BV_SOURCE_TYPE.RETAIL];
    const credits = await BVLedger.find({ referenceId: purchase.purchaseId, sourceType: { $in: creditTypes } });
    const description = `Reversal of refunded order ${purchase.purchaseId}`;
    const businessDate = BusinessDate.today();

    for (const credit of credits) {
      const bv = credit.earnedBV || 0;
      if (bv <= 0) continue;
      const member = await Member.findOne({ memberId: credit.memberId });
      if (!member) continue;

      if (!credit.position) {
        // The buyer's own personal BV
        const openingBV = await this.lastPersonalClosing(member.memberId);
        member.personalBv = Math.max(0, (member.personalBv || 0) - bv);
        member.qualifyingBv = member.personalBv;
        const activeRule = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
        member.welcomeBonusCap = member.personalBv * (activeRule?.welcomeBonus?.maxMultiplier ?? 2);
        await member.save();
        result.personalBvReversed += bv;

        await BVLedger.create({
          ledgerId: newLedgerId(),
          userId: member._id.toString(),
          memberId: member.memberId,
          sourceMemberId: credit.sourceMemberId,
          sourceType: BV_SOURCE_TYPE.REVERSAL,
          referenceId: purchase.purchaseId,
          openingBV,
          earnedBV: 0,
          consumedBV: bv,
          carriedForwardBV: 0,
          flushedBV: 0,
          closingBV: Math.max(0, openingBV - bv),
          description,
          isImmutable: true,
        });
        continue;
      }

      // Upline leg volume
      const isLeft = credit.position === BINARY_POSITION.LEFT;
      const field = isLeft ? 'leftTotalBV' : 'rightTotalBV';
      const vol = (await BinaryVolume.findOneAndUpdate(
        { memberId: member.memberId },
        [{ $set: { [field]: { $max: [0, { $subtract: [`$${field}`, bv] }] } } }],
        { returnDocument: 'after', updatePipeline: true } as any
      )) as IBinaryVolume | null;
      if (vol) {
        await Member.updateOne({ memberId: member.memberId }, { $set: { leftBv: vol.leftTotalBV, rightBv: vol.rightTotalBV } });
      }
      const closingBV = vol ? (isLeft ? vol.leftTotalBV : vol.rightTotalBV) : 0;

      await BVLedger.create({
        ledgerId: newLedgerId(),
        userId: member._id.toString(),
        memberId: member.memberId,
        sourceMemberId: credit.sourceMemberId,
        sourceType: BV_SOURCE_TYPE.REVERSAL,
        referenceId: purchase.purchaseId,
        position: credit.position,
        openingBV: closingBV + bv,
        earnedBV: 0,
        consumedBV: bv,
        carriedForwardBV: 0,
        flushedBV: 0,
        closingBV,
        businessDate,
        settlementStatus: BV_SETTLEMENT_STATUS.PENDING,
        description,
        isImmutable: true,
      });
      result.uplineEntriesReversed++;
    }

    return result;
  }
}
