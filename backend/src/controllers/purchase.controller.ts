import { Request, Response } from 'express';
import { Purchase } from '../models/Purchase.model';
import { Member } from '../models/Member.model';
import { CompensationEngine } from '../services/compensation/CompensationEngine';
import { HTTP_STATUS, PURCHASE_TYPE, PURCHASE_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const PurchaseController = {
  /**
   * Create a new purchase (Joining, Repurchase, or Retail)
   * POST /api/purchases
   */
  async createPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { memberId, type = PURCHASE_TYPE.JOINING, items = [], notes } = req.body;
      if (!memberId || items.length === 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Member ID and at least one item are required.' });
        return;
      }

      const member = await Member.findOne({ memberId: memberId.toUpperCase().trim() });
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: `Member ${memberId} not found.` });
        return;
      }

      // Calculate totals with decimal safety
      let totalAmount = 0;
      let totalBV = 0;

      const mappedItems = items.map((it: any) => {
        const itemTotal = it.unitPrice * it.quantity;
        const itemBV = it.unitBV * it.quantity;
        totalAmount += itemTotal;
        totalBV += itemBV;

        return {
          itemId: it.itemId,
          itemType: it.itemType || (type === PURCHASE_TYPE.JOINING ? 'PACKAGE' : 'PRODUCT'),
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unitPriceInPaise: Math.round(it.unitPrice * 100),
          unitBV: it.unitBV,
          totalPrice: itemTotal,
          totalPriceInPaise: Math.round(itemTotal * 100),
          totalBV: itemBV,
        };
      });

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
