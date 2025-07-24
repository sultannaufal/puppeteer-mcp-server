/**
 * Browser management service for Puppeteer
 */

import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { 
  BrowserInstance, 
  PageSession, 
  BrowserManagerConfig,
  BrowserHealthStatus,
  SAFE_DEFAULT_ARGS,
  DANGEROUS_ARGS
} from '@/types/puppeteer';
import { getConfig } from '@/utils/config';
import { logger, browserLogger, performanceLogger } from '@/utils/logger';
import { BrowserError, TimeoutError } from '@/utils/errors';

const config = getConfig();

/**
 * Browser Manager class
 */
class BrowserManager {
  private browser: Browser | null = null;
  private pages = new Map<string, PageSession>();
  private isInitialized = false;
  private restartCount = 0;
  private lastRestartTime: Date | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupCleanupIntervals();
  }

  /**
   * Initialize browser manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.launchBrowser();
      this.isInitialized = true;
      
      const launchOptions = this.getLaunchOptions();
      logger.info('Browser manager initialized', {
        executablePath: launchOptions.executablePath,
        args: (launchOptions as any).args,
      });
    } catch (error) {
      logger.error('Failed to initialize browser manager', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BrowserError('Failed to initialize browser manager', { originalError: error });
    }
  }

  /**
   * Get or create a page for a session
   */
  async getPage(sessionId: string): Promise<Page> {
    await this.ensureBrowserReady();

    // Check if page already exists for this session
    const existingSession = this.pages.get(sessionId);
    if (existingSession && !existingSession.page.isClosed()) {
      existingSession.lastActivity = new Date();
      return existingSession.page;
    }

    // Create new page
    if (!this.browser) {
      throw new BrowserError('Browser not available');
    }

    try {
      const page = await this.browser.newPage();
      
      // Set default viewport
      await page.setViewport({
        width: config.screenshot.defaultWidth,
        height: config.screenshot.defaultHeight,
      });

      // Set default timeout
      page.setDefaultTimeout(config.browser.timeout);
      page.setDefaultNavigationTimeout(config.browser.timeout);

      // Setup page event listeners
      this.setupPageEventListeners(page, sessionId);

      // Create page session
      const pageSession: PageSession = {
        page,
        sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.pages.set(sessionId, pageSession);

      logger.info('New page created', {
        sessionId,
        totalPages: this.pages.size,
      });

      return page;
    } catch (error) {
      logger.error('Failed to create page', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BrowserError('Failed to create page', { sessionId, originalError: error });
    }
  }

  /**
   * Close page for a session
   */
  async closePage(sessionId: string): Promise<void> {
    const pageSession = this.pages.get(sessionId);
    if (!pageSession) {
      return;
    }

    try {
      if (!pageSession.page.isClosed()) {
        await pageSession.page.close();
      }
      this.pages.delete(sessionId);

      logger.info('Page closed', {
        sessionId,
        remainingPages: this.pages.size,
      });
    } catch (error) {
      logger.error('Failed to close page', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Remove from map even if close failed
      this.pages.delete(sessionId);
    }
  }

  /**
   * Get browser health status
   */
  async getHealthStatus(): Promise<BrowserHealthStatus> {
    const uptime = this.lastRestartTime 
      ? Date.now() - this.lastRestartTime.getTime()
      : Date.now();

    try {
      const isHealthy = this.browser !== null && this.browser.isConnected();
      const pageCount = this.pages.size;

      let memoryUsage: number | undefined;
      if (isHealthy && this.browser) {
        try {
          // Get memory usage from a page if available
          const pages = await this.browser.pages();
          if (pages.length > 0 && pages[0]) {
            const metrics = await pages[0].metrics();
            if (metrics.JSHeapUsedSize) {
              memoryUsage = Math.round(metrics.JSHeapUsedSize / 1024 / 1024); // MB
            }
          }
        } catch (error) {
          // Memory usage not critical for health check
        }
      }

      const result: BrowserHealthStatus = {
        isHealthy,
        uptime,
        pageCount,
      };
      
      if (memoryUsage !== undefined) {
        (result as any).memoryUsage = memoryUsage;
      }
      
      return result;
    } catch (error) {
      return {
        isHealthy: false,
        uptime,
        pageCount: this.pages.size,
        lastError: error instanceof Error ? error.message : String(error),
        lastErrorTime: new Date(),
      };
    }
  }

  /**
   * Restart browser
   */
  async restartBrowser(reason = 'Manual restart'): Promise<void> {
    logger.warn('Restarting browser', { reason, restartCount: this.restartCount });

    try {
      // Close all pages
      for (const [sessionId] of this.pages) {
        await this.closePage(sessionId);
      }

      // Close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      // Launch new browser
      await this.launchBrowser();
      
      this.restartCount++;
      this.lastRestartTime = new Date();

      performanceLogger.browserRestart(reason, Date.now() - (this.lastRestartTime?.getTime() || 0));

      logger.info('Browser restarted successfully', {
        restartCount: this.restartCount,
        reason,
      });
    } catch (error) {
      logger.error('Failed to restart browser', {
        error: error instanceof Error ? error.message : String(error),
        reason,
      });
      throw new BrowserError('Failed to restart browser', { reason, originalError: error });
    }
  }

  /**
   * Cleanup expired pages
   */
  async cleanupExpiredPages(): Promise<number> {
    const now = new Date();
    const timeout = config.browser.sessionTimeout;
    let cleanedCount = 0;

    for (const [sessionId, pageSession] of this.pages.entries()) {
      const inactiveTime = now.getTime() - pageSession.lastActivity.getTime();
      
      if (inactiveTime > timeout || pageSession.page.isClosed()) {
        await this.closePage(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      performanceLogger.sessionCleanup(cleanedCount, this.pages.size + cleanedCount);
    }

    return cleanedCount;
  }

  /**
   * Destroy browser manager
   */
  async destroy(): Promise<void> {
    logger.info('Destroying browser manager...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all pages
    for (const [sessionId] of this.pages) {
      await this.closePage(sessionId);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.isInitialized = false;
    logger.info('Browser manager destroyed');
  }

  /**
   * Get launch options
   */
  private getLaunchOptions(): LaunchOptions {
    const baseOptions = JSON.parse(config.puppeteer.launchOptions);
    
    return {
      ...baseOptions,
      executablePath: config.puppeteer.executablePath,
      args: baseOptions.args || SAFE_DEFAULT_ARGS,
      headless: baseOptions.headless !== false, // Default to true
    };
  }

  /**
   * Launch browser
   */
  private async launchBrowser(): Promise<void> {
    const launchOptions = this.getLaunchOptions();
    
    try {
      this.browser = await puppeteer.launch(launchOptions);
      
      // Setup browser event listeners
      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected unexpectedly');
        this.browser = null;
        // Auto-restart browser
        this.restartBrowser('Browser disconnected').catch(error => {
          logger.error('Failed to auto-restart browser', { error: error.message });
        });
      });

      logger.info('Browser launched successfully', {
        executablePath: launchOptions.executablePath,
        headless: (launchOptions as any).headless,
      });
    } catch (error) {
      logger.error('Failed to launch browser', {
        error: error instanceof Error ? error.message : String(error),
        launchOptions,
      });
      throw error;
    }
  }

  /**
   * Ensure browser is ready
   */
  private async ensureBrowserReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.browser || !this.browser.isConnected()) {
      await this.restartBrowser('Browser not connected');
    }

    // Check if we need to restart due to too many operations
    if (this.restartCount > 0 && this.pages.size === 0) {
      const timeSinceRestart = this.lastRestartTime 
        ? Date.now() - this.lastRestartTime.getTime()
        : 0;
      
      if (timeSinceRestart > config.performance.browserRestartThreshold * 1000) {
        await this.restartBrowser('Scheduled restart');
      }
    }
  }

  /**
   * Setup page event listeners
   */
  private setupPageEventListeners(page: Page, sessionId: string): void {
    page.on('error', (error) => {
      browserLogger.error('page-error', error, sessionId);
    });

    page.on('pageerror', (error) => {
      browserLogger.error('page-error', error, sessionId);
    });

    page.on('console', (msg) => {
      logger.debug('Page console', {
        sessionId,
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('response', (response) => {
      if (!response.ok()) {
        logger.debug('Page response error', {
          sessionId,
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });
  }

  /**
   * Setup cleanup intervals
   */
  private setupCleanupIntervals(): void {
    // Cleanup expired pages every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredPages();
      } catch (error) {
        logger.error('Page cleanup failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, config.browser.pageCleanupInterval);

    // Health check every minute
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        if (!health.isHealthy) {
          logger.warn('Browser health check failed', health);
        }
      } catch (error) {
        logger.error('Health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 60000);
  }
}

// Create singleton instance
export const browserManager = new BrowserManager();

export default browserManager;