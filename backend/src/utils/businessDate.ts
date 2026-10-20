import { BINARY_SETTLEMENT } from '../config/constants';

/**
 * Business days for binary income run on India Standard Time, whatever the server's own timezone.
 * A business date is a 'YYYY-MM-DD' string; IST has no daylight saving, so a fixed offset is exact.
 */
const OFFSET_MS = BINARY_SETTLEMENT.TIMEZONE_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class BusinessDate {
  /** The IST business date that the given instant falls on */
  static of(instant: Date = new Date()): string {
    return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
  }

  static today(): string {
    return this.of(new Date());
  }

  static isValid(value: unknown): value is string {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  }

  static addDays(date: string, days: number): string {
    return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
  }

  /** First instant of the business date (IST midnight) as a UTC Date */
  static startOf(date: string): Date {
    return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - OFFSET_MS);
  }

  /** Last millisecond of the business date */
  static endOf(date: string): Date {
    return new Date(this.startOf(date).getTime() + DAY_MS - 1);
  }

  /** Milliseconds from now until the next IST midnight */
  static msUntilNextDay(now: Date = new Date()): number {
    return this.startOf(this.addDays(this.of(now), 1)).getTime() - now.getTime();
  }
}

export default BusinessDate;
