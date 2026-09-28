import mongoose, { Document, Schema } from 'mongoose';
import { BV_SOURCE_TYPE, BVSourceType, BINARY_POSITION, BinaryPosition } from '../config/constants';

export interface IBVLedger extends Document {
  ledgerId: string;
  userId: string;
  memberId: string;
  sourceType: BVSourceType;
  referenceId: string; // e.g. purchaseId, eventId, matchId
  position?: BinaryPosition; // LEFT or RIGHT leg
  
  // Auditable balance tracking
  openingBV: number;
  earnedBV: number;
  consumedBV: number;
  carriedForwardBV: number;
  flushedBV: number;
  closingBV: number;
  
  description: string;
  isImmutable: boolean;
  createdAt: Date;
}

const bvLedgerSchema = new Schema<IBVLedger>(
  {
    ledgerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    sourceType: {
      type: String,
      enum: [
        BV_SOURCE_TYPE.JOINING_PACKAGE,
        BV_SOURCE_TYPE.REPURCHASE,
        BV_SOURCE_TYPE.RETAIL,
        BV_SOURCE_TYPE.ADJUSTMENT,
        BV_SOURCE_TYPE.MATCHED,
        BV_SOURCE_TYPE.FLUSHED,
        BV_SOURCE_TYPE.REVERSAL,
      ],
      required: true,
      index: true,
    },
    referenceId: {
      type: String,
      required: true,
      index: true,
    },
    position: {
      type: String,
      enum: [BINARY_POSITION.LEFT, BINARY_POSITION.RIGHT],
    },
    openingBV: {
      type: Number,
      required: true,
      default: 0,
    },
    earnedBV: {
      type: Number,
      required: true,
      default: 0,
    },
    consumedBV: {
      type: Number,
      required: true,
      default: 0,
    },
    carriedForwardBV: {
      type: Number,
      required: true,
      default: 0,
    },
    flushedBV: {
      type: Number,
      required: true,
      default: 0,
    },
    closingBV: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isImmutable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable ledger entries
  }
);

// Compound index for member volume history
bvLedgerSchema.index({ memberId: 1, createdAt: -1 });
bvLedgerSchema.index({ referenceId: 1, sourceType: 1 });

export const BVLedger = mongoose.model<IBVLedger>('BVLedger', bvLedgerSchema);
export default BVLedger;
