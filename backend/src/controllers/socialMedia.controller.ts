import { Request, Response } from 'express';
import { SocialLink, ISocialLink } from '../models/SocialLink.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const SocialMediaController = {
  // ==========================================
  // PUBLIC / MEMBER: Get Active Social Links
  // ==========================================
  getPublicLinks: async (_req: Request, res: Response): Promise<void> => {
    try {
      // Ensure default platforms exist
      await SocialLink.seedDefaults();

      // Only return links that are active and have a non-empty URL
      const links = await SocialLink.find({
        isActive: true,
        url: { $exists: true, $ne: '' },
      }).sort({ order: 1, createdAt: 1 });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: links,
      });
    } catch (error: any) {
      console.error('[SocialMediaController.getPublicLinks] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch social media links',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Get All Social Links
  // ==========================================
  adminGetLinks: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await SocialLink.seedDefaults();

      const links = await SocialLink.find().sort({ order: 1, createdAt: 1 });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: links,
      });
    } catch (error: any) {
      console.error('[SocialMediaController.adminGetLinks] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch social links',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Bulk Update Social Links
  // ==========================================
  adminBulkUpdateLinks: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { links } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      if (!Array.isArray(links)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Expected array of social media links',
        });
        return;
      }

      const updatedLinks: ISocialLink[] = [];

      for (const item of links) {
        if (!item._id && !item.platform) continue;

        const updateData: any = {
          updatedBy: String(adminId),
        };

        if (item.title !== undefined) updateData.title = String(item.title).trim();
        if (item.subtitle !== undefined) updateData.subtitle = String(item.subtitle).trim();
        if (item.url !== undefined) updateData.url = String(item.url).trim();
        if (item.isActive !== undefined) updateData.isActive = Boolean(item.isActive);
        if (item.order !== undefined) updateData.order = Number(item.order) || 0;
        if (item.icon !== undefined) updateData.icon = String(item.icon).trim();

        if (item._id) {
          const doc = await SocialLink.findByIdAndUpdate(item._id, updateData, {
            new: true,
          });
          if (doc) updatedLinks.push(doc);
        } else if (item.platform) {
          const doc = await SocialLink.findOneAndUpdate(
            { platform: item.platform },
            { $set: updateData },
            { new: true, upsert: true }
          );
          if (doc) updatedLinks.push(doc);
        }
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Social media links updated successfully',
        data: updatedLinks,
      });
    } catch (error: any) {
      console.error('[SocialMediaController.adminBulkUpdateLinks] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to bulk update social links',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Create or Add New Social Link
  // ==========================================
  adminCreateLink: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { platform, title, subtitle, url, icon, isActive, order } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      if (!title || !platform) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Platform and title are required',
        });
        return;
      }

      const doc = await SocialLink.create({
        platform,
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : '',
        url: url ? url.trim() : '',
        icon: icon ? icon.trim() : '',
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        order: Number(order) || 0,
        updatedBy: String(adminId),
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Social link created successfully',
        data: doc,
      });
    } catch (error: any) {
      console.error('[SocialMediaController.adminCreateLink] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create social link',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Update Single Social Link
  // ==========================================
  adminUpdateLink: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, subtitle, url, icon, isActive, order } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      const updateData: any = {
        updatedBy: String(adminId),
      };

      if (title !== undefined) updateData.title = String(title).trim();
      if (subtitle !== undefined) updateData.subtitle = String(subtitle).trim();
      if (url !== undefined) updateData.url = String(url).trim();
      if (icon !== undefined) updateData.icon = String(icon).trim();
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (order !== undefined) updateData.order = Number(order) || 0;

      const doc = await SocialLink.findByIdAndUpdate(id, updateData, { new: true });
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Social link not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Social link updated successfully',
        data: doc,
      });
    } catch (error: any) {
      console.error('[SocialMediaController.adminUpdateLink] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update social link',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Toggle Status (Active / Inactive)
  // ==========================================
  adminToggleStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const doc = await SocialLink.findById(id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Social link not found',
        });
        return;
      }

      doc.isActive = isActive !== undefined ? Boolean(isActive) : !doc.isActive;
      doc.updatedBy = String(req.user?.id || 'SuperAdmin');
      await doc.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Social link ${doc.isActive ? 'activated' : 'deactivated'}`,
        data: doc,
      });
    } catch (error: any) {
      console.error('[SocialMediaController.adminToggleStatus] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update status',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Delete Social Link
  // ==========================================
  adminDeleteLink: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const doc = await SocialLink.findByIdAndDelete(id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Social link not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Social link deleted successfully',
      });
    } catch (error: any) {
      console.error('[SocialMediaController.adminDeleteLink] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete social link',
      });
    }
  },
};

export default SocialMediaController;
