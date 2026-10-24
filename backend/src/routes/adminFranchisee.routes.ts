import { Router } from 'express';
import { FranchiseeController } from '../controllers/franchisee.controller';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';

const router = Router();

// SuperAdmin authentication required for all franchisee management endpoints
router.use(authenticate, requireSuperAdmin);

// Stores
router.get('/stores', FranchiseeController.adminListStores);
router.post('/stores', FranchiseeController.adminCreateStore);
router.put('/stores/:id', FranchiseeController.adminUpdateStore);
router.delete('/stores/:id', FranchiseeController.adminDeleteStore);
router.post('/stores/:id/assign', FranchiseeController.adminAssignStore);
router.post('/stores/:id/unassign', FranchiseeController.adminUnassignStore);

// Member search (by Member ID or name) for assigning stores
router.get('/members/search', FranchiseeController.adminSearchMembers);

// Member requests
router.get('/requests', FranchiseeController.adminListRequests);
router.post('/requests/:id/approve', FranchiseeController.adminApproveRequest);
router.post('/requests/:id/reject', FranchiseeController.adminRejectRequest);

export default router;
