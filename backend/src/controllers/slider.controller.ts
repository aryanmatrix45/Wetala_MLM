import { Request, Response } from 'express';
import { Slider, ISlider, SliderType, SliderStatus } from '../models/Slider.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { StorageService } from '../services/storage.service';

// Exact banner resolutions the member home slider is designed around (keep in sync with frontend SLIDER_SPECS)
const SLIDER_BACKEND_SPECS: Record<string, { width: number; height: number; label: string }> = {
  parent: { width: 1920, height: 480, label: 'Desktop slider' },
  child: { width: 1080, height: 540, label: 'Mobile slider' },
};

function normalizeDirectImageUrl(url?: string): string {
  if (!url) return '';
  let trimmed = url.trim();
  const gDriveMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]+)/i);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}=s0`;
  }
  if (trimmed.includes('dropbox.com')) {
    trimmed = trimmed.replace(/\?dl=0$/, '?raw=1').replace(/&dl=0$/, '&raw=1');
    if (!trimmed.includes('raw=1')) {
      trimmed += (trimmed.includes('?') ? '&' : '?') + 'raw=1';
    }
    return trimmed;
  }
  return trimmed;
}

function parseImageBufferDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG: bytes 16-23
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 marker
  if (buf.length >= 8 && buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] === 0xFF && (buf[i + 1] >= 0xC0 && buf[i + 1] <= 0xC3)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i++;
    }
  }
  // WEBP
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const type = buf.toString('ascii', 12, 16);
    if (type === 'VP8 ') {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    } else if (type === 'VP8L') {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return { width: 1 + (((b1 & 0x3F) << 8) | b0), height: 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6)) };
    } else if (type === 'VP8X') {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  }
  return null;
}

/**
 * Returns an error message when a base64 image does not match the exact slider resolution,
 * or null when it matches (or its dimensions cannot be parsed).
 */
function getSliderDimensionError(rawBase64: string, type: string): string | null {
  try {
    const matches = rawBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buf = matches && matches[2] ? Buffer.from(matches[2], 'base64') : Buffer.from(rawBase64, 'base64');
    const dims = parseImageBufferDimensions(buf);
    const spec = SLIDER_BACKEND_SPECS[type] || SLIDER_BACKEND_SPECS.parent;
    if (dims && (dims.width !== spec.width || dims.height !== spec.height)) {
      return `Image dimensions (${dims.width}x${dims.height}px) are not allowed. ${spec.label} images must be exactly ${spec.width}x${spec.height}px.`;
    }
  } catch (e) {
    // Continue if dimension parse fails on custom formats
  }
  return null;
}

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

      const sliderType: SliderType = type === 'child' ? 'child' : 'parent';
      const sliderStatus: SliderStatus = status === 'inactive' ? 'inactive' : 'active';

      let finalImageUrl = normalizeDirectImageUrl(imageUrl || image || '');

      // If base64 image data is provided, validate dimensions and save to disk
      const rawBase64 = base64Image || (image && image.startsWith('data:') ? image : '');
      if (rawBase64) {
        const dimensionError = getSliderDimensionError(rawBase64, sliderType);
        if (dimensionError) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: dimensionError });
          return;
        }

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
        let finalImageUrl = normalizeDirectImageUrl(item.imageUrl || item.image || item.url || '');
        const rawBase64 = item.base64 || (finalImageUrl && finalImageUrl.startsWith('data:') ? finalImageUrl : '');

        if (rawBase64) {
          // Skip items that are not the exact required resolution in bulk
          if (getSliderDimensionError(rawBase64, sliderType)) {
            continue;
          }

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
      let newImageUrl = normalizeDirectImageUrl(imageUrl || image);
      const rawBase64 = base64Image || (newImageUrl && newImageUrl.startsWith('data:') ? newImageUrl : '');

      if (rawBase64) {
        const targetType = type === 'child' || type === 'parent' ? type : slider.type;
        const dimensionError = getSliderDimensionError(rawBase64, targetType);
        if (dimensionError) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: dimensionError });
          return;
        }
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
