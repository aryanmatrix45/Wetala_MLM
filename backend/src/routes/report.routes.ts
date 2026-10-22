import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// Company-wide figures and audit logs are for the Super Admin only
router.get('/overview', authenticate, requireSuperAdmin, ReportController.getOverview);
router.get('/audit-logs', authenticate, requireSuperAdmin, ReportController.getAuditLogs);

export default router;
