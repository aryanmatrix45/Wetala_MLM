import { BVLedger, IBVLedger } from '../models/BVLedger.model';
import { BinaryVolume, IBinaryVolume } from '../models/BinaryVolume.model';
import { Member } from '../models/Member.model';
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
      member.personalBv = (member.personalBv || 0) + bvAmount;
      if (member.personalBv >= 100) {
        if (!member.isBinaryActive) {
          member.isBinaryActive = true;
          if (!member.binaryActivatedAt) {
            member.binaryActivatedAt = new Date();
          }
        }
      }
      await member.save();
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
}
