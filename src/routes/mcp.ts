/**
 * MCP routes using the official MCP SDK with SSE transport
 */

import { Router, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { AuthenticatedRequest } from '@/types/server';
import { createMCPServer, activeTransports } from '@/services/mcp-server';
import { logger } from '@/utils/logger';
import { ErrorHandler } from '@/utils/errors';

const router = Router();

// Create the MCP server instance
const mcpServer = createMCPServer();

/**
 * SSE endpoint for MCP communication
 * GET /sse - Establishes SSE connection using MCP SDK
 */
router.get('/sse', async (req: AuthenticatedRequest, res: Response) => {
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

    logger.info('MCP SSE connection request', {
      sessionId: req.sessionId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create SSE transport using MCP SDK
    const transport = new SSEServerTransport('/messages', res);
    
    // Store transport for session management
    activeTransports.set(req.sessionId, transport);

    // Handle client disconnect
    res.on('close', () => {
      activeTransports.delete(req.sessionId!);
      logger.info('MCP SSE client disconnected', {
        sessionId: req.sessionId,
        transportId: transport.sessionId,
      });
    });

    // Handle connection errors
    res.on('error', (error) => {
      activeTransports.delete(req.sessionId!);
      logger.error('MCP SSE connection error', {
        sessionId: req.sessionId,
        transportId: transport.sessionId,
        error: error.message,
      });
    });

    // Connect the MCP server to the transport
    await mcpServer.connect(transport);

    logger.info('MCP SSE connection established', {
      sessionId: req.sessionId,
      transportId: transport.sessionId,
      totalConnections: activeTransports.size,
    });

    // Connection is now managed by the MCP SDK
    // The response will be kept alive by the SSEServerTransport

  } catch (error) {
    logger.error('MCP SSE endpoint error', {
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

/**
 * Messages endpoint for MCP communication
 * POST /messages - Handles MCP messages using MCP SDK
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32602,
          message: 'Missing sessionId parameter',
        },
      });
    }

    logger.debug('MCP message request', {
      sessionId,
      method: req.body?.method,
      id: req.body?.id,
    });

    // Get the transport for this session
    const transport = activeTransports.get(sessionId);
    if (!transport) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32001,
          message: 'No active transport found for sessionId',
          data: { sessionId },
        },
      });
    }

    // Handle the message using the MCP SDK transport
    await transport.handlePostMessage(req, res, req.body);

    logger.debug('MCP message handled', {
      sessionId,
      method: req.body?.method,
      id: req.body?.id,
    });

  } catch (error) {
    logger.error('MCP message endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.query.sessionId,
      method: req.body?.method,
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

/**
 * Get MCP server statistics
 * GET /stats - Returns information about active connections and server status
 */
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = {
      serverInfo: {
        name: 'puppeteer-mcp-server',
        version: '1.0.0',
      },
      connections: {
        active: activeTransports.size,
        sessions: Array.from(activeTransports.keys()),
      },
      timestamp: new Date().toISOString(),
    };

    logger.debug('MCP stats requested', {
      sessionId: req.sessionId,
      activeConnections: stats.connections.active,
    });

    res.json(stats);
  } catch (error) {
    logger.error('MCP stats endpoint error', {
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

export default router;