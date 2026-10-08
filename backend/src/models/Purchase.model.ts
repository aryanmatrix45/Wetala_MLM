import mongoose, { Document, Schema } from 'mongoose';
import { PURCHASE_TYPE, PurchaseType, PURCHASE_STATUS, PurchaseStatus } from '../config/constants';

export interface IPurchaseItem {
  itemId: string; // packageId or productId
  productId?: string; // Product document ID snapshot
  productName?: string; // Product name snapshot
  itemType: 'PACKAGE' | 'PRODUCT';
  name: string;
  quantity: number;
  unitPrice: number;
  price?: number; // Snapshot of unit price
  unitPriceInPaise: number;
  unitBV: number;
  businessVolume?: number; // Snapshot of unit business volume
  totalPrice: number;
  totalPriceInPaise: number;
  totalBV: number;
}

export interface IPurchase extends Document {
  purchaseId: string;
  userId: string; // memberId or _id
  memberId: string;
  type: PurchaseType;
  items: IPurchaseItem[];
  totalAmount: number;
  totalAmountInPaise: number;
  totalBV: number;
  status: PurchaseStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string;
  transactionId: string;
  notes?: string;
  completedAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseItemSchema = new Schema<IPurchaseItem>(
  {
    itemId: { type: String, required: true },
    productId: { type: String },
    productName: { type: String },
    itemType: { type: String, enum: ['PACKAGE', 'PRODUCT'], required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    price: { type: Number, min: 0 },
    unitPriceInPaise: { type: Number, required: true, min: 0 },
    unitBV: { type: Number, required: true, min: 0 },
    businessVolume: { type: Number, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    totalPriceInPaise: { type: Number, required: true, min: 0 },
    totalBV: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseSchema = new Schema<IPurchase>(
  {
    purchaseId: {
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
    type: {
      type: String,
      enum: [PURCHASE_TYPE.JOINING, PURCHASE_TYPE.REPURCHASE, PURCHASE_TYPE.RETAIL, PURCHASE_TYPE.OTHER],
      required: true,
      index: true,
    },
    items: [purchaseItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalBV: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        PURCHASE_STATUS.PENDING,
        PURCHASE_STATUS.CONFIRMED,
        PURCHASE_STATUS.COMPLETED,
        PURCHASE_STATUS.CANCELLED,
        PURCHASE_STATUS.REFUNDED,
      ],
      default: PURCHASE_STATUS.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'WALLET',
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Purchase = mongoose.model<IPurchase>('Purchase', purchaseSchema);
export default Purchase;
