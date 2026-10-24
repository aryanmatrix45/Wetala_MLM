import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type FranchiseeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface IFranchiseeRequest extends Document {
  store: Types.ObjectId;
  storeId: string;
  memberId: string;
  memberName: string;
  status: FranchiseeRequestStatus;
  adminNote?: string;
  processedBy?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFranchiseeRequestModel extends Model<IFranchiseeRequest> {}

const franchiseeRequestSchema = new Schema<IFranchiseeRequest, IFranchiseeRequestModel>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'FranchiseeStore', required: true, index: true },
    storeId: { type: String, required: true, trim: true },
    memberId: { type: String, required: true, trim: true, index: true },
    memberName: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, trim: true, default: '' },
    processedBy: { type: String, trim: true },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const FranchiseeRequest = mongoose.model<IFranchiseeRequest, IFranchiseeRequestModel>(
  'FranchiseeRequest',
  franchiseeRequestSchema
);
export default FranchiseeRequest;
