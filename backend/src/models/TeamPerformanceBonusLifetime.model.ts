import mongoose, { Document, Schema } from 'mongoose';

/** Lifetime paid per member per slab, in paise, so the cap is an exact integer comparison */
export interface ITeamPerformanceBonusLifetime extends Document {
  memberId: string;
  slabId: string;
  paidPaise: number;
  createdAt: Date;
  updatedAt: Date;
}

const lifetimeSchema = new Schema<ITeamPerformanceBonusLifetime>(
  {
    memberId: { type: String, required: true, uppercase: true, trim: true },
    slabId: { type: String, required: true, trim: true },
    paidPaise: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

lifetimeSchema.index({ memberId: 1, slabId: 1 }, { unique: true });

export const TeamPerformanceBonusLifetime = mongoose.model<ITeamPerformanceBonusLifetime>(
  'TeamPerformanceBonusLifetime',
  lifetimeSchema
);
export default TeamPerformanceBonusLifetime;
