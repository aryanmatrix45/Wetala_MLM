import mongoose, { Document, Schema } from 'mongoose';

export interface IProductImage {
  url: string;
  key: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface IProduct extends Document {
  productId: string;
  title: string;
  name: string; // Backward compatibility alias for title
  slug: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  categoryId?: mongoose.Types.ObjectId;
  subcategoryId?: mongoose.Types.ObjectId | null;
  category?: string;
  brand?: string;
  businessVolume: number;
  bv: number; // Backward compatibility alias for businessVolume
  price: number;
  priceInPaise: number;
  costPrice?: number;
  costPriceInPaise?: number;
  mrp?: number;
  mrpInPaise?: number;
  images: IProductImage[];
  stock: number;
  stockQuantity: number; // Backward compatibility alias for stock
  status: ProductStatus;
  isActive: boolean; // Backward compatibility alias for status === 'ACTIVE'
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    alt: { type: String, default: '', trim: true },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    sku: {
      type: String,
      required: [true, 'Product SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    shortDescription: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    subcategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Subcategory',
      default: null,
      index: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    businessVolume: {
      type: Number,
      required: [true, 'Business Volume is required'],
      min: [0, 'Business Volume must be greater than or equal to 0'],
    },
    bv: {
      type: Number,
      min: 0,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    priceInPaise: {
      type: Number,
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
    images: {
      type: [productImageSchema],
      default: [],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Targeted database indexes
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });

productSchema.pre('validate', function () {
  // Sync title and name
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }

  // Sync BV and businessVolume
  if (this.businessVolume !== undefined && this.bv === undefined) {
    this.bv = this.businessVolume;
  } else if (this.bv !== undefined && this.businessVolume === undefined) {
    this.businessVolume = this.bv;
  }

  // Sync stock and stockQuantity
  if (this.stock !== undefined && this.stockQuantity === undefined) {
    this.stockQuantity = this.stock;
  } else if (this.stockQuantity !== undefined && this.stock === undefined) {
    this.stock = this.stockQuantity;
  }

  // Sync status and isActive
  if (this.status) {
    this.isActive = this.status === 'ACTIVE';
  } else if (this.isActive !== undefined) {
    this.status = this.isActive ? 'ACTIVE' : 'INACTIVE';
  } else {
    this.status = 'ACTIVE';
    this.isActive = true;
  }

  // Generate productId if missing
  if (!this.productId) {
    this.productId = `PRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  // Monetary precision in paise
  if (this.price !== undefined) {
    this.priceInPaise = Math.round(this.price * 100);
  }
  if (this.costPrice !== undefined) {
    this.costPriceInPaise = Math.round(this.costPrice * 100);
  }
  if (this.mrp !== undefined) {
    this.mrpInPaise = Math.round(this.mrp * 100);
  }

  // Ensure slug format
  if (this.slug) {
    this.slug = this.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Guarantee primary image consistency if images exist
  if (this.images && this.images.length > 0) {
    const hasPrimary = this.images.some(img => img.isPrimary);
    if (!hasPrimary) {
      this.images[0].isPrimary = true;
    }
  }
});

export const Product = mongoose.model<IProduct>('Product', productSchema);
export default Product;
