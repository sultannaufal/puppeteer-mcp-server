/**
 * MCP protocol endpoint for handling JSON-RPC requests and SSE connections
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '@/types/server';
import {
  JSONRPCRequest,
  JSONRPCResponse,
  InitializeRequest,
  InitializeResult,
  ListToolsRequest,
  ListToolsResult,
  CallToolRequest,
  CallToolResult,
  PingRequest,
  PingResult,
  ServerCapabilities,
  ErrorCodes,
  ToolContext
} from '@/types/mcp';
import { sendMCPMessageToSession, createSSEConnection, sseManager, setupHeartbeat } from '@/services/sse';
import { logger, mcpLogger } from '@/utils/logger';
import { ErrorHandler, ValidationError, MethodNotFoundError } from '@/utils/errors';
import { validate } from '@/utils/validation';
import { getConfig } from '@/utils/config';
import { toolRegistry, getToolDefinitions } from '@/tools';
import { browserManager } from '@/services/browser';

const router = Router();
const config = getConfig();

// Server information
const SERVER_INFO = {
  name: 'puppeteer-mcp-server',
  version: '1.0.0',
};

// Server capabilities
const SERVER_CAPABILITIES: ServerCapabilities = {
  tools: {
    listChanged: false,
  },
  logging: {},
};

// Available tools from tool registry
const availableTools = getToolDefinitions();

/**
 * MCP protocol endpoint for SSE connections
 * GET /mcp - Establishes SSE connection for server-to-client communication
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

    logger.info('MCP SSE connection request', {
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
      logger.info('MCP SSE client disconnected', {
        connectionId: connection.id,
        sessionId: req.sessionId,
      });
    });

    // Handle connection errors
    req.on('error', (error) => {
      clearInterval(heartbeatInterval);
      sseManager.removeConnection(connection.id);
      logger.error('MCP SSE connection error', {
        connectionId: connection.id,
        sessionId: req.sessionId,
        error: error.message,
      });
    });

    logger.info('MCP SSE connection established', {
      connectionId: connection.id,
      sessionId: req.sessionId,
      totalConnections: sseManager.connections.size,
    });

    // Connection established successfully
    return;

  } catch (error) {
    logger.error('MCP SSE endpoint error', {
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

/**
 * MCP protocol endpoint for JSON-RPC requests
 * POST /mcp - Handles client-to-server communication
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  let requestId: string | number | null = null;

  try {
    // Validate request format
    const request = validate.mcpRequest(req.body) as JSONRPCRequest;
    requestId = request.id || null;

    mcpLogger.request(request.method, request.params, requestId);

    // Handle different MCP methods
    let result: any;
    
    switch (request.method) {
      case 'initialize':
        result = await handleInitialize(request.params);
        break;
        
      case 'tools/list':
        result = await handleToolsList(request.params);
        break;
        
      case 'tools/call':
        result = await handleToolsCall(request.params, req.sessionId!, requestId);
        break;
        
      case 'ping':
        result = await handlePing(request.params);
        break;
        
      default:
        throw new MethodNotFoundError(request.method);
    }

    // Create response
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: requestId,
      result,
    };

    const duration = Date.now() - startTime;
    mcpLogger.response(result, requestId, duration);

    // Send response via SSE if session exists
    if (req.sessionId) {
      const sentCount = sendMCPMessageToSession(req.sessionId, response);
      logger.debug('MCP response sent via SSE', {
        sessionId: req.sessionId,
        requestId,
        method: request.method,
        sentToConnections: sentCount,
      });
    }

    // Also send HTTP response
    res.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    mcpLogger.error(error, requestId);

    const { error: jsonRpcError, statusCode } = ErrorHandler.handleError(error, requestId);
    
    const errorResponse: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: requestId,
      error: jsonRpcError,
    };

    // Send error via SSE if session exists
    if (req.sessionId) {
      sendMCPMessageToSession(req.sessionId, errorResponse);
    }

    logger.error('MCP request failed', {
      sessionId: req.sessionId,
      requestId,
      method: req.body?.method,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    res.status(statusCode).json(errorResponse);
  }
});

/**
 * Handle initialize request
 */
async function handleInitialize(params: any): Promise<InitializeResult> {
  const validatedParams = validate.initializeParams(params);
  
  logger.info('MCP client initialized', {
    protocolVersion: validatedParams.protocolVersion,
    clientName: validatedParams.clientInfo.name,
    clientVersion: validatedParams.clientInfo.version,
  });

  return {
    protocolVersion: '2024-11-05',
    capabilities: SERVER_CAPABILITIES,
    serverInfo: SERVER_INFO,
  };
}

/**
 * Handle tools/list request
 */
async function handleToolsList(params: any): Promise<ListToolsResult> {
  return {
    tools: availableTools,
  };
}

/**
 * Handle tools/call request
 */
async function handleToolsCall(params: any, sessionId: string, requestId: string | number | null): Promise<CallToolResult> {
  const validatedParams = validate.toolsCallParams(params);
  
  // Create tool context
  const toolContext: ToolContext = {
    sessionId,
    requestId,
    browserManager,
    logger,
  };
  
  // Execute the tool
  return await toolRegistry.execute(validatedParams.name, validatedParams.arguments, toolContext);
}

/**
 * Handle ping request
 */
async function handlePing(params: any): Promise<PingResult> {
  return {}; // Empty object response as per MCP spec
}

// Remove the setAvailableTools function as we now use the tool registry directly

/**
 * Get server capabilities
 */
export function getServerCapabilities(): ServerCapabilities {
  return SERVER_CAPABILITIES;
}

/**
 * Get server info
 */
export function getServerInfo(): typeof SERVER_INFO {
  return SERVER_INFO;
}

export default router;