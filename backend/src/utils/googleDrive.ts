/**
 * Google Drive link helpers.
 *
 * Accepts the share-link formats Drive produces for a single file:
 *   https://drive.google.com/file/d/<id>/view?usp=sharing
 *   https://drive.google.com/open?id=<id>
 *   https://drive.google.com/uc?export=view&id=<id>
 *   https://lh3.googleusercontent.com/d/<id>
 */
const DRIVE_FILE_PATTERNS = [
  /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/i,
  /^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]{10,})/i,
  /^https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/i,
];

export const extractGoogleDriveFileId = (url?: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  for (const pattern of DRIVE_FILE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
};

/** Direct image URL for a Drive file id (renders in <img> when the file is shared publicly). */
export const toGoogleDriveImageUrl = (fileId: string): string =>
  `https://lh3.googleusercontent.com/d/${fileId}=s0`;
