import { Router } from 'express';
import authRoutes from './auth.routes';
import mlmRoutes from './mlm.routes';
import binaryRoutes from './binary.routes';
import sponsorRoutes from './sponsor.routes';
import compensationRoutes from './compensation.routes';
import purchaseRoutes from './purchase.routes';
import packageRoutes from './package.routes';
import productRoutes from './product.routes';
import adminProductRoutes from './adminProduct.routes';
import categoryRoutes from './category.routes';
import subcategoryRoutes from './subcategory.routes';
import adminCategoryRoutes from './adminCategory.routes';
import adminSubcategoryRoutes from './adminSubcategory.routes';
import walletRoutes from './wallet.routes';
import reportRoutes from './report.routes';
import welcomeBonusRoutes from './welcomeBonus.routes';
import withdrawalRoutes from './withdrawal.routes';

const router = Router();

// Authentication & Profile
router.use('/auth', authRoutes);

// Binary Tree & Placements
router.use('/binary', binaryRoutes);

// Sponsor Tree & Unilevel
router.use('/sponsor', sponsorRoutes);

// Compensation Rules, Simulator, Commissions, Explanation
router.use('/compensation', compensationRoutes);

// Standalone Welcome Bonus System
router.use('/welcome-bonus', welcomeBonusRoutes);

// Purchases, Joining, Repurchase & Reversals
router.use('/purchases', purchaseRoutes);

// Joining & Repurchase Packages
router.use('/packages', packageRoutes);

// Products & Stock Inventory (Members / Public)
router.use('/products', productRoutes);

// Product Management (SuperAdmin)
router.use('/admin/products', adminProductRoutes);

// Categories & Subcategories (Members / Public)
router.use('/categories', categoryRoutes);
router.use('/subcategories', subcategoryRoutes);

// Category & Subcategory Management (SuperAdmin)
router.use('/admin/categories', adminCategoryRoutes);
router.use('/admin/subcategories', adminSubcategoryRoutes);

// Wallets & Transactions
router.use('/wallet', walletRoutes);

// Member & Admin Withdrawal Requests & Notifications
router.use('/withdrawals', withdrawalRoutes);

// Reports, Analytics & Audits
router.use('/reports', reportRoutes);

// MLM Legacy & Core endpoints
router.use('/', mlmRoutes);

export default router;
