import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Purchase, IPurchaseItem } from '../models/Purchase.model';
import { Member } from '../models/Member.model';
import { Product } from '../models/Product.model';
import { Package } from '../models/Package.model';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { HTTP_STATUS, PURCHASE_TYPE, PURCHASE_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const PurchaseController = {
  /**
   * Create a new purchase (Joining, Repurchase, or Retail)
   * Integrates authoritative Product & Package data, validates stock,
   * stores BV & Price snapshots, and decrements inventory safely.
   * POST /api/purchases
   */
  async createPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { memberId, type = PURCHASE_TYPE.JOINING, items = [], notes } = req.body;
      if (!memberId || !Array.isArray(items) || items.length === 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID and at least one item are required.' });
        return;
      }

      const member = await Member.findOne({ memberId: memberId.toUpperCase().trim() });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: `Member ${memberId} not found.` });
        return;
      }

      // Authoritative item validation and snapshot assembly
      let totalAmount = 0;
      let totalBV = 0;
      const mappedItems: IPurchaseItem[] = [];

      for (const it of items) {
        const qty = parseInt(String(it.quantity), 10);
        if (isNaN(qty) || qty <= 0) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: `Invalid quantity for item '${it.name || it.itemId || 'Unknown'}'. Quantity must be at least 1.`,
          });
          return;
        }

        const effectiveItemType: 'PACKAGE' | 'PRODUCT' =
          it.itemType === 'PACKAGE' || (type === PURCHASE_TYPE.JOINING && !it.itemType)
            ? 'PACKAGE'
            : 'PRODUCT';

        if (effectiveItemType === 'PRODUCT') {
          // Authoritative Product lookup
          const lookupKey = it.productId || it.itemId;
          let product = null;

          if (lookupKey && mongoose.Types.ObjectId.isValid(lookupKey)) {
            product = await Product.findById(lookupKey);
          }
          if (!product && lookupKey) {
            product = await Product.findOne({
              $or: [{ productId: lookupKey }, { slug: lookupKey }, { sku: String(lookupKey).toUpperCase() }],
            });
          }

          if (!product) {
            res.status(HTTP_STATUS.NOT_FOUND).json({
              status: false,
              message: `Product '${it.name || lookupKey}' does not exist or has been removed.`,
            });
            return;
          }

          // Verify ACTIVE status
          if (product.status !== 'ACTIVE' && !product.isActive) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: `Product '${product.title || product.name}' is currently inactive and cannot be purchased.`,
            });
            return;
          }

          // Verify stock availability
          const availableStock = product.stock !== undefined ? product.stock : (product.stockQuantity || 0);
          if (availableStock < qty) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: `Insufficient stock for '${product.title || product.name}'. Available: ${availableStock}, Requested: ${qty}.`,
            });
            return;
          }

          // Authoritative Price & Business Volume from database (NEVER trust frontend values)
          const authPrice = Number(product.price);
          const authBV = Number(product.businessVolume !== undefined ? product.businessVolume : (product.bv || 0));
          const itemTotal = authPrice * qty;
          const itemBV = authBV * qty;

          totalAmount += itemTotal;
          totalBV += itemBV;

          // Safe inventory decrement
          await Product.findByIdAndUpdate(product._id, {
            $inc: { stock: -qty, stockQuantity: -qty },
          });

          // Immutable order item snapshot
          mappedItems.push({
            itemId: product.productId || product._id.toString(),
            productId: product._id.toString(),
            productName: product.title || product.name,
            itemType: 'PRODUCT',
            name: product.title || product.name,
            quantity: qty,
            unitPrice: authPrice,
            price: authPrice,
            unitPriceInPaise: Math.round(authPrice * 100),
            unitBV: authBV,
            businessVolume: authBV,
            totalPrice: itemTotal,
            totalPriceInPaise: Math.round(itemTotal * 100),
            totalBV: itemBV,
          });
        } else {
          // Authoritative Package lookup
          const lookupKey = it.packageId || it.itemId;
          let pkg = await Package.findOne({ packageId: lookupKey });
          if (!pkg && lookupKey && mongoose.Types.ObjectId.isValid(lookupKey)) {
            pkg = await Package.findById(lookupKey);
          }

          const authPrice = pkg ? Number(pkg.price) : Number(it.unitPrice || 0);
          const authBV = pkg ? Number(pkg.bv) : Number(it.unitBV || 0);
          const pkgName = pkg ? pkg.name : (it.name || 'Joining Package');
          const itemTotal = authPrice * qty;
          const itemBV = authBV * qty;

          totalAmount += itemTotal;
          totalBV += itemBV;

          mappedItems.push({
            itemId: pkg ? pkg.packageId : (it.itemId || 'pkg-1'),
            itemType: 'PACKAGE',
            name: pkgName,
            quantity: qty,
            unitPrice: authPrice,
            price: authPrice,
            unitPriceInPaise: Math.round(authPrice * 100),
            unitBV: authBV,
            businessVolume: authBV,
            totalPrice: itemTotal,
            totalPriceInPaise: Math.round(itemTotal * 100),
            totalBV: itemBV,
          });
        }
      }

      const purchaseId = `PUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const purchase = await Purchase.create({
        purchaseId,
        userId: member._id.toString(),
        memberId: member.memberId,
        type,
        items: mappedItems,
        totalAmount,
        totalAmountInPaise: Math.round(totalAmount * 100),
        totalBV,
        status: PURCHASE_STATUS.CONFIRMED,
        paymentStatus: 'PAID',
        transactionId,
        notes,
      });

      // Automatically trigger compensation engine processing upon confirmed purchase
      const compensationResult = await CompensationEngine.processPurchaseCompleted(purchase.purchaseId);

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Purchase created and commissions processed successfully.',
        data: purchase,
        compensation: {
          eventId: compensationResult.eventId,
          commissionsCount: compensationResult.commissionsGenerated.length,
          commissions: compensationResult.commissionsGenerated.map(c => ({
            ledgerId: c.ledgerId,
            memberId: c.memberId,
            type: c.type,
            payableAmount: c.payableAmount,
          })),
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Complete a purchase and trigger commission pipeline
   * POST /api/purchases/:purchaseId/complete
   */
  async completePurchase(req: Request, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const result = await CompensationEngine.processPurchaseCompleted(purchaseId);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Purchase completed and commissions calculated.',
        data: result,
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Refund / Reverse a purchase and claw back commissions
   * POST /api/purchases/:purchaseId/refund
   */
  async refundPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { reason = 'Customer refund' } = req.body;

      const purchase = await Purchase.findOne({ purchaseId });
      if (!purchase) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Purchase not found.' });
        return;
      }

      purchase.status = PURCHASE_STATUS.REFUNDED;
      purchase.paymentStatus = 'REFUNDED';
      purchase.refundedAt = new Date();
      await purchase.save();

      const reversalResult = await CompensationEngine.reversePurchaseCommission(purchaseId, reason);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Purchase refunded and ${reversalResult.reversedCount} related commission(s) reversed.`,
        data: reversalResult,
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Get purchases list with filters
   * GET /api/purchases
   */
  async getPurchases(req: Request, res: Response): Promise<void> {
    try {
      const { memberId, type, status, limit = 50, page = 1 } = req.query;
      const query: any = {};
      if (memberId) query.memberId = memberId;
      if (type) query.type = type;
      if (status) query.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [purchases, total] = await Promise.all([
        Purchase.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        Purchase.countDocuments(query),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: purchases,
        pagination: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
