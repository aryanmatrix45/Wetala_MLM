import mongoose, { Document, Schema } from 'mongoose';

export type SubcategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface ISubcategory extends Document {
  name: string;
  slug: string;
  categoryId: mongoose.Types.ObjectId;
  description?: string;
  status: SubcategoryStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subcategorySchema = new Schema<ISubcategory>(
  {
    name: {
      type: String,
      required: [true, 'Subcategory name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Subcategory slug is required'],
      trim: true,
      lowercase: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Parent Category is required'],
      index: true,
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

// Unique slug per category or globally unique slug
subcategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true });
subcategorySchema.index({ createdAt: -1 });

subcategorySchema.pre('validate', function () {
  if (this.slug) {
    this.slug = this.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
});

export const Subcategory = mongoose.model<ISubcategory>('Subcategory', subcategorySchema);
export default Subcategory;
