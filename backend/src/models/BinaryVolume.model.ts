import mongoose, { Document, Schema } from 'mongoose';

export interface IBinaryVolume extends Document {
  memberId: string;
  userId: string;
  
  // Cumulative Lifetime Volumes
  leftTotalBV: number;
  rightTotalBV: number;
  matchedTotalBV: number;
  
  // Current Active / Unmatched Available Volumes for Binary Matching
  leftAvailableBV: number;
  rightAvailableBV: number;
  
  // Last cycle carried forward
  leftCarryForwardBV: number;
  rightCarryForwardBV: number;
  
  // Consumed downline member IDs in binary cycles (never reused)
  consumedBinaryMemberIds: string[];

  lastMatchedAt?: Date;
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
    consumedBinaryMemberIds: {
      type: [String],
      default: [],
    },
    lastMatchedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const BinaryVolume = mongoose.model<IBinaryVolume>('BinaryVolume', binaryVolumeSchema);
export default BinaryVolume;
