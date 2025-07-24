/**
 * SSE endpoint route for MCP communication
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types/server';
import { createSSEConnection, sseManager, setupHeartbeat } from '@/services/sse';
import { logger } from '@/utils/logger';
import { ErrorHandler } from '@/utils/errors';

const router = Router();

/**
 * SSE endpoint for MCP communication
 * GET /sse
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Ensure we have a session ID from authentication
    if (!req.sessionId) {
      const { error, statusCode } = ErrorHandler.handleError(
        new Error('Session ID not found - authentication required')
      );
      return res.status(statusCode).json({
        jsonrpc: '2.0',
        id: null,
        error,
      });
    }

    logger.info('SSE connection request', {
      sessionId: req.sessionId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create SSE connection
    const connection = createSSEConnection(res, req.sessionId);
    
    // Add connection to manager
    sseManager.addConnection(connection);

    // Setup heartbeat
    const heartbeatInterval = setupHeartbeat(connection.id);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      sseManager.removeConnection(connection.id);
      logger.info('SSE client disconnected', {
        connectionId: connection.id,
        sessionId: req.sessionId,
      });
    });

    // Handle connection errors
    req.on('error', (error) => {
      clearInterval(heartbeatInterval);
      sseManager.removeConnection(connection.id);
      logger.error('SSE connection error', {
        connectionId: connection.id,
        sessionId: req.sessionId,
        error: error.message,
      });
    });

    logger.info('SSE connection established', {
      connectionId: connection.id,
      sessionId: req.sessionId,
      totalConnections: sseManager.connections.size,
    });

    // Connection established successfully
    return;

  } catch (error) {
    logger.error('SSE endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
      ip: req.ip,
    });

    const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);
    
    if (!res.headersSent) {
      res.status(statusCode).json({
        jsonrpc: '2.0',
        id: null,
        error: jsonRpcError,
      });
    }
  }
});

export default router;