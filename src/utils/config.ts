/**
 * Configuration management utility
 * Loads and validates environment variables
 */

import { config } from 'dotenv';
import { ServerConfig } from '@/types/server';

// Load environment variables
config();

/**
 * Parse environment variable as integer with default value
 */
function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as boolean with default value
 */
function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse JSON environment variable with default value
 */
function parseJsonEnv<T>(value: string | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Validate required environment variables
 */
function validateRequiredEnv(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Load and validate server configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  return {
    port: parseIntEnv(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'production',
    apiKey: validateRequiredEnv('API_KEY', process.env.API_KEY),
    
    puppeteer: {
      skipChromiumDownload: parseBooleanEnv(process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD, true),
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      launchOptions: process.env.PUPPETEER_LAUNCH_OPTIONS || JSON.stringify({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }),
    },
    
    browser: {
      timeout: parseIntEnv(process.env.BROWSER_TIMEOUT, 30000),
      maxPagesPerSession: parseIntEnv(process.env.MAX_PAGES_PER_SESSION, 5),
      pageCleanupInterval: parseIntEnv(process.env.PAGE_CLEANUP_INTERVAL, 300000),
      sessionTimeout: parseIntEnv(process.env.SESSION_TIMEOUT, 1800000),
    },
    
    security: {
      corsOrigin: process.env.CORS_ORIGIN || '*',
      rateLimitWindow: parseIntEnv(process.env.RATE_LIMIT_WINDOW, 900000),
      rateLimitMax: parseIntEnv(process.env.RATE_LIMIT_MAX, 100),
    },
    
    logging: {
      level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'json',
    },
    
    healthCheck: {
      enabled: parseBooleanEnv(process.env.HEALTH_CHECK_ENABLED, true),
      path: process.env.HEALTH_CHECK_PATH || '/health',
    },
    
    metrics: {
      enabled: parseBooleanEnv(process.env.METRICS_ENABLED, false),
      path: process.env.METRICS_PATH || '/metrics',
    },
    
    screenshot: {
      defaultWidth: parseIntEnv(process.env.SCREENSHOT_DEFAULT_WIDTH, 800),
      defaultHeight: parseIntEnv(process.env.SCREENSHOT_DEFAULT_HEIGHT, 600),
      maxWidth: parseIntEnv(process.env.SCREENSHOT_MAX_WIDTH, 1920),
      maxHeight: parseIntEnv(process.env.SCREENSHOT_MAX_HEIGHT, 1080),
      quality: parseIntEnv(process.env.SCREENSHOT_QUALITY, 80),
    },
    
    performance: {
      maxConcurrentPages: parseIntEnv(process.env.MAX_CONCURRENT_PAGES, 10),
      browserRestartThreshold: parseIntEnv(process.env.BROWSER_RESTART_THRESHOLD, 100),
      memoryLimitMB: parseIntEnv(process.env.MEMORY_LIMIT_MB, 1024),
    },
  };
}

/**
 * Get current configuration (singleton pattern)
 */
let cachedConfig: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Validate configuration at startup
 */
export function validateConfig(config: ServerConfig): void {
  // Validate port range
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port number: ${config.port}. Must be between 1 and 65535.`);
  }
  
  // Validate API key strength
  if (config.apiKey.length < 32) {
    console.warn('WARNING: API key is shorter than 32 characters. Consider using a stronger key.');
  }
  
  // Validate Puppeteer launch options
  try {
    JSON.parse(config.puppeteer.launchOptions);
  } catch (error) {
    throw new Error(`Invalid PUPPETEER_LAUNCH_OPTIONS JSON: ${error}`);
  }
  
  // Validate timeout values
  if (config.browser.timeout < 1000) {
    throw new Error('Browser timeout must be at least 1000ms');
  }
  
  if (config.browser.sessionTimeout < 60000) {
    throw new Error('Session timeout must be at least 60000ms (1 minute)');
  }
  
  // Validate screenshot dimensions
  if (config.screenshot.maxWidth > 4096 || config.screenshot.maxHeight > 4096) {
    throw new Error('Screenshot dimensions cannot exceed 4096x4096 pixels');
  }
  
  // Validate memory limit
  if (config.performance.memoryLimitMB < 256) {
    throw new Error('Memory limit must be at least 256MB');
  }
}

/**
 * Get environment-specific defaults
 */
export function getEnvironmentDefaults(): Partial<ServerConfig> {
  const nodeEnv = process.env.NODE_ENV || 'production';
  
  switch (nodeEnv) {
    case 'development':
      return {
        logging: {
          level: 'debug',
          format: 'simple',
        },
        security: {
          corsOrigin: '*',
          rateLimitWindow: 60000,
          rateLimitMax: 1000,
        },
      };
      
    case 'test':
      return {
        logging: {
          level: 'error',
          format: 'simple',
        },
        browser: {
          timeout: 10000,
          maxPagesPerSession: 2,
          pageCleanupInterval: 30000,
          sessionTimeout: 300000,
        },
      };
      
    case 'production':
    default:
      return {
        logging: {
          level: 'info',
          format: 'json',
        },
        security: {
          corsOrigin: process.env.CORS_ORIGIN || 'https://yourdomain.com',
          rateLimitWindow: 900000,
          rateLimitMax: 100,
        },
      };
  }
}

/**
 * Export configuration for easy access
 */
export const serverConfig = getConfig();