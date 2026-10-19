import mongoose, { Document, Schema, Model } from 'mongoose';

export type AboutSectionStatus = 'ACTIVE' | 'INACTIVE';

export interface IAboutSection extends Document {
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  status: AboutSectionStatus;
  order: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAboutSectionModel extends Model<IAboutSection> {
  seedDefaults(): Promise<IAboutSection[]>;
}

// Convert Google Drive view/share links or Dropbox links to direct image URLs
export function normalizeDirectImageUrl(url?: string): string {
  if (!url) return '';
  let trimmed = url.trim();

  // Google Drive
  const gDriveMatch = trimmed.match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]+)/i
  );
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  // Dropbox
  if (trimmed.includes('dropbox.com')) {
    trimmed = trimmed.replace(/\?dl=0$/, '?raw=1').replace(/&dl=0$/, '&raw=1');
    if (!trimmed.includes('raw=1')) {
      trimmed += (trimmed.includes('?') ? '&' : '?') + 'raw=1';
    }
    return trimmed;
  }

  return trimmed;
}

const aboutSectionSchema = new Schema<IAboutSection, IAboutSectionModel>(
  {
    title: {
      type: String,
      required: [true, 'About section title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    order: {
      type: Number,
      default: 1,
      index: true,
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

// Normalize Google Drive image URL before save/validation
aboutSectionSchema.pre('validate', function () {
  if (this.imageUrl) {
    this.imageUrl = normalizeDirectImageUrl(this.imageUrl);
  }
});

// Seed default About Us story if collection is empty
aboutSectionSchema.statics.seedDefaults = async function (): Promise<IAboutSection[]> {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.create({
      title: 'About Wetala Wellness',
      subtitle: 'Ancient Ayurvedic Wisdom Meets Modern Formulation Science',
      description: `
        <p>Welcome to <strong>Wetala Wellness</strong>, a pioneer in authentic, research-driven Ayurvedic and wellness formulations. Our mission is to restore harmony, vitality, and natural balance through pure botanical extractions and time-tested holistic therapies.</p>
        <p>Every formulation is crafted from sustainably harvested herbs, certified for 100% purity, and manufactured under strict GMP compliance standards. Beyond superior wellness products, we empower thousands of independent distributors across India through our ethical business volume (BV) direct selling network.</p>
        <ul>
          <li><strong>100% Herbal & Authentic:</strong> Formulated using pure Ayurvedic botanicals with zero harmful additives.</li>
          <li><strong>Certified GMP Manufacturing:</strong> Highest quality assurance standards for maximum bioavailability.</li>
          <li><strong>Distributor Prosperity:</strong> Transparent binary compensation, instant BV credits, and lifelong rewards.</li>
        </ul>
      `,
      imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1000&auto=format&fit=crop',
      status: 'ACTIVE',
      order: 1,
      updatedBy: 'System',
    });
  }
  return this.find().sort({ order: 1 });
};

export const AboutSection = mongoose.model<IAboutSection, IAboutSectionModel>(
  'AboutSection',
  aboutSectionSchema
);

export default AboutSection;
