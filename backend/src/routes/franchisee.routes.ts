import { Router } from 'express';
import { FranchiseeController } from '../controllers/franchisee.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Member: own store, available stores and own requests
router.get('/', authenticate, FranchiseeController.getMemberOverview);

// Member: request to buy an available store
router.post('/requests', authenticate, FranchiseeController.createRequest);

export default router;
