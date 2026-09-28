import { Router } from 'express';
import { PackageController } from '../controllers/package.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', PackageController.getPackages);
router.post('/', authenticate, PackageController.createPackage);
router.put('/:packageId', authenticate, PackageController.updatePackage);

export default router;
