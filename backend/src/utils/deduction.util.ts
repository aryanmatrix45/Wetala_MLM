import { DecimalUtil } from './decimal';
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
   * Calculate TDS and Admin Fee deductions dynamically based on Admin configuration.
   * Both TDS and Admin fee can be set to any percentage, including 0%.
   * 
   * If deductions are disabled or both set to 0%, netPayable = grossAmount (100% credited).
   */
  static calculateDeductions(
    grossAmount: number,
    rules?: Partial<ICompensationRule> | null,
    overrideRates?: { tdsPercent?: number; adminFeePercent?: number }
  ): DeductionResult {
    if (grossAmount <= 0) {
      return {
        grossAmount: 0,
        tdsRate: 0,
        tdsDeduction: 0,
        adminFeeRate: 0,
        adminFee: 0,
        totalDeductions: 0,
        netPayable: 0,
        netPercent: 100,
      };
    }

    const deductionsConfig = rules?.payoutDeductions;
    const isEnabled = deductionsConfig?.isEnabled ?? true;

    // Check override rates first, then rules config, default to 5% if completely undefined
    let tdsRate = 5;
    if (overrideRates?.tdsPercent !== undefined) {
      tdsRate = Math.max(0, Number(overrideRates.tdsPercent));
    } else if (deductionsConfig?.tdsPercent !== undefined) {
      tdsRate = Math.max(0, Number(deductionsConfig.tdsPercent));
    }

    let adminFeeRate = 5;
    if (overrideRates?.adminFeePercent !== undefined) {
      adminFeeRate = Math.max(0, Number(overrideRates.adminFeePercent));
    } else if (deductionsConfig?.adminFeePercent !== undefined) {
      adminFeeRate = Math.max(0, Number(deductionsConfig.adminFeePercent));
    }

    // If deductions disabled globally by admin, force rates to 0
    if (!isEnabled) {
      tdsRate = 0;
      adminFeeRate = 0;
    }

    const tdsDeduction = DecimalUtil.multiplyPercent(grossAmount, tdsRate);
    const adminFee = DecimalUtil.multiplyPercent(grossAmount, adminFeeRate);
    const totalDeductions = DecimalUtil.add(tdsDeduction, adminFee);
    const netPayable = DecimalUtil.sub(grossAmount, totalDeductions);
    const netPercent = Math.max(0, 100 - (tdsRate + adminFeeRate));

    return {
      grossAmount,
      tdsRate,
      tdsDeduction,
      adminFeeRate,
      adminFee,
      totalDeductions,
      netPayable: Math.max(0, netPayable),
      netPercent,
    };
  }
}
