import mongoose, { Document, Schema } from 'mongoose';
import { BV_OWNER_TYPE, BVOwnerType } from '../config/constants';

/**
 * Transferable BV credit balance for the Super Admin or a member.
 *
 * Deliberately separate from Member.personalBv / BinaryVolume / BVLedger. Wallet BV reaches the
 * binary tree in two ways only: when it pays for an order (the order's BV is credited on approval),
 * or when part of it is locked at binary activation (totalActivationLocked).
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
  totalWelcomeBonus: number;
  totalSpent: number; // BV paid for orders, net of refunds
  totalActivationLocked: number; // BV locked at binary activation and fed into the binary tree
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
    totalWelcomeBonus: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalActivationLocked: { type: Number, default: 0 },
    sequence: { type: Number, default: 0 },
    isFrozen: { type: Boolean, default: false },
    frozenReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const BVWallet = mongoose.model<IBVWallet>('BVWallet', bvWalletSchema);
export default BVWallet;
