import { AuditLog, IAuditLog } from '../models/AuditLog.model';

export class AuditService {
  static async log(params: {
    action: string;
    entity: string;
    entityId: string;
    performedBy: string;
    performedByRole?: string;
    oldValues?: any;
    newValues?: any;
    reason?: string;
    ipAddress?: string;
  }): Promise<IAuditLog> {
    return AuditLog.create({
      logId: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      performedBy: params.performedBy,
      performedByRole: params.performedByRole || 'admin',
      oldValues: params.oldValues,
      newValues: params.newValues,
      reason: params.reason || '',
      ipAddress: params.ipAddress || '',
    });
  }
}
