import mongoose, { Document, Schema } from 'mongoose';

/** One Left:Right RP milestone. Thresholds are cumulative RP, not BV. */
export interface ITeamPerformanceBonusSlab {
  slabId: string;
  leftRp: number;
  rightRp: number;
  percent: number; // share of the period's company turnover (CTO) for this slab's pool, e.g. 3 = 3%
  lifetimeLimit: number; // INR the member can ever earn from this slab
  isActive: boolean;
}

export interface ITeamPerformanceBonusConfig extends Document {
  configId: string;
  rpBvUnit: number; // BV per reward point, default 1250
  slabs: ITeamPerformanceBonusSlab[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const slabSchema = new Schema<ITeamPerformanceBonusSlab>(
  {
    slabId: { type: String, required: true, trim: true },
    leftRp: { type: Number, required: true, min: 1 },
    rightRp: { type: Number, required: true, min: 1 },
    percent: { type: Number, required: true, min: 0, max: 100 },
    lifetimeLimit: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const teamPerformanceBonusConfigSchema = new Schema<ITeamPerformanceBonusConfig>(
  {
    configId: { type: String, required: true, unique: true, default: 'DEFAULT' },
    rpBvUnit: { type: Number, required: true, min: 1, default: 1250 },
    slabs: { type: [slabSchema], default: [] },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

export const TeamPerformanceBonusConfig = mongoose.model<ITeamPerformanceBonusConfig>(
  'TeamPerformanceBonusConfig',
  teamPerformanceBonusConfigSchema
);
export default TeamPerformanceBonusConfig;
