import mongoose from 'mongoose';

/**
 * DecimalSafe Arithmetic Utility
 * 
 * Provides deterministic, precision-safe financial and BV arithmetic without
 * floating-point inaccuracy (such as 0.1 + 0.2 !== 0.3).
 * 
 * Standard base:
 * - Currency stored in integer minor units (paise: ₹1 = 100 paise)
 * - Volume stored in integer BV units
 * - Rates stored as decimal scale or percentage (e.g. 20% = 0.20)
 */
export class DecimalUtil {
  // Convert standard rupee amount (e.g. 3000.50) to integer paise (300050)
  static toPaise(rupees: number | string | mongoose.Types.Decimal128): number {
    if (typeof rupees === 'object' && rupees !== null && 'toString' in rupees) {
      return Math.round(parseFloat(rupees.toString()) * 100);
    }
    const val = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
    return Math.round(val * 100);
  }

  // Convert paise (300050) back to rupees (3000.5)
  static fromPaise(paise: number): number {
    return Math.round(paise) / 100;
  }

  // Decimal safe addition
  static add(a: number, b: number): number {
    const aPaise = Math.round(a * 100);
    const bPaise = Math.round(b * 100);
    return (aPaise + bPaise) / 100;
  }

  // Decimal safe subtraction
  static sub(a: number, b: number): number {
    const aPaise = Math.round(a * 100);
    const bPaise = Math.round(b * 100);
    return (aPaise - bPaise) / 100;
  }

  // Decimal safe percentage multiplication: amount * (percentage / 100)
  // e.g. multiplyPercent(1000, 20) => 200
  static multiplyPercent(amount: number, percentage: number): number {
    const amountInPaise = Math.round(amount * 100);
    // Multiply by percentage and divide by 100, maintaining precision
    const resultPaise = Math.round((amountInPaise * percentage) / 100);
    return resultPaise / 100;
  }

  // Decimal safe rate multiplication: amount * rate (where rate is e.g. 0.20)
  static multiplyRate(amount: number, rate: number): number {
    const amountInPaise = Math.round(amount * 100);
    const resultPaise = Math.round(amountInPaise * rate);
    return resultPaise / 100;
  }

  // Safe division: (a / b)
  static divide(a: number, b: number): number {
    if (b === 0) return 0;
    return Math.round((a / b) * 100) / 100;
  }

  // Minimum of two numbers safely
  static min(a: number, b: number): number {
    return a <= b ? a : b;
  }

  // Convert number to Mongoose Decimal128
  static toDecimal128(val: number): mongoose.Types.Decimal128 {
    return mongoose.Types.Decimal128.fromString((Math.round(val * 100) / 100).toFixed(2));
  }

  // Read Mongoose Decimal128 safely as number
  static fromDecimal128(val: mongoose.Types.Decimal128 | number | undefined | null): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString());
  }
}
