import { BinaryVolume, IBinaryVolume } from '../../models/BinaryVolume.model';
import { Member, IMember } from '../../models/Member.model';
import { BVLedger } from '../../models/BVLedger.model';
import { BinaryDailyClosing } from '../../models/BinaryDailyClosing.model';
import { ICompensationRule } from '../../models/CompensationRule.model';
import { CapService } from './CapService';
import { BinaryTreeService } from '../tree/BinaryTreeService';
import { BusinessDate } from '../../utils/businessDate';
import { BINARY_POSITION, BV_SETTLEMENT_STATUS } from '../../config/constants';
import {
  BinaryMatchState,
  BinaryMatchCycle,
  applyDailyCap,
  computeMatches,
  matchRulesFrom,
} from './BinaryMatchingEngine';

export interface BinaryQualification {
  isSelfActive: boolean;
  isSponsorQualified: boolean;
  hasLeftSponsor: boolean;
  hasRightSponsor: boolean;
  leftSponsorMembers: Array<{ memberId: string; name: string; personalBv: number }>;
  rightSponsorMembers: Array<{ memberId: string; name: string; personalBv: number }>;
}

export interface BinaryDayPreview {
  businessDate: string;
  opening: BinaryMatchState; // carry forward from the last closing
  newLeftBV: number; // team BV not yet settled (today, plus any unsettled earlier day)
  newRightBV: number;
  qualification: BinaryQualification;
  matches: number;
  cycles: BinaryMatchCycle[];
  ratePerMatch: number;
  generatedAmount: number;
  dailyCap: number; // 0 = uncapped
  creditedAmount: number;
  flushedAmount: number;
  closing: BinaryMatchState; // what will carry into the next day
}

/**
 * Binary matching income.
 *
 * Team BV reaches a member's legs in real time (BVService.distributeVolumeToAncestors) as PENDING
 * BVLedger rows. Nothing is paid then: once an IST day ends, DailyBinarySettlementService closes it
 * for every member with computeMatches() and credits the capped amount to the wallet. This service
 * holds the read side: unsettled volume, qualification and the live estimate for today.
 */
export class BinaryBonusService {
  static snapshotOf(vol: IBinaryVolume | null): BinaryMatchState {
    return {
      left: vol?.leftAvailableBV || 0,
      right: vol?.rightAvailableBV || 0,
      reservedBV: vol?.reservedBV || 0,
      reservedSide: (vol?.reservedSide as BinaryMatchState['reservedSide']) || null,
      payoutCount: vol?.payoutCount || 0,
    };
  }

  /** Net team BV per leg in PENDING ledger rows dated on or before the business date */
  static async getPendingVolume(memberId: string, upToDate?: string) {
    const filter: Record<string, unknown> = {
      memberId,
      settlementStatus: BV_SETTLEMENT_STATUS.PENDING,
      position: { $in: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT] },
    };
    if (upToDate) filter.businessDate = { $lte: upToDate };
    const rows = await BVLedger.find(filter).select('_id position earnedBV consumedBV');

    let left = 0;
    let right = 0;
    for (const row of rows) {
      const net = (row.earnedBV || 0) - (row.consumedBV || 0);
      if (row.position === BINARY_POSITION.LEFT) left += net;
      else right += net;
    }
    return { left, right, rowIds: rows.map((r) => r._id) };
  }

  /**
   * Binary income needs the member to be binary active (100 BV locked) and to have personally
   * sponsored at least one active member somewhere in the left subtree AND one in the right
   * subtree, at any depth.
   */
  static async getQualification(member: IMember): Promise<BinaryQualification> {
    const isSelfActive = Boolean(
      member.isActive && member.status !== 'blocked' && (member.isBinaryActive || (member.personalBv || 0) >= 100)
    );
    const sponsorCheck = await BinaryTreeService.checkSponsorLegEligibility(member.memberId);
    return {
      isSelfActive,
      isSponsorQualified: sponsorCheck.isQualified,
      hasLeftSponsor: sponsorCheck.hasLeftSponsor,
      hasRightSponsor: sponsorCheck.hasRightSponsor,
      leftSponsorMembers: sponsorCheck.leftSponsorMembers || [],
      rightSponsorMembers: sponsorCheck.rightSponsorMembers || [],
    };
  }

  /**
   * Live estimate of what the next daily closing will pay this member. Read only: it changes no
   * balances and pays nothing.
   */
  static async previewToday(memberId: string, rules: ICompensationRule): Promise<BinaryDayPreview | null> {
    const cleanId = (memberId || '').toUpperCase().trim();
    const member = await Member.findOne({ memberId: cleanId });
    if (!member) return null;

    const businessDate = BusinessDate.today();
    const matchRules = matchRulesFrom(rules);
    const [vol, pending, qualification, dailyCap, settledToday] = await Promise.all([
      BinaryVolume.findOne({ memberId: cleanId }),
      this.getPendingVolume(cleanId),
      this.getQualification(member),
      CapService.getDailyCap(cleanId),
      BinaryDailyClosing.findOne({ memberId: cleanId, businessDate }),
    ]);

    const opening = this.snapshotOf(vol);
    const start: BinaryMatchState = {
      ...opening,
      left: Math.max(0, opening.left + pending.left),
      right: Math.max(0, opening.right + pending.right),
    };
    const canEarn = rules.binaryBonus?.isEnabled !== false && qualification.isSelfActive && qualification.isSponsorQualified;
    const result = canEarn ? computeMatches(start, matchRules) : null;

    // A day is capped once; anything already settled for today counts against it
    const alreadyCredited = settledToday?.creditedAmount || 0;
    const remainingCap = dailyCap > 0 ? Math.max(0, dailyCap - alreadyCredited) : 0;
    const generatedAmount = result?.generatedAmount || 0;
    const { creditedAmount, flushedAmount } =
      dailyCap > 0 && remainingCap === 0
        ? { creditedAmount: 0, flushedAmount: generatedAmount }
        : applyDailyCap(generatedAmount, remainingCap);

    return {
      businessDate,
      opening,
      newLeftBV: pending.left,
      newRightBV: pending.right,
      qualification,
      matches: result?.matches || 0,
      cycles: result?.cycles || [],
      ratePerMatch: matchRules.ratePerMatch,
      generatedAmount,
      dailyCap,
      creditedAmount,
      flushedAmount,
      closing: result?.state || start,
    };
  }
}
