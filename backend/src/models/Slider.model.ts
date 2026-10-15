import mongoose, { Document, Schema } from 'mongoose';

export type SliderType = 'parent' | 'child'; // parent = desktop, child = mobile
export type SliderStatus = 'active' | 'inactive';

export interface ISlider extends Document {
  image: string;
  imageUrl: string;
  title?: string;
  link?: string;
  type: SliderType;
  status: SliderStatus;
  order: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sliderSchema = new Schema<ISlider>(
  {
    image: {
      type: String,
      required: [true, 'Slider image is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['parent', 'child'],
      default: 'parent',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    order: {
      type: Number,
      default: 1,
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

// Indexes for fast lookup
sliderSchema.index({ type: 1, status: 1, order: 1 });
sliderSchema.index({ createdAt: -1 });

// Ensure image and imageUrl are synchronized
sliderSchema.pre('validate', function () {
  if (this.image && !this.imageUrl) {
    this.imageUrl = this.image;
  } else if (this.imageUrl && !this.image) {
    this.image = this.imageUrl;
  }
});

export const Slider = mongoose.model<ISlider>('Slider', sliderSchema);
export default Slider;
