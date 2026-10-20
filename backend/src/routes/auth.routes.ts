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

// Public Sponsor Lookup (Pre-registration / Referral link)
router.get('/sponsor-lookup/:sponsorId', AuthController.sponsorLookup);
router.get('/sponsor-lookup', AuthController.sponsorLookup);
router.get('/root-sponsor', AuthController.getRootSponsor);

// Check if SuperAdmin exists in database
router.get('/superadmin-status', AuthController.getSuperAdminStatus);

// Authenticated SuperAdmin profile
router.get('/me', authenticate, AuthController.getProfile);

// Update SuperAdmin profile information
router.put('/profile', authenticate, AuthController.updateProfile);

// Member: update own nominee details (email & phone are not editable)
router.patch('/profile/nominee', authenticate, AuthController.updateNominee);

export default router;
