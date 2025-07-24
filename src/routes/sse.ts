/**
 * SSE endpoint route for MCP communication
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
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

    // Set SSE headers immediately to prevent timeout
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Send immediate connection confirmation to prevent 524 timeout
    res.write(': SSE connection established\n\n');
    res.write('event: connection\n');
    res.write(`data: {"type":"connection","sessionId":"${req.sessionId}","timestamp":"${new Date().toISOString()}"}\n\n`);

    // Create SSE connection object (headers already set above)
    const connectionId = uuidv4();
    const now = new Date();
    
    const connection = {
      id: connectionId,
      sessionId: req.sessionId,
      response: res,
      createdAt: now,
      lastActivity: now,
      isActive: true,
    };
    
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

    // Handle response close
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      sseManager.removeConnection(connection.id);
      logger.info('SSE response closed', {
        connectionId: connection.id,
        sessionId: req.sessionId,
      });
    });

    logger.info('SSE connection established', {
      connectionId: connection.id,
      sessionId: req.sessionId,
      totalConnections: sseManager.connections.size,
    });

    // Keep connection alive - don't return here
    // The connection will be kept open until client disconnects

  } catch (error) {
    logger.error('SSE endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.sessionId,
      ip: req.ip,
    });

    if (!res.headersSent) {
      const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error);
      res.status(statusCode).json({
        jsonrpc: '2.0',
        id: null,
        error: jsonRpcError,
      });
    }
  }
});

export default router;