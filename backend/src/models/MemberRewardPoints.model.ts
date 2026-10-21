import mongoose, { Document, Schema } from 'mongoose';

/**
 * Per-member RP for the Team Performance Bonus, derived from BinaryVolume lifetime leg totals.
 * Binary matching does not reduce these totals, so binary-consumed BV still counts toward RP.
 */
export interface IMemberRewardPoints extends Document {
  memberId: string;
  leftBV: number;
  rightBV: number;
  leftRP: number; // floor(leftBV / rpBvUnit)
  rightRP: number;
  // RP that the highest qualified slab already uses on each side. Recorded for reporting only:
  // slabs are cumulative, so nothing is deducted from the balances above.
  leftConsumedRP: number;
  rightConsumedRP: number;
  rpBvUnit: number;
  updatedAt: Date;
  createdAt: Date;
}

const memberRewardPointsSchema = new Schema<IMemberRewardPoints>(
  {
    memberId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    leftBV: { type: Number, default: 0, min: 0 },
    rightBV: { type: Number, default: 0, min: 0 },
    leftRP: { type: Number, default: 0, min: 0 },
    rightRP: { type: Number, default: 0, min: 0 },
    leftConsumedRP: { type: Number, default: 0, min: 0 },
    rightConsumedRP: { type: Number, default: 0, min: 0 },
    rpBvUnit: { type: Number, default: 1250, min: 1 },
  },
  { timestamps: true }
);

export const MemberRewardPoints = mongoose.model<IMemberRewardPoints>('MemberRewardPoints', memberRewardPointsSchema);
export default MemberRewardPoints;
