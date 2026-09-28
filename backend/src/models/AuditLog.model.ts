import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  logId: string;
  action: string;
  entity: string; // e.g. 'COMPENSATION_RULE', 'PACKAGE', 'WALLET', 'BINARY_TREE', 'COMMISSION'
  entityId: string;
  performedBy: string; // adminId or 'SYSTEM'
  performedByRole: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entity: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      type: String,
      required: true,
      index: true,
    },
    performedByRole: {
      type: String,
      default: 'admin',
    },
    oldValues: {
      type: Schema.Types.Mixed,
    },
    newValues: {
      type: Schema.Types.Mixed,
    },
    reason: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable audit log
  }
);

auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
