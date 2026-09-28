import { Request, Response } from 'express';
import { Package } from '../models/Package.model';
import { AuditService } from '../services/AuditService';
import { HTTP_STATUS, PURCHASE_TYPE } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const defaultPackages = [
  { packageId: 'PKG-1', name: 'Package 1', price: 3000, bv: 1250, dailyCapping: 4000, type: PURCHASE_TYPE.JOINING, isActive: true },
  { packageId: 'PKG-2', name: 'Package 2', price: 6500, bv: 2500, dailyCapping: 4000, type: PURCHASE_TYPE.JOINING, isActive: true },
  { packageId: 'PKG-3', name: 'Package 3', price: 12000, bv: 5000, dailyCapping: 8000, type: PURCHASE_TYPE.JOINING, isActive: true },
  { packageId: 'PKG-4', name: 'Package 4', price: 24000, bv: 10000, dailyCapping: 15000, type: PURCHASE_TYPE.JOINING, isActive: true },
];

export const PackageController = {
  /**
   * Get all active packages
   * GET /api/packages
   */
  async getPackages(_req: Request, res: Response): Promise<void> {
    try {
      let packages = await Package.find().sort({ price: 1 });
      if (packages.length === 0) {
        // Auto-seed default packages from handwritten compensation plan
        for (const pkg of defaultPackages) {
          await Package.create({
            ...pkg,
            priceInPaise: pkg.price * 100,
          });
        }
        packages = await Package.find().sort({ price: 1 });
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
      const { name, price, bv, dailyCapping, type = PURCHASE_TYPE.JOINING, description } = req.body;
      if (!name || price === undefined || bv === undefined) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Name, price, and BV are required.' });
        return;
      }

      const packageId = `PKG-${Date.now().toString(36).toUpperCase()}`;
      const newPkg = await Package.create({
        packageId,
        name,
        price,
        priceInPaise: Math.round(price * 100),
        bv,
        dailyCapping: dailyCapping || 4000,
        type,
        description,
        isActive: true,
      });

      await AuditService.log({
        action: 'CREATE_PACKAGE',
        entity: 'PACKAGE',
        entityId: newPkg.packageId,
        performedBy: req.user ? req.user.email : 'ADMIN',
        newValues: newPkg.toObject(),
      });

      res.status(HTTP_STATUS.CREATED).json({ status: true, data: newPkg });
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
      const { name, price, bv, dailyCapping, isActive, description } = req.body;

      if (name !== undefined) pkg.name = name;
      if (price !== undefined) {
        pkg.price = price;
        pkg.priceInPaise = Math.round(price * 100);
      }
      if (bv !== undefined) pkg.bv = bv;
      if (dailyCapping !== undefined) pkg.dailyCapping = dailyCapping;
      if (isActive !== undefined) pkg.isActive = isActive;
      if (description !== undefined) pkg.description = description;

      await pkg.save();

      await AuditService.log({
        action: 'UPDATE_PACKAGE',
        entity: 'PACKAGE',
        entityId: pkg.packageId,
        performedBy: req.user ? req.user.email : 'ADMIN',
        oldValues,
        newValues: pkg.toObject(),
      });

      res.status(HTTP_STATUS.OK).json({ status: true, data: pkg });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
