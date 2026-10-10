import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Queries & Dossier
router.get('/', authenticate, PurchaseController.getPurchases);
router.get('/member/:memberId/history', authenticate, PurchaseController.getMemberHistory);

// Multi-step Purchase Request & Verification Workflow
router.post('/request', authenticate, PurchaseController.requestPurchase);
router.post('/:purchaseId/approve-instructions', authenticate, PurchaseController.approveInstructions);
router.post('/:purchaseId/submit-payment', authenticate, PurchaseController.submitPayment);
router.post('/:purchaseId/verify-and-pay', authenticate, PurchaseController.verifyAndPay);
router.post('/:purchaseId/reject', authenticate, PurchaseController.rejectPurchase);

// Legacy / Direct endpoints
router.post('/', authenticate, PurchaseController.createPurchase);
router.post('/:purchaseId/complete', authenticate, PurchaseController.completePurchase);
router.post('/:purchaseId/refund', authenticate, PurchaseController.refundPurchase);

export default router;
