import { Member } from '../../models/Member.model';
import { Package } from '../../models/Package.model';
import { BINARY_SETTLEMENT } from '../../config/constants';

export class CapService {
  /**
   * Daily binary income cap in rupees for a member.
   *
   * Only members earn income, and every member is capped the same way: the member's package cap
   * (Member.dailyCapping, which only ever goes up as bigger packages are bought), then the joining
   * package, and otherwise a flat ₹4,000.
   */
  static async getDailyCap(memberId: string): Promise<number> {
    const cleanId = (memberId || '').toUpperCase().trim();
    const member = await Member.findOne({ memberId: cleanId }).select('dailyCapping joiningPackageId');
    if (!member) return BINARY_SETTLEMENT.DEFAULT_DAILY_CAP;

    let cap = member.dailyCapping && member.dailyCapping > 0 ? member.dailyCapping : 0;
    if (member.joiningPackageId) {
      const pkg = await Package.findOne({ packageId: member.joiningPackageId }).select('dailyCapping');
      if (pkg?.dailyCapping && pkg.dailyCapping > cap) cap = pkg.dailyCapping;
    }
    return cap > 0 ? cap : BINARY_SETTLEMENT.DEFAULT_DAILY_CAP;
  }
}
