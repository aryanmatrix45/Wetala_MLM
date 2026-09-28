import mongoose, { Document, Schema } from 'mongoose';

export interface IAward extends Document {
  awardId: string;
  name: string;
  description: string;
  qualificationCriteria: string;
  rankRequired?: string;
  targetCount?: number;
  rewardType: 'TROPHY' | 'CERTIFICATE' | 'BADGE' | 'TRIP' | 'PHYSICAL_GIFT';
  rewardDescription: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const awardSchema = new Schema<IAward>(
  {
    awardId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    qualificationCriteria: {
      type: String,
      required: true,
    },
    rankRequired: {
      type: String,
      trim: true,
    },
    targetCount: {
      type: Number,
    },
    rewardType: {
      type: String,
      enum: ['TROPHY', 'CERTIFICATE', 'BADGE', 'TRIP', 'PHYSICAL_GIFT'],
      default: 'TROPHY',
    },
    rewardDescription: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Award = mongoose.model<IAward>('Award', awardSchema);
export default Award;
