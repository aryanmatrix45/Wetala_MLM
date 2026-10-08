import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Category, CategoryStatus } from '../models/Category.model';
import { Subcategory } from '../models/Subcategory.model';
import { Product } from '../models/Product.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

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

export const CategoryController = {
  // ==========================================
  // SUPERADMIN APIS
  // ==========================================

  /**
   * SuperAdmin: Create a new category
   * POST /api/admin/categories
   */
  async adminCreateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, slug: inputSlug, description, status = 'ACTIVE' } = req.body;

      const trimmedName = String(name || '').trim();
      if (!trimmedName) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Category name is required.',
        });
        return;
      }

      const categorySlug = slugify(inputSlug || trimmedName);
      if (!categorySlug) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'A valid category slug is required.',
        });
        return;
      }

      // Check unique name and slug
      const nameExists = await Category.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (nameExists) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Category with name '${trimmedName}' already exists.`,
        });
        return;
      }

      const slugExists = await Category.findOne({ slug: categorySlug });
      if (slugExists) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Category with slug '${categorySlug}' already exists.`,
        });
        return;
      }

      const categoryStatus: CategoryStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const newCategory = await Category.create({
        name: trimmedName,
        slug: categorySlug,
        description: String(description || '').trim(),
        status: categoryStatus,
        createdBy: req.user?.id || req.user?.email,
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Category created successfully.',
        data: newCategory,
      });
    } catch (error: any) {
      console.error('[CategoryController] adminCreateCategory error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create category.',
      });
    }
  },

  /**
   * SuperAdmin: List categories with pagination, search, status filter, and subcategory counts
   * GET /api/admin/categories
   */
  async adminGetCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 50, search, q, status } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const query: any = {};
      const searchTerm = String(search || q || '').trim();
      if (searchTerm) {
        const regex = new RegExp(searchTerm, 'i');
        query.$or = [{ name: regex }, { slug: regex }, { description: regex }];
      }

      if (status && status !== 'ALL') {
        query.status = String(status).toUpperCase();
      }

      const [categories, total] = await Promise.all([
        Category.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Category.countDocuments(query),
      ]);

      // Calculate subcategory count and product count for each category
      const categoryIds = categories.map((c) => c._id);
      const [subcatCounts, productCounts] = await Promise.all([
        Subcategory.aggregate([
          { $match: { categoryId: { $in: categoryIds } } },
          { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        ]),
        Product.aggregate([
          { $match: { categoryId: { $in: categoryIds } } },
          { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        ]),
      ]);

      const subcatMap = new Map<string, number>();
      subcatCounts.forEach((s) => subcatMap.set(s._id.toString(), s.count));

      const productMap = new Map<string, number>();
      productCounts.forEach((p) => productMap.set(p._id.toString(), p.count));

      const enriched = categories.map((c) => ({
        ...c.toObject(),
        subcategoryCount: subcatMap.get(c._id.toString()) || 0,
        productCount: productMap.get(c._id.toString()) || 0,
      }));

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: enriched,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error('[CategoryController] adminGetCategories error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch categories.',
      });
    }
  },

  /**
   * SuperAdmin: Get single category by ID or slug
   * GET /api/admin/categories/:id
   */
  async adminGetCategoryById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      let category = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        category = await Category.findById(id);
      }
      if (!category) {
        category = await Category.findOne({ slug: id });
      }

      if (!category) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Category '${id}' not found.`,
        });
        return;
      }

      const [subcategories, productCount] = await Promise.all([
        Subcategory.find({ categoryId: category._id }).sort({ name: 1 }),
        Product.countDocuments({ categoryId: category._id }),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          ...category.toObject(),
          subcategories,
          productCount,
        },
      });
    } catch (error: any) {
      console.error('[CategoryController] adminGetCategoryById error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch category details.',
      });
    }
  },

  /**
   * SuperAdmin: Update category
   * PUT /api/admin/categories/:id
   */
  async adminUpdateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, slug: inputSlug, description, status } = req.body;

      let category = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        category = await Category.findById(id);
      }
      if (!category) {
        category = await Category.findOne({ slug: id });
      }

      if (!category) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Category '${id}' not found.`,
        });
        return;
      }

      // Name uniqueness check
      if (name !== undefined) {
        const trimmedName = String(name).trim();
        if (!trimmedName) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Category name cannot be empty.',
          });
          return;
        }

        if (trimmedName.toLowerCase() !== category.name.toLowerCase()) {
          const nameExists = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            _id: { $ne: category._id },
          });
          if (nameExists) {
            res.status(HTTP_STATUS.CONFLICT).json({
              status: false,
              message: `Category with name '${trimmedName}' already exists.`,
            });
            return;
          }
        }
        category.name = trimmedName;
      }

      // Slug uniqueness check
      if (inputSlug !== undefined) {
        const newSlug = slugify(inputSlug);
        if (!newSlug) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Category slug cannot be empty.',
          });
          return;
        }

        if (newSlug !== category.slug) {
          const slugExists = await Category.findOne({
            slug: newSlug,
            _id: { $ne: category._id },
          });
          if (slugExists) {
            res.status(HTTP_STATUS.CONFLICT).json({
              status: false,
              message: `Slug '${newSlug}' is already in use by another category.`,
            });
            return;
          }
          category.slug = newSlug;
        }
      }

      if (description !== undefined) {
        category.description = String(description).trim();
      }

      if (status !== undefined) {
        category.status = String(status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      category.updatedBy = req.user?.id || req.user?.email;
      await category.save();

      // If category name changed, also update legacy category string on associated products
      if (name !== undefined) {
        await Product.updateMany({ categoryId: category._id }, { category: category.name });
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Category updated successfully.',
        data: category,
      });
    } catch (error: any) {
      console.error('[CategoryController] adminUpdateCategory error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update category.',
      });
    }
  },

  /**
   * SuperAdmin: Delete category (with Delete Safety checks)
   * DELETE /api/admin/categories/:id
   */
  async adminDeleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      let category = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        category = await Category.findById(id);
      }
      if (!category) {
        category = await Category.findOne({ slug: id });
      }

      if (!category) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Category '${id}' not found.`,
        });
        return;
      }

      // Delete Safety Rule 1: Check if subcategories belong to this category
      const subcatCount = await Subcategory.countDocuments({ categoryId: category._id });
      if (subcatCount > 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Cannot delete category '${category.name}' because ${subcatCount} subcategory/subcategories are linked to it. Please reassign or delete subcategories first, or deactivate the category.`,
          subcategoriesCount: subcatCount,
        });
        return;
      }

      // Delete Safety Rule 2: Check if products belong to this category
      const productCount = await Product.countDocuments({ categoryId: category._id });
      if (productCount > 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Cannot delete category '${category.name}' because ${productCount} product(s) are currently assigned to it. Please reassign the products first, or deactivate the category.`,
          productsCount: productCount,
        });
        return;
      }

      await Category.findByIdAndDelete(category._id);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Category '${category.name}' deleted successfully.`,
      });
    } catch (error: any) {
      console.error('[CategoryController] adminDeleteCategory error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete category.',
      });
    }
  },

  /**
   * SuperAdmin: Toggle or update category status
   * PATCH /api/admin/categories/:id/status
   */
  async adminUpdateCategoryStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      let category = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        category = await Category.findById(id);
      }
      if (!category) {
        category = await Category.findOne({ slug: id });
      }

      if (!category) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Category '${id}' not found.`,
        });
        return;
      }

      let newStatus: CategoryStatus;
      if (status) {
        newStatus = String(status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      } else {
        newStatus = category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      category.status = newStatus;
      category.updatedBy = req.user?.id || req.user?.email;
      await category.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Category status updated to ${newStatus}.`,
        data: category,
      });
    } catch (error: any) {
      console.error('[CategoryController] adminUpdateCategoryStatus error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update category status.',
      });
    }
  },

  // ==========================================
  // PUBLIC / MEMBER APIS
  // ==========================================

  /**
   * Member / Public: Get active categories
   * GET /api/categories
   */
  async getCategories(_req: Request, res: Response): Promise<void> {
    try {
      const categories = await Category.find({ status: 'ACTIVE' }).sort({ name: 1 });
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: categories,
      });
    } catch (error: any) {
      console.error('[CategoryController] getCategories error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch categories.',
      });
    }
  },
};
