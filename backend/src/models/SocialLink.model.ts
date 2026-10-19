import mongoose, { Document, Schema, Model } from 'mongoose';

export type SocialPlatform =
  | 'youtube'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'whatsapp'
  | 'telegram'
  | 'linkedin'
  | 'website'
  | 'custom';

export interface ISocialLink extends Document {
  platform: SocialPlatform;
  title: string;
  subtitle?: string;
  url: string;
  icon?: string;
  isActive: boolean;
  order: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISocialLinkModel extends Model<ISocialLink> {
  seedDefaults(): Promise<ISocialLink[]>;
}

const socialLinkSchema = new Schema<ISocialLink, ISocialLinkModel>(
  {
    platform: {
      type: String,
      required: true,
      enum: [
        'youtube',
        'instagram',
        'twitter',
        'facebook',
        'whatsapp',
        'telegram',
        'linkedin',
        'website',
        'custom',
      ],
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    url: {
      type: String,
      trim: true,
      default: '',
    },
    icon: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
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

// Default predefined platforms list
export const DEFAULT_SOCIAL_PLATFORMS: Array<{
  platform: SocialPlatform;
  title: string;
  subtitle: string;
  url: string;
  order: number;
  isActive: boolean;
}> = [
  {
    platform: 'youtube',
    title: 'YouTube Channel',
    subtitle: 'Watch tutorials & presentations',
    url: '',
    order: 1,
    isActive: true,
  },
  {
    platform: 'instagram',
    title: 'Instagram',
    subtitle: 'Follow our official updates',
    url: '',
    order: 2,
    isActive: true,
  },
  {
    platform: 'twitter',
    title: 'X (Twitter)',
    subtitle: 'Latest announcements & news',
    url: '',
    order: 3,
    isActive: true,
  },
  {
    platform: 'facebook',
    title: 'Facebook Page',
    subtitle: 'Connect with community',
    url: '',
    order: 4,
    isActive: true,
  },
  {
    platform: 'whatsapp',
    title: 'WhatsApp Channel',
    subtitle: 'Instant alerts & member support',
    url: '',
    order: 5,
    isActive: false,
  },
  {
    platform: 'telegram',
    title: 'Telegram Channel',
    subtitle: 'Official community broadcasts',
    url: '',
    order: 6,
    isActive: false,
  },
  {
    platform: 'linkedin',
    title: 'LinkedIn',
    subtitle: 'Corporate & career network',
    url: '',
    order: 7,
    isActive: false,
  },
];

socialLinkSchema.statics.seedDefaults = async function (): Promise<ISocialLink[]> {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.insertMany(DEFAULT_SOCIAL_PLATFORMS);
  }
  return this.find().sort({ order: 1 });
};

export const SocialLink = mongoose.model<ISocialLink, ISocialLinkModel>('SocialLink', socialLinkSchema);
export default SocialLink;
