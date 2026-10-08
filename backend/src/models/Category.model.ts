import mongoose, { Document, Schema } from 'mongoose';

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  status: CategoryStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
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

// Indexes
categorySchema.index({ createdAt: -1 });

categorySchema.pre('validate', function () {
  if (this.slug) {
    this.slug = this.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
});

export const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;
