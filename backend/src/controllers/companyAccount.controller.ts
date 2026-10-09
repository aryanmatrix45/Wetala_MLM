import { Request, Response } from 'express';
import { CompanyAccount } from '../models/CompanyAccount.model';
import { StorageService } from '../services/storage.service';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

export const CompanyAccountController = {
  /**
   * Get Current Company Account Details (Bank, UPI, QR Code)
   * Accessible to all authenticated users (both Members and Admins)
   * GET /api/company-account
   */
  async getAccount(_req: Request, res: Response): Promise<void> {
    try {
      const account = await CompanyAccount.getOrCreateDefault();
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: account,
      });
    } catch (error: any) {
      console.error('[CompanyAccountController.getAccount] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch company account details',
      });
    }
  },

  /**
   * Update Company Account Details
   * Accessible only to Admin / SuperAdmin
   * PUT /api/company-account
   */
  async updateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SUPERADMIN) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          status: false,
          message: 'Access denied: Only administrators can update company account details.',
        });
        return;
      }

      const {
        bankName,
        accountHolderName,
        accountNumber,
        ifscCode,
        branchName,
        accountType,
        upiId,
        upiHolderName,
        qrCodeUrl,
        depositInstructions,
        supportPhone,
        supportEmail,
        isActive,
      } = req.body;

      const account = await CompanyAccount.getOrCreateDefault();

      if (bankName !== undefined) account.bankName = bankName.trim();
      if (accountHolderName !== undefined) account.accountHolderName = accountHolderName.trim();
      if (accountNumber !== undefined) account.accountNumber = accountNumber.trim();
      if (ifscCode !== undefined) account.ifscCode = ifscCode.trim().toUpperCase();
      if (branchName !== undefined) account.branchName = branchName.trim();
      if (accountType !== undefined) account.accountType = accountType.trim();
      if (upiId !== undefined) account.upiId = upiId.trim().toLowerCase();
      if (upiHolderName !== undefined) account.upiHolderName = upiHolderName.trim();
      if (qrCodeUrl !== undefined) account.qrCodeUrl = qrCodeUrl.trim();
      if (depositInstructions !== undefined) account.depositInstructions = depositInstructions.trim();
      if (supportPhone !== undefined) account.supportPhone = supportPhone.trim();
      if (supportEmail !== undefined) account.supportEmail = supportEmail.trim();
      if (isActive !== undefined) account.isActive = Boolean(isActive);

      account.updatedBy = req.user?.email || 'ADMIN';
      await account.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Company payment details updated successfully.',
        data: account,
      });
    } catch (error: any) {
      console.error('[CompanyAccountController.updateAccount] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to update company account details',
      });
    }
  },

  /**
   * Upload / Replace Payment QR Code Image
   * Accessible only to Admin / SuperAdmin
   * POST /api/company-account/upload-qr
   */
  async uploadQRCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SUPERADMIN) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          status: false,
          message: 'Access denied: Only administrators can upload company QR codes.',
        });
        return;
      }

      const { image, base64Image } = req.body;
      const targetImage = image || base64Image;

      if (!targetImage) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Base64 image data is required.',
        });
        return;
      }

      const account = await CompanyAccount.getOrCreateDefault();

      // If existing QR code file exists, delete it first to keep storage lean
      if (account.qrCodeKey) {
        await StorageService.deleteImageByKey(account.qrCodeKey, 'accounts').catch(() => null);
      }

      const stored = await StorageService.saveImageBase64(targetImage, 'company_payment_qr', 'accounts');

      account.qrCodeUrl = stored.url;
      account.qrCodeKey = stored.key;
      account.updatedBy = req.user?.email || 'ADMIN';
      await account.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Company Payment QR Code uploaded and published successfully.',
        data: {
          qrCodeUrl: account.qrCodeUrl,
          qrCodeKey: account.qrCodeKey,
          account,
        },
      });
    } catch (error: any) {
      console.error('[CompanyAccountController.uploadQRCode] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to upload QR code image',
      });
    }
  },

  /**
   * Remove / Clear Payment QR Code Image
   * Accessible only to Admin / SuperAdmin
   * DELETE /api/company-account/qr
   */
  async removeQRCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SUPERADMIN) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          status: false,
          message: 'Access denied: Only administrators can modify company payment details.',
        });
        return;
      }

      const account = await CompanyAccount.getOrCreateDefault();

      if (account.qrCodeKey) {
        await StorageService.deleteImageByKey(account.qrCodeKey, 'accounts').catch(() => null);
      }

      account.qrCodeUrl = '';
      account.qrCodeKey = '';
      account.updatedBy = req.user?.email || 'ADMIN';
      await account.save();

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Payment QR Code removed successfully.',
        data: account,
      });
    } catch (error: any) {
      console.error('[CompanyAccountController.removeQRCode] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to remove QR code',
      });
    }
  },
};

export default CompanyAccountController;
