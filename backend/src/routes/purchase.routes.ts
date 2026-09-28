import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', PurchaseController.getPurchases);
router.post('/', PurchaseController.createPurchase);
router.post('/:purchaseId/complete', PurchaseController.completePurchase);
router.post('/:purchaseId/refund', authenticate, PurchaseController.refundPurchase);

export default router;
