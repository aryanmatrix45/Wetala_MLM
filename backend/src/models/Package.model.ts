import mongoose, { Document, Schema } from 'mongoose';
import { PURCHASE_TYPE, PurchaseType } from '../config/constants';

export interface IPackage extends Document {
  packageId: string;
  name: string;
  price: number; // in Rupees
  priceInPaise: number; // in Paise for decimal safety
  bv: number; // Business Volume
  type: PurchaseType;
  dailyCapping: number; // in Rupees
  description?: string;
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
    name: {
      type: String,
      required: true,
      trim: true,
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
