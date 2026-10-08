import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product, IProductImage, ProductStatus } from '../models/Product.model';
import { Category } from '../models/Category.model';
import { Subcategory } from '../models/Subcategory.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { StorageService } from '../services/storage.service';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export const ProductController = {
  // ==========================================
  // SUPERADMIN APIS
  // ==========================================

  /**
   * SuperAdmin: Create a new product
   * POST /api/admin/products
   */
  async adminCreateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        title,
        name,
        slug: inputSlug,
        sku,
        shortDescription,
        description,
        categoryId,
        subcategoryId,
        brand,
        businessVolume,
        bv,
        price,
        mrp,
        images = [],
        stock = 0,
        stockQuantity,
        status = 'ACTIVE',
      } = req.body;

      const productTitle = (title || name || '').trim();
      if (!productTitle) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Product title is required.',
        });
        return;
      }

      const productSku = (sku || '').trim().toUpperCase();
      if (!productSku) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Unique product SKU is required.',
        });
        return;
      }

      // 1. Mandatory Category Validation
      if (!categoryId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Product Category is required.',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(String(categoryId))) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Invalid Category ID provided.',
        });
        return;
      }

      const categoryDoc = await Category.findById(categoryId);
      if (!categoryDoc) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Selected Category does not exist.',
        });
        return;
      }

      // 2. Mandatory Subcategory Validation (if provided)
      let validSubcategoryId: mongoose.Types.ObjectId | null = null;
      if (subcategoryId && subcategoryId !== 'null' && subcategoryId !== '') {
        if (!mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Invalid Subcategory ID provided.',
          });
          return;
        }

        const subcatDoc = await Subcategory.findById(subcategoryId);
        if (!subcatDoc) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Selected Subcategory does not exist.',
          });
          return;
        }

        // Strict relationship check: Subcategory MUST belong to the selected Category
        if (subcatDoc.categoryId.toString() !== categoryDoc._id.toString()) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: `Subcategory '${subcatDoc.name}' does not belong to category '${categoryDoc.name}'.`,
          });
          return;
        }

        validSubcategoryId = subcatDoc._id;
      }

      // Generate or normalize slug
      const productSlug = slugify(inputSlug || productTitle);
      if (!productSlug) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'A valid product slug is required.',
        });
        return;
      }

      // Check unique slug and sku
      const existingSlug = await Product.findOne({ slug: productSlug });
      if (existingSlug) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Product with slug '${productSlug}' already exists. Please choose a unique title or slug.`,
        });
        return;
      }

      const existingSku = await Product.findOne({ sku: productSku });
      if (existingSku) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Product with SKU '${productSku}' already exists.`,
        });
        return;
      }

      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Price must be a valid number greater than or equal to 0.',
        });
        return;
      }

      const rawBV = businessVolume !== undefined ? businessVolume : bv;
      const parsedBV = Number(rawBV);
      if (isNaN(parsedBV) || parsedBV < 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Business Volume (BV) must be a valid number greater than or equal to 0.',
        });
        return;
      }

      const rawStock = stock !== undefined ? stock : stockQuantity;
      const parsedStock = Number(rawStock ?? 0);
      if (isNaN(parsedStock) || parsedStock < 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Stock quantity cannot be negative.',
        });
        return;
      }

      const parsedMrp = mrp !== undefined && mrp !== '' ? Number(mrp) : undefined;
      if (parsedMrp !== undefined && (isNaN(parsedMrp) || parsedMrp < 0)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'MRP must be a valid number greater than or equal to 0.',
        });
        return;
      }

      const productStatus: ProductStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      // Sanitize rich-text CKEditor HTML
      const sanitizedDescription = description ? sanitizeHtml(description) : '';

      // Validate & normalize images
      const validatedImages: IProductImage[] = Array.isArray(images)
        ? images.map((img: any, idx: number) => ({
            url: String(img.url || '').trim(),
            key: String(img.key || `img_${idx}`).trim(),
            alt: String(img.alt || '').trim(),
            isPrimary: Boolean(img.isPrimary),
            sortOrder: Number(img.sortOrder ?? idx),
          })).filter(img => Boolean(img.url))
        : [];

      // Ensure at least one primary image if images exist
      if (validatedImages.length > 0 && !validatedImages.some(img => img.isPrimary)) {
        validatedImages[0].isPrimary = true;
      }

      const productId = `PRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const newProduct = await Product.create({
        productId,
        title: productTitle,
        name: productTitle,
        slug: productSlug,
        sku: productSku,
        shortDescription: (shortDescription || '').trim(),
        description: sanitizedDescription,
        categoryId: categoryDoc._id,
        subcategoryId: validSubcategoryId,
        category: categoryDoc.name,
        brand: (brand || '').trim(),
        businessVolume: parsedBV,
        bv: parsedBV,
        price: parsedPrice,
        priceInPaise: Math.round(parsedPrice * 100),
        mrp: parsedMrp !== undefined ? parsedMrp : parsedPrice,
        mrpInPaise: parsedMrp !== undefined ? Math.round(parsedMrp * 100) : Math.round(parsedPrice * 100),
        images: validatedImages,
        stock: parsedStock,
        stockQuantity: parsedStock,
        status: productStatus,
        isActive: productStatus === 'ACTIVE',
        createdBy: req.user?.id || req.user?.email,
      });

      const populatedProduct = await Product.findById(newProduct._id)
        .populate('categoryId', 'name slug status')
        .populate('subcategoryId', 'name slug status');

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Product created successfully.',
        data: populatedProduct,
      });
    } catch (error: any) {
      console.error('[ProductController] adminCreateProduct error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create product.',
      });
    }
  },

  /**
   * SuperAdmin: List products with pagination, search, status, category, and subcategory filtering
   * GET /api/admin/products
   */
  async adminGetProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        q,
        status,
        categoryId,
        subcategoryId,
        category,
        sort = 'createdAt:desc',
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const query: any = {};

      // Search across title, SKU, brand, and category
      const searchTerm = String(search || q || '').trim();
      if (searchTerm) {
        const regex = new RegExp(searchTerm, 'i');
        query.$or = [
          { title: regex },
          { name: regex },
          { sku: regex },
          { brand: regex },
          { category: regex },
        ];
      }

      // Status filtering: 'ACTIVE' | 'INACTIVE'
      if (status && status !== 'ALL') {
        query.status = String(status).toUpperCase();
      }

      // Category filtering (supports ObjectId or legacy name)
      if (categoryId && categoryId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(String(categoryId))) {
          query.categoryId = new mongoose.Types.ObjectId(String(categoryId));
        } else {
          const cat = await Category.findOne({ slug: String(categoryId) });
          if (cat) query.categoryId = cat._id;
        }
      } else if (category && category !== 'ALL') {
        query.category = String(category).trim();
      }

      // Subcategory filtering
      if (subcategoryId && subcategoryId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
          query.subcategoryId = new mongoose.Types.ObjectId(String(subcategoryId));
        } else {
          const subcat = await Subcategory.findOne({ slug: String(subcategoryId) });
          if (subcat) query.subcategoryId = subcat._id;
        }
      }

      // Parse sort field
      const sortParts = String(sort).split(':');
      const sortField = sortParts[0] || 'createdAt';
      const sortOrder = sortParts[1] === 'asc' ? 1 : -1;
      const sortObj: any = { [sortField]: sortOrder };

      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('categoryId', 'name slug status')
          .populate('subcategoryId', 'name slug status')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum),
        Product.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error: any) {
      console.error('[ProductController] adminGetProducts error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch products.',
      });
    }
  },

  /**
   * SuperAdmin: Get single product details by id or slug
   * GET /api/admin/products/:id
   */
  async adminGetProductById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      let product = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id)
          .populate('categoryId', 'name slug status')
          .populate('subcategoryId', 'name slug status');
      }
      if (!product) {
        product = await Product.findOne({
          $or: [{ productId: id }, { slug: id }, { sku: id.toUpperCase() }],
        })
          .populate('categoryId', 'name slug status')
          .populate('subcategoryId', 'name slug status');
      }

      if (!product) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Product '${id}' not found.`,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: product,
      });
    } catch (error: any) {
      console.error('[ProductController] adminGetProductById error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch product details.',
      });
    }
  },

  /**
   * SuperAdmin: Update product
   * PUT /api/admin/products/:id
   */
  async adminUpdateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        title,
        name,
        slug: inputSlug,
        sku,
        shortDescription,
        description,
        categoryId,
        subcategoryId,
        brand,
        businessVolume,
        bv,
        price,
        mrp,
        images,
        stock,
        stockQuantity,
        status,
      } = req.body;

      let product = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id);
      }
      if (!product) {
        product = await Product.findOne({
          $or: [{ productId: id }, { slug: id }],
        });
      }

      if (!product) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Product '${id}' not found.`,
        });
        return;
      }

      // Title
      if (title !== undefined || name !== undefined) {
        const newTitle = (title || name || '').trim();
        if (!newTitle) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Product title cannot be empty.',
          });
          return;
        }
        product.title = newTitle;
        product.name = newTitle;
      }

      // Category Validation (if provided/updated)
      let currentCategoryId = product.categoryId;
      if (categoryId !== undefined) {
        if (!categoryId) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Product category cannot be empty.',
          });
          return;
        }
        if (!mongoose.Types.ObjectId.isValid(String(categoryId))) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Invalid Category ID.',
          });
          return;
        }

        const categoryDoc = await Category.findById(categoryId);
        if (!categoryDoc) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Selected Category does not exist.',
          });
          return;
        }

        product.categoryId = categoryDoc._id;
        product.category = categoryDoc.name;
        currentCategoryId = categoryDoc._id;
      }

      // Subcategory Validation (if provided/updated)
      if (subcategoryId !== undefined) {
        if (!subcategoryId || subcategoryId === 'null' || subcategoryId === '') {
          product.subcategoryId = null;
        } else {
          if (!mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: 'Invalid Subcategory ID.',
            });
            return;
          }

          const subcatDoc = await Subcategory.findById(subcategoryId);
          if (!subcatDoc) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: 'Selected Subcategory does not exist.',
            });
            return;
          }

          // Strict relationship check: Subcategory MUST belong to current Category
          if (!currentCategoryId || subcatDoc.categoryId.toString() !== currentCategoryId.toString()) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: `Subcategory '${subcatDoc.name}' does not belong to the selected Category.`,
            });
            return;
          }

          product.subcategoryId = subcatDoc._id;
        }
      }

      // Slug
      if (inputSlug !== undefined) {
        const newSlug = slugify(inputSlug);
        if (!newSlug) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Valid slug cannot be empty.',
          });
          return;
        }
        if (newSlug !== product.slug) {
          const slugExists = await Product.findOne({ slug: newSlug, _id: { $ne: product._id } });
          if (slugExists) {
            res.status(HTTP_STATUS.CONFLICT).json({
              status: false,
              message: `Slug '${newSlug}' is already in use by another product.`,
            });
            return;
          }
          product.slug = newSlug;
        }
      }

      // SKU
      if (sku !== undefined) {
        const newSku = sku.trim().toUpperCase();
        if (!newSku) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'SKU cannot be empty.',
          });
          return;
        }
        if (newSku !== product.sku) {
          const skuExists = await Product.findOne({ sku: newSku, _id: { $ne: product._id } });
          if (skuExists) {
            res.status(HTTP_STATUS.CONFLICT).json({
              status: false,
              message: `SKU '${newSku}' is already in use by another product.`,
            });
            return;
          }
          product.sku = newSku;
        }
      }

      // Price
      if (price !== undefined) {
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Price must be a valid number >= 0.',
          });
          return;
        }
        product.price = parsedPrice;
        product.priceInPaise = Math.round(parsedPrice * 100);
      }

      // MRP
      if (mrp !== undefined) {
        if (mrp === null || mrp === '') {
          product.mrp = undefined;
          product.mrpInPaise = undefined;
        } else {
          const parsedMrp = Number(mrp);
          if (isNaN(parsedMrp) || parsedMrp < 0) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: 'MRP must be a valid number >= 0.',
            });
            return;
          }
          product.mrp = parsedMrp;
          product.mrpInPaise = Math.round(parsedMrp * 100);
        }
      }

      // Business Volume (BV)
      const rawBV = businessVolume !== undefined ? businessVolume : bv;
      if (rawBV !== undefined) {
        const parsedBV = Number(rawBV);
        if (isNaN(parsedBV) || parsedBV < 0) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Business Volume (BV) must be a valid number >= 0.',
          });
          return;
        }
        product.businessVolume = parsedBV;
        product.bv = parsedBV;
      }

      // Stock
      const rawStock = stock !== undefined ? stock : stockQuantity;
      if (rawStock !== undefined) {
        const parsedStock = Number(rawStock);
        if (isNaN(parsedStock) || parsedStock < 0) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Stock cannot be negative.',
          });
          return;
        }
        product.stock = parsedStock;
        product.stockQuantity = parsedStock;
      }

      // Short Description & Rich Description (Sanitized)
      if (shortDescription !== undefined) {
        product.shortDescription = String(shortDescription).trim();
      }
      if (description !== undefined) {
        product.description = sanitizeHtml(String(description));
      }

      // Brand
      if (brand !== undefined) {
        product.brand = String(brand).trim();
      }

      // Images
      if (images !== undefined && Array.isArray(images)) {
        const validatedImages: IProductImage[] = images.map((img: any, idx: number) => ({
          url: String(img.url || '').trim(),
          key: String(img.key || `img_${idx}`).trim(),
          alt: String(img.alt || '').trim(),
          isPrimary: Boolean(img.isPrimary),
          sortOrder: Number(img.sortOrder ?? idx),
        })).filter(img => Boolean(img.url));

        if (validatedImages.length > 0 && !validatedImages.some(img => img.isPrimary)) {
          validatedImages[0].isPrimary = true;
        }
        product.images = validatedImages;
      }

      // Status
      if (status !== undefined) {
        const nextStatus: ProductStatus = String(status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
        product.status = nextStatus;
        product.isActive = nextStatus === 'ACTIVE';
      }

      product.updatedBy = req.user?.id || req.user?.email;
      await product.save();

      const populatedProduct = await Product.findById(product._id)
        .populate('categoryId', 'name slug status')
        .populate('subcategoryId', 'name slug status');

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Product updated successfully.',
        data: populatedProduct,
      });
    } catch (error: any) {
      console.error('[ProductController] adminUpdateProduct error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update product.',
      });
    }
  },

  /**
   * SuperAdmin: Delete product
   * DELETE /api/admin/products/:id
   */
  async adminDeleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      let product = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id);
      }
      if (!product) {
        product = await Product.findOne({
          $or: [{ productId: id }, { slug: id }],
        });
      }

      if (!product) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Product '${id}' not found.`,
        });
        return;
      }

      // Clean up uploaded image files
      if (Array.isArray(product.images)) {
        for (const img of product.images) {
          if (img.key && img.url.startsWith('/uploads/products/')) {
            await StorageService.deleteImageByKey(img.key);
          }
        }
      }

      await Product.findByIdAndDelete(product._id);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Product '${product.title}' deleted successfully.`,
      });
    } catch (error: any) {
      console.error('[ProductController] adminDeleteProduct error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete product.',
      });
    }
  },

  /**
   * SuperAdmin: Activate/Deactivate product
   * PATCH /api/admin/products/:id/status
   */
  async adminUpdateProductStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      let product = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        product = await Product.findById(id);
      }
      if (!product) {
        product = await Product.findOne({
          $or: [{ productId: id }, { slug: id }],
        });
      }

      if (!product) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Product '${id}' not found.`,
        });
        return;
      }

      let newStatus: ProductStatus;
      if (status) {
        newStatus = String(status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      } else {
        newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      product.status = newStatus;
      product.isActive = newStatus === 'ACTIVE';
      product.updatedBy = req.user?.id || req.user?.email;
      await product.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Product status changed to ${newStatus}.`,
        data: {
          id: product._id,
          productId: product.productId,
          status: product.status,
          isActive: product.isActive,
        },
      });
    } catch (error: any) {
      console.error('[ProductController] adminUpdateProductStatus error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update product status.',
      });
    }
  },

  /**
   * SuperAdmin: Upload product image
   * POST /api/admin/products/upload-image
   */
  async adminUploadImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { data, filename = 'product_image', alt = '' } = req.body;
      if (!data) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Image base64 data is required.',
        });
        return;
      }

      const stored = await StorageService.saveImageBase64(data, filename);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Image uploaded successfully.',
        data: {
          url: stored.url,
          key: stored.key,
          alt: alt || stored.originalName,
          isPrimary: false,
          sortOrder: 0,
        },
      });
    } catch (error: any) {
      console.error('[ProductController] adminUploadImage error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to upload image.',
      });
    }
  },

  // ==========================================
  // MEMBER & PUBLIC APIS
  // ==========================================

  /**
   * Member: Get active products (supports categoryId & subcategoryId filtering)
   * GET /api/products
   */
  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        q,
        categoryId,
        subcategoryId,
        category,
        sort = 'createdAt:desc',
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      // STRICT MEMBER RULE: Only ACTIVE products visible
      const query: any = { status: 'ACTIVE' };

      const searchTerm = String(search || q || '').trim();
      if (searchTerm) {
        const regex = new RegExp(searchTerm, 'i');
        query.$or = [
          { title: regex },
          { name: regex },
          { sku: regex },
          { brand: regex },
          { category: regex },
        ];
      }

      if (categoryId && categoryId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(String(categoryId))) {
          query.categoryId = new mongoose.Types.ObjectId(String(categoryId));
        } else {
          const cat = await Category.findOne({ slug: String(categoryId) });
          if (cat) query.categoryId = cat._id;
        }
      } else if (category && category !== 'ALL') {
        query.category = String(category).trim();
      }

      if (subcategoryId && subcategoryId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(String(subcategoryId))) {
          query.subcategoryId = new mongoose.Types.ObjectId(String(subcategoryId));
        } else {
          const subcat = await Subcategory.findOne({ slug: String(subcategoryId) });
          if (subcat) query.subcategoryId = subcat._id;
        }
      }

      const sortParts = String(sort).split(':');
      const sortField = sortParts[0] || 'createdAt';
      const sortOrder = sortParts[1] === 'asc' ? 1 : -1;
      const sortObj: any = { [sortField]: sortOrder };

      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('categoryId', 'name slug')
          .populate('subcategoryId', 'name slug')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum),
        Product.countDocuments(query),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error('[ProductController] getProducts error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch active products.',
      });
    }
  },

  /**
   * Member: Get single product by slug
   * GET /api/products/:slug
   */
  async getProductBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      // STRICT MEMBER RULE: Only ACTIVE products visible
      const product = await Product.findOne({
        slug: slug.toLowerCase().trim(),
        status: 'ACTIVE',
      })
        .populate('categoryId', 'name slug')
        .populate('subcategoryId', 'name slug');

      if (!product) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Product with slug '${slug}' was not found or is currently unavailable.`,
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: product,
      });
    } catch (error: any) {
      console.error('[ProductController] getProductBySlug error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch product details.',
      });
    }
  },
};
