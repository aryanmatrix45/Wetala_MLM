import { Router } from 'express';
import { CompanyAccountController } from '../controllers/companyAccount.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Get Company Account Details (Read-only for all authenticated users: Admin & Members)
router.get('/', authenticate, CompanyAccountController.getAccount);

// Update Company Account Details (Admin / SuperAdmin Only)
router.put('/', authenticate, CompanyAccountController.updateAccount);
router.post('/', authenticate, CompanyAccountController.updateAccount);

// Upload QR Code Image (Admin / SuperAdmin Only)
router.post('/upload-qr', authenticate, CompanyAccountController.uploadQRCode);

// Remove QR Code Image (Admin / SuperAdmin Only)
router.delete('/qr', authenticate, CompanyAccountController.removeQRCode);

export default router;
