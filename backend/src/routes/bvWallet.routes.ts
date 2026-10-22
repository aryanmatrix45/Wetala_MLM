import { Router } from 'express';
import { BVWalletController } from '../controllers/bvWallet.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

// Own wallet & history (Super Admin or member; the owner comes from the JWT)
router.get('/me', BVWalletController.getMyWallet);
router.get('/transactions', BVWalletController.getMyTransactions);

// Recipient lookup (masked results) for verifying who BV is sent to
router.get('/recipients/search', BVWalletController.searchRecipients);
router.get('/recipients/:recipientId', BVWalletController.getRecipient);

// Instant transfers (member -> member, Super Admin -> member; the latter is a BV sale at the BV rate)
router.post('/transfers', BVWalletController.transfer);

// Member returns of BV bought from the Super Admin (held until the Super Admin approves)
router.get('/returns', BVWalletController.getMyReturns);
router.post('/returns', BVWalletController.requestReturn);
router.post('/returns/:requestId/cancel', BVWalletController.cancelReturn);

// Super Admin
router.post('/admin/generate', requireSuperAdmin, BVWalletController.generate);
router.get('/admin/overview', requireSuperAdmin, BVWalletController.getAdminOverview);
router.get('/admin/transactions', requireSuperAdmin, BVWalletController.getAllTransactions);
router.post('/admin/transactions/:transactionId/reverse', requireSuperAdmin, BVWalletController.reverseTransfer);
router.get('/admin/reconcile', requireSuperAdmin, BVWalletController.reconcile);
router.get('/admin/wallets/:memberId', requireSuperAdmin, BVWalletController.getMemberWallet);
router.post('/admin/wallets/:memberId/freeze', requireSuperAdmin, BVWalletController.setWalletFrozen);
router.get('/admin/returns', requireSuperAdmin, BVWalletController.getAllReturns);
router.post('/admin/returns/:requestId/approve', requireSuperAdmin, BVWalletController.approveReturn);
router.post('/admin/returns/:requestId/reject', requireSuperAdmin, BVWalletController.rejectReturn);

export default router;
