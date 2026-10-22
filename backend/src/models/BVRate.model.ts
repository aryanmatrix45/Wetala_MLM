import mongoose, { Document, Schema } from 'mongoose';

/**
 * The price of 1 BV when the Super Admin sells it to a member. Each change adds a row; the newest
 * row is the current rate. Every sale stores the rate it used, so changing the rate never changes
 * past earnings.
 */
export interface IBVRate extends Document {
  rateId: string;
  ratePaise: number; // rupees per BV, in paise
  note: string;
  setBy: { email: string; operatorName: string };
  createdAt: Date;
}

const bvRateSchema = new Schema<IBVRate>(
  {
    rateId: { type: String, required: true, unique: true, trim: true },
    ratePaise: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => Number.isInteger(v) && v >= 1,
        message: 'BV rate must be at least ₹0.01',
      },
    },
    note: { type: String, trim: true, default: '' },
    setBy: {
      email: { type: String, default: '' },
      operatorName: { type: String, trim: true, default: '' },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // A rate is never edited; a change adds a new row
);

bvRateSchema.index({ createdAt: -1 });

export const BVRate = mongoose.model<IBVRate>('BVRate', bvRateSchema);
export default BVRate;
