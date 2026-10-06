import mongoose, { Document, Schema } from 'mongoose';
import { COMMISSION_TYPE, CommissionType } from '../config/constants';

export interface ICommissionCalculationDetails {
  sourcePurchaseId?: string;
  sourceEventId?: string;
  sourceMemberId?: string;
  calculationBase?: string;
  baseAmount?: number;
  baseBV?: number;
  rateApplied?: number;
  percentageApplied?: number;
  
  // Binary specific
  leftVolume?: number;
  rightVolume?: number;
  matchedVolume?: number;
  
  // Cap specifics
  rawCommission?: number;
  dailyCapAmount?: number;
  alreadyEarnedToday?: number;
  dailyCapRemaining?: number;
  excessAmount?: number;
  excessPolicyApplied?: string;
  
  // Binary Cycle specifics
  cycles?: any[];
  cyclesCount?: number;
  totalGeneratedIncome?: number;
  consumedMemberIds?: string[];
  remainingUnusedLeft?: number;
  remainingUnusedRight?: number;

  // Tier / Notes
  tierApplied?: string;
  notes?: string;
}

export interface ICommissionLedger extends Document {
  ledgerId: string;
  userId: string;
  memberId: string;
  type: CommissionType;
  sourceEventId: string;
  sourcePurchaseId?: string;
  
  grossAmount: number;
  grossAmountInPaise: number;
  
  tdsDeduction: number;
  tdsDeductionInPaise: number;
  
  adminFee: number;
  adminFeeInPaise: number;
  
  payableAmount: number;
  payableAmountInPaise: number;
  
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED' | 'REJECTED';
  calculationDetails: ICommissionCalculationDetails;
  
  // Reversal tracking
  isReversed: boolean;
  reversalLedgerId?: string;
  reversedAt?: Date;
  reversalReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const commissionLedgerSchema = new Schema<ICommissionLedger>(
  {
    ledgerId: {
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
      index: true,
    },
    type: {
      type: String,
      enum: [
        COMMISSION_TYPE.WELCOME_BONUS,
        COMMISSION_TYPE.BINARY_BONUS,
        COMMISSION_TYPE.SPONSOR_BINARY_BONUS,
        COMMISSION_TYPE.SELF_PURCHASE_BONUS,
        COMMISSION_TYPE.TEAM_BONUS,
        COMMISSION_TYPE.TEAM_PERFORMANCE_BONUS,
        COMMISSION_TYPE.UPLINE_BONUS,
        COMMISSION_TYPE.FRANCHISE_BONUS,
        COMMISSION_TYPE.ROYALTY,
        COMMISSION_TYPE.REWARD,
        COMMISSION_TYPE.ADJUSTMENT,
        COMMISSION_TYPE.REVERSAL,
      ],
      required: true,
      index: true,
    },
    sourceEventId: {
      type: String,
      required: true,
      index: true,
    },
    sourcePurchaseId: {
      type: String,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    grossAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    tdsDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },
    tdsDeductionInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    adminFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    adminFeeInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    payableAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payableAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PAID', 'REVERSED', 'REJECTED'],
      default: 'APPROVED',
      index: true,
    },
    calculationDetails: {
      type: Schema.Types.Mixed,
      required: true,
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversalLedgerId: {
      type: String,
    },
    reversedAt: {
      type: Date,
    },
    reversalReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

commissionLedgerSchema.index({ memberId: 1, type: 1, createdAt: -1 });
commissionLedgerSchema.index({ sourceEventId: 1, memberId: 1, type: 1 });

export const CommissionLedger = mongoose.model<ICommissionLedger>('CommissionLedger', commissionLedgerSchema);
export default CommissionLedger;
