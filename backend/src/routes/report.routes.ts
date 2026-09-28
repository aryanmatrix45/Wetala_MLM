import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/overview', ReportController.getOverview);
router.get('/audit-logs', authenticate, ReportController.getAuditLogs);

export default router;
