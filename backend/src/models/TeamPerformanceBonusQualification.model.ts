import mongoose, { Document, Schema } from 'mongoose';

/**
 * A member reaching a slab for the first time. Written once per (member, slab) and never again,
 * so a slab can only ever be paid once. settlementPeriodId is set when a period pays it out.
 */
export interface ITeamPerformanceBonusQualification extends Document {
  qualificationId: string;
  memberId: string;
  slabId: string;
  leftRp: number; // the slab's thresholds at the time of qualifying
  rightRp: number;
  leftRP: number; // the member's RP at the time of qualifying
  rightRP: number;
  qualifiedAt: Date;
  settlementPeriodId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const qualificationSchema = new Schema<ITeamPerformanceBonusQualification>(
  {
    qualificationId: { type: String, required: true, unique: true },
    memberId: { type: String, required: true, uppercase: true, trim: true },
    slabId: { type: String, required: true, trim: true },
    leftRp: { type: Number, required: true },
    rightRp: { type: Number, required: true },
    leftRP: { type: Number, required: true },
    rightRP: { type: Number, required: true },
    qualifiedAt: { type: Date, required: true },
    settlementPeriodId: { type: String, default: null },
  },
  { timestamps: true }
);

qualificationSchema.index({ memberId: 1, slabId: 1 }, { unique: true });
qualificationSchema.index({ slabId: 1, settlementPeriodId: 1 });

export const TeamPerformanceBonusQualification = mongoose.model<ITeamPerformanceBonusQualification>(
  'TeamPerformanceBonusQualification',
  qualificationSchema
);
export default TeamPerformanceBonusQualification;
