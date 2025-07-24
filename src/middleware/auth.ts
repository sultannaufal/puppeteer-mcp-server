/**
 * Authentication middleware for API key validation
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types/server';
import { AuthenticationError, ErrorHandler } from '@/utils/errors';
import { getConfig } from '@/utils/config';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const config = getConfig();

/**
 * Extract API key from request headers
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Check for Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Validate API key against configured key
 */
function validateApiKey(providedKey: string): boolean {
  if (!providedKey || !config.apiKey) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  if (providedKey.length !== config.apiKey.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ config.apiKey.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Authentication middleware
 */
export const authenticateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Extract API key from request
    const apiKey = extractApiKey(req);
    
    if (!apiKey) {
      logger.warn('Authentication failed: Missing or invalid authorization header', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
      });
      
      const { error, statusCode } = ErrorHandler.handleError(
        new AuthenticationError('Missing or invalid authorization header')
      );
      
      res.status(statusCode).json({
        jsonrpc: '2.0',
        id: null,
        error,
      });
      return;
    }
    
    // Validate API key
    if (!validateApiKey(apiKey)) {
      logger.warn('Authentication failed: Invalid API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        keyPrefix: apiKey.substring(0, 8) + '...',
      });
      
      const { error, statusCode } = ErrorHandler.handleError(
        new AuthenticationError('Invalid API key')
      );
      
      res.status(statusCode).json({
        jsonrpc: '2.0',
        id: null,
        error,
      });
      return;
    }
    
    // Generate session ID for this request
    req.sessionId = uuidv4();
    
    logger.debug('Authentication successful', {
      sessionId: req.sessionId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
    });
    
    next();
    
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      url: req.url,
    });
    
    const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);
    
    res.status(statusCode).json({
      jsonrpc: '2.0',
      id: null,
      error: jsonRpcError,
    });
  }
};

/**
 * Optional authentication middleware for health checks and public endpoints
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = extractApiKey(req);
  
  if (apiKey && validateApiKey(apiKey)) {
    req.sessionId = uuidv4();
    logger.debug('Optional authentication successful', {
      sessionId: req.sessionId,
      ip: req.ip,
      url: req.url,
    });
  }
  
  next();
};

/**
 * Rate limiting by API key (if needed in the future)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimitByApiKey = (maxRequests: number, windowMs: number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const apiKey = extractApiKey(req);
    
    if (!apiKey) {
      return next(); // Let auth middleware handle this
    }
    
    const now = Date.now();
    const key = `rate_limit_${apiKey}`;
    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize rate limit
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }
    
    if (current.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        apiKey: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        url: req.url,
        count: current.count,
        maxRequests,
      });
      
      const { error, statusCode } = ErrorHandler.handleError(
        new AuthenticationError('Rate limit exceeded')
      );
      
      res.status(statusCode).json({
        jsonrpc: '2.0',
        id: null,
        error,
      });
      return;
    }
    
    // Increment counter
    current.count++;
    rateLimitStore.set(key, current);
    
    next();
  };
};

/**
 * Cleanup expired rate limit entries
 */
export const cleanupRateLimit = (): void => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

// Cleanup rate limit store every 5 minutes
setInterval(cleanupRateLimit, 5 * 60 * 1000);

/**
 * Middleware to add security headers
 */
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add CORS headers for SSE
  if (req.path === '/sse') {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', config.security.corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  
  next();
};

/**
 * CORS preflight handler
 */
export const handleCorsPreflightForSSE = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method === 'OPTIONS' && req.path === '/sse') {
    res.setHeader('Access-Control-Allow-Origin', config.security.corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(204).end();
    return;
  }
  next();
};

export default {
  authenticateApiKey,
  optionalAuth,
  rateLimitByApiKey,
  securityHeaders,
  handleCorsPreflightForSSE,
  cleanupRateLimit,
};