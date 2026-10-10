import { Router } from 'express';
import { BinaryController } from '../controllers/binary.controller';
import { optionalAuthenticate } from '../middlewares/auth';

const router = Router();

router.get('/tree', optionalAuthenticate, BinaryController.getTree);
router.get('/extremes', optionalAuthenticate, BinaryController.getExtremes);
router.post('/validate-placement', BinaryController.validatePlacement);
router.get('/volume/:memberId', BinaryController.getVolume);
router.get('/ledger/:memberId', BinaryController.getLedger);
router.post('/settle-daily', BinaryController.settleDaily);
router.get('/available-placement/:memberId', BinaryController.findAvailablePlacement);
router.post('/rebalance', BinaryController.rebalance);

export default router;
