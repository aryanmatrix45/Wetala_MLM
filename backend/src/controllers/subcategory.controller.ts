import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Subcategory, SubcategoryStatus } from '../models/Subcategory.model';
import { Category } from '../models/Category.model';
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

export const SubcategoryController = {
  // ==========================================
  // SUPERADMIN APIS
  // ==========================================

  /**
   * SuperAdmin: Create a new subcategory
   * POST /api/admin/subcategories
   */
  async adminCreateSubcategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, slug: inputSlug, categoryId, description, status = 'ACTIVE' } = req.body;

      const trimmedName = String(name || '').trim();
      if (!trimmedName) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Subcategory name is required.',
        });
        return;
      }

      if (!categoryId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Parent Category ID is required.',
        });
        return;
      }

      // Verify parent category exists
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Invalid Category ID.',
        });
        return;
      }

      const parentCategory = await Category.findById(categoryId);
      if (!parentCategory) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Parent Category does not exist.',
        });
        return;
      }

      const subcategorySlug = slugify(inputSlug || trimmedName);
      if (!subcategorySlug) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'A valid subcategory slug is required.',
        });
        return;
      }

      // Check unique slug within the category
      const slugExists = await Subcategory.findOne({
        categoryId: parentCategory._id,
        slug: subcategorySlug,
      });
      if (slugExists) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Subcategory with slug '${subcategorySlug}' already exists in category '${parentCategory.name}'.`,
        });
        return;
      }

      const subcategoryStatus: SubcategoryStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const newSubcategory = await Subcategory.create({
        name: trimmedName,
        slug: subcategorySlug,
        categoryId: parentCategory._id,
        description: String(description || '').trim(),
        status: subcategoryStatus,
        createdBy: req.user?.id || req.user?.email,
      });

      const populated = await Subcategory.findById(newSubcategory._id).populate('categoryId', 'name slug');

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Subcategory created successfully.',
        data: populated,
      });
    } catch (error: any) {
      console.error('[SubcategoryController] adminCreateSubcategory error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create subcategory.',
      });
    }
  },

  /**
   * SuperAdmin: List subcategories with category filter, pagination, search
   * GET /api/admin/subcategories?categoryId=<CATEGORY_ID>
   */
  async adminGetSubcategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 50, search, q, categoryId, status } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const query: any = {};

      // Filter by categoryId if provided
      if (categoryId && categoryId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(String(categoryId))) {
          query.categoryId = new mongoose.Types.ObjectId(String(categoryId));
        } else {
          // Check by category slug
          const cat = await Category.findOne({ slug: String(categoryId) });
          if (cat) query.categoryId = cat._id;
        }
      }

      const searchTerm = String(search || q || '').trim();
      if (searchTerm) {
        const regex = new RegExp(searchTerm, 'i');
        query.$or = [{ name: regex }, { slug: regex }, { description: regex }];
      }

      if (status && status !== 'ALL') {
        query.status = String(status).toUpperCase();
      }

      const [subcategories, total] = await Promise.all([
        Subcategory.find(query)
          .populate('categoryId', 'name slug status')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Subcategory.countDocuments(query),
      ]);

      // Calculate product counts for each subcategory
      const subcatIds = subcategories.map((s) => s._id);
      const productCounts = await Product.aggregate([
        { $match: { subcategoryId: { $in: subcatIds } } },
        { $group: { _id: '$subcategoryId', count: { $sum: 1 } } },
      ]);

      const productMap = new Map<string, number>();
      productCounts.forEach((p) => productMap.set(p._id.toString(), p.count));

      const enriched = subcategories.map((s) => ({
        ...s.toObject(),
        productCount: productMap.get(s._id.toString()) || 0,
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
      console.error('[SubcategoryController] adminGetSubcategories error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch subcategories.',
      });
    }
  },

  /**
   * SuperAdmin: Get single subcategory by ID or slug
   * GET /api/admin/subcategories/:id
   */
  async adminGetSubcategoryById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      let subcategory = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        subcategory = await Subcategory.findById(id).populate('categoryId', 'name slug status');
      }
      if (!subcategory) {
        subcategory = await Subcategory.findOne({ slug: id }).populate('categoryId', 'name slug status');
      }

      if (!subcategory) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Subcategory '${id}' not found.`,
        });
        return;
      }

      const productCount = await Product.countDocuments({ subcategoryId: subcategory._id });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          ...subcategory.toObject(),
          productCount,
        },
      });
    } catch (error: any) {
      console.error('[SubcategoryController] adminGetSubcategoryById error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch subcategory details.',
      });
    }
  },

  /**
   * SuperAdmin: Update subcategory
   * PUT /api/admin/subcategories/:id
   */
  async adminUpdateSubcategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, slug: inputSlug, categoryId, description, status } = req.body;

      let subcategory = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        subcategory = await Subcategory.findById(id);
      }
      if (!subcategory) {
        subcategory = await Subcategory.findOne({ slug: id });
      }

      if (!subcategory) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Subcategory '${id}' not found.`,
        });
        return;
      }

      // If categoryId updated, verify new parent exists
      let targetCategoryId = subcategory.categoryId;
      if (categoryId && categoryId !== subcategory.categoryId.toString()) {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Invalid Category ID.',
          });
          return;
        }
        const parentCategory = await Category.findById(categoryId);
        if (!parentCategory) {
          res.status(HTTP_STATUS.NOT_FOUND).json({
            status: false,
            message: 'Parent Category not found.',
          });
          return;
        }
        subcategory.categoryId = parentCategory._id;
        targetCategoryId = parentCategory._id;
      }

      // Name
      if (name !== undefined) {
        const trimmedName = String(name).trim();
        if (!trimmedName) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Subcategory name cannot be empty.',
          });
          return;
        }
        subcategory.name = trimmedName;
      }

      // Slug
      if (inputSlug !== undefined) {
        const newSlug = slugify(inputSlug);
        if (!newSlug) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Subcategory slug cannot be empty.',
          });
          return;
        }

        if (newSlug !== subcategory.slug) {
          const slugExists = await Subcategory.findOne({
            categoryId: targetCategoryId,
            slug: newSlug,
            _id: { $ne: subcategory._id },
          });
          if (slugExists) {
            res.status(HTTP_STATUS.CONFLICT).json({
              status: false,
              message: `Slug '${newSlug}' is already in use by another subcategory in this category.`,
            });
            return;
          }
          subcategory.slug = newSlug;
        }
      }

      if (description !== undefined) {
        subcategory.description = String(description).trim();
      }

      if (status !== undefined) {
        subcategory.status = String(status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      subcategory.updatedBy = req.user?.id || req.user?.email;
      await subcategory.save();

      const populated = await Subcategory.findById(subcategory._id).populate('categoryId', 'name slug');

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Subcategory updated successfully.',
        data: populated,
      });
    } catch (error: any) {
      console.error('[SubcategoryController] adminUpdateSubcategory error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update subcategory.',
      });
    }
  },

  /**
   * SuperAdmin: Delete subcategory (with Delete Safety checks)
   * DELETE /api/admin/subcategories/:id
   */
  async adminDeleteSubcategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      let subcategory = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        subcategory = await Subcategory.findById(id);
      }
      if (!subcategory) {
        subcategory = await Subcategory.findOne({ slug: id });
      }

      if (!subcategory) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Subcategory '${id}' not found.`,
        });
        return;
      }

      // Delete Safety Rule: Check if products belong to this subcategory
      const productCount = await Product.countDocuments({ subcategoryId: subcategory._id });
      if (productCount > 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: `Cannot delete subcategory '${subcategory.name}' because ${productCount} product(s) are currently assigned to it. Please reassign the products first, or deactivate the subcategory.`,
          productsCount: productCount,
        });
        return;
      }

      await Subcategory.findByIdAndDelete(subcategory._id);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Subcategory '${subcategory.name}' deleted successfully.`,
      });
    } catch (error: any) {
      console.error('[SubcategoryController] adminDeleteSubcategory error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete subcategory.',
      });
    }
  },

  /**
   * SuperAdmin: Toggle or update subcategory status
   * PATCH /api/admin/subcategories/:id/status
   */
  async adminUpdateSubcategoryStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      let subcategory = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        subcategory = await Subcategory.findById(id);
      }
      if (!subcategory) {
        subcategory = await Subcategory.findOne({ slug: id });
      }

      if (!subcategory) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Subcategory '${id}' not found.`,
        });
        return;
      }

      let newStatus: SubcategoryStatus;
      if (status) {
        newStatus = String(status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      } else {
        newStatus = subcategory.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      subcategory.status = newStatus;
      subcategory.updatedBy = req.user?.id || req.user?.email;
      await subcategory.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Subcategory status updated to ${newStatus}.`,
        data: subcategory,
      });
    } catch (error: any) {
      console.error('[SubcategoryController] adminUpdateSubcategoryStatus error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update subcategory status.',
      });
    }
  },

  // ==========================================
  // PUBLIC / MEMBER APIS
  // ==========================================

  /**
   * Member / Public: Get active subcategories (supports ?categoryId=<CATEGORY_ID>)
   * GET /api/subcategories
   */
  async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.query;
      const query: any = { status: 'ACTIVE' };

      if (categoryId && categoryId !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(String(categoryId))) {
          query.categoryId = new mongoose.Types.ObjectId(String(categoryId));
        } else {
          const cat = await Category.findOne({ slug: String(categoryId) });
          if (cat) query.categoryId = cat._id;
        }
      }

      const subcategories = await Subcategory.find(query)
        .populate('categoryId', 'name slug')
        .sort({ name: 1 });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: subcategories,
      });
    } catch (error: any) {
      console.error('[SubcategoryController] getSubcategories error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch subcategories.',
      });
    }
  },
};
