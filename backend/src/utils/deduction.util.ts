import { ICompensationRule } from '../models/CompensationRule.model';

export interface DeductionResult {
  grossAmount: number;
  tdsRate: number;
  tdsDeduction: number;
  adminFeeRate: number;
  adminFee: number;
  totalDeductions: number;
  netPayable: number;
  netPercent: number;
}

export class DeductionUtil {
  /**
   * No TDS or admin fee is deducted from any income: the full gross amount is credited to the
   * wallet. Kept as the single place commissions get their deduction fields from, so every
   * ledger row still records an explicit 0.
   */
  static calculateDeductions(
    grossAmount: number,
    _rules?: Partial<ICompensationRule> | null,
    _overrideRates?: { tdsPercent?: number; adminFeePercent?: number }
  ): DeductionResult {
    const gross = Math.max(0, grossAmount || 0);
    return {
      grossAmount: gross,
      tdsRate: 0,
      tdsDeduction: 0,
      adminFeeRate: 0,
      adminFee: 0,
      totalDeductions: 0,
      netPayable: gross,
      netPercent: 100,
    };
  }
}
