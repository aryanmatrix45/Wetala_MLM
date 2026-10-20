import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// Queries & Dossier (members are limited to their own orders inside the controller)
router.get('/', authenticate, PurchaseController.getPurchases);
router.get('/member/:memberId/history', authenticate, PurchaseController.getMemberHistory);

// Multi-step Purchase Request & Verification Workflow
router.post('/request', authenticate, PurchaseController.requestPurchase);
router.post('/:purchaseId/approve-instructions', authenticate, requireSuperAdmin, PurchaseController.approveInstructions);
router.post('/:purchaseId/submit-payment', authenticate, PurchaseController.submitPayment);
router.post('/:purchaseId/verify-and-pay', authenticate, requireSuperAdmin, PurchaseController.verifyAndPay);
router.post('/:purchaseId/reject', authenticate, requireSuperAdmin, PurchaseController.rejectPurchase);

// Legacy / Direct endpoints
router.post('/', authenticate, PurchaseController.createPurchase);
router.post('/:purchaseId/complete', authenticate, requireSuperAdmin, PurchaseController.completePurchase);
router.post('/:purchaseId/refund', authenticate, requireSuperAdmin, PurchaseController.refundPurchase);

export default router;
