import mongoose, { Document, Schema } from 'mongoose';

export interface IBinaryVolume extends Document {
  memberId: string;
  userId: string;
  
  // Cumulative Lifetime Volumes
  leftTotalBV: number;
  rightTotalBV: number;
  matchedTotalBV: number;
  
  // Carry forward after the last daily closing: unmatched BV available for the next day's matching.
  // New team BV waits as PENDING BVLedger rows until the daily settlement takes it in.
  leftAvailableBV: number;
  rightAvailableBV: number;

  // Same values as leftAvailableBV / rightAvailableBV (kept for older readers)
  leftCarryForwardBV: number;
  rightCarryForwardBV: number;

  // Sequential Payout Lifecycle Tracking
  payoutCount: number; // 0: no payout yet, 1: first payout done, 2: second payout done, >=2: regular 1250:1250
  reservedSide?: 'LEFT' | 'RIGHT' | null;
  reservedBV: number; // 2500 BV reserved from First Payout for Second Payout
  firstPayoutAt?: Date;
  secondPayoutAt?: Date;
  consumedTotalBV: number;

  lastMatchedAt?: Date;
  lastSettledDate?: string; // IST business date of the last daily closing
  updatedAt: Date;
}

const binaryVolumeSchema = new Schema<IBinaryVolume>(
  {
    memberId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    leftTotalBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    rightTotalBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchedTotalBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    leftAvailableBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    rightAvailableBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    leftCarryForwardBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    rightCarryForwardBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    payoutCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedSide: {
      type: String,
      enum: ['LEFT', 'RIGHT', null],
      default: null,
    },
    reservedBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstPayoutAt: {
      type: Date,
    },
    secondPayoutAt: {
      type: Date,
    },
    consumedTotalBV: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMatchedAt: {
      type: Date,
    },
    lastSettledDate: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const BinaryVolume = mongoose.model<IBinaryVolume>('BinaryVolume', binaryVolumeSchema);
export default BinaryVolume;
