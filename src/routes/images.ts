/**
 * Image serving routes for binary image support
 */

import { Router, Request, Response } from 'express';
import { imageStorage } from '@/services/image-storage';
import { logger } from '@/utils/logger';
import { getConfig } from '@/utils/config';

const config = getConfig();
const router = Router();

/**
 * Serve binary image by ID
 * GET /images/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Invalid image ID',
    });
  }

  try {
    // Get image metadata
    const image = await imageStorage.getImage(id);
    
    if (!image) {
      return res.status(404).json({
        error: 'Image not found or expired',
      });
    }

    // Get image buffer
    const buffer = await imageStorage.getImageBuffer(id);
    
    if (!buffer) {
      return res.status(404).json({
        error: 'Image file not found',
      });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': image.mimeType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': `public, max-age=${config.screenshot.binaryUrlTtl}`,
      'Expires': image.expiresAt.toUTCString(),
      'Last-Modified': image.createdAt.toUTCString(),
      'ETag': `"${id}"`,
    });

    // Handle conditional requests
    const ifNoneMatch = req.get('If-None-Match');
    if (ifNoneMatch === `"${id}"`) {
      return res.status(304).end();
    }

    const ifModifiedSince = req.get('If-Modified-Since');
    if (ifModifiedSince) {
      const modifiedSince = new Date(ifModifiedSince);
      if (image.createdAt <= modifiedSince) {
        return res.status(304).end();
      }
    }

    // Log access
    logger.debug('Image served', {
      id,
      sessionId: image.sessionId,
      filename: image.filename,
      size: buffer.length,
      mimeType: image.mimeType,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Send image
    res.send(buffer);

  } catch (error) {
    logger.error('Error serving image', {
      error: error instanceof Error ? error.message : String(error),
      id,
      ip: req.ip,
    });

    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * Get image metadata by ID
 * GET /images/:id/info
 */
router.get('/:id/info', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Invalid image ID',
    });
  }

  try {
    const image = await imageStorage.getImage(id);
    
    if (!image) {
      return res.status(404).json({
        error: 'Image not found or expired',
      });
    }

    // Return metadata (without file path for security)
    res.json({
      id: image.id,
      sessionId: image.sessionId,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      createdAt: image.createdAt.toISOString(),
      expiresAt: image.expiresAt.toISOString(),
      url: `/images/${id}`,
    });

  } catch (error) {
    logger.error('Error getting image info', {
      error: error instanceof Error ? error.message : String(error),
      id,
      ip: req.ip,
    });

    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * Get storage statistics (for debugging/monitoring)
 * GET /images/stats
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = imageStorage.getStats();
    
    res.json({
      ...stats,
      oldestImage: stats.oldestImage?.toISOString(),
      newestImage: stats.newestImage?.toISOString(),
      totalSizeMB: Math.round(stats.totalSize / 1024 / 1024 * 100) / 100,
    });

  } catch (error) {
    logger.error('Error getting storage stats', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    });

    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;