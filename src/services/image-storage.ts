/**
 * Image Storage Service
 * Manages temporary storage and serving of binary images for HTTP transport
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '@/utils/config';
import { logger } from '@/utils/logger';

const config = getConfig();

export interface StoredImage {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  expiresAt: Date;
  filePath: string;
}

export class ImageStorageService {
  private images = new Map<string, StoredImage>();
  private storageDir: string;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.storageDir = path.join(process.cwd(), 'temp', 'images');
    this.ensureStorageDirectory();
    this.startCleanupTimer();
  }

  /**
   * Store a binary image and return its ID and URL
   */
  async storeImage(
    buffer: Buffer,
    sessionId: string,
    filename: string,
    mimeType: string = 'image/png'
  ): Promise<{ id: string; url: string; expiresAt: Date }> {
    const id = uuidv4();
    const fileExtension = this.getFileExtension(mimeType);
    const safeFilename = this.sanitizeFilename(filename);
    const fullFilename = `${id}_${safeFilename}.${fileExtension}`;
    const filePath = path.join(this.storageDir, fullFilename);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.screenshot.binaryUrlTtl * 1000);

    try {
      // Write file to disk
      await fs.writeFile(filePath, buffer);

      // Store metadata
      const storedImage: StoredImage = {
        id,
        sessionId,
        filename: safeFilename,
        mimeType,
        size: buffer.length,
        createdAt: now,
        expiresAt,
        filePath,
      };

      this.images.set(id, storedImage);

      const url = `/images/${id}`;
      
      logger.debug('Image stored successfully', {
        id,
        sessionId,
        filename: safeFilename,
        size: buffer.length,
        url,
        expiresAt: expiresAt.toISOString(),
      });

      return { id, url, expiresAt };
    } catch (error) {
      logger.error('Failed to store image', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        filename: safeFilename,
      });
      throw new Error(`Failed to store image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve a stored image by ID
   */
  async getImage(id: string): Promise<StoredImage | null> {
    const image = this.images.get(id);
    
    if (!image) {
      return null;
    }

    // Check if expired
    if (new Date() > image.expiresAt) {
      await this.deleteImage(id);
      return null;
    }

    // Check if file still exists
    try {
      await fs.access(image.filePath);
      return image;
    } catch {
      // File doesn't exist, remove from memory
      this.images.delete(id);
      return null;
    }
  }

  /**
   * Get image buffer by ID
   */
  async getImageBuffer(id: string): Promise<Buffer | null> {
    const image = await this.getImage(id);
    
    if (!image) {
      return null;
    }

    try {
      return await fs.readFile(image.filePath);
    } catch (error) {
      logger.error('Failed to read image file', {
        error: error instanceof Error ? error.message : String(error),
        id,
        filePath: image.filePath,
      });
      return null;
    }
  }

  /**
   * Delete a stored image
   */
  async deleteImage(id: string): Promise<boolean> {
    const image = this.images.get(id);
    
    if (!image) {
      return false;
    }

    try {
      // Delete file
      await fs.unlink(image.filePath);
    } catch (error) {
      // File might not exist, log but continue
      logger.debug('Failed to delete image file (might not exist)', {
        error: error instanceof Error ? error.message : String(error),
        id,
        filePath: image.filePath,
      });
    }

    // Remove from memory
    this.images.delete(id);
    
    logger.debug('Image deleted', { id, sessionId: image.sessionId });
    return true;
  }

  /**
   * Clean up expired images
   */
  async cleanupExpiredImages(): Promise<number> {
    const now = new Date();
    const expiredIds: string[] = [];

    // Find expired images
    for (const [id, image] of this.images.entries()) {
      if (now > image.expiresAt) {
        expiredIds.push(id);
      }
    }

    // Delete expired images
    let deletedCount = 0;
    for (const id of expiredIds) {
      if (await this.deleteImage(id)) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info('Cleaned up expired images', { count: deletedCount });
    }

    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalImages: number;
    totalSize: number;
    oldestImage?: Date;
    newestImage?: Date;
  } {
    let totalSize = 0;
    let oldestImage: Date | undefined;
    let newestImage: Date | undefined;

    for (const image of this.images.values()) {
      totalSize += image.size;
      
      if (!oldestImage || image.createdAt < oldestImage) {
        oldestImage = image.createdAt;
      }
      
      if (!newestImage || image.createdAt > newestImage) {
        newestImage = image.createdAt;
      }
    }

    return {
      totalImages: this.images.size,
      totalSize,
      oldestImage,
      newestImage,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Final cleanup
    await this.cleanupExpiredImages();
    
    logger.info('Image storage service shut down');
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directory', {
        error: error instanceof Error ? error.message : String(error),
        storageDir: this.storageDir,
      });
      throw error;
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (config.screenshot.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredImages().catch((error) => {
          logger.error('Error during image cleanup', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, config.screenshot.cleanupInterval);
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
        return 'jpg';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      default:
        return 'png';
    }
  }

  /**
   * Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100); // Limit length
  }
}

// Create singleton instance
export const imageStorage = new ImageStorageService();
export default imageStorage;