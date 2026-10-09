import fs from 'fs';
import path from 'path';

// Target directory for uploads
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const PRODUCT_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'products');
const ACCOUNTS_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'accounts');

// Ensure upload directories exist
for (const dir of [PRODUCT_UPLOAD_DIR, ACCOUNTS_UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface StoredImageResult {
  url: string;
  key: string;
  originalName?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export const StorageService = {
  getUploadDir(subfolder: string = 'products'): string {
    return subfolder === 'accounts' ? ACCOUNTS_UPLOAD_DIR : PRODUCT_UPLOAD_DIR;
  },

  /**
   * Save an image from a base64 string or binary buffer
   */
  async saveImageBase64(
    base64Data: string,
    filenameHint: string = 'image',
    subfolder: string = 'products'
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
    const prefix = subfolder === 'accounts' ? 'qr' : 'prod';
    const key = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const targetDir = subfolder === 'accounts' ? ACCOUNTS_UPLOAD_DIR : PRODUCT_UPLOAD_DIR;
    const filePath = path.join(targetDir, key);

    const buffer = Buffer.from(base64String, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    return {
      url: `/uploads/${subfolder}/${key}`,
      key,
      originalName: safeHint + ext,
      sizeBytes: buffer.length,
      mimeType,
    };
  },

  /**
   * Delete image file by its key
   */
  async deleteImageByKey(key: string, subfolder: string = 'products'): Promise<boolean> {
    if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
      return false;
    }
    const targetDir = subfolder === 'accounts' ? ACCOUNTS_UPLOAD_DIR : PRODUCT_UPLOAD_DIR;
    const filePath = path.join(targetDir, key);
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
