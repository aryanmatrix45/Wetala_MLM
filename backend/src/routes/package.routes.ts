import { Router } from 'express';
import { PackageController } from '../controllers/package.controller';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

router.get('/', PackageController.getPackages);
router.post('/', authenticate, requireAdmin, PackageController.createPackage);
router.put('/:packageId', authenticate, requireAdmin, PackageController.updatePackage);
router.delete('/:packageId', authenticate, requireAdmin, PackageController.deletePackage);
router.post('/buy', authenticate, PackageController.buyPackage);

export default router;
