import { Request, Response } from 'express';
import { Product } from '../models/Product.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const defaultProducts = [
  { productId: 'PRD-1', sku: 'WET-HLT-01', name: 'Ayurvedic Health Tonic (500ml)', category: 'Health Care', price: 750, costPrice: 500, mrp: 950, bv: 250, stockQuantity: 500, isActive: true },
  { productId: 'PRD-2', sku: 'WET-WEL-02', name: 'Immunity Booster Capsules (60 caps)', category: 'Wellness', price: 1200, costPrice: 800, mrp: 1500, bv: 450, stockQuantity: 300, isActive: true },
  { productId: 'PRD-3', sku: 'WET-SKN-03', name: 'Organic Herbal Face Cream (100g)', category: 'Personal Care', price: 450, costPrice: 300, mrp: 600, bv: 150, stockQuantity: 400, isActive: true },
  { productId: 'PRD-4', sku: 'WET-DET-04', name: 'Detox Herbal Tea (200g)', category: 'Health Care', price: 600, costPrice: 400, mrp: 800, bv: 200, stockQuantity: 250, isActive: true },
];

export const ProductController = {
  /**
   * Get all active products
   * GET /api/products
   */
  async getProducts(_req: Request, res: Response): Promise<void> {
    try {
      let products = await Product.find({ isActive: true }).sort({ name: 1 });
      if (products.length === 0) {
        for (const p of defaultProducts) {
          await Product.create({
            ...p,
            priceInPaise: p.price * 100,
            costPriceInPaise: p.costPrice * 100,
            mrpInPaise: p.mrp * 100,
          });
        }
        products = await Product.find({ isActive: true }).sort({ name: 1 });
      }
      res.status(HTTP_STATUS.OK).json({ status: true, data: products });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },

  /**
   * Admin create product
   * POST /api/products
   */
  async createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, sku, category, price, costPrice, mrp, bv, stockQuantity, description } = req.body;
      if (!name || !sku || price === undefined || bv === undefined) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Name, SKU, price, and BV are required.' });
        return;
      }

      const productId = `PRD-${Date.now().toString(36).toUpperCase()}`;
      const product = await Product.create({
        productId,
        sku: sku.toUpperCase().trim(),
        name: name.trim(),
        category: category || 'General',
        price,
        priceInPaise: Math.round(price * 100),
        costPrice: costPrice || 0,
        costPriceInPaise: Math.round((costPrice || 0) * 100),
        mrp: mrp || price,
        mrpInPaise: Math.round((mrp || price) * 100),
        bv,
        stockQuantity: stockQuantity || 100,
        description,
        isActive: true,
      });

      res.status(HTTP_STATUS.CREATED).json({ status: true, data: product });
    } catch (error: any) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: error.message });
    }
  },
};
