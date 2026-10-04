import mongoose, { Document, Schema } from 'mongoose';

export interface IWelcomeBonusTransaction extends Document {
  transactionId: string;
  memberId: string;
  settlementId: string;
  companyGrossBusinessVolume: number;
  bonusRate: number;
  totalBonusPool: number;
  eligibleMemberCount: number;
  equalMemberShare: number;
  previousWelcomeBonusEarned: number;
  welcomeBonusCap: number;
  remainingCap: number;
  actualPayout: number;
  createdAt: Date;
  updatedAt: Date;
}

const welcomeBonusTransactionSchema = new Schema<IWelcomeBonusTransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    memberId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    settlementId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    companyGrossBusinessVolume: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusRate: {
      type: Number,
      required: true,
      min: 0,
    },
    totalBonusPool: {
      type: Number,
      required: true,
      min: 0,
    },
    eligibleMemberCount: {
      type: Number,
      required: true,
      min: 0,
    },
    equalMemberShare: {
      type: Number,
      required: true,
      min: 0,
    },
    previousWelcomeBonusEarned: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    welcomeBonusCap: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingCap: {
      type: Number,
      required: true,
      min: 0,
    },
    actualPayout: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee idempotency: Never pay the same member twice for the same settlement
welcomeBonusTransactionSchema.index({ memberId: 1, settlementId: 1 }, { unique: true });

export const WelcomeBonusTransaction = mongoose.model<IWelcomeBonusTransaction>(
  'WelcomeBonusTransaction',
  welcomeBonusTransactionSchema
);
export default WelcomeBonusTransaction;
