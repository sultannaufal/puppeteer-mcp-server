/**
 * Express application setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { getConfig } from '@/utils/config';
import { logger, requestLogger, errorLogger } from '@/utils/logger';
import { ErrorHandler } from '@/utils/errors';
import { 
  authenticateApiKey, 
  optionalAuth, 
  securityHeaders, 
  handleCorsPreflightForSSE 
} from '@/middleware/auth';

// Import routes
import healthRoutes from '@/routes/health';
import sseRoutes from '@/routes/sse';
import mcpRoutes from '@/routes/mcp';

const config = getConfig();

/**
 * Create Express application
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy (for proper IP detection behind reverse proxy)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for SSE compatibility
  }));

  // Custom security headers
  app.use(securityHeaders);

  // CORS preflight handler for SSE
  app.use(handleCorsPreflightForSSE);

  // CORS configuration
  app.use(cors({
    origin: config.security.corsOrigin === '*' ? true : config.security.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours
  }));

  // Compression
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      // Don't compress SSE responses
      if (req.path === '/sse') {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindow,
    max: config.security.rateLimitMax,
    message: {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32006,
        message: 'Rate limit exceeded',
        data: {
          windowMs: config.security.rateLimitWindow,
          max: config.security.rateLimitMax,
        },
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/health');
    },
  });

  app.use(limiter);

  // Body parsing
  app.use(express.json({ 
    limit: '10mb',
    strict: true,
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
  }));

  // Request logging
  app.use(requestLogger);

  // Health check routes (no authentication required)
  app.use('/health', optionalAuth, healthRoutes);

  // SSE endpoint (requires authentication)
  app.use('/sse', authenticateApiKey, sseRoutes);

  // MCP protocol endpoint (requires authentication)
  app.use('/mcp', authenticateApiKey, mcpRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Puppeteer MCP Server',
      version: '1.0.0',
      description: 'A self-hosted Puppeteer MCP server with remote SSE access',
      endpoints: {
        health: '/health',
        sse: '/sse',
        mcp: '/mcp',
      },
      documentation: 'https://github.com/yourusername/puppeteer-mcp-server',
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32601,
        message: 'Endpoint not found',
        data: {
          path: req.originalUrl,
          method: req.method,
        },
      },
    });
  });

  // Global error handler
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    errorLogger(error, req);

    const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);

    res.status(statusCode).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: jsonRpcError,
    });
  });

  return app;
}

export default createApp;