import mongoose, { Document, Schema } from 'mongoose';
import { BV_OWNER_TYPE, BVOwnerType } from '../config/constants';

/**
 * Transferable BV credit balance for the Super Admin or a member.
 *
 * Deliberately separate from Member.personalBv / BinaryVolume / BVLedger: wallet BV is not
 * backed by a sale, so it never feeds binary matching, activation or commissions.
 * Balances are only ever changed by BVWalletService through guarded $inc updates.
 */
export interface IBVWallet extends Document {
  walletId: string;
  ownerType: BVOwnerType;
  ownerId: string; // 'ADMIN' or a memberId
  availableBV: number;
  totalGenerated: number;
  totalReceived: number;
  totalSent: number;
  sequence: number; // incremented on every balance change; mirrored on each ledger entry
  isFrozen: boolean;
  frozenReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const bvWalletSchema = new Schema<IBVWallet>(
  {
    walletId: { type: String, required: true, unique: true, trim: true },
    ownerType: { type: String, enum: Object.values(BV_OWNER_TYPE), required: true },
    ownerId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    availableBV: {
      type: Number,
      default: 0,
      validate: {
        validator: (v: number) => Number.isInteger(v) && v >= 0,
        message: 'BV balance must be a non-negative whole number',
      },
    },
    totalGenerated: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    totalSent: { type: Number, default: 0 },
    sequence: { type: Number, default: 0 },
    isFrozen: { type: Boolean, default: false },
    frozenReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const BVWallet = mongoose.model<IBVWallet>('BVWallet', bvWalletSchema);
export default BVWallet;
