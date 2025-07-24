/**
 * Logging utility using Winston
 */

import winston from 'winston';
import { getConfig } from './config';

const config = getConfig();

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

// Create formatters
const jsonFormatter = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const simpleFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.logging.format === 'json' ? jsonFormatter : simpleFormatter,
  }),
];

// Add file transport in production
if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormatter,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormatter,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: config.logging.level,
  transports,
  exitOnError: false,
});

// Create request logger middleware
export const requestLogger = (req: any, res: any, next: any): void => {
  const start = Date.now();
  const { method, url, ip } = req;
  
  // Log request
  logger.info('Request started', {
    method,
    url,
    ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionId,
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    logger.info('Request completed', {
      method,
      url,
      ip,
      statusCode,
      duration,
      sessionId: req.sessionId,
    });
    
    originalEnd.call(res, chunk, encoding);
  };
  
  next();
};

// Error logger
export const errorLogger = (error: Error, req?: any): void => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    method: req?.method,
    url: req?.url,
    ip: req?.ip,
    sessionId: req?.sessionId,
  });
};

// Browser operation logger
export const browserLogger = {
  navigate: (url: string, sessionId: string, duration?: number): void => {
    logger.info('Browser navigation', { url, sessionId, duration });
  },
  
  screenshot: (name: string, sessionId: string, size?: number): void => {
    logger.info('Screenshot taken', { name, sessionId, size });
  },
  
  click: (selector: string, sessionId: string): void => {
    logger.info('Element clicked', { selector, sessionId });
  },
  
  fill: (selector: string, sessionId: string): void => {
    logger.info('Element filled', { selector, sessionId });
  },
  
  select: (selector: string, value: string, sessionId: string): void => {
    logger.info('Element selected', { selector, value, sessionId });
  },
  
  hover: (selector: string, sessionId: string): void => {
    logger.info('Element hovered', { selector, sessionId });
  },
  
  evaluate: (sessionId: string, duration?: number): void => {
    logger.info('Script evaluated', { sessionId, duration });
  },
  
  error: (operation: string, error: Error, sessionId: string): void => {
    logger.error('Browser operation failed', {
      operation,
      error: error.message,
      stack: error.stack,
      sessionId,
    });
  },
};

// MCP protocol logger
export const mcpLogger = {
  request: (method: string, params: any, id: string | number | null): void => {
    logger.debug('MCP request', { method, params, id });
  },
  
  response: (result: any, id: string | number | null, duration?: number): void => {
    logger.debug('MCP response', { result, id, duration });
  },
  
  error: (error: any, id: string | number | null): void => {
    logger.error('MCP error', { error, id });
  },
  
  notification: (method: string, params: any): void => {
    logger.debug('MCP notification', { method, params });
  },
};

// SSE logger
export const sseLogger = {
  connect: (connectionId: string, sessionId: string): void => {
    logger.info('SSE connection established', { connectionId, sessionId });
  },
  
  disconnect: (connectionId: string, sessionId: string, duration?: number): void => {
    logger.info('SSE connection closed', { connectionId, sessionId, duration });
  },
  
  send: (connectionId: string, event: string, dataSize: number): void => {
    logger.debug('SSE message sent', { connectionId, event, dataSize });
  },
  
  error: (connectionId: string, error: Error): void => {
    logger.error('SSE error', {
      connectionId,
      error: error.message,
      stack: error.stack,
    });
  },
};

// Performance logger
export const performanceLogger = {
  memory: (usage: NodeJS.MemoryUsage): void => {
    logger.debug('Memory usage', {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
    });
  },
  
  browserRestart: (reason: string, uptime: number): void => {
    logger.warn('Browser restarted', { reason, uptime });
  },
  
  sessionCleanup: (cleanedCount: number, totalSessions: number): void => {
    logger.info('Session cleanup', { cleanedCount, totalSessions });
  },
};

// Health check logger
export const healthLogger = {
  check: (status: 'ok' | 'error', details?: any): void => {
    if (status === 'ok') {
      logger.debug('Health check passed', details);
    } else {
      logger.warn('Health check failed', details);
    }
  },
};

// Startup logger
export const startupLogger = {
  config: (config: any): void => {
    logger.info('Server configuration loaded', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      logLevel: config.logging.level,
    });
  },
  
  server: (port: number, host: string): void => {
    logger.info('Server started successfully', { port, host });
  },
  
  browser: (executablePath?: string): void => {
    logger.info('Browser manager initialized', { executablePath });
  },
  
  error: (error: Error): void => {
    logger.error('Startup failed', {
      message: error.message,
      stack: error.stack,
    });
  },
};

// Export default logger
export default logger;