import mongoose, { Document, Schema, Model } from 'mongoose';

export type NotificationType =
  | 'WITHDRAWAL_REQUEST'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_PAID'
  | 'WITHDRAWAL_REJECTED'
  | 'SYSTEM_ALERT';

export interface IAdminNotification extends Document {
  notificationId: string;
  type: NotificationType;
  title: string;
  message: string;
  senderId?: string;
  senderName?: string;
  recipientRole: 'admin' | 'member';
  recipientId?: string; // 'admin' or specific memberId
  referenceId?: string; // e.g. requestId
  amount?: number;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'WITHDRAWAL_REQUEST',
        'WITHDRAWAL_APPROVED',
        'WITHDRAWAL_PAID',
        'WITHDRAWAL_REJECTED',
        'SYSTEM_ALERT',
      ],
      default: 'WITHDRAWAL_REQUEST',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    senderId: {
      type: String,
      trim: true,
    },
    senderName: {
      type: String,
      trim: true,
    },
    recipientRole: {
      type: String,
      enum: ['admin', 'member'],
      default: 'admin',
      index: true,
    },
    recipientId: {
      type: String,
      trim: true,
      default: 'admin',
      index: true,
    },
    referenceId: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

adminNotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const AdminNotification: Model<IAdminNotification> =
  mongoose.models.AdminNotification ||
  mongoose.model<IAdminNotification>('AdminNotification', adminNotificationSchema);

export default AdminNotification;
