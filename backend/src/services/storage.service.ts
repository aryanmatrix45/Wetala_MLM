import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Target directory for uploads
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const PRODUCT_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'products');
const ACCOUNTS_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'accounts');
const SLIDER_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'sliders');

// Private storage for sensitive files (KYC documents). This directory is deliberately outside
// UPLOAD_ROOT, which Express and Nginx serve publicly; files here are only streamed through
// authenticated API routes.
const PRIVATE_UPLOAD_ROOT = path.resolve(__dirname, '../../private_uploads');
const KYC_UPLOAD_DIR = path.join(PRIVATE_UPLOAD_ROOT, 'kyc');

// Stored in the database to mark a value as a private KYC upload (vs. an external link)
export const KYC_FILE_PREFIX = 'kycfile:';
const KYC_FILE_KEY_PATTERN = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

// Image formats accepted for KYC documents, identified by their leading bytes
const KYC_IMAGE_SIGNATURES: Array<{ mimeType: string; ext: string; matches: (b: Buffer) => boolean }> = [
  { mimeType: 'image/jpeg', ext: '.jpg', matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mimeType: 'image/png',
    ext: '.png',
    matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    ext: '.webp',
    matches: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

export const KYC_MAX_IMAGE_BYTES = 3 * 1024 * 1024;

// Ensure upload directories exist
for (const dir of [PRODUCT_UPLOAD_DIR, ACCOUNTS_UPLOAD_DIR, SLIDER_UPLOAD_DIR, KYC_UPLOAD_DIR]) {
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
    if (subfolder === 'accounts') return ACCOUNTS_UPLOAD_DIR;
    if (subfolder === 'sliders') return SLIDER_UPLOAD_DIR;
    return PRODUCT_UPLOAD_DIR;
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
    const prefix = subfolder === 'accounts' ? 'qr' : (subfolder === 'sliders' ? 'slider' : 'prod');
    const key = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const targetDir = StorageService.getUploadDir(subfolder);
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
   * Decode and validate a KYC image sent as a base64 data URL. The real format is detected from
   * the file bytes (the declared MIME type is not trusted); only JPEG, PNG and WebP are accepted.
   */
  parseKycImage(dataUrl: unknown): { buffer: Buffer; ext: string; mimeType: string } | { error: string } {
    if (typeof dataUrl !== 'string') {
      return { error: 'Invalid file data.' };
    }
    const match = dataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
      return { error: 'Invalid file data. Please upload a JPG, PNG or WebP image.' };
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
      return { error: 'The uploaded file is empty.' };
    }
    if (buffer.length > KYC_MAX_IMAGE_BYTES) {
      return { error: `Image is too large. Maximum size is ${KYC_MAX_IMAGE_BYTES / (1024 * 1024)} MB.` };
    }
    const format = KYC_IMAGE_SIGNATURES.find((sig) => sig.matches(buffer));
    if (!format) {
      return { error: 'Unsupported file type. Please upload a JPG, PNG or WebP image.' };
    }
    return { buffer, ext: format.ext, mimeType: format.mimeType };
  },

  /**
   * Save a validated KYC image to private storage. Returns the reference to store in the database.
   */
  async saveKycImage(buffer: Buffer, ext: string): Promise<string> {
    const key = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    await fs.promises.writeFile(path.join(KYC_UPLOAD_DIR, key), buffer, { mode: 0o600 });
    return `${KYC_FILE_PREFIX}${key}`;
  },

  isValidKycFileKey(key: string): boolean {
    return KYC_FILE_KEY_PATTERN.test(key);
  },

  /** Absolute path of a private KYC file, or null when the key is malformed or missing on disk. */
  getKycFilePath(key: string): string | null {
    if (!StorageService.isValidKycFileKey(key)) return null;
    const filePath = path.join(KYC_UPLOAD_DIR, key);
    return fs.existsSync(filePath) ? filePath : null;
  },

  /** Delete a private KYC file given its stored reference; ignores external links. */
  async deleteKycImage(reference?: string): Promise<void> {
    if (!reference || !reference.startsWith(KYC_FILE_PREFIX)) return;
    const filePath = StorageService.getKycFilePath(reference.slice(KYC_FILE_PREFIX.length));
    if (filePath) {
      await fs.promises.unlink(filePath).catch((err) => {
        console.error(`[StorageService] Failed to delete KYC file ${filePath}:`, err);
      });
    }
  },

  /**
   * Delete image file by its key
   */
  async deleteImageByKey(key: string, subfolder: string = 'products'): Promise<boolean> {
    if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
      return false;
    }
    const targetDir = StorageService.getUploadDir(subfolder);
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
