import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  productId: string;
  sku: string;
  name: string;
  category: string;
  price: number; // Selling price in rupees
  priceInPaise: number;
  costPrice: number; // Cost price in rupees
  costPriceInPaise: number;
  mrp: number; // Maximum Retail Price
  mrpInPaise: number;
  bv: number; // Business volume credited
  description?: string;
  imageUrl?: string;
  stockQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
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
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPriceInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    mrpInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    bv: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    stockQuantity: {
      type: Number,
      default: 1000,
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

productSchema.pre('validate', function () {
  if (this.price !== undefined && !this.priceInPaise) {
    this.priceInPaise = Math.round(this.price * 100);
  }
  if (this.costPrice !== undefined && !this.costPriceInPaise) {
    this.costPriceInPaise = Math.round(this.costPrice * 100);
  }
  if (this.mrp !== undefined && !this.mrpInPaise) {
    this.mrpInPaise = Math.round(this.mrp * 100);
  }
});

export const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;
