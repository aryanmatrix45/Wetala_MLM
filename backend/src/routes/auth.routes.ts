import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// One-time SuperAdmin setup
router.post('/setup-superadmin', AuthController.setupSuperAdmin);

// SuperAdmin / Admin login
router.post('/login', AuthController.login);

// Public Member Registration / Signup
router.post('/register', AuthController.register);

// Check if SuperAdmin exists in database
router.get('/superadmin-status', AuthController.getSuperAdminStatus);

// Authenticated SuperAdmin profile
router.get('/me', authenticate, AuthController.getProfile);

// Update SuperAdmin profile information
router.put('/profile', authenticate, AuthController.updateProfile);

export default router;
