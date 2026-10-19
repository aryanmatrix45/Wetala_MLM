import { Request, Response } from 'express';
import { FooterConfig, normalizeDirectImageUrl } from '../models/FooterConfig.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const FooterController = {
  /**
   * Get Current Footer Configuration
   * Public & Member accessible (No login required)
   * GET /api/footer
   */
  async getFooter(_req: Request, res: Response): Promise<void> {
    try {
      const config = await FooterConfig.getOrCreateDefault();
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: config,
      });
    } catch (error: any) {
      console.error('[FooterController.getFooter] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch footer configuration',
      });
    }
  },

  /**
   * Admin: Get Footer Configuration
   * GET /api/admin/footer
   */
  async adminGetFooter(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config = await FooterConfig.getOrCreateDefault();
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: config,
      });
    } catch (error: any) {
      console.error('[FooterController.adminGetFooter] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch footer configuration',
      });
    }
  },

  /**
   * Admin: Update Footer Configuration
   * PUT /api/admin/footer
   */
  async adminUpdateFooter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config = await FooterConfig.getOrCreateDefault();

      const {
        brandName,
        brandTrademark,
        tagline,
        logoUrl,
        aboutText,
        helpTitle,
        helpLinks,
        customerCareTitle,
        customerCareLinks,
        contactTitle,
        operatingAddressTitle,
        operatingAddress,
        corporateAddressTitle,
        corporateAddress,
        emailTitle,
        emails,
        phoneTitle,
        phoneNumbers,
        businessHoursTitle,
        businessHoursWeekdays,
        businessHoursWeekend,
        showSocialLinks,
        copyrightText,
        disclaimerText,
      } = req.body;

      if (brandName !== undefined) config.brandName = String(brandName).trim();
      if (brandTrademark !== undefined) config.brandTrademark = String(brandTrademark).trim();
      if (tagline !== undefined) config.tagline = String(tagline).trim();
      if (logoUrl !== undefined) config.logoUrl = normalizeDirectImageUrl(logoUrl);
      if (aboutText !== undefined) config.aboutText = String(aboutText).trim();

      if (helpTitle !== undefined) config.helpTitle = String(helpTitle).trim();
      if (Array.isArray(helpLinks)) {
        config.helpLinks = helpLinks.map((item: any, idx: number) => ({
          label: String(item.label || '').trim(),
          url: String(item.url || '#').trim(),
          openInNewTab: Boolean(item.openInNewTab),
          isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          order: item.order !== undefined ? Number(item.order) : idx + 1,
        }));
      }

      if (customerCareTitle !== undefined) config.customerCareTitle = String(customerCareTitle).trim();
      if (Array.isArray(customerCareLinks)) {
        config.customerCareLinks = customerCareLinks.map((item: any, idx: number) => ({
          label: String(item.label || '').trim(),
          url: String(item.url || '#').trim(),
          openInNewTab: Boolean(item.openInNewTab),
          isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          order: item.order !== undefined ? Number(item.order) : idx + 1,
        }));
      }

      if (contactTitle !== undefined) config.contactTitle = String(contactTitle).trim();
      if (operatingAddressTitle !== undefined) config.operatingAddressTitle = String(operatingAddressTitle).trim();
      if (operatingAddress !== undefined) config.operatingAddress = String(operatingAddress).trim();
      if (corporateAddressTitle !== undefined) config.corporateAddressTitle = String(corporateAddressTitle).trim();
      if (corporateAddress !== undefined) config.corporateAddress = String(corporateAddress).trim();

      if (emailTitle !== undefined) config.emailTitle = String(emailTitle).trim();
      if (Array.isArray(emails)) {
        config.emails = emails.map((e: any) => String(e).trim()).filter(Boolean);
      }
      if (phoneTitle !== undefined) config.phoneTitle = String(phoneTitle).trim();
      if (Array.isArray(phoneNumbers)) {
        config.phoneNumbers = phoneNumbers.map((p: any) => String(p).trim()).filter(Boolean);
      }

      if (businessHoursTitle !== undefined) config.businessHoursTitle = String(businessHoursTitle).trim();
      if (businessHoursWeekdays !== undefined) config.businessHoursWeekdays = String(businessHoursWeekdays).trim();
      if (businessHoursWeekend !== undefined) config.businessHoursWeekend = String(businessHoursWeekend).trim();

      if (showSocialLinks !== undefined) config.showSocialLinks = Boolean(showSocialLinks);
      if (copyrightText !== undefined) config.copyrightText = String(copyrightText).trim();
      if (disclaimerText !== undefined) config.disclaimerText = String(disclaimerText).trim();

      config.updatedBy = req.user?.id || 'Admin';

      await config.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Footer configuration updated successfully',
        data: config,
      });
    } catch (error: any) {
      console.error('[FooterController.adminUpdateFooter] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update footer configuration',
      });
    }
  },

  /**
   * Admin: Reset Footer Configuration to Defaults
   * POST /api/admin/footer/reset
   */
  async adminResetFooter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await FooterConfig.deleteOne({ configId: 'DEFAULT_FOOTER_CONFIG' });
      const newConfig = await FooterConfig.getOrCreateDefault();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Footer configuration reset to factory defaults',
        data: newConfig,
      });
    } catch (error: any) {
      console.error('[FooterController.adminResetFooter] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to reset footer configuration',
      });
    }
  },
};
