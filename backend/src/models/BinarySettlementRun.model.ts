import mongoose, { Document, Schema } from 'mongoose';

/**
 * One daily binary settlement per IST business date. The unique businessDate doubles as a lock:
 * across PM2 cluster workers only one process can hold a date in RUNNING state.
 */
export interface IBinarySettlementTotals {
  membersEvaluated: number;
  closings: number;
  qualifiedMembers: number;
  earners: number;
  matches: number;
  newLeftBV: number;
  newRightBV: number;
  generatedAmount: number;
  creditedAmount: number;
  flushedAmount: number;
}

export interface IBinarySettlementRun extends Document {
  businessDate: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  triggeredBy: string;
  attempts: number;
  startedAt: Date;
  heartbeatAt: Date;
  completedAt?: Date;
  totals: IBinarySettlementTotals;
  failures: Array<{ memberId: string; message: string }>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const binarySettlementRunSchema = new Schema<IBinarySettlementRun>(
  {
    businessDate: { type: String, required: true, unique: true },
    status: { type: String, enum: ['RUNNING', 'COMPLETED', 'FAILED'], required: true },
    triggeredBy: { type: String, default: 'SYSTEM' },
    attempts: { type: Number, default: 0 },
    startedAt: { type: Date },
    heartbeatAt: { type: Date },
    completedAt: { type: Date },
    totals: {
      membersEvaluated: { type: Number, default: 0 },
      closings: { type: Number, default: 0 },
      qualifiedMembers: { type: Number, default: 0 },
      earners: { type: Number, default: 0 },
      matches: { type: Number, default: 0 },
      newLeftBV: { type: Number, default: 0 },
      newRightBV: { type: Number, default: 0 },
      generatedAmount: { type: Number, default: 0 },
      creditedAmount: { type: Number, default: 0 },
      flushedAmount: { type: Number, default: 0 },
    },
    failures: { type: [{ memberId: String, message: String, _id: false }], default: [] },
    error: { type: String },
  },
  { timestamps: true }
);

export const BinarySettlementRun = mongoose.model<IBinarySettlementRun>('BinarySettlementRun', binarySettlementRunSchema);
export default BinarySettlementRun;
