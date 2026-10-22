import mongoose, { Document, Schema } from 'mongoose';
import { COMPANY_EARNING_TYPE, CompanyEarningType } from '../config/constants';

/**
 * Super Admin earnings: one row per event that brings rupees in or gives them back. Append-only;
 * a correction (reversal, refund, return) is a new row with a negative amount. The Super Admin's
 * earnings are the sum of all rows.
 *
 *   BV_SALE           + BV x rate            Super Admin sent BV to a member
 *   BV_SALE_REVERSED  - the sale amount      that transfer was reversed
 *   BV_RETURNED       - BV x average price   a member's return to the company was approved
 *   ORDER_PAID        + order total          bank / UPI package or product order marked as paid
 *   ORDER_REFUNDED    - order total          that order was refunded
 *
 * Orders paid from the BV Wallet add nothing: that BV was counted when the Super Admin sold it.
 */
export interface ICompanyEarning extends Document {
  entryId: string;
  type: CompanyEarningType;
  sourceId: string; // BV transaction ID, purchase ID or return request ID
  memberId: string;
  memberName: string;
  bv: number;
  ratePaise?: number; // BV entries: rupees per BV used, in paise
  amountPaise: number; // signed
  amount: number; // signed rupees, amountPaise / 100
  paymentMode?: string; // order entries
  note: string;
  relatedEntryId?: string; // a reversal or refund points at the entry it undoes
  performedBy: { email: string; operatorName: string };
  createdAt: Date;
}

const companyEarningSchema = new Schema<ICompanyEarning>(
  {
    entryId: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: Object.values(COMPANY_EARNING_TYPE), required: true },
    sourceId: { type: String, required: true, trim: true },
    memberId: { type: String, uppercase: true, trim: true, default: '' },
    memberName: { type: String, trim: true, default: '' },
    bv: { type: Number, default: 0 },
    ratePaise: { type: Number },
    amountPaise: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: 'Amount must be a whole number of paise' },
    },
    amount: { type: Number, required: true },
    paymentMode: { type: String, trim: true },
    note: { type: String, trim: true, default: '' },
    relatedEntryId: { type: String, trim: true },
    performedBy: {
      email: { type: String, default: '' },
      operatorName: { type: String, trim: true, default: '' },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Entries are never edited
);

// Each event is counted once: one sale per transfer, one payment and one refund per order
companyEarningSchema.index({ type: 1, sourceId: 1 }, { unique: true });
companyEarningSchema.index({ createdAt: -1 });
companyEarningSchema.index({ memberId: 1, createdAt: -1 });

export const CompanyEarning = mongoose.model<ICompanyEarning>('CompanyEarning', companyEarningSchema);
export default CompanyEarning;
