import { Member, IMember } from '../../models/Member.model';

export interface SponsorNodeDTO {
  memberId: string;
  name: string;
  email: string;
  mobile: string;
  rank: string;
  packageName: string;
  isActive: boolean;
  status: string;
  directReferralsCount: number;
  totalTeamCount: number;
  joinedAt: Date;
  referrals?: SponsorNodeDTO[];
}

export class SponsorTreeService {
  /**
   * Get direct downline referrals sponsored by this member (Level 1)
   */
  static async getDirectReferrals(sponsorMemberId: string): Promise<IMember[]> {
    return Member.find({ sponsorId: sponsorMemberId }).sort({ createdAt: -1 });
  }

  /**
   * Build recursive Sponsor Tree (Unilevel tree) up to maxDepth
   */
  static async getSponsorTree(rootMemberId: string, maxDepth: number = 3): Promise<SponsorNodeDTO | null> {
    const root = await Member.findOne({ memberId: rootMemberId });
    if (!root) return null;

    return this.buildSponsorNode(root, 1, maxDepth);
  }

  private static async buildSponsorNode(member: IMember, currentDepth: number, maxDepth: number): Promise<SponsorNodeDTO> {
    const directCount = await Member.countDocuments({ sponsorId: member.memberId });

    const node: SponsorNodeDTO = {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      mobile: member.mobile,
      rank: member.rank || 'Distributor',
      packageName: member.packageName || 'Basic',
      isActive: member.isActive,
      status: member.status,
      directReferralsCount: directCount,
      totalTeamCount: directCount, // simplified or aggregated
      joinedAt: member.joinedAt || member.createdAt,
      referrals: [],
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    const directs = await Member.find({ sponsorId: member.memberId }).limit(50);
    const childNodes = await Promise.all(
      directs.map((child) => this.buildSponsorNode(child, currentDepth + 1, maxDepth))
    );

    node.referrals = childNodes;
    return node;
  }
}
