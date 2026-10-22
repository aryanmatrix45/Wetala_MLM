import mongoose, { Document, Schema } from 'mongoose';
import { BV_OWNER_TYPE, BVOwnerType } from '../config/constants';

/**
 * Transferable BV credit balance for the Super Admin or a member.
 *
 * Deliberately separate from Member.personalBv / BinaryVolume / BVLedger. Wallet BV reaches the
 * binary tree in two ways only: when it pays for an order (the order's BV is credited on approval),
 * or when part of it is locked at binary activation (totalActivationLocked).
 * Balances are only ever changed by BVWalletService through guarded $inc updates.
 *
 * availableBV is the whole balance. bonusBV is the part of it that came from the welcome bonus:
 * it can only pay for the member's own orders (and binary activation), never be transferred or
 * returned. The rest (availableBV - bonusBV) is regular BV.
 */
export interface IBVWallet extends Document {
  walletId: string;
  ownerType: BVOwnerType;
  ownerId: string; // 'ADMIN' or a memberId
  availableBV: number;
  bonusBV: number;
  totalGenerated: number;
  totalReceived: number;
  totalSent: number;
  totalWelcomeBonus: number;
  totalSpent: number; // BV paid for orders, net of refunds
  totalActivationLocked: number; // BV locked at binary activation and fed into the binary tree
  totalSold: number; // Super Admin wallet: BV sold to members, net of reversed sales
  // Member wallets: BV bought from the Super Admin and returned to it, with their rupee value in paise.
  // A member can only return what it bought, at its average purchase price.
  purchasedBV: number;
  purchasedPaise: number;
  returnedBV: number;
  returnedPaise: number;
  pendingReturnBV: number; // held by return requests awaiting approval
  pendingReturnPaise: number;
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
    bonusBV: { type: Number, default: 0 },
    totalGenerated: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    totalSent: { type: Number, default: 0 },
    totalWelcomeBonus: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalActivationLocked: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0 },
    purchasedBV: { type: Number, default: 0 },
    purchasedPaise: { type: Number, default: 0 },
    returnedBV: { type: Number, default: 0 },
    returnedPaise: { type: Number, default: 0 },
    pendingReturnBV: { type: Number, default: 0 },
    pendingReturnPaise: { type: Number, default: 0 },
    sequence: { type: Number, default: 0 },
    isFrozen: { type: Boolean, default: false },
    frozenReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const BVWallet = mongoose.model<IBVWallet>('BVWallet', bvWalletSchema);
export default BVWallet;
