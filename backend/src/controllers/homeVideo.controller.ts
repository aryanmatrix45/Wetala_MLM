import { Request, Response } from 'express';
import {
  HomeVideo,
  HomeVideoSettings,
  extractYouTubeId,
} from '../models/HomeVideo.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const HomeVideoController = {
  // ==========================================
  // PUBLIC / MEMBER: Get Active Header & Videos
  // ==========================================
  getPublicVideos: async (_req: Request, res: Response): Promise<void> => {
    try {
      const { settings } = await HomeVideo.seedDefaults();

      if (!settings.isActive) {
        res.status(HTTP_STATUS.OK).json({
          status: true,
          data: {
            settings,
            videos: [],
          },
        });
        return;
      }

      const videos = await HomeVideo.find({ status: 'ACTIVE' }).sort({
        order: 1,
        createdAt: 1,
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          settings,
          videos,
        },
      });
    } catch (error: any) {
      console.error('[HomeVideoController.getPublicVideos] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch videos',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Get All Settings & Videos
  // ==========================================
  adminGetVideos: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { settings } = await HomeVideo.seedDefaults();
      const videos = await HomeVideo.find().sort({ order: 1, createdAt: 1 });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          settings,
          videos,
        },
      });
    } catch (error: any) {
      console.error('[HomeVideoController.adminGetVideos] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch videos',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Update Header Settings (CKEditor Title & Subtitle)
  // ==========================================
  adminUpdateSettings: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { headerTitle, headerSubtitle, isActive } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      let settings = await HomeVideoSettings.findOne({
        settingsKey: 'DEFAULT_HOME_VIDEO_SETTINGS',
      });

      if (!settings) {
        settings = new HomeVideoSettings({
          settingsKey: 'DEFAULT_HOME_VIDEO_SETTINGS',
        });
      }

      if (headerTitle !== undefined) settings.headerTitle = headerTitle;
      if (headerSubtitle !== undefined) settings.headerSubtitle = headerSubtitle;
      if (isActive !== undefined) settings.isActive = Boolean(isActive);
      settings.updatedBy = String(adminId);

      await settings.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Video section header settings updated successfully',
        data: settings,
      });
    } catch (error: any) {
      console.error('[HomeVideoController.adminUpdateSettings] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update video settings',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Create Video Item
  // ==========================================
  adminCreateVideo: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { title, youtubeUrl, description, order, status } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      if (!title || !title.trim()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Video title is required',
        });
        return;
      }

      if (!youtubeUrl || !youtubeUrl.trim()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'YouTube URL is required',
        });
        return;
      }

      const videoId = extractYouTubeId(youtubeUrl);
      if (!videoId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Invalid YouTube link. Please provide a valid YouTube watch, share, or short link.',
        });
        return;
      }

      const doc = await HomeVideo.create({
        title: title.trim(),
        youtubeUrl: youtubeUrl.trim(),
        videoId,
        description: description ? description.trim() : '',
        order: Number(order) || 1,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        updatedBy: String(adminId),
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Video added successfully',
        data: doc,
      });
    } catch (error: any) {
      console.error('[HomeVideoController.adminCreateVideo] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to create video',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Update Video Item
  // ==========================================
  adminUpdateVideo: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, youtubeUrl, description, order, status } = req.body;
      const adminId = req.user?.id || 'SuperAdmin';

      const updateData: any = {
        updatedBy: String(adminId),
      };

      if (title !== undefined) {
        if (!title.trim()) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Video title cannot be empty',
          });
          return;
        }
        updateData.title = title.trim();
      }

      if (youtubeUrl !== undefined) {
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Invalid YouTube link. Please provide a valid YouTube link.',
          });
          return;
        }
        updateData.youtubeUrl = youtubeUrl.trim();
        updateData.videoId = videoId;
      }

      if (description !== undefined) updateData.description = description.trim();
      if (order !== undefined) updateData.order = Number(order) || 1;
      if (status !== undefined) updateData.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const doc = await HomeVideo.findByIdAndUpdate(id, updateData, { new: true });
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Video not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Video updated successfully',
        data: doc,
      });
    } catch (error: any) {
      console.error('[HomeVideoController.adminUpdateVideo] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update video',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Toggle Video Status
  // ==========================================
  adminToggleStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const doc = await HomeVideo.findById(id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Video not found',
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
        message: `Video is now ${doc.status === 'ACTIVE' ? 'Active' : 'Inactive'}`,
        data: doc,
      });
    } catch (error: any) {
      console.error('[HomeVideoController.adminToggleStatus] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to toggle status',
      });
    }
  },

  // ==========================================
  // SUPERADMIN: Delete Video
  // ==========================================
  adminDeleteVideo: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const doc = await HomeVideo.findByIdAndDelete(id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Video not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Video deleted successfully',
      });
    } catch (error: any) {
      console.error('[HomeVideoController.adminDeleteVideo] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to delete video',
      });
    }
  },
};

export default HomeVideoController;
