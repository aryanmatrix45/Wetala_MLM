import mongoose, { Document, Schema, Model } from 'mongoose';

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface IStatusAudit {
  status: WithdrawalStatus;
  changedAt: Date;
  changedBy: string; // adminId, memberId, or 'SYSTEM'
  note?: string;
}

export interface IWithdrawalRequest extends Document {
  requestId: string;
  memberId: string;
  memberName?: string;
  requestedAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  status: WithdrawalStatus;
  note?: string;
  adminNote?: string;
  paymentReference?: string;
  requestedAt: Date;
  approvedAt?: Date;
  paidAt?: Date;
  rejectedAt?: Date;
  processedBy?: string;
  statusHistory: IStatusAudit[];
  createdAt: Date;
  updatedAt: Date;
}

const statusAuditSchema = new Schema<IStatusAudit>(
  {
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'],
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      required: true,
      default: 'SYSTEM',
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const withdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    memberId: {
      type: String,
      required: [true, 'Member ID is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    memberName: {
      type: String,
      trim: true,
      default: '',
    },
    requestedAmount: {
      type: Number,
      required: [true, 'Requested amount is required'],
      min: [1, 'Requested amount must be at least ₹1'],
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PAID', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    processedBy: {
      type: String,
      trim: true,
      default: '',
    },
    statusHistory: {
      type: [statusAuditSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

withdrawalRequestSchema.index({ memberId: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

export const WithdrawalRequest: Model<IWithdrawalRequest> =
  mongoose.models.WithdrawalRequest ||
  mongoose.model<IWithdrawalRequest>('WithdrawalRequest', withdrawalRequestSchema);

export default WithdrawalRequest;
