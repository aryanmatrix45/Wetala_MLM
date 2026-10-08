import fs from 'fs';
import path from 'path';

// Target directory for uploaded product images
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const PRODUCT_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'products');

// Ensure upload directory exists
if (!fs.existsSync(PRODUCT_UPLOAD_DIR)) {
  fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
}

export interface StoredImageResult {
  url: string;
  key: string;
  originalName?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export const StorageService = {
  getUploadDir(): string {
    return PRODUCT_UPLOAD_DIR;
  },

  /**
   * Save an image from a base64 string or binary buffer
   */
  async saveImageBase64(
    base64Data: string,
    filenameHint: string = 'product_image'
  ): Promise<StoredImageResult> {
    // Check if base64 has a data URL prefix
    let mimeType = 'image/jpeg';
    let base64String = base64Data;

    const matches = base64Data.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64String = matches[2];
    }

    // Determine extension
    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('gif')) ext = '.gif';

    const safeHint = filenameHint
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const key = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(PRODUCT_UPLOAD_DIR, key);

    const buffer = Buffer.from(base64String, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    return {
      url: `/uploads/products/${key}`,
      key,
      originalName: safeHint + ext,
      sizeBytes: buffer.length,
      mimeType,
    };
  },

  /**
   * Delete image file by its key
   */
  async deleteImageByKey(key: string): Promise<boolean> {
    if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
      return false;
    }
    const filePath = path.join(PRODUCT_UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
        return true;
      } catch (err) {
        console.error(`[StorageService] Failed to unlink file ${filePath}:`, err);
        return false;
      }
    }
    return false;
  },
};
