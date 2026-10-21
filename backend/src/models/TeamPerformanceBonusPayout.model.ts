import mongoose, { Document, Schema } from 'mongoose';

/**
 * One member's payout for one slab in one period. idempotencyKey is unique, so a retried or
 * concurrent settlement can never write the same payout twice.
 */
export interface ITeamPerformanceBonusPayout extends Document {
  payoutId: string;
  idempotencyKey: string; // TPB:<periodId>:<slabId>:<memberId>
  periodId: string;
  slabId: string;
  memberId: string;
  pool: number;
  eligibleCount: number;
  equalShare: number;
  lifetimeBefore: number; // INR paid for this slab before this payout
  lifetimeLimit: number;
  plannedPayout: number;
  actualPayout: number; // after the lifetime cap at the time of paying
  ledgerId?: string; // CommissionLedger / WalletTransaction reference
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<ITeamPerformanceBonusPayout>(
  {
    payoutId: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true, unique: true },
    periodId: { type: String, required: true, index: true },
    slabId: { type: String, required: true },
    memberId: { type: String, required: true, uppercase: true, trim: true, index: true },
    pool: { type: Number, required: true, default: 0 },
    eligibleCount: { type: Number, required: true, default: 0 },
    equalShare: { type: Number, required: true, default: 0 },
    lifetimeBefore: { type: Number, required: true, default: 0 },
    lifetimeLimit: { type: Number, required: true, default: 0 },
    plannedPayout: { type: Number, required: true, default: 0 },
    actualPayout: { type: Number, required: true, default: 0 },
    ledgerId: { type: String },
  },
  { timestamps: true }
);

export const TeamPerformanceBonusPayout = mongoose.model<ITeamPerformanceBonusPayout>(
  'TeamPerformanceBonusPayout',
  payoutSchema
);
export default TeamPerformanceBonusPayout;
