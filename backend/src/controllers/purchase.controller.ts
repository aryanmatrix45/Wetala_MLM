import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Purchase, IPurchaseItem, PurchaseApprovalStage } from '../models/Purchase.model';
import { Member } from '../models/Member.model';
import { Product } from '../models/Product.model';
import { Package } from '../models/Package.model';
import { CompanyAccount } from '../models/CompanyAccount.model';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { AuditService } from '../services/AuditService';
import { HTTP_STATUS, PURCHASE_TYPE, PURCHASE_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const PurchaseController = {
  /**
   * 1. Member initiates a purchase request (Package or Product repurchase)
   * POST /api/purchases/request
   */
  async requestPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { memberId: rawMemberId, type = PURCHASE_TYPE.JOINING, items = [], notes } = req.body;
      const targetMemberId = (rawMemberId || req.user?.memberId || '').toUpperCase().trim();

      if (!targetMemberId || !Array.isArray(items) || items.length === 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Member ID and at least one item are required to submit purchase request.',
        });
        return;
      }

      const member = await Member.findOne({ memberId: targetMemberId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Member ${targetMemberId} not found.`,
        });
        return;
      }

      let totalAmount = 0;
      let totalBV = 0;
      const mappedItems: IPurchaseItem[] = [];

      for (const it of items) {
        const qty = parseInt(String(it.quantity || 1), 10);
        if (isNaN(qty) || qty <= 0) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: `Invalid quantity for item '${it.name || it.itemId || 'Item'}'.`,
          });
          return;
        }

        const effectiveItemType: 'PACKAGE' | 'PRODUCT' =
          it.itemType === 'PACKAGE' || (type === PURCHASE_TYPE.JOINING && !it.itemType)
            ? 'PACKAGE'
            : 'PRODUCT';

        if (effectiveItemType === 'PRODUCT') {
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

          if (product.status !== 'ACTIVE' && !product.isActive) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: `Product '${product.title || product.name}' is currently inactive.`,
            });
            return;
          }

          const availableStock = product.stock !== undefined ? product.stock : (product.stockQuantity || 0);
          if (availableStock < qty) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: `Insufficient stock for '${product.title || product.name}'. Available: ${availableStock}, Requested: ${qty}.`,
            });
            return;
          }

          const authPrice = Number(product.price);
          const authBV = Number(product.businessVolume !== undefined ? product.businessVolume : (product.bv || 0));
          const itemTotal = authPrice * qty;
          const itemBV = authBV * qty;

          totalAmount += itemTotal;
          totalBV += itemBV;

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
          if (!pkg && lookupKey) {
            pkg = await Package.findOne({
              $or: [{ name: lookupKey }, { name: new RegExp(`^${lookupKey}$`, 'i') }],
            });
          }

          if (!pkg) {
            res.status(HTTP_STATUS.NOT_FOUND).json({
              status: false,
              message: `Selected Package '${lookupKey}' not found.`,
            });
            return;
          }

          const authPrice = Number(pkg.price);
          const authBV = Number(pkg.bv);
          const itemTotal = authPrice * qty;
          const itemBV = authBV * qty;

          totalAmount += itemTotal;
          totalBV += itemBV;

          mappedItems.push({
            itemId: pkg.packageId,
            itemType: 'PACKAGE',
            name: pkg.name,
            quantity: qty,
            unitPrice: authPrice,
            price: authPrice,
            unitPriceInPaise: pkg.priceInPaise || Math.round(authPrice * 100),
            unitBV: authBV,
            businessVolume: authBV,
            totalPrice: itemTotal,
            totalPriceInPaise: Math.round(itemTotal * 100),
            totalBV: itemBV,
          });
        }
      }

      const purchaseId = `PUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const tempTxnId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const purchase = await Purchase.create({
        purchaseId,
        userId: member._id.toString(),
        memberId: member.memberId,
        memberName: member.name,
        memberMobile: member.mobile,
        memberEmail: member.email,
        type: mappedItems.some((i) => i.itemType === 'PACKAGE') ? PURCHASE_TYPE.JOINING : PURCHASE_TYPE.REPURCHASE,
        items: mappedItems,
        totalAmount,
        totalAmountInPaise: Math.round(totalAmount * 100),
        totalBV,
        status: PURCHASE_STATUS.PENDING,
        paymentStatus: 'PENDING',
        approvalStage: 'REQUESTED',
        transactionId: tempTxnId,
        notes: notes || `Purchase request initiated by ${member.name} (${member.memberId})`,
      });

      await AuditService.log({
        action: 'MEMBER_REQUEST_PURCHASE',
        entity: 'PURCHASE',
        entityId: purchase.purchaseId,
        performedBy: member.email || member.memberId,
        newValues: {
          memberId: member.memberId,
          totalAmount,
          totalBV,
          itemsCount: mappedItems.length,
          stage: 'REQUESTED',
        },
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Purchase request submitted to Super Admin! Please await payment instructions.',
        data: purchase,
      });
    } catch (error: any) {
      console.error('[PurchaseController.requestPurchase] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * 2. Super Admin approves purchase request & sends payment instructions with Company Bank/UPI/QR
   * POST /api/purchases/:purchaseId/approve-instructions
   */
  async approveInstructions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { adminMessage } = req.body;

      const purchase = await Purchase.findOne({ purchaseId });
      if (!purchase) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Purchase request not found.' });
        return;
      }

      if (purchase.approvalStage !== 'REQUESTED') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Cannot send payment instructions for request in '${purchase.approvalStage}' stage.`,
        });
        return;
      }

      // Fetch authoritative company account details
      const companyAccount = await CompanyAccount.getOrCreateDefault();

      purchase.approvalStage = 'PAYMENT_INSTRUCTIONS_SENT';
      purchase.adminMessage =
        adminMessage?.trim() ||
        companyAccount.depositInstructions ||
        'Please transfer the exact order amount to the company bank or UPI account below, and submit your Transaction/UTR reference number.';
      purchase.companyAccountSnapshot = {
        bankName: companyAccount.bankName,
        accountHolderName: companyAccount.accountHolderName,
        accountNumber: companyAccount.accountNumber,
        ifscCode: companyAccount.ifscCode,
        branchName: companyAccount.branchName,
        accountType: companyAccount.accountType,
        upiId: companyAccount.upiId,
        upiHolderName: companyAccount.upiHolderName,
        qrCodeUrl: companyAccount.qrCodeUrl,
        depositInstructions: companyAccount.depositInstructions,
        supportPhone: companyAccount.supportPhone,
      };

      await purchase.save();

      await AuditService.log({
        action: 'ADMIN_APPROVE_PAYMENT_INSTRUCTIONS',
        entity: 'PURCHASE',
        entityId: purchase.purchaseId,
        performedBy: req.user?.email || 'ADMIN',
        newValues: {
          purchaseId: purchase.purchaseId,
          stage: 'PAYMENT_INSTRUCTIONS_SENT',
        },
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Payment instructions sent to member ${purchase.memberName || purchase.memberId}.`,
        data: purchase,
      });
    } catch (error: any) {
      console.error('[PurchaseController.approveInstructions] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * 3. Member submits transaction ID, payer name, mode, and proof after making payment
   * POST /api/purchases/:purchaseId/submit-payment
   */
  async submitPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { utrNumber, transactionId: rawTxn, payerName, paymentMode = 'UPI', paymentProofUrl, notes } = req.body;

      const effectiveUtr = (utrNumber || rawTxn || '').trim();
      const effectivePayer = (payerName || '').trim();

      if (!effectiveUtr) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Bank UTR / Transaction ID is required to submit payment verification.',
        });
        return;
      }

      if (!effectivePayer) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Payer Full Name is required to verify the payment receipt.',
        });
        return;
      }

      const purchase = await Purchase.findOne({ purchaseId });
      if (!purchase) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Purchase request not found.' });
        return;
      }

      // Allow submission if in REQUESTED or PAYMENT_INSTRUCTIONS_SENT
      if (purchase.approvalStage !== 'PAYMENT_INSTRUCTIONS_SENT' && purchase.approvalStage !== 'REQUESTED') {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Cannot submit payment for request currently in '${purchase.approvalStage}' stage.`,
        });
        return;
      }

      purchase.utrNumber = effectiveUtr;
      purchase.payerName = effectivePayer;
      purchase.paymentMode = paymentMode;
      if (paymentProofUrl) purchase.paymentProofUrl = paymentProofUrl;
      if (notes) purchase.notes = notes;
      purchase.paymentStatus = 'SUBMITTED';
      purchase.approvalStage = 'PAYMENT_SUBMITTED';
      purchase.paymentSubmittedAt = new Date();

      await purchase.save();

      await AuditService.log({
        action: 'MEMBER_SUBMIT_PAYMENT',
        entity: 'PURCHASE',
        entityId: purchase.purchaseId,
        performedBy: req.user?.email || purchase.memberId,
        newValues: {
          purchaseId: purchase.purchaseId,
          utrNumber: effectiveUtr,
          payerName: effectivePayer,
          paymentMode,
          stage: 'PAYMENT_SUBMITTED',
        },
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Payment details submitted successfully! Super Admin will verify and activate your order.',
        data: purchase,
      });
    } catch (error: any) {
      console.error('[PurchaseController.submitPayment] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * 4. Super Admin verifies transaction and marks as Paid
   * Crediting package / BV / capping and processing compensation pipeline
   * POST /api/purchases/:purchaseId/verify-and-pay
   */
  async verifyAndPay(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;

      const purchase = await Purchase.findOne({ purchaseId });
      if (!purchase) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Purchase request not found.' });
        return;
      }

      if (purchase.approvalStage === 'VERIFIED_AND_PAID' || purchase.status === PURCHASE_STATUS.COMPLETED) {
        res.status(HTTP_STATUS.OK).json({
          status: true,
          message: 'This purchase is already verified and marked as paid.',
          data: purchase,
        });
        return;
      }

      const member = await Member.findOne({ memberId: purchase.memberId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Member ${purchase.memberId} not found in database.`,
        });
        return;
      }

      // Check if purchase contains a Package
      const packageItem = purchase.items.find((it) => it.itemType === 'PACKAGE');
      if (packageItem) {
        let pkg = await Package.findOne({ packageId: packageItem.itemId });
        if (!pkg && mongoose.Types.ObjectId.isValid(packageItem.itemId)) {
          pkg = await Package.findById(packageItem.itemId);
        }
        if (!pkg) {
          pkg = await Package.findOne({ name: packageItem.name });
        }

        if (pkg) {
          member.packageName = pkg.name;
          member.joiningPackageId = pkg.packageId;
          member.packageBv = pkg.bv;
          member.packageRp = pkg.rp;
          member.dailyCapping = pkg.dailyCapping;
        } else {
          member.packageName = packageItem.name;
          member.joiningPackageId = packageItem.itemId;
          member.packageBv = packageItem.unitBV;
        }

        member.status = 'active';
        member.isActive = true;
        await member.save();
      }

      // If product repurchase: decrement inventory safely now if not already decremented
      for (const it of purchase.items) {
        if (it.itemType === 'PRODUCT' && it.productId) {
          await Product.findByIdAndUpdate(it.productId, {
            $inc: { stock: -it.quantity, stockQuantity: -it.quantity },
          });
        }
      }

      // Update Purchase status
      purchase.status = PURCHASE_STATUS.COMPLETED;
      purchase.paymentStatus = 'PAID';
      purchase.approvalStage = 'VERIFIED_AND_PAID';
      purchase.verifiedBy = req.user?.email || 'ADMIN';
      purchase.verifiedAt = new Date();
      purchase.completedAt = new Date();
      await purchase.save();

      // Trigger authoritative Compensation Engine to credit BV & volume propagation
      let compensationResult: any = null;
      try {
        compensationResult = await CompensationEngine.processPurchaseCompleted(purchase.purchaseId);
      } catch (compErr) {
        console.warn('[verifyAndPay] Compensation Engine calculation notice:', compErr);
      }

      await AuditService.log({
        action: 'ADMIN_VERIFY_AND_PAY_PURCHASE',
        entity: 'PURCHASE',
        entityId: purchase.purchaseId,
        performedBy: req.user?.email || 'ADMIN',
        newValues: {
          purchaseId: purchase.purchaseId,
          memberId: member.memberId,
          totalAmount: purchase.totalAmount,
          totalBV: purchase.totalBV,
          stage: 'VERIFIED_AND_PAID',
        },
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Payment verified and marked as paid! Business volume of ${purchase.totalBV?.toLocaleString()} BV and package benefits credited to ${member.name} (${member.memberId}).`,
        data: purchase,
        compensation: compensationResult,
      });
    } catch (error: any) {
      console.error('[PurchaseController.verifyAndPay] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * 5. Super Admin rejects purchase request
   * POST /api/purchases/:purchaseId/reject
   */
  async rejectPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { reason = 'Invalid payment details or cancelled by admin.' } = req.body;

      const purchase = await Purchase.findOne({ purchaseId });
      if (!purchase) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Purchase request not found.' });
        return;
      }

      purchase.status = PURCHASE_STATUS.CANCELLED;
      purchase.approvalStage = 'REJECTED';
      purchase.rejectionReason = reason;
      await purchase.save();

      await AuditService.log({
        action: 'ADMIN_REJECT_PURCHASE',
        entity: 'PURCHASE',
        entityId: purchase.purchaseId,
        performedBy: req.user?.email || 'ADMIN',
        newValues: {
          purchaseId: purchase.purchaseId,
          reason,
          stage: 'REJECTED',
        },
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Purchase request ${purchaseId} rejected.`,
        data: purchase,
      });
    } catch (error: any) {
      console.error('[PurchaseController.rejectPurchase] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * 6. Member Purchase History Dossier (Packages & Products in one unified history)
   * GET /api/purchases/member/:memberId/history
   */
  async getMemberHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { memberId } = req.params;
      const cleanMemberId = memberId.toUpperCase().trim();

      const member = await Member.findOne({ memberId: cleanMemberId });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: `Member ${memberId} not found.` });
        return;
      }

      const purchases = await Purchase.find({ memberId: cleanMemberId }).sort({ createdAt: -1 });

      const totalSpent = purchases
        .filter((p) => p.paymentStatus === 'PAID')
        .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

      const totalBvCredited = purchases
        .filter((p) => p.paymentStatus === 'PAID')
        .reduce((sum, p) => sum + (p.totalBV || 0), 0);

      const packagePurchases = purchases.filter((p) => p.items.some((i) => i.itemType === 'PACKAGE'));
      const productPurchases = purchases.filter((p) => p.items.some((i) => i.itemType === 'PRODUCT'));

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          member: {
            memberId: member.memberId,
            name: member.name,
            email: member.email,
            mobile: member.mobile,
            currentPackage: member.packageName || 'No Package',
            currentPackageId: member.joiningPackageId || null,
            dailyCapping: member.dailyCapping || 4000,
            personalBv: member.personalBv || 0,
            status: member.status,
          },
          summary: {
            totalRequests: purchases.length,
            totalSpent,
            totalBvCredited,
            packageRequestsCount: packagePurchases.length,
            productRequestsCount: productPurchases.length,
          },
          history: purchases,
        },
      });
    } catch (error: any) {
      console.error('[PurchaseController.getMemberHistory] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * 7. Legacy Direct Complete (e.g. for testing / direct admin actions)
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
   * 8. Refund / Reverse a purchase
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
   * 9. Get purchases list with comprehensive filters & search
   * GET /api/purchases
   */
  async getPurchases(req: Request, res: Response): Promise<void> {
    try {
      const { memberId, type, status, stage, search, limit = 200, page = 1 } = req.query;
      const conditions: any[] = [];

      if (memberId) conditions.push({ memberId: String(memberId).toUpperCase().trim() });
      if (type) conditions.push({ type });
      if (status) conditions.push({ status });

      if (stage) {
        if (stage === 'REQUESTED') {
          conditions.push({
            $or: [
              { approvalStage: 'REQUESTED' },
              { approvalStage: { $exists: false } },
              { approvalStage: null },
            ],
          });
        } else {
          conditions.push({ approvalStage: stage });
        }
      }

      if (search) {
        const s = String(search).trim();
        conditions.push({
          $or: [
            { memberId: new RegExp(s, 'i') },
            { memberName: new RegExp(s, 'i') },
            { utrNumber: new RegExp(s, 'i') },
            { payerName: new RegExp(s, 'i') },
            { purchaseId: new RegExp(s, 'i') },
            { transactionId: new RegExp(s, 'i') },
          ],
        });
      }

      const query = conditions.length > 0 ? { $and: conditions } : {};

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

  /**
   * 10. Fallback / direct programmatic createPurchase
   * POST /api/purchases
   */
  async createPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    // Redirects to requestPurchase to enforce unified lifecycle
    return PurchaseController.requestPurchase(req, res);
  },
};
