import { CommissionLedger, ICommissionLedger } from '../../models/CommissionLedger.model';
import { ICompensationRule } from '../../models/CompensationRule.model';

export class RoyaltyService {
  /**
   * Process Company Royalty Pool.
   * Disabled by default until the business confirms the exact pool qualification rules.
   */
  static async processRoyaltyPool(
    _totalCompanyTurnover: number,
    rules: ICompensationRule,
    _sourceEventId: string
  ): Promise<ICommissionLedger[]> {
    const config = rules.royalty;
    if (!config.isEnabled || config.poolPercent <= 0) {
      return [];
    }

    // TODO: Confirm exact royalty formula, ranking qualification, and distribution cycle with business owner.
    return [];
  }
}
