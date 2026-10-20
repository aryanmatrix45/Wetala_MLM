import { getGoogleDriveFileId } from '../services/api';

export const KYC_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const KYC_ACCEPT_ATTR = KYC_ACCEPTED_TYPES.join(',');
export const KYC_MAX_SOURCE_MB = 10;

// Must stay within the backend limit (KYC_MAX_IMAGE_BYTES in storage.service.ts)
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_DIMENSION = 2000;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image. Please choose a JPG, PNG or WebP file.'));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read the processed image.'));
    reader.readAsDataURL(blob);
  });

/**
 * Validates a KYC image chosen by the user and re-encodes it as a JPEG data URL, scaled down to
 * at most 2000px. Re-encoding keeps uploads small and strips metadata such as GPS location.
 * Throws an Error with a user-facing message when the file is not acceptable.
 */
export async function prepareKycImage(file: File): Promise<string> {
  if (!KYC_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Unsupported file type. Please upload a JPG, PNG or WebP image.');
  }
  if (file.size > KYC_MAX_SOURCE_MB * 1024 * 1024) {
    throw new Error(`File is too large. Maximum size is ${KYC_MAX_SOURCE_MB} MB.`);
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');

  // JPEG has no transparency; paint white so transparent PNGs (e.g. QR codes) stay readable
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.88, 0.75, 0.6]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      return blobToDataUrl(blob);
    }
  }
  throw new Error('This image is too detailed to upload. Please choose a smaller image.');
}

/** True for a Google Drive link to a single file (folders and Docs links are not images). */
export const isGoogleDriveFileLink = (url: string): boolean =>
  /^https:\/\//i.test(url.trim()) && Boolean(getGoogleDriveFileId(url.trim()));
