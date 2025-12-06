import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";

// Image cache: keyed by resolved path, stores mtime + size + result
interface ImageCacheEntry {
  mtimeMs: number;
  size: number;
  result: LocalImageResult;
}

const imageCache = new Map<string, ImageCacheEntry>();

/**
 * Clear the image cache. Useful for testing or when the cache becomes stale.
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Get the current size of the image cache (for testing/debugging).
 */
export function getImageCacheSize(): number {
  return imageCache.size;
}

// Supported image extensions and their MIME types
// Only formats supported by Figma's createImage API: PNG, JPEG, GIF
// Note: WebP and SVG are NOT supported by Figma Slides
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

// Default maximum file size (5MB)
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

export interface LocalImageResult {
  dataBase64: string;
  mimeType: string;
}

export interface LocalImageOptions {
  maxSize?: number;
}

/**
 * Check if a URL is a remote URL (http:// or https://)
 */
export function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Check if the given file extension is a supported image format
 */
export function isSupportedImageFormat(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return ext in MIME_TYPES;
}

/**
 * Get MIME type for an image file based on extension
 */
export function getMimeType(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || null;
}

/**
 * Resolve an image path relative to a base directory
 */
export function resolveImagePath(imagePath: string, basePath: string): string {
  if (isAbsolute(imagePath)) {
    return imagePath;
  }
  return resolve(join(basePath, imagePath));
}

/**
 * Read a local image file and return base64-encoded data with MIME type.
 * Returns null if:
 * - The file doesn't exist
 * - The format is not supported
 * - The file exceeds the size limit
 */
export function readLocalImage(
  imagePath: string,
  basePath: string,
  options: LocalImageOptions = {},
): LocalImageResult | null {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const resolvedPath = resolveImagePath(imagePath, basePath);

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    console.warn(`[figdeck] Image not found: ${resolvedPath}`);
    return null;
  }

  // Check file size and get stats for cache validation
  const stats = statSync(resolvedPath);
  if (stats.size > maxSize) {
    console.warn(
      `[figdeck] Image too large (${(stats.size / 1024 / 1024).toFixed(2)}MB > ${(maxSize / 1024 / 1024).toFixed(2)}MB limit): ${resolvedPath}`,
    );
    return null;
  }

  // Check cache: if mtime and size match, return cached result
  const cached = imageCache.get(resolvedPath);
  if (
    cached &&
    cached.mtimeMs === stats.mtimeMs &&
    cached.size === stats.size
  ) {
    return cached.result;
  }

  // Check MIME type
  const mimeType = getMimeType(resolvedPath);
  if (!mimeType) {
    console.warn(`[figdeck] Unsupported image format: ${resolvedPath}`);
    return null;
  }

  try {
    const buffer = readFileSync(resolvedPath);
    const dataBase64 = buffer.toString("base64");
    const result = { dataBase64, mimeType };

    // Store in cache
    imageCache.set(resolvedPath, {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      result,
    });

    return result;
  } catch (error) {
    console.warn(
      `[figdeck] Failed to read image: ${resolvedPath}`,
      (error as Error).message,
    );
    return null;
  }
}
