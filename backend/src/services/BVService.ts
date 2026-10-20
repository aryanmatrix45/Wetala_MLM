import { BVLedger, IBVLedger } from '../models/BVLedger.model';
import { BinaryVolume, IBinaryVolume } from '../models/BinaryVolume.model';
import { Member } from '../models/Member.model';
import { CompensationRule } from '../models/CompensationRule.model';
import { Purchase, IPurchase } from '../models/Purchase.model';
import { BinaryTreeService } from './tree/BinaryTreeService';
import { BV_SOURCE_TYPE, BVSourceType, BINARY_POSITION, BinaryPosition } from '../config/constants';

export class BVService {
  /**
   * Get or create BinaryVolume tracker for a member
   */
  static async getOrCreateBinaryVolume(memberId: string, userId: string): Promise<IBinaryVolume> {
    let vol = await BinaryVolume.findOne({ memberId });
    if (!vol) {
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
    }
    return vol;
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
    const lastEntry = await BVLedger.findOne({ memberId }).sort({ createdAt: -1 });
    const openingBV = lastEntry ? lastEntry.closingBV : 0;
    const closingBV = openingBV + bvAmount;

    const ledger = await BVLedger.create({
      ledgerId: `BV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
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
   * Distribute purchase volume UP the binary tree to all ancestors.
   * For each ancestor, determines whether the volume is on their LEFT or RIGHT leg,
   * updates BinaryVolume available volumes, and logs an immutable BVLedger entry.
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

    for (const { memberId: ancestorId, leg } of ancestors) {
      const ancestorMember = await Member.findOne({ memberId: ancestorId });
      if (!ancestorMember) continue;

      const vol = await this.getOrCreateBinaryVolume(ancestorMember.memberId, ancestorMember._id.toString());

      const isLeft = leg === BINARY_POSITION.LEFT;
      if (isLeft) {
        vol.leftTotalBV += bvAmount;
        vol.leftAvailableBV += bvAmount;
        vol.leftCarryForwardBV = vol.leftAvailableBV;
      } else {
        vol.rightTotalBV += bvAmount;
        vol.rightAvailableBV += bvAmount;
        vol.rightCarryForwardBV = vol.rightAvailableBV;
      }
      await vol.save();

      // Sync high-level Member cache
      ancestorMember.leftBv = vol.leftTotalBV;
      ancestorMember.rightBv = vol.rightTotalBV;
      await ancestorMember.save();

      // Record immutable BVLedger entry for ancestor
      const lastEntry = await BVLedger.findOne({ memberId: ancestorMember.memberId }).sort({ createdAt: -1 });
      const openingBV = lastEntry ? lastEntry.closingBV : 0;
      const closingBV = openingBV + bvAmount;

      await BVLedger.create({
        ledgerId: `BV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        userId: ancestorMember._id.toString(),
        memberId: ancestorMember.memberId,
        sourceMemberId: purchaserMemberId,
        sourceType,
        referenceId,
        position: leg,
        openingBV,
        earnedBV: bvAmount,
        consumedBV: 0,
        carriedForwardBV: isLeft ? vol.leftAvailableBV : vol.rightAvailableBV,
        flushedBV: 0,
        closingBV,
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
   * Volume already consumed by binary matching cannot be un-matched; only unmatched volume is removed.
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

    for (const credit of credits) {
      const bv = credit.earnedBV || 0;
      if (bv <= 0) continue;
      const member = await Member.findOne({ memberId: credit.memberId });
      if (!member) continue;

      const lastEntry = await BVLedger.findOne({ memberId: member.memberId }).sort({ createdAt: -1 });
      const openingBV = lastEntry ? lastEntry.closingBV : 0;
      let carriedForwardBV = 0;

      if (!credit.position) {
        // The buyer's own personal BV
        member.personalBv = Math.max(0, (member.personalBv || 0) - bv);
        member.qualifyingBv = member.personalBv;
        const activeRule = await CompensationRule.findOne({ isActive: true }).sort({ version: -1 });
        member.welcomeBonusCap = member.personalBv * (activeRule?.welcomeBonus?.maxMultiplier ?? 2);
        await member.save();
        result.personalBvReversed += bv;
      } else {
        // Upline leg volume
        const vol = await BinaryVolume.findOne({ memberId: member.memberId });
        if (vol) {
          if (credit.position === BINARY_POSITION.LEFT) {
            vol.leftTotalBV = Math.max(0, vol.leftTotalBV - bv);
            vol.leftAvailableBV = Math.max(0, vol.leftAvailableBV - bv);
            vol.leftCarryForwardBV = vol.leftAvailableBV;
            carriedForwardBV = vol.leftAvailableBV;
          } else {
            vol.rightTotalBV = Math.max(0, vol.rightTotalBV - bv);
            vol.rightAvailableBV = Math.max(0, vol.rightAvailableBV - bv);
            vol.rightCarryForwardBV = vol.rightAvailableBV;
            carriedForwardBV = vol.rightAvailableBV;
          }
          await vol.save();
          await Member.updateOne({ memberId: member.memberId }, { $set: { leftBv: vol.leftTotalBV, rightBv: vol.rightTotalBV } });
        }
        result.uplineEntriesReversed++;
      }

      await BVLedger.create({
        ledgerId: `BV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        userId: member._id.toString(),
        memberId: member.memberId,
        sourceMemberId: credit.sourceMemberId,
        sourceType: BV_SOURCE_TYPE.REVERSAL,
        referenceId: purchase.purchaseId,
        position: credit.position,
        openingBV,
        earnedBV: 0,
        consumedBV: bv,
        carriedForwardBV,
        flushedBV: 0,
        closingBV: Math.max(0, openingBV - bv),
        description,
        isImmutable: true,
      });
    }

    return result;
  }
}
