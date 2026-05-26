// File: src/modules/media/media.constants.ts
import { MediaFolder } from './media.model';

export const ALLOWED_FOLDERS: MediaFolder[] = [
  'products', 'banners', 'brands', 'avatars', 'collections', 'general',
];

export const ALLOWED_IMAGE_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);

export const ALLOWED_VIDEO_MIMETYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
]);

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;  // 15 MB
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_FILES_PER_REQUEST = 10;