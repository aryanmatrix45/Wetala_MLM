import mongoose, { Document, Schema } from 'mongoose';
import { BV_LEDGER_ENTRY, BVLedgerEntryType } from '../config/constants';

/**
 * Append-only record of every BV Wallet balance change. Never updated or deleted.
 * Summing availableDelta per wallet must reproduce the wallet's balance, and summing bonusDelta its
 * welcome bonus part.
 */
export interface IBVWalletLedger extends Document {
  entryId: string;
  walletId: string;
  ownerId: string;
  transactionId: string;
  entryType: BVLedgerEntryType;
  amount: number;
  availableDelta: number;
  bonusDelta: number;
  availableBefore: number;
  availableAfter: number;
  walletSequence: number;
  createdAt: Date;
}

const bvWalletLedgerSchema = new Schema<IBVWalletLedger>(
  {
    entryId: { type: String, required: true, unique: true, trim: true },
    walletId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    transactionId: { type: String, required: true, index: true },
    entryType: { type: String, enum: Object.values(BV_LEDGER_ENTRY), required: true },
    amount: { type: Number, required: true, min: 1 },
    availableDelta: { type: Number, required: true },
    bonusDelta: { type: Number, default: 0 },
    availableBefore: { type: Number, required: true },
    availableAfter: { type: Number, required: true },
    walletSequence: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Immutable ledger entries
);

// The same posting can never be written twice for a transaction
bvWalletLedgerSchema.index({ transactionId: 1, walletId: 1, entryType: 1 }, { unique: true });
// Strict per-wallet ordering
bvWalletLedgerSchema.index({ walletId: 1, walletSequence: 1 }, { unique: true });

export const BVWalletLedger = mongoose.model<IBVWalletLedger>('BVWalletLedger', bvWalletLedgerSchema);
export default BVWalletLedger;
