import mongoose, { Document, Schema } from 'mongoose';

/**
 * One member's binary result for one IST business day. Written once by the daily settlement and
 * never edited afterwards (except to record that the wallet credit went through). The unique
 * (memberId, businessDate) index means a day can never be paid twice.
 */
export interface IBinaryLegSnapshot {
  left: number;
  right: number;
  reservedBV: number;
  reservedSide: 'LEFT' | 'RIGHT' | null;
  payoutCount: number;
}

export interface IBinaryDailyClosing extends Document {
  closingId: string;
  memberId: string;
  userId: string;
  memberName: string;
  businessDate: string; // YYYY-MM-DD (IST)

  opening: IBinaryLegSnapshot; // carry forward from the previous closing
  newLeftBV: number; // team BV that arrived on the left leg (net of reversals)
  newRightBV: number;
  closing: IBinaryLegSnapshot; // carry forward into the next day

  isSelfActive: boolean;
  isSponsorQualified: boolean;
  matches: number;
  leftBVUsed: number;
  rightBVUsed: number;
  cycles: any[]; // BinaryMatchCycle[] from the matching engine

  ratePerMatch: number;
  generatedAmount: number; // matches x rate
  dailyCap: number; // 0 = uncapped
  creditedAmount: number; // paid to the wallet
  flushedAmount: number; // above the cap, lost

  commissionLedgerId?: string;
  walletCredited: boolean;

  // Sponsor income: the direct sponsor's share of creditedAmount, paid by the company on top
  sponsorId?: string;
  sponsorBonusRate?: number; // e.g. 0.20
  sponsorBonusAmount: number; // 0 when no sponsor income was due
  sponsorCommissionLedgerId?: string;
  sponsorWalletCredited: boolean;

  status: 'PAID' | 'NO_MATCH' | 'NOT_QUALIFIED';
  createdAt: Date;
  updatedAt: Date;
}

const legSnapshotSchema = new Schema<IBinaryLegSnapshot>(
  {
    left: { type: Number, default: 0 },
    right: { type: Number, default: 0 },
    reservedBV: { type: Number, default: 0 },
    reservedSide: { type: String, enum: ['LEFT', 'RIGHT', null], default: null },
    payoutCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const binaryDailyClosingSchema = new Schema<IBinaryDailyClosing>(
  {
    closingId: { type: String, required: true, unique: true, trim: true },
    memberId: { type: String, required: true, uppercase: true, trim: true },
    userId: { type: String, required: true },
    memberName: { type: String, trim: true, default: '' },
    businessDate: { type: String, required: true, index: true },
    opening: { type: legSnapshotSchema, required: true },
    newLeftBV: { type: Number, default: 0 },
    newRightBV: { type: Number, default: 0 },
    closing: { type: legSnapshotSchema, required: true },
    isSelfActive: { type: Boolean, default: false },
    isSponsorQualified: { type: Boolean, default: false },
    matches: { type: Number, default: 0 },
    leftBVUsed: { type: Number, default: 0 },
    rightBVUsed: { type: Number, default: 0 },
    cycles: { type: Schema.Types.Mixed, default: [] },
    ratePerMatch: { type: Number, default: 0 },
    generatedAmount: { type: Number, default: 0 },
    dailyCap: { type: Number, default: 0 },
    creditedAmount: { type: Number, default: 0 },
    flushedAmount: { type: Number, default: 0 },
    commissionLedgerId: { type: String, trim: true },
    walletCredited: { type: Boolean, default: false },
    sponsorId: { type: String, uppercase: true, trim: true },
    sponsorBonusRate: { type: Number },
    sponsorBonusAmount: { type: Number, default: 0 },
    sponsorCommissionLedgerId: { type: String, trim: true },
    sponsorWalletCredited: { type: Boolean, default: false },
    status: { type: String, enum: ['PAID', 'NO_MATCH', 'NOT_QUALIFIED'], required: true },
  },
  { timestamps: true }
);

binaryDailyClosingSchema.index({ memberId: 1, businessDate: 1 }, { unique: true });
binaryDailyClosingSchema.index({ memberId: 1, businessDate: -1 });
binaryDailyClosingSchema.index({ businessDate: 1, creditedAmount: -1 });
binaryDailyClosingSchema.index({ sponsorId: 1, businessDate: -1 });

export const BinaryDailyClosing = mongoose.model<IBinaryDailyClosing>('BinaryDailyClosing', binaryDailyClosingSchema);
export default BinaryDailyClosing;
