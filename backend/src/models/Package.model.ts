import mongoose, { Document, Schema } from 'mongoose';
import { PURCHASE_TYPE, PurchaseType } from '../config/constants';

export interface IPackage extends Document {
  packageId: string;
  packageNumber?: number;
  name: string;
  badge?: string; // e.g. 'STARTER', 'EXECUTIVE', 'PROFESSIONAL', 'ELITE VIP'
  price: number; // in Rupees
  priceInPaise: number; // in Paise for decimal safety
  bv: number; // Business Volume
  rp: number; // Reward Points (from Image 2)
  type: PurchaseType;
  dailyCapping: number; // in Rupees
  description?: string;
  features?: string[]; // Bullet-point perks/features list
  isPopular?: boolean; // Highlight as most popular
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage>(
  {
    packageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    packageNumber: {
      type: Number,
      default: 1,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    badge: {
      type: String,
      trim: true,
      default: 'STARTER',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    bv: {
      type: Number,
      required: true,
      min: 0,
    },
    rp: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    type: {
      type: String,
      enum: [PURCHASE_TYPE.JOINING, PURCHASE_TYPE.REPURCHASE],
      default: PURCHASE_TYPE.JOINING,
    },
    dailyCapping: {
      type: Number,
      default: 4000,
    },
    description: {
      type: String,
      trim: true,
    },
    features: {
      type: [String],
      default: [],
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

packageSchema.pre('validate', function () {
  if (this.price !== undefined && !this.priceInPaise) {
    this.priceInPaise = Math.round(this.price * 100);
  }
});

export const Package = mongoose.model<IPackage>('Package', packageSchema);
export default Package;
