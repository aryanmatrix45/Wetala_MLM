import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/:memberId', WalletController.getWallet);
router.get('/transactions/:memberId', WalletController.getTransactions);
router.post('/withdraw', authenticate, WalletController.requestWithdrawal);

export default router;
