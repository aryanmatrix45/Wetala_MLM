import mongoose, { Document, Schema, Model } from 'mongoose';

// Extract 11-character YouTube video ID from any standard YouTube URL
export function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  return match ? match[1] : null;
}

export type HomeVideoStatus = 'ACTIVE' | 'INACTIVE';

export interface IHomeVideo extends Document {
  title: string;
  youtubeUrl: string;
  videoId: string;
  description?: string;
  order: number;
  status: HomeVideoStatus;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHomeVideoSettings extends Document {
  settingsKey: string;
  headerTitle: string;
  headerSubtitle?: string;
  isActive: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHomeVideoModel extends Model<IHomeVideo> {
  seedDefaults(): Promise<{ settings: IHomeVideoSettings; videos: IHomeVideo[] }>;
}

const homeVideoSettingsSchema = new Schema<IHomeVideoSettings>(
  {
    settingsKey: {
      type: String,
      default: 'DEFAULT_HOME_VIDEO_SETTINGS',
      unique: true,
      index: true,
    },
    headerTitle: {
      type: String,
      default: '<h2 style="color: #0f172a; margin: 0;">Featured Presentations & Training Videos</h2>',
      trim: true,
    },
    headerSubtitle: {
      type: String,
      default: '<p style="color: #64748b; margin: 4px 0 0 0;">Watch our official product demonstrations, business briefings, and distributor guides</p>',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

export const HomeVideoSettings = mongoose.model<IHomeVideoSettings>(
  'HomeVideoSettings',
  homeVideoSettingsSchema
);

const homeVideoSchema = new Schema<IHomeVideo, IHomeVideoModel>(
  {
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
    },
    youtubeUrl: {
      type: String,
      required: [true, 'YouTube URL is required'],
      trim: true,
    },
    videoId: {
      type: String,
      required: [true, 'Valid YouTube Video ID is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    order: {
      type: Number,
      default: 1,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
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

// Pre-validate hook to parse videoId from youtubeUrl
homeVideoSchema.pre('validate', function () {
  if (this.youtubeUrl && !this.videoId) {
    const extracted = extractYouTubeId(this.youtubeUrl);
    if (extracted) {
      this.videoId = extracted;
    }
  } else if (this.youtubeUrl) {
    const extracted = extractYouTubeId(this.youtubeUrl);
    if (extracted) {
      this.videoId = extracted;
    }
  }
});

homeVideoSchema.statics.seedDefaults = async function (): Promise<{
  settings: IHomeVideoSettings;
  videos: IHomeVideo[];
}> {
  let settings = await HomeVideoSettings.findOne({
    settingsKey: 'DEFAULT_HOME_VIDEO_SETTINGS',
  });

  if (!settings) {
    settings = await HomeVideoSettings.create({
      settingsKey: 'DEFAULT_HOME_VIDEO_SETTINGS',
      headerTitle: '<h2 style="color: #0f172a; margin: 0;">Featured Presentations & Training Videos</h2>',
      headerSubtitle: '<p style="color: #64748b; margin: 4px 0 0 0;">Watch our official product demonstrations, business briefings, and distributor guides</p>',
      isActive: true,
      updatedBy: 'System',
    });
  }

  const count = await this.countDocuments();
  if (count === 0) {
    await this.create([
      {
        title: 'Ayurveda & Natural Health: The Science of Daily Wellness',
        youtubeUrl: 'https://www.youtube.com/watch?v=xyQY8a-ng6g',
        videoId: 'xyQY8a-ng6g',
        description:
          '<p>Educational scientific guide on nutritional wellness, natural botanical balance, and holistic vitality for health enthusiasts.</p>',
        order: 1,
        status: 'ACTIVE',
        updatedBy: 'System',
      },
      {
        title: 'Mastering Leadership & Purpose-Driven Entrepreneurship',
        youtubeUrl: 'https://www.youtube.com/watch?v=qp0HIF3SfI4',
        videoId: 'qp0HIF3SfI4',
        description:
          '<p>A masterclass on sustainable leadership, team culture, and how visionary entrepreneurs inspire lasting success and network growth.</p>',
        order: 2,
        status: 'ACTIVE',
        updatedBy: 'System',
      },
    ]);
  } else if (count === 1) {
    await this.create({
      title: 'Mastering Leadership & Purpose-Driven Entrepreneurship',
      youtubeUrl: 'https://www.youtube.com/watch?v=qp0HIF3SfI4',
      videoId: 'qp0HIF3SfI4',
      description:
        '<p>A masterclass on sustainable leadership, team culture, and how visionary entrepreneurs inspire lasting success and network growth.</p>',
      order: 2,
      status: 'ACTIVE',
      updatedBy: 'System',
    });
  }

  const videos = await this.find().sort({ order: 1 });
  return { settings, videos };
};

export const HomeVideo = mongoose.model<IHomeVideo, IHomeVideoModel>(
  'HomeVideo',
  homeVideoSchema
);

export default HomeVideo;
