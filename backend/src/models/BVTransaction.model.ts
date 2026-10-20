import mongoose, { Document, Schema } from 'mongoose';
import { BV_OWNER_TYPE, BVOwnerType, BV_TXN_TYPE, BVTxnType, BV_TXN_STATUS, BVTxnStatus } from '../config/constants';

/**
 * One row per BV Wallet business event: a generation, an instant transfer, an admin reversal of a
 * transfer, a welcome bonus credit, or an order paid with BV (and its refund). Drives transaction
 * history. Balance movements are recorded in BVWalletLedger.
 */
export interface IBVTransaction extends Document {
  transactionId: string;
  type: BVTxnType;
  status: BVTxnStatus;
  senderType: BVOwnerType;
  senderId: string;
  senderName: string;
  recipientType?: BVOwnerType;
  recipientId: string;
  recipientName: string;
  amount: number;
  title: string;
  note: string;
  requestKey?: string;
  purchaseId?: string; // PURCHASE / PURCHASE_REFUND
  settlementId?: string; // WELCOME_BONUS
  // Reversal links: a REVERSAL row points at the transfer it undid; that transfer points back
  reversalOf?: string;
  reversedBy?: string;
  reversedAt?: Date;
  reversalReason?: string;
  initiatedBy: {
    role: string;
    email: string;
    operatorName?: string;
    ip?: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const bvTransactionSchema = new Schema<IBVTransaction>(
  {
    transactionId: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: Object.values(BV_TXN_TYPE), required: true },
    status: { type: String, enum: Object.values(BV_TXN_STATUS), required: true },
    senderType: { type: String, enum: Object.values(BV_OWNER_TYPE), required: true },
    senderId: { type: String, required: true, uppercase: true, trim: true },
    senderName: { type: String, trim: true, default: '' },
    recipientType: { type: String, enum: Object.values(BV_OWNER_TYPE) },
    recipientId: { type: String, uppercase: true, trim: true, default: '' },
    recipientName: { type: String, trim: true, default: '' },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => Number.isInteger(v) && v >= 1,
        message: 'BV amount must be a whole number of at least 1',
      },
    },
    title: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: '' },
    requestKey: { type: String, trim: true },
    purchaseId: { type: String, trim: true },
    settlementId: { type: String, trim: true },
    reversalOf: { type: String, trim: true },
    reversedBy: { type: String, trim: true },
    reversedAt: { type: Date },
    reversalReason: { type: String, trim: true },
    initiatedBy: {
      role: { type: String, default: '' },
      email: { type: String, default: '' },
      operatorName: { type: String, trim: true, default: '' },
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

bvTransactionSchema.index({ senderId: 1, createdAt: -1 });
bvTransactionSchema.index({ recipientId: 1, createdAt: -1 });
bvTransactionSchema.index({ type: 1, createdAt: -1 });
// Repeat-send check: same sender, recipient and amount within a short window
bvTransactionSchema.index({ senderId: 1, recipientId: 1, amount: 1, createdAt: -1 });
// A retried "send" with the same key returns the original transfer instead of sending again
bvTransactionSchema.index(
  { senderId: 1, requestKey: 1 },
  { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } }
);
// An order is paid with BV at most once and refunded at most once
bvTransactionSchema.index(
  { type: 1, purchaseId: 1 },
  { unique: true, partialFilterExpression: { purchaseId: { $type: 'string' } } }
);
// A member receives at most one welcome bonus credit per settlement
bvTransactionSchema.index(
  { type: 1, settlementId: 1, recipientId: 1 },
  { unique: true, partialFilterExpression: { settlementId: { $type: 'string' } } }
);
// A transfer can be reversed at most once
bvTransactionSchema.index(
  { reversalOf: 1 },
  { unique: true, partialFilterExpression: { reversalOf: { $type: 'string' } } }
);

export const BVTransaction = mongoose.model<IBVTransaction>('BVTransaction', bvTransactionSchema);
export default BVTransaction;
