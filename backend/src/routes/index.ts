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
import teamPerformanceBonusRoutes from './teamPerformanceBonus.routes';
import withdrawalRoutes from './withdrawal.routes';
import companyAccountRoutes from './companyAccount.routes';
import sliderRoutes from './slider.routes';
import adminSliderRoutes from './adminSlider.routes';
import socialMediaRoutes from './socialMedia.routes';
import adminSocialMediaRoutes from './adminSocialMedia.routes';
import aboutSectionRoutes from './aboutSection.routes';
import adminAboutSectionRoutes from './adminAboutSection.routes';
import homeVideoRoutes from './homeVideo.routes';
import adminHomeVideoRoutes from './adminHomeVideo.routes';
import footerRoutes from './footer.routes';
import adminFooterRoutes from './adminFooter.routes';
import kycRoutes from './kyc.routes';
import bvWalletRoutes from './bvWallet.routes';
import bvSummaryRoutes from './bvSummary.routes';

const router = Router();

// Footer & Company Information (Members / Public)
router.use('/footer', footerRoutes);

// Footer & Company Information Management (SuperAdmin)
router.use('/admin/footer', adminFooterRoutes);

// Video Showcase Section (Members / Public)
router.use('/home-videos', homeVideoRoutes);

// Video Showcase Management (SuperAdmin)
router.use('/admin/home-videos', adminHomeVideoRoutes);

// About Us Section (Members / Public)
router.use('/about-sections', aboutSectionRoutes);

// About Us Section Management (SuperAdmin)
router.use('/admin/about-sections', adminAboutSectionRoutes);

// Social Media Links (Members / Public)
router.use('/social-links', socialMediaRoutes);

// Social Media Management (SuperAdmin)
router.use('/admin/social-links', adminSocialMediaRoutes);

// Home Sliders (Members / Public)
router.use('/sliders', sliderRoutes);

// Slider Management (SuperAdmin)
router.use('/admin/sliders', adminSliderRoutes);

// Company Official Payment Account & QR Code Details (Admin Configurable / Member View-Only)
router.use('/company-account', companyAccountRoutes);

// Authentication & Profile
router.use('/auth', authRoutes);

// Member KYC (bank, payment & identity documents)
router.use('/kyc', kycRoutes);

// Binary Tree & Placements
router.use('/binary', binaryRoutes);

// Sponsor Tree & Unilevel
router.use('/sponsor', sponsorRoutes);

// Compensation Rules, Simulator, Commissions, Explanation
router.use('/compensation', compensationRoutes);

// Standalone Welcome Bonus System
router.use('/welcome-bonus', welcomeBonusRoutes);

// Team Performance Bonus (RP milestones, CTO pools; SuperAdmin settings and member view)
router.use('/team-performance', teamPerformanceBonusRoutes);

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

// BV Wallet: generation, PIN-confirmed transfers & history
router.use('/bv-wallet', bvWalletRoutes);

// Member Total Business Volume (personal + BV Wallet, team shown separately)
router.use('/bv-summary', bvSummaryRoutes);

// Member & Admin Withdrawal Requests & Notifications
router.use('/withdrawals', withdrawalRoutes);

// Reports, Analytics & Audits
router.use('/reports', reportRoutes);

// MLM Legacy & Core endpoints
router.use('/', mlmRoutes);

export default router;
