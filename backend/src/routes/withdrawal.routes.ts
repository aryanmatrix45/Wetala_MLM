import { Router } from 'express';
import { WithdrawalController } from '../controllers/withdrawal.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// Member Endpoints
router.post('/request', authenticate, WithdrawalController.submitRequest);
router.get('/my-requests', authenticate, WithdrawalController.getMyRequests);
router.get('/balance-summary/:memberId?', authenticate, WithdrawalController.getBalanceSummary);

// Member Notifications
router.get('/notifications/member/:memberId?', authenticate, WithdrawalController.getMemberNotifications);

// Admin Endpoints
router.get('/admin/all', authenticate, requireAdmin, WithdrawalController.getAllRequestsAdmin);
router.post('/admin/:id/approve', authenticate, requireAdmin, WithdrawalController.approveRequest);
router.post('/admin/:id/reject', authenticate, requireAdmin, WithdrawalController.rejectRequest);
router.post('/admin/:id/pay', authenticate, requireAdmin, WithdrawalController.markAsPaid);

// Admin Notifications / Messages
router.get('/notifications/admin', authenticate, requireAdmin, WithdrawalController.getAdminNotifications);
router.put('/notifications/:id/read', authenticate, WithdrawalController.markNotificationAsRead);

export default router;
