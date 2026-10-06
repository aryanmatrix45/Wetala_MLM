import { Request, Response } from 'express';
import { Package } from '../models/Package.model';
import { Member } from '../models/Member.model';
import { Purchase } from '../models/Purchase.model';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { AuditService } from '../services/AuditService';
import { HTTP_STATUS, PURCHASE_TYPE, PURCHASE_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const defaultPackages = [
  {
    packageId: 'PKG-1',
    packageNumber: 1,
    name: 'Package 1',
    badge: 'STARTER',
    isPopular: false,
    price: 3000,
    bv: 1250,
    rp: 1,
    dailyCapping: 4000,
    type: PURCHASE_TYPE.JOINING,
    description: '1,250 B.V. — 1 RP — Daily Capping ₹4,000',
    features: [
      '1,250 Business Volume (BV) allocated',
      '1 RP reward qualification point',
      'Daily Binary Payout Cap: ₹ 4,000',
      'Binary placement eligible (Left / Right)',
      'Standard 20% binary matching payout',
    ],
    isActive: true,
  },
  {
    packageId: 'PKG-2',
    packageNumber: 2,
    name: 'Package 2',
    badge: 'EXECUTIVE',
    isPopular: true,
    price: 6500,
    bv: 2500,
    rp: 2,
    dailyCapping: 8000,
    type: PURCHASE_TYPE.JOINING,
    description: '2,500 B.V. — 2 RP — Daily Capping ₹8,000',
    features: [
      '2,500 Business Volume (BV) allocated',
      '2 RP reward qualification points',
      'Daily Binary Payout Cap: ₹ 8,000',
      'Eligible for consultancy bonus & pools',
      'Direct sponsor binary matching payout',
    ],
    isActive: true,
  },
  {
    packageId: 'PKG-3',
    packageNumber: 3,
    name: 'Package 3',
    badge: 'PROFESSIONAL',
    isPopular: false,
    price: 15000,
    bv: 5000,
    rp: 4,
    dailyCapping: 12000,
    type: PURCHASE_TYPE.JOINING,
    description: '5,000 B.V. — 4 RP — Daily Capping ₹12,000',
    features: [
      '5,000 Business Volume (BV) allocated',
      '4 RP reward qualification points',
      'Daily Binary Payout Cap: ₹ 12,000',
      'Accelerated team volume propagation',
      'Lifetime rewards milestone tracker',
    ],
    isActive: true,
  },
  {
    packageId: 'PKG-4',
    packageNumber: 4,
    name: 'Package 4',
    badge: 'ELITE VIP',
    isPopular: false,
    price: 35000,
    bv: 10000,
    rp: 8,
    dailyCapping: 16000,
    type: PURCHASE_TYPE.JOINING,
    description: '10,000 B.V. — 8 RP — Daily Capping ₹16,000',
    features: [
      '10,000 Business Volume (BV) allocated',
      '8 RP reward qualification points',
      'Maximum Daily Payout Cap: ₹ 16,000',
      'High-tier royalty pool qualification',
      'Priority rank advancement & stockist ready',
    ],
    isActive: true,
  },
];

export const PackageController = {
  /**
   * Get all packages (active or all for admin)
   * GET /api/packages
   */
  async getPackages(req: Request, res: Response): Promise<void> {
    try {
      let packages = await Package.find().sort({ packageNumber: 1, price: 1 });
      if (packages.length === 0) {
        // Auto-seed default packages aligned with Image 2 (Somras Package)
        for (const pkg of defaultPackages) {
          await Package.create({
            ...pkg,
            priceInPaise: Math.round(pkg.price * 100),
          });
        }
        packages = await Package.find().sort({ packageNumber: 1, price: 1 });
      }

      res.status(HTTP_STATUS.OK).json({ status: true, data: packages });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin create a package
   * POST /api/packages
   */
  async createPackage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        badge = 'STARTER',
        price,
        bv,
        rp = 1,
        dailyCapping = 4000,
        packageNumber,
        type = PURCHASE_TYPE.JOINING,
        description,
        features = [],
        isPopular = false,
      } = req.body;

      if (!name || price === undefined || bv === undefined) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Name, price, and BV are required.' });
        return;
      }

      const totalCount = await Package.countDocuments();
      const num = packageNumber ? Number(packageNumber) : totalCount + 1;
      const packageId = `PKG-${Date.now().toString(36).toUpperCase()}`;

      const newPkg = await Package.create({
        packageId,
        packageNumber: num,
        name: name.trim(),
        badge: (badge || 'STARTER').trim().toUpperCase(),
        price: Number(price),
        priceInPaise: Math.round(Number(price) * 100),
        bv: Number(bv),
        rp: Number(rp),
        dailyCapping: Number(dailyCapping),
        type,
        description: description ? description.trim() : `${Number(bv).toLocaleString()} B.V. — ${rp} RP — Daily Capping ₹${Number(dailyCapping).toLocaleString()}`,
        features: Array.isArray(features) ? features : [],
        isPopular: Boolean(isPopular),
        isActive: true,
      });

      await AuditService.log({
        action: 'CREATE_PACKAGE',
        entity: 'PACKAGE',
        entityId: newPkg.packageId,
        performedBy: req.user ? req.user.email : 'ADMIN',
        newValues: newPkg.toObject(),
      });

      res.status(HTTP_STATUS.CREATED).json({ status: true, data: newPkg, message: 'Package created successfully.' });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin update a package
   * PUT /api/packages/:packageId
   */
  async updatePackage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packageId } = req.params;
      const pkg = await Package.findOne({ packageId });
      if (!pkg) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Package not found.' });
        return;
      }

      const oldValues = pkg.toObject();
      const {
        name,
        badge,
        price,
        bv,
        rp,
        dailyCapping,
        packageNumber,
        isActive,
        description,
        features,
        isPopular,
      } = req.body;

      if (name !== undefined) pkg.name = name.trim();
      if (badge !== undefined) pkg.badge = badge.trim().toUpperCase();
      if (price !== undefined) {
        pkg.price = Number(price);
        pkg.priceInPaise = Math.round(Number(price) * 100);
      }
      if (bv !== undefined) pkg.bv = Number(bv);
      if (rp !== undefined) pkg.rp = Number(rp);
      if (dailyCapping !== undefined) pkg.dailyCapping = Number(dailyCapping);
      if (packageNumber !== undefined) pkg.packageNumber = Number(packageNumber);
      if (isActive !== undefined) pkg.isActive = Boolean(isActive);
      if (description !== undefined) pkg.description = description;
      if (features !== undefined && Array.isArray(features)) pkg.features = features;
      if (isPopular !== undefined) pkg.isPopular = Boolean(isPopular);

      await pkg.save();

      await AuditService.log({
        action: 'UPDATE_PACKAGE',
        entity: 'PACKAGE',
        entityId: pkg.packageId,
        performedBy: req.user ? req.user.email : 'ADMIN',
        oldValues,
        newValues: pkg.toObject(),
      });

      res.status(HTTP_STATUS.OK).json({ status: true, data: pkg, message: 'Package rules updated successfully.' });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin delete / deactivate a package
   * DELETE /api/packages/:packageId
   */
  async deletePackage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packageId } = req.params;
      const isHard = req.query.hard === 'true';
      const pkg = await Package.findOne({ packageId });
      if (!pkg) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Package not found.' });
        return;
      }

      if (isHard) {
        await Package.deleteOne({ packageId });
      } else {
        pkg.isActive = false;
        await pkg.save();
      }

      await AuditService.log({
        action: isHard ? 'DELETE_PACKAGE' : 'DEACTIVATE_PACKAGE',
        entity: 'PACKAGE',
        entityId: pkg.packageId,
        performedBy: req.user ? req.user.email : 'ADMIN',
        newValues: isHard ? {} : { isActive: false },
      });

      res.status(HTTP_STATUS.OK).json({ 
        status: true, 
        message: isHard ? `Package ${pkg.name} deleted permanently.` : `Package ${pkg.name} deactivated successfully.` 
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Member buy / activate a package
   * POST /api/packages/buy
   */
  async buyPackage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { packageId } = req.body;
      if (!packageId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Package ID is required.' });
        return;
      }

      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ status: false, message: 'Authentication required.' });
        return;
      }

      const pkg = await Package.findOne({ packageId, isActive: true });
      if (!pkg) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Selected package is not active or not found.' });
        return;
      }

      // Find member by user ID or email
      let member = await Member.findOne({
        $or: [{ _id: req.user.id }, { email: req.user.email.toLowerCase() }],
      });

      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member account not found.' });
        return;
      }

      // Update Member Package details
      member.packageName = pkg.name;
      member.joiningPackageId = pkg.packageId;
      member.packageBv = pkg.bv;
      member.packageRp = pkg.rp;
      member.dailyCapping = pkg.dailyCapping;
      member.status = 'active';
      member.isActive = true;
      await member.save();

      // Create purchase transaction record
      const purchaseId = `PUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const purchase = await Purchase.create({
        purchaseId,
        userId: member._id.toString(),
        memberId: member.memberId,
        type: PURCHASE_TYPE.JOINING,
        items: [
          {
            itemId: pkg.packageId,
            itemType: 'PACKAGE',
            name: pkg.name,
            quantity: 1,
            unitPrice: pkg.price,
            unitPriceInPaise: pkg.priceInPaise || Math.round(pkg.price * 100),
            unitBV: pkg.bv,
            totalPrice: pkg.price,
            totalPriceInPaise: pkg.priceInPaise || Math.round(pkg.price * 100),
            totalBV: pkg.bv,
          },
        ],
        totalAmount: pkg.price,
        totalAmountInPaise: pkg.priceInPaise || Math.round(pkg.price * 100),
        totalBV: pkg.bv,
        status: PURCHASE_STATUS.COMPLETED,
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        notes: `Dynamic package purchase: ${pkg.name}`,
      });

      // Distribute volume into binary tree & calculate commissions
      try {
        await CompensationEngine.processPurchaseCompleted(purchase.purchaseId);
      } catch (compErr) {
        console.warn('[buyPackage] Compensation calculation notice:', compErr);
      }

      await AuditService.log({
        action: 'MEMBER_BUY_PACKAGE',
        entity: 'PURCHASE',
        entityId: purchase.purchaseId,
        performedBy: member.email,
        newValues: {
          memberId: member.memberId,
          packageId: pkg.packageId,
          packageName: pkg.name,
          bv: pkg.bv,
          rp: pkg.rp,
          price: pkg.price,
        },
      });

      const isUpgrade = Boolean(member.packageName && member.packageName !== pkg.name);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: isUpgrade ? `Successfully upgraded to ${pkg.name}!` : `Successfully purchased ${pkg.name}!`,
        data: {
          memberId: member.memberId,
          packageName: member.packageName,
          joiningPackageId: member.joiningPackageId,
          packageBv: member.packageBv,
          packageRp: member.packageRp,
          dailyCapping: member.dailyCapping,
          purchaseId: purchase.purchaseId,
        },
      });
    } catch (error: any) {
      console.error('[buyPackage] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
