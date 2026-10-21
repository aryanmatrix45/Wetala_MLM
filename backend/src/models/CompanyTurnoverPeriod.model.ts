import mongoose, { Document, Schema } from 'mongoose';

/** One slab's pool and split within a settled period. Frozen when the period is first planned. */
export interface ITeamPerformanceBonusSlabResult {
  slabId: string;
  percent: number;
  lifetimeLimit: number; // INR, as configured when the period was planned
  pool: number; // INR
  eligibleCount: number;
  equalShare: number; // INR per eligible member, before lifetime caps
  distributed: number; // INR actually credited
  undistributed: number; // INR kept by the company (lifetime caps and rounding)
  qualificationIds: string[]; // the qualifications this slab's split covers
  payouts: { qualificationId: string; memberId: string; plannedPayout: number }[]; // INR, before cap check at pay time
}

export interface ICompanyTurnoverPeriod extends Document {
  periodId: string; // TPB-PERIOD-<start>-<end>, unique: one settlement per period
  periodStart: string; // IST 'YYYY-MM-DD'
  periodEnd: string;
  turnoverRevenue: number; // INR of paid orders in the period (GrossVolumeService)
  turnoverSource: 'AUTO' | 'OVERRIDE';
  totalPool: number;
  totalDistributed: number;
  totalUndistributed: number;
  slabResults: ITeamPerformanceBonusSlabResult[];
  status: 'PENDING' | 'COMPLETED';
  processedBy?: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const slabResultSchema = new Schema<ITeamPerformanceBonusSlabResult>(
  {
    slabId: { type: String, required: true },
    percent: { type: Number, required: true },
    lifetimeLimit: { type: Number, required: true, default: 0 },
    pool: { type: Number, required: true, default: 0 },
    eligibleCount: { type: Number, required: true, default: 0 },
    equalShare: { type: Number, required: true, default: 0 },
    distributed: { type: Number, required: true, default: 0 },
    undistributed: { type: Number, required: true, default: 0 },
    qualificationIds: { type: [String], default: [] },
    payouts: {
      type: [
        {
          qualificationId: { type: String, required: true },
          memberId: { type: String, required: true },
          plannedPayout: { type: Number, required: true, default: 0 },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const companyTurnoverPeriodSchema = new Schema<ICompanyTurnoverPeriod>(
  {
    periodId: { type: String, required: true, unique: true },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    turnoverRevenue: { type: Number, required: true, default: 0 },
    turnoverSource: { type: String, enum: ['AUTO', 'OVERRIDE'], required: true },
    totalPool: { type: Number, default: 0 },
    totalDistributed: { type: Number, default: 0 },
    totalUndistributed: { type: Number, default: 0 },
    slabResults: { type: [slabResultSchema], default: [] },
    status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
    processedBy: { type: String, trim: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const CompanyTurnoverPeriod = mongoose.model<ICompanyTurnoverPeriod>(
  'CompanyTurnoverPeriod',
  companyTurnoverPeriodSchema
);
export default CompanyTurnoverPeriod;
