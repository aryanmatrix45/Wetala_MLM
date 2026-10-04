import mongoose, { Document, Schema } from 'mongoose';

export interface IWelcomeBonusSettlement extends Document {
  settlementId: string;
  periodStart: Date;
  periodEnd: Date;
  companyGrossBusinessVolume: number;
  welcomeBonusRate: number;
  totalWelcomeBonusPool: number;
  eligibleMemberCount: number;
  equalMemberShare: number;
  totalAmountDistributed: number;
  totalAmountUndistributed: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  processedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const welcomeBonusSettlementSchema = new Schema<IWelcomeBonusSettlement>(
  {
    settlementId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    companyGrossBusinessVolume: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    welcomeBonusRate: {
      type: Number,
      required: true,
      default: 4,
      min: 0,
    },
    totalWelcomeBonusPool: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    eligibleMemberCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    equalMemberShare: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalAmountDistributed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalAmountUndistributed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED',
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const WelcomeBonusSettlement = mongoose.model<IWelcomeBonusSettlement>(
  'WelcomeBonusSettlement',
  welcomeBonusSettlementSchema
);
export default WelcomeBonusSettlement;
