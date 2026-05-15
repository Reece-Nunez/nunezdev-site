export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.heic',
  '.heif',
  '.pdf',
];

// MIME types that browsers cannot render natively in an <img> tag.
// We show a file icon for these in upload lists rather than a broken image.
export const NON_PREVIEWABLE_IMAGE_TYPES = new Set(['image/heic', 'image/heif']);

export const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
};

export function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
}

export function isFileAllowed(fileName: string, fileType: string): boolean {
  if (ALLOWED_MIME_TYPES.includes(fileType)) return true;
  return ALLOWED_EXTENSIONS.includes(getFileExtension(fileName));
}

export function resolveContentType(fileName: string, fileType: string): string {
  if (fileType) return fileType;
  const ext = getFileExtension(fileName);
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
