import mongoose, { Document, Schema } from 'mongoose';

/** One eligible member's payout, fixed when the settlement starts so a retried run pays the same */
export interface IWelcomeBonusPlannedPayout {
  memberId: string;
  name: string;
  lifetimeBv: number;
  sponsoredCount: number;
  welcomeBonusCap: number;
  welcomeBonusEarned: number; // before this settlement
  plannedPayout: number;
}

export interface IWelcomeBonusSettlement extends Document {
  settlementId: string;
  weekStart?: string; // IST Monday 'YYYY-MM-DD'; missing on settlements made before weeks were keyed
  periodStart: Date;
  periodEnd: Date;
  companyGrossBusinessVolume: number;
  welcomeBonusRate: number;
  totalWelcomeBonusPool: number;
  eligibleMemberCount: number;
  equalMemberShare: number;
  totalAmountDistributed: number;
  totalAmountUndistributed: number;
  // Rules the settlement was run with
  maxMultiplier?: number;
  minLifetimeBv?: number;
  minSponsoredCount?: number;
  payouts: IWelcomeBonusPlannedPayout[];
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
    weekStart: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
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
    maxMultiplier: { type: Number, min: 0 },
    minLifetimeBv: { type: Number, min: 0 },
    minSponsoredCount: { type: Number, min: 0 },
    payouts: [
      {
        _id: false,
        memberId: { type: String, required: true },
        name: { type: String, default: '' },
        lifetimeBv: { type: Number, default: 0 },
        sponsoredCount: { type: Number, default: 0 },
        welcomeBonusCap: { type: Number, default: 0 },
        welcomeBonusEarned: { type: Number, default: 0 },
        plannedPayout: { type: Number, default: 0 },
      },
    ],
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
