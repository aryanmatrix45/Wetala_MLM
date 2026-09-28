import mongoose, { Document, Schema } from 'mongoose';
import {
  COMPENSATION_EVENT_TYPE,
  CompensationEventType,
  COMPENSATION_EVENT_STATUS,
  CompensationEventStatus,
} from '../config/constants';

export interface ICompensationEvent extends Document {
  eventId: string; // Unique idempotency key (e.g. EVENT-PURCHASE-123)
  eventType: CompensationEventType;
  sourceId: string; // purchaseId or refundId
  userId: string;
  memberId: string;
  status: CompensationEventStatus;
  payload: any;
  result?: any;
  error?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const compensationEventSchema = new Schema<ICompensationEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        COMPENSATION_EVENT_TYPE.PURCHASE_COMPLETED,
        COMPENSATION_EVENT_TYPE.REPURCHASE_COMPLETED,
        COMPENSATION_EVENT_TYPE.COMMISSION_REVERSED,
        COMPENSATION_EVENT_TYPE.MANUAL_ADJUSTMENT,
      ],
      required: true,
      index: true,
    },
    sourceId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    memberId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        COMPENSATION_EVENT_STATUS.PENDING,
        COMPENSATION_EVENT_STATUS.PROCESSED,
        COMPENSATION_EVENT_STATUS.FAILED,
        COMPENSATION_EVENT_STATUS.REVERSED,
      ],
      default: COMPENSATION_EVENT_STATUS.PENDING,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    result: {
      type: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const CompensationEvent = mongoose.model<ICompensationEvent>('CompensationEvent', compensationEventSchema);
export default CompensationEvent;
