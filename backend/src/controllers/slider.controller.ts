import { Request, Response } from 'express';
import { Slider, ISlider, SliderType, SliderStatus } from '../models/Slider.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { StorageService } from '../services/storage.service';

export const SliderController = {
  // ==========================================
  // MEMBER / PUBLIC APIS
  // ==========================================

  /**
   * Get active sliders for members/public
   * GET /api/sliders
   */
  async getSliders(req: Request, res: Response): Promise<void> {
    try {
      const type = req.query.type as string | undefined;

      const filter: Record<string, any> = {
        status: 'active',
      };

      if (type && ['parent', 'child'].includes(type)) {
        filter.type = type;
      }

      const sliders = await Slider.find(filter)
        .sort({ order: 1, createdAt: -1 })
        .lean();

      const desktop = sliders.filter((s: any) => s.type === 'parent');
      const mobile = sliders.filter((s: any) => s.type === 'child');

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Active sliders fetched successfully',
        data: {
          all: sliders,
          desktop,
          mobile,
        },
      });
    } catch (error: any) {
      console.error('[SliderController.getSliders] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch sliders',
      });
    }
  },

  // ==========================================
  // SUPERADMIN APIS
  // ==========================================

  /**
   * SuperAdmin: Get all sliders (active & inactive)
   * GET /api/admin/sliders
   */
  async adminGetSliders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { type, status, search } = req.query;

      const filter: Record<string, any> = {};

      if (type && ['parent', 'child'].includes(type as string)) {
        filter.type = type;
      }
      if (status && ['active', 'inactive'].includes(status as string)) {
        filter.status = status;
      }
      if (search && typeof search === 'string' && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [{ title: regex }, { link: regex }, { imageUrl: regex }];
      }

      const sliders = await Slider.find(filter)
        .sort({ type: 1, order: 1, createdAt: -1 })
        .lean();

      const totalCount = await Slider.countDocuments();
      const desktopCount = await Slider.countDocuments({ type: 'parent' });
      const mobileCount = await Slider.countDocuments({ type: 'child' });
      const activeCount = await Slider.countDocuments({ status: 'active' });
      const inactiveCount = await Slider.countDocuments({ status: 'inactive' });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: sliders,
        metrics: {
          total: totalCount,
          desktop: desktopCount,
          mobile: mobileCount,
          active: activeCount,
          inactive: inactiveCount,
        },
      });
    } catch (error: any) {
      console.error('[SliderController.adminGetSliders] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch admin sliders',
      });
    }
  },

  /**
   * SuperAdmin: Create a new slider
   * POST /api/admin/sliders
   */
  async adminCreateSlider(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        image,
        imageUrl,
        base64Image,
        title = '',
        link = '',
        type = 'parent',
        status = 'active',
        order,
      } = req.body;

      let finalImageUrl = imageUrl || image || '';

      // If base64 image data is provided, save to disk
      const rawBase64 = base64Image || (image && image.startsWith('data:') ? image : '');
      if (rawBase64) {
        const stored = await StorageService.saveImageBase64(rawBase64, title || 'slider', 'sliders');
        finalImageUrl = stored.url;
      }

      if (!finalImageUrl) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Slider image or image URL is required',
        });
        return;
      }

      const sliderType: SliderType = type === 'child' ? 'child' : 'parent';
      const sliderStatus: SliderStatus = status === 'inactive' ? 'inactive' : 'active';

      let targetOrder = Number(order);
      if (!targetOrder || isNaN(targetOrder) || targetOrder < 1) {
        const highest = await Slider.findOne({ type: sliderType }).sort({ order: -1 }).select('order');
        targetOrder = (highest?.order || 0) + 1;
      }

      const newSlider = await Slider.create({
        image: finalImageUrl,
        imageUrl: finalImageUrl,
        title: title.trim(),
        link: link.trim(),
        type: sliderType,
        status: sliderStatus,
        order: targetOrder,
        createdBy: req.user?.email || 'ADMIN',
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Slider created successfully',
        data: newSlider,
      });
    } catch (error: any) {
      console.error('[SliderController.adminCreateSlider] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create slider',
      });
    }
  },

  /**
   * SuperAdmin: Bulk Upload Sliders
   * POST /api/admin/sliders/bulk
   */
  async adminBulkCreateSliders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { type = 'parent', sliders = [], images = [] } = req.body;
      const sliderType: SliderType = type === 'child' ? 'child' : 'parent';

      const highest = await Slider.findOne({ type: sliderType }).sort({ order: -1 }).select('order');
      let currentOrder = (highest?.order || 0) + 1;

      const createdSliders: ISlider[] = [];

      // Combine sliders array or simple images array
      const rawItems = sliders.length > 0 ? sliders : images.map((img: string) => ({ image: img }));

      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'At least one slider image is required for bulk upload',
        });
        return;
      }

      for (const item of rawItems) {
        let finalImageUrl = item.imageUrl || item.image || item.url || '';
        const rawBase64 = item.base64 || (finalImageUrl && finalImageUrl.startsWith('data:') ? finalImageUrl : '');

        if (rawBase64) {
          const stored = await StorageService.saveImageBase64(rawBase64, item.title || 'slider', 'sliders');
          finalImageUrl = stored.url;
        }

        if (!finalImageUrl) continue;

        const created = await Slider.create({
          image: finalImageUrl,
          imageUrl: finalImageUrl,
          title: (item.title || '').trim(),
          link: (item.link || '').trim(),
          type: sliderType,
          status: item.status === 'inactive' ? 'inactive' : 'active',
          order: item.order ? Number(item.order) : currentOrder++,
          createdBy: req.user?.email || 'ADMIN',
        });

        createdSliders.push(created);
      }

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: `Successfully uploaded ${createdSliders.length} sliders`,
        data: createdSliders,
      });
    } catch (error: any) {
      console.error('[SliderController.adminBulkCreateSliders] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to bulk create sliders',
      });
    }
  },

  /**
   * SuperAdmin: Update slider details
   * PUT /api/admin/sliders/:id
   */
  async adminUpdateSlider(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        image,
        imageUrl,
        base64Image,
        title,
        link,
        type,
        status,
        order,
      } = req.body;

      const slider = await Slider.findById(id);
      if (!slider) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Slider not found',
        });
        return;
      }

      // Check if image is being updated
      let newImageUrl = imageUrl || image;
      const rawBase64 = base64Image || (newImageUrl && newImageUrl.startsWith('data:') ? newImageUrl : '');

      if (rawBase64) {
        const stored = await StorageService.saveImageBase64(rawBase64, title || 'slider', 'sliders');
        newImageUrl = stored.url;
      }

      if (newImageUrl) {
        slider.image = newImageUrl;
        slider.imageUrl = newImageUrl;
      }

      if (title !== undefined) slider.title = title.trim();
      if (link !== undefined) slider.link = link.trim();
      if (type !== undefined && ['parent', 'child'].includes(type)) {
        slider.type = type as SliderType;
      }
      if (status !== undefined && ['active', 'inactive'].includes(status)) {
        slider.status = status as SliderStatus;
      }
      if (order !== undefined) {
        const numOrder = Number(order);
        if (!isNaN(numOrder) && numOrder >= 1) {
          slider.order = numOrder;
        }
      }

      slider.updatedBy = req.user?.email || 'ADMIN';
      await slider.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Slider updated successfully',
        data: slider,
      });
    } catch (error: any) {
      console.error('[SliderController.adminUpdateSlider] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update slider',
      });
    }
  },

  /**
   * SuperAdmin: Toggle status (active/inactive)
   * PATCH /api/admin/sliders/:id/status
   */
  async adminUpdateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const slider = await Slider.findById(id);
      if (!slider) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Slider not found',
        });
        return;
      }

      if (status && ['active', 'inactive'].includes(status)) {
        slider.status = status as SliderStatus;
      } else {
        // Toggle
        slider.status = slider.status === 'active' ? 'inactive' : 'active';
      }

      slider.updatedBy = req.user?.email || 'ADMIN';
      await slider.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Slider status changed to ${slider.status}`,
        data: slider,
      });
    } catch (error: any) {
      console.error('[SliderController.adminUpdateStatus] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update slider status',
      });
    }
  },

  /**
   * SuperAdmin: Reorder sliders
   * PUT /api/admin/sliders/reorder
   */
  async adminReorderSliders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { items } = req.body; // Array<{ id: string, order: number }>
      if (!Array.isArray(items)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Invalid items array for reordering',
        });
        return;
      }

      const updates = items.map((item) =>
        Slider.findByIdAndUpdate(item.id, { order: Number(item.order) })
      );

      await Promise.all(updates);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Sliders reordered successfully',
      });
    } catch (error: any) {
      console.error('[SliderController.adminReorderSliders] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to reorder sliders',
      });
    }
  },

  /**
   * SuperAdmin: Delete slider
   * DELETE /api/admin/sliders/:id
   */
  async adminDeleteSlider(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const slider = await Slider.findById(id);
      if (!slider) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Slider not found',
        });
        return;
      }

      // If stored locally under /uploads/sliders/, optionally clean up disk
      if (slider.image && slider.image.startsWith('/uploads/sliders/')) {
        const key = slider.image.replace('/uploads/sliders/', '');
        await StorageService.deleteImageByKey(key, 'sliders').catch(() => null);
      }

      await Slider.findByIdAndDelete(id);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Slider deleted successfully',
      });
    } catch (error: any) {
      console.error('[SliderController.adminDeleteSlider] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete slider',
      });
    }
  },
};
export default SliderController;
