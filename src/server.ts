/**
 * Main server entry point
 */

import { createApp } from './app';
import { getConfig, validateConfig } from '@/utils/config';
import { logger, startupLogger } from '@/utils/logger';
import { sseManager } from '@/services/sse';
import { browserManager } from '@/services/browser';
import '@/tools'; // Import tools to register them

// Load and validate configuration
const config = getConfig();

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

    // Create Express application
    const app = createApp();

    // Start HTTP server
    const server = app.listen(config.port, config.host, () => {
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

      // Stop accepting new connections
      server.close(async (err) => {
        if (err) {
          logger.error('Error during server shutdown', { error: err.message });
          process.exit(1);
        }

        try {
          // Cleanup SSE connections
          logger.info('Cleaning up SSE connections...');
          sseManager.destroy();

          // Cleanup browser manager
          logger.info('Cleaning up browser manager...');
          await browserManager.destroy();

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (cleanupError) {
          logger.error('Error during cleanup', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
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