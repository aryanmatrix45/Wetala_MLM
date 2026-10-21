import mongoose, { Document, Schema, Model } from 'mongoose';

// Icon keys the admin can choose from; the frontend maps each key to an icon.
export const HIGHLIGHT_ICON_KEYS = [
  'leaf',
  'lotus',
  'twin-leaves',
  'sprout',
  'herb',
  'mortar',
  'flower',
  'tree',
  'wheat',
  'droplet',
  'sun',
  'heart',
  'heart-pulse',
  'shield',
  'sparkles',
  'apple',
  'salad',
  'pill',
  'baby',
  'family',
  'home',
  'recycle',
  'award',
  'smile',
] as const;

export type HighlightIconKey = (typeof HIGHLIGHT_ICON_KEYS)[number];
export type HomeHighlightStatus = 'ACTIVE' | 'INACTIVE';
export type HighlightScrollSpeed = 'SLOW' | 'NORMAL' | 'FAST';

export interface IHomeHighlight extends Document {
  icon: HighlightIconKey;
  title: string;
  subtitle?: string;
  isHighlighted: boolean;
  order: number;
  status: HomeHighlightStatus;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHomeHighlightSettings extends Document {
  settingsKey: string;
  heading?: string;
  subheading?: string;
  isActive: boolean;
  scrollSpeed: HighlightScrollSpeed;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHomeHighlightModel extends Model<IHomeHighlight> {
  seedDefaults(): Promise<IHomeHighlightSettings>;
}

const SETTINGS_KEY = 'DEFAULT_HOME_HIGHLIGHT_SETTINGS';

const homeHighlightSettingsSchema = new Schema<IHomeHighlightSettings>(
  {
    settingsKey: { type: String, default: SETTINGS_KEY, unique: true, index: true },
    heading: { type: String, default: '', trim: true, maxlength: 120 },
    subheading: { type: String, default: '', trim: true, maxlength: 240 },
    isActive: { type: Boolean, default: true },
    scrollSpeed: { type: String, enum: ['SLOW', 'NORMAL', 'FAST'], default: 'NORMAL' },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

export const HomeHighlightSettings = mongoose.model<IHomeHighlightSettings>(
  'HomeHighlightSettings',
  homeHighlightSettingsSchema
);

const homeHighlightSchema = new Schema<IHomeHighlight, IHomeHighlightModel>(
  {
    icon: {
      type: String,
      enum: { values: HIGHLIGHT_ICON_KEYS as unknown as string[], message: 'Please choose a valid icon' },
      default: 'leaf',
    },
    title: {
      type: String,
      required: [true, 'Card title is required'],
      trim: true,
      maxlength: [60, 'Title must be 60 characters or fewer'],
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
      maxlength: [120, 'Subtitle must be 120 characters or fewer'],
    },
    isHighlighted: { type: Boolean, default: false },
    order: { type: Number, default: 1, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

// Creates the settings record and the three starter cards the first time the section is used
homeHighlightSchema.statics.seedDefaults = async function (): Promise<IHomeHighlightSettings> {
  let settings = await HomeHighlightSettings.findOne({ settingsKey: SETTINGS_KEY });
  if (!settings) {
    settings = await HomeHighlightSettings.create({ settingsKey: SETTINGS_KEY, updatedBy: 'System' });

    if ((await this.countDocuments()) === 0) {
      await this.create([
        { icon: 'leaf', title: 'Health & Wellness', subtitle: 'Build inner strength naturally', isHighlighted: true, order: 1, updatedBy: 'System' },
        { icon: 'lotus', title: 'Personal Care', subtitle: 'Pure care for you and your family', order: 2, updatedBy: 'System' },
        { icon: 'twin-leaves', title: 'Agriculture', subtitle: 'For healthier soil and a greener tomorrow', order: 3, updatedBy: 'System' },
      ]);
    }
  }
  return settings;
};

export const HomeHighlight = mongoose.model<IHomeHighlight, IHomeHighlightModel>('HomeHighlight', homeHighlightSchema);
