/**
 * Main server entry point
 */

import { createApp } from './app';
import { getConfig, validateConfig } from '@/utils/config';
import { logger, startupLogger } from '@/utils/logger';
import { browserManager } from '@/services/browser';
import { cleanupTransports } from '@/services/mcp-server';
import { transportManager } from '@/services/transport-manager';
import { transportFactory } from '@/services/transport-factory';
import { imageStorage } from '@/services/image-storage';
import '@/tools'; // Import tools to register them

// Load and validate configuration
const config = getConfig();

// Global references for cleanup
let httpServer: any = null;

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig(config);
    startupLogger.config(config);

    // Initialize browser manager
    await browserManager.initialize();
    startupLogger.browser(config.puppeteer.executablePath);

    // Create Express application and start HTTP server
    const app = createApp();

    // Start HTTP server
    httpServer = app.listen(config.port, config.host, () => {
      startupLogger.server(config.port, config.host);
      
      logger.info('Server startup complete', {
        port: config.port,
        host: config.host,
        nodeEnv: config.nodeEnv,
        processId: process.pid,
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Force shutdown after 30 seconds
      const forceShutdownTimer = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);

      try {
        // Stop HTTP server if running
        if (httpServer) {
          await new Promise<void>((resolve, reject) => {
            httpServer.close((err: any) => {
              if (err) {
                logger.error('Error during HTTP server shutdown', { error: err.message });
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }

        // Cleanup new transport system
        logger.info('Cleaning up transport manager...');
        await transportManager.closeAllTransports();
        
        logger.info('Cleaning up transport factory...');
        await transportFactory.cleanup();

        // Cleanup legacy MCP transports
        logger.info('Cleaning up legacy MCP transports...');
        cleanupTransports();

        // Cleanup browser manager
        logger.info('Cleaning up browser manager...');
        await browserManager.destroy();

        // Cleanup image storage service
        if (config.screenshot.enableBinaryServing) {
          logger.info('Cleaning up image storage...');
          await imageStorage.shutdown();
        }

        // Clear the force shutdown timer
        clearTimeout(forceShutdownTimer);

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (cleanupError) {
        logger.error('Error during cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
        clearTimeout(forceShutdownTimer);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      process.exit(1);
    });

    // Log memory usage periodically in development
    if (config.nodeEnv === 'development') {
      setInterval(() => {
        const memUsage = process.memoryUsage();
        logger.debug('Memory usage', {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
          external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
          rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        });
      }, 60000); // Every minute
    }

  } catch (error) {
    startupLogger.error(error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { startServer };
export default startServer;