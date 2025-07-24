/**
 * Health check endpoint
 */

import { Router, Request, Response } from 'express';
import { HealthCheckResponse } from '@/types/server';
import { getConfig } from '@/utils/config';
import { logger, healthLogger } from '@/utils/logger';
import { browserManager } from '@/services/browser';
import { activeTransports } from '@/services/mcp-server';

const router = Router();
const config = getConfig();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Get MCP connection stats
    const mcpStats = {
      totalConnections: activeTransports.size,
      activeConnections: activeTransports.size,
      sessionCount: activeTransports.size,
    };
    
    // Basic health check response
    const healthResponse: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
    };

    // Add MCP connection info
    if (mcpStats.totalConnections > 0) {
      healthResponse.connections = {
        total: mcpStats.totalConnections,
        active: mcpStats.activeConnections,
        sessions: mcpStats.sessionCount,
      };
    }

    // Check browser manager health
    try {
      const browserHealth = await browserManager.getHealthStatus();
      healthResponse.browser = {
        isHealthy: browserHealth.isHealthy,
        pageCount: browserHealth.pageCount,
        memoryUsage: browserHealth.memoryUsage as any,
      };
    } catch (error) {
      healthResponse.browser = {
        isHealthy: false,
        pageCount: 0,
        error: 'Browser manager not available',
      };
    }

    const responseTime = Date.now() - startTime;
    
    healthLogger.check('ok', {
      uptime,
      memoryUsage: healthResponse.memory,
      responseTime,
      connections: mcpStats,
    });

    // Add response time header
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    res.json(healthResponse);

  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorResponse: HealthCheckResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    healthLogger.check('error', { error: errorResponse.error });

    res.status(503).json(errorResponse);
  }
});

/**
 * Detailed health check endpoint (requires authentication)
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get MCP connection stats
    const mcpStats = {
      totalConnections: activeTransports.size,
      activeConnections: activeTransports.size,
      sessionCount: activeTransports.size,
    };
    
    // Detailed health response
    const detailedResponse: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || '1.0.0',
      
      // System information
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
      },
      
      // Memory usage
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      
      // CPU usage
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      
      // MCP connections
      connections: {
        total: mcpStats.totalConnections,
        active: mcpStats.activeConnections,
        sessions: mcpStats.sessionCount,
      },
      
      // Configuration
      config: {
        nodeEnv: config.nodeEnv,
        port: config.port,
        logLevel: config.logging.level,
        browserTimeout: config.browser.timeout,
        maxPagesPerSession: config.browser.maxPagesPerSession,
      },
    };

    // Add browser information
    try {
      const browserHealth = await browserManager.getHealthStatus();
      detailedResponse.browser = {
        isHealthy: browserHealth.isHealthy,
        pageCount: browserHealth.pageCount,
        uptime: browserHealth.uptime,
        memoryUsage: browserHealth.memoryUsage,
        lastError: browserHealth.lastError,
        lastErrorTime: browserHealth.lastErrorTime,
      };
    } catch (error) {
      detailedResponse.browser = {
        isHealthy: false,
        error: 'Browser manager not available',
      };
    }

    const responseTime = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    res.json(detailedResponse);

  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Readiness probe endpoint
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all required services are ready
    const checks = {
      server: true, // Server is running if we reach this point
      mcp: activeTransports !== null,
      browser: (await browserManager.getHealthStatus()).isHealthy,
    };

    const allReady = Object.values(checks).every(check => check === true);

    if (allReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    }

  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Liveness probe endpoint
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

export default router;