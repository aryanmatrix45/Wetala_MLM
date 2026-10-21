import { Request, Response } from 'express';
import {
  HomeHighlight,
  HomeHighlightSettings,
  HIGHLIGHT_ICON_KEYS,
} from '../models/HomeHighlight.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const SETTINGS_KEY = 'DEFAULT_HOME_HIGHLIGHT_SETTINGS';
const SPEEDS = ['SLOW', 'NORMAL', 'FAST'];

const isValidIcon = (icon: unknown) => typeof icon === 'string' && (HIGHLIGHT_ICON_KEYS as readonly string[]).includes(icon);

const fail = (res: Response, error: any, fallback: string, where: string) => {
  console.error(`[HomeHighlightController.${where}] Error:`, error);
  const isValidation = error?.name === 'ValidationError' || error?.name === 'CastError';
  res.status(isValidation ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    status: false,
    message: error?.message || fallback,
  });
};

export const HomeHighlightController = {
  // ==========================================
  // PUBLIC / MEMBER: Section settings & active cards
  // ==========================================
  getPublicHighlights: async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings = await HomeHighlight.seedDefaults();
      const highlights = settings.isActive
        ? await HomeHighlight.find({ status: 'ACTIVE' }).sort({ order: 1, createdAt: 1 })
        : [];

      res.status(HTTP_STATUS.OK).json({ status: true, data: { settings, highlights } });
    } catch (error: any) {
      fail(res, error, 'Failed to fetch highlights', 'getPublicHighlights');
    }
  },

  // ==========================================
  // SUPERADMIN: Settings & all cards
  // ==========================================
  adminGetHighlights: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const settings = await HomeHighlight.seedDefaults();
      const highlights = await HomeHighlight.find().sort({ order: 1, createdAt: 1 });
      res.status(HTTP_STATUS.OK).json({ status: true, data: { settings, highlights } });
    } catch (error: any) {
      fail(res, error, 'Failed to fetch highlights', 'adminGetHighlights');
    }
  },

  // ==========================================
  // SUPERADMIN: Update section heading, subheading, visibility & speed
  // ==========================================
  adminUpdateSettings: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { heading, subheading, isActive, scrollSpeed } = req.body;

      let settings = await HomeHighlightSettings.findOne({ settingsKey: SETTINGS_KEY });
      if (!settings) settings = new HomeHighlightSettings({ settingsKey: SETTINGS_KEY });

      if (heading !== undefined) settings.heading = String(heading).trim();
      if (subheading !== undefined) settings.subheading = String(subheading).trim();
      if (isActive !== undefined) settings.isActive = Boolean(isActive);
      if (scrollSpeed !== undefined) {
        if (!SPEEDS.includes(scrollSpeed)) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Scroll speed must be SLOW, NORMAL or FAST' });
          return;
        }
        settings.scrollSpeed = scrollSpeed;
      }
      settings.updatedBy = String(req.user?.id || 'SuperAdmin');
      await settings.save();

      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Highlights section updated', data: settings });
    } catch (error: any) {
      fail(res, error, 'Failed to update highlight settings', 'adminUpdateSettings');
    }
  },

  // ==========================================
  // SUPERADMIN: Create card
  // ==========================================
  adminCreateHighlight: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { icon, title, subtitle, isHighlighted, order, status } = req.body;

      if (!title || !String(title).trim()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Card title is required' });
        return;
      }
      if (icon !== undefined && !isValidIcon(icon)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Please choose a valid icon' });
        return;
      }

      const doc = await HomeHighlight.create({
        icon: icon || 'leaf',
        title: String(title).trim(),
        subtitle: subtitle ? String(subtitle).trim() : '',
        isHighlighted: Boolean(isHighlighted),
        order: Number(order) || 1,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        updatedBy: String(req.user?.id || 'SuperAdmin'),
      });

      res.status(HTTP_STATUS.CREATED).json({ status: true, message: 'Card added', data: doc });
    } catch (error: any) {
      fail(res, error, 'Failed to create card', 'adminCreateHighlight');
    }
  },

  // ==========================================
  // SUPERADMIN: Update card
  // ==========================================
  adminUpdateHighlight: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { icon, title, subtitle, isHighlighted, order, status } = req.body;
      const update: Record<string, unknown> = { updatedBy: String(req.user?.id || 'SuperAdmin') };

      if (title !== undefined) {
        if (!String(title).trim()) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Card title cannot be empty' });
          return;
        }
        update.title = String(title).trim();
      }
      if (icon !== undefined) {
        if (!isValidIcon(icon)) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Please choose a valid icon' });
          return;
        }
        update.icon = icon;
      }
      if (subtitle !== undefined) update.subtitle = String(subtitle).trim();
      if (isHighlighted !== undefined) update.isHighlighted = Boolean(isHighlighted);
      if (order !== undefined) update.order = Number(order) || 1;
      if (status !== undefined) update.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const doc = await HomeHighlight.findByIdAndUpdate(id, update, { new: true, runValidators: true });
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Card not found' });
        return;
      }
      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Card updated', data: doc });
    } catch (error: any) {
      fail(res, error, 'Failed to update card', 'adminUpdateHighlight');
    }
  },

  // ==========================================
  // SUPERADMIN: Toggle card visibility
  // ==========================================
  adminToggleStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const doc = await HomeHighlight.findById(req.params.id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Card not found' });
        return;
      }
      const { status } = req.body;
      doc.status = status ? (status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE') : doc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      doc.updatedBy = String(req.user?.id || 'SuperAdmin');
      await doc.save();
      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: `Card is now ${doc.status === 'ACTIVE' ? 'visible' : 'hidden'}`,
        data: doc,
      });
    } catch (error: any) {
      fail(res, error, 'Failed to change card status', 'adminToggleStatus');
    }
  },

  // ==========================================
  // SUPERADMIN: Delete card
  // ==========================================
  adminDeleteHighlight: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const doc = await HomeHighlight.findByIdAndDelete(req.params.id);
      if (!doc) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Card not found' });
        return;
      }
      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Card deleted' });
    } catch (error: any) {
      fail(res, error, 'Failed to delete card', 'adminDeleteHighlight');
    }
  },
};

export default HomeHighlightController;
