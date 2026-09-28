import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  walletId: string;
  userId: string;
  memberId: string;
  
  availableBalance: number;
  availableBalanceInPaise: number;
  
  pendingBalance: number;
  pendingBalanceInPaise: number;
  
  withdrawnAmount: number;
  withdrawnAmountInPaise: number;
  
  totalEarned: number;
  totalEarnedInPaise: number;
  
  totalPaid: number;
  totalPaidInPaise: number;
  
  totalAdjusted: number;
  totalAdjustedInPaise: number;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    walletId: {
      type: String,
      required: true,
      unique: true,
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
      unique: true,
      index: true,
    },
    availableBalance: {
      type: Number,
      default: 0,
    },
    availableBalanceInPaise: {
      type: Number,
      default: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
    },
    pendingBalanceInPaise: {
      type: Number,
      default: 0,
    },
    withdrawnAmount: {
      type: Number,
      default: 0,
    },
    withdrawnAmountInPaise: {
      type: Number,
      default: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalEarnedInPaise: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    totalPaidInPaise: {
      type: Number,
      default: 0,
    },
    totalAdjusted: {
      type: Number,
      default: 0,
    },
    totalAdjustedInPaise: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
export default Wallet;
