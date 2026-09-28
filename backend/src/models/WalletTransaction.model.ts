import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletTransaction extends Document {
  transactionId: string;
  walletId: string;
  userId: string;
  memberId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  amountInPaise: number;
  balanceBefore: number;
  balanceBeforeInPaise: number;
  balanceAfter: number;
  balanceAfterInPaise: number;
  referenceType: 'COMMISSION' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'PURCHASE';
  referenceId: string; // e.g. CommissionLedger ledgerId
  description: string;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    walletId: {
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
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceBeforeInPaise: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    balanceAfterInPaise: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['COMMISSION', 'WITHDRAWAL', 'ADJUSTMENT', 'PURCHASE'],
      required: true,
      index: true,
    },
    referenceId: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable transactions
  }
);

walletTransactionSchema.index({ memberId: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
export default WalletTransaction;
