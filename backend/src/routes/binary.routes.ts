import { Router } from 'express';
import { BinaryController } from '../controllers/binary.controller';

const router = Router();

router.get('/tree', BinaryController.getTree);
router.post('/validate-placement', BinaryController.validatePlacement);
router.get('/volume/:memberId', BinaryController.getVolume);
router.get('/available-placement/:memberId', BinaryController.findAvailablePlacement);

export default router;
