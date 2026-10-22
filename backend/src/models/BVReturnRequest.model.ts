import mongoose, { Document, Schema } from 'mongoose';
import { BV_RETURN_STATUS, BVReturnStatus } from '../config/constants';

/**
 * A member's request to return BV it bought from the Super Admin. The BV is held from the member's
 * wallet when the request is made. Approval hands it to the Super Admin wallet and deducts its value
 * from Super Admin earnings (the refund itself is paid outside the app); rejection or cancellation
 * gives it back.
 */
export interface IBVReturnRequest extends Document {
  requestId: string;
  memberId: string;
  memberName: string;
  amount: number; // BV
  valuePaise: number; // refund value: BV x the member's average purchase price
  status: BVReturnStatus;
  note: string;
  requestKey?: string;
  holdTransactionId: string;
  settleTransactionId?: string; // RETURN_APPROVED or RETURN_RELEASED
  decisionReason?: string;
  decidedBy?: { role: string; email: string; operatorName?: string };
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bvReturnRequestSchema = new Schema<IBVReturnRequest>(
  {
    requestId: { type: String, required: true, unique: true, trim: true },
    memberId: { type: String, required: true, uppercase: true, trim: true },
    memberName: { type: String, trim: true, default: '' },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => Number.isInteger(v) && v >= 1,
        message: 'BV amount must be a whole number of at least 1',
      },
    },
    valuePaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(BV_RETURN_STATUS), required: true, default: BV_RETURN_STATUS.PENDING },
    note: { type: String, trim: true, default: '' },
    requestKey: { type: String, trim: true },
    holdTransactionId: { type: String, required: true, trim: true },
    settleTransactionId: { type: String, trim: true },
    decisionReason: { type: String, trim: true },
    decidedBy: {
      role: { type: String },
      email: { type: String },
      operatorName: { type: String, trim: true },
    },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

bvReturnRequestSchema.index({ status: 1, createdAt: -1 });
bvReturnRequestSchema.index({ memberId: 1, createdAt: -1 });
// A retried submit with the same key returns the original request
bvReturnRequestSchema.index(
  { memberId: 1, requestKey: 1 },
  { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } }
);

export const BVReturnRequest = mongoose.model<IBVReturnRequest>('BVReturnRequest', bvReturnRequestSchema);
export default BVReturnRequest;
