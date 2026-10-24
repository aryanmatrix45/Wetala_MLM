import mongoose, { Document, Schema, Model } from 'mongoose';

export type FranchiseeStoreStatus = 'available' | 'sold';

export interface IFranchiseeStore extends Document {
  storeId: string;
  storeName: string;
  ownerName: string;
  city: string;
  fullAddress: string;
  pinCode: string;
  isActive: boolean;
  status: FranchiseeStoreStatus;
  // Member who bought this store (set when the Super Admin assigns it)
  buyerMemberId?: string;
  buyerName?: string;
  soldAt?: Date;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFranchiseeStoreModel extends Model<IFranchiseeStore> {}

const franchiseeStoreSchema = new Schema<IFranchiseeStore, IFranchiseeStoreModel>(
  {
    storeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    fullAddress: { type: String, required: true, trim: true },
    pinCode: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['available', 'sold'], default: 'available', index: true },
    buyerMemberId: { type: String, trim: true, index: true },
    buyerName: { type: String, trim: true },
    soldAt: { type: Date },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

export const FranchiseeStore = mongoose.model<IFranchiseeStore, IFranchiseeStoreModel>(
  'FranchiseeStore',
  franchiseeStoreSchema
);
export default FranchiseeStore;
