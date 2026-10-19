import { Request, Response } from 'express';
import { AboutSection, normalizeDirectImageUrl } from '../models/AboutSection.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const AboutSectionController = {
  // ==========================================
  // PUBLIC / MEMBER: Get Active About Sections
  // ==========================================
  getPublicSections: async (_req: Request, res: Response): Promise<void> => {
    try {
      await AboutSection.seedDefaults();

      const sections = await AboutSection.find({ status: 'ACTIVE' }).sort({
        order: 1,
        createdAt: 1,
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: sections,
      });
    } catch (error: any) {
      console.error('[AboutSectionController.getPublicSections] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch about sections',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Get All About Sections
  // ==========================================
  adminGetSections: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await AboutSection.seedDefaults();

      const sections = await AboutSection.find().sort({ order: 1, createdAt: 1 });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: sections,
      });
    } catch (error: any) {
      console.error('[AboutSectionController.adminGetSections] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch about sections',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Create About Section
  // ==========================================
  adminCreateSection: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { title, subtitle, description, imageUrl, status, order } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      if (!title || !title.trim()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Title is mandatory',
        });
        return;
      }

      if (!description || !description.trim()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Description is required',
        });
        return;
      }

      const normalizedImage = normalizeDirectImageUrl(imageUrl);

      const doc = await AboutSection.create({
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : '',
        description: description.trim(),
        imageUrl: normalizedImage,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        order: Number(order) || 1,
        updatedBy: String(adminId),
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'About section created successfully',
        data: doc,
      });
    } catch (error: any) {
      console.error('[AboutSectionController.adminCreateSection] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create about section',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Update About Section
  // ==========================================
  adminUpdateSection: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, subtitle, description, imageUrl, status, order } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      const updateData: any = {
        updatedBy: String(adminId),
      };

      if (title !== undefined) {
        if (!title.trim()) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Title cannot be empty',
          });
          return;
        }
        updateData.title = title.trim();
      }

      if (subtitle !== undefined) updateData.subtitle = subtitle.trim();
      if (description !== undefined) {
        if (!description.trim()) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Description cannot be empty',
          });
          return;
        }
        updateData.description = description.trim();
      }

      if (imageUrl !== undefined) {
        updateData.imageUrl = normalizeDirectImageUrl(imageUrl);
      }

      if (status !== undefined) {
        updateData.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      if (order !== undefined) {
        updateData.order = Number(order) || 1;
      }

      const doc = await AboutSection.findByIdAndUpdate(id, updateData, { new: true });
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'About section not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'About section updated successfully',
        data: doc,
      });
    } catch (error: any) {
      console.error('[AboutSectionController.adminUpdateSection] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update about section',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Toggle Status (ACTIVE / INACTIVE)
  // ==========================================
  adminToggleStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const doc = await AboutSection.findById(id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'About section not found',
        });
        return;
      }

      if (status) {
        doc.status = status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      } else {
        doc.status = doc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }

      doc.updatedBy = String(req.user?.id || 'SuperAdmin');
      await doc.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `About section is now ${doc.status === 'ACTIVE' ? 'Active' : 'Inactive'}`,
        data: doc,
      });
    } catch (error: any) {
      console.error('[AboutSectionController.adminToggleStatus] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to toggle status',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Delete About Section
  // ==========================================
  adminDeleteSection: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const doc = await AboutSection.findByIdAndDelete(id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'About section not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'About section deleted successfully',
      });
    } catch (error: any) {
      console.error('[AboutSectionController.adminDeleteSection] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete about section',
      });
    }
  },
};

export default AboutSectionController;
