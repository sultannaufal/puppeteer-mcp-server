/**
 * New MCP transport routes for streamable HTTP
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types/server';
import { TransportType } from '@/types/transport';
import { transportManager } from '@/services/transport-manager';
import { logger } from '@/utils/logger';
import { ErrorHandler } from '@/utils/errors';

const router = Router();

/**
 * Streamable HTTP transport endpoints
 * Supports POST, GET, and DELETE methods as per MCP specification
 */

// POST /http - Handle JSON-RPC messages
router.post('/http', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Streamable HTTP POST request', {
      sessionId: req.sessionId,
      mcpSessionId: req.headers['mcp-session-id'],
      method: req.body?.method,
      id: req.body?.id,
    });

    await transportManager.handleRequest(req, res, TransportType.STREAMABLE_HTTP);
  } catch (error) {
    logger.error('Streamable HTTP POST error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
      mcpSessionId: req.headers['mcp-session-id'],
    });

    if (!res.headersSent) {
      const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);
      res.status(statusCode).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: jsonRpcError,
      });
    }
  }
});

// GET /http - Establish SSE stream
router.get('/http', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string;
    const lastEventId = req.headers['last-event-id'] as string;

    logger.info('Streamable HTTP GET request (SSE)', {
      sessionId: req.sessionId,
      mcpSessionId: sessionId,
      lastEventId,
      userAgent: req.get('User-Agent'),
    });

    await transportManager.handleRequest(req, res, TransportType.STREAMABLE_HTTP);
  } catch (error) {
    logger.error('Streamable HTTP GET error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
      mcpSessionId: req.headers['mcp-session-id'],
    });

    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

// DELETE /http - Terminate session
router.delete('/http', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string;

    logger.info('Streamable HTTP DELETE request (session termination)', {
      sessionId: req.sessionId,
      mcpSessionId: sessionId,
    });

    await transportManager.handleRequest(req, res, TransportType.STREAMABLE_HTTP);
  } catch (error) {
    logger.error('Streamable HTTP DELETE error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
      mcpSessionId: req.headers['mcp-session-id'],
    });

    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

/**
 * Transport statistics endpoint
 * GET /transports/stats - Returns information about active transports
 */
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = {
      serverInfo: {
        name: 'puppeteer-mcp-server',
        version: '1.0.0',
        supportedTransports: [
          TransportType.SSE,
          TransportType.STREAMABLE_HTTP,
        ],
      },
      transports: transportManager.getStats(),
      timestamp: new Date().toISOString(),
    };

    logger.debug('Transport stats requested', {
      sessionId: req.sessionId,
      stats,
    });

    res.json(stats);
  } catch (error) {
    logger.error('Transport stats error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
    });

    const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);
    res.status(statusCode).json({
      jsonrpc: '2.0',
      id: null,
      error: jsonRpcError,
    });
  }
});

/**
 * Transport health check endpoint
 * GET /transports/health - Returns health status of transport system
 */
router.get('/health', (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeTransports = transportManager.getActiveTransports();
    const stats = transportManager.getStats();

    const health = {
      status: 'healthy',
      transports: {
        active: stats.activeTransports,
        sessions: stats.activeSessions,
        types: {
          [TransportType.SSE]: 'available',
          [TransportType.STREAMABLE_HTTP]: 'available',
        },
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    logger.debug('Transport health check', {
      sessionId: req.sessionId,
      health,
    });

    res.json(health);
  } catch (error) {
    logger.error('Transport health check error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
    });

    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Close specific transport endpoint
 * DELETE /transports/:transportId - Close a specific transport
 */
router.delete('/:transportId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transportId } = req.params;

    if (!transportId) {
      return res.status(400).json({
        success: false,
        error: {
          code: -32602,
          message: 'Transport ID is required',
        },
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Manual transport closure requested', {
      sessionId: req.sessionId,
      transportId,
    });

    await transportManager.closeTransport(transportId);

    res.json({
      success: true,
      message: `Transport ${transportId} closed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Manual transport closure error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
      transportId: req.params.transportId,
    });

    const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);
    res.status(statusCode).json({
      success: false,
      error: jsonRpcError,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;