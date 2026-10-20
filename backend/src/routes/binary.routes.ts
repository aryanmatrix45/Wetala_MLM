import { Router } from 'express';
import { BinaryController } from '../controllers/binary.controller';
import { BinaryIncomeController } from '../controllers/binaryIncome.controller';
import { authenticate, optionalAuthenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// Tree and placement
router.get('/tree', optionalAuthenticate, BinaryController.getTree);
router.get('/extremes', optionalAuthenticate, BinaryController.getExtremes);
router.post('/validate-placement', BinaryController.validatePlacement);
router.get('/preview-placement', optionalAuthenticate, BinaryController.previewPlacement);
router.get('/available-placement/:memberId', BinaryController.findAvailablePlacement);
router.post('/rebalance', authenticate, requireSuperAdmin, BinaryController.rebalance);

// Binary income (own or downline data for members, everything for the Super Admin)
router.get('/volume/:memberId', authenticate, BinaryIncomeController.getVolume);
router.get('/today/:memberId', authenticate, BinaryIncomeController.getToday);
router.get('/daily/:memberId', authenticate, BinaryIncomeController.getDailyHistory);
router.get('/ledger/:memberId', authenticate, BinaryIncomeController.getLedger);
router.get('/leaderboard', authenticate, BinaryIncomeController.getLeaderboard);

// Daily settlement (Super Admin)
router.get('/settlements', authenticate, requireSuperAdmin, BinaryIncomeController.listSettlements);
router.get('/settlements/:date', authenticate, requireSuperAdmin, BinaryIncomeController.getSettlement);
router.post('/settle-daily', authenticate, requireSuperAdmin, BinaryIncomeController.settleDaily);

export default router;
