/**
 * MCP Server implementation using the official MCP SDK
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LoggingMessageNotificationSchema
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@/utils/logger';
import { toolRegistry, getToolDefinitions } from '@/tools';
import { browserManager } from '@/services/browser';
import { ToolContext } from '@/types/mcp';

// Server information
const SERVER_INFO = {
  name: 'puppeteer-mcp-server',
  version: '1.0.0',
};

/**
 * Create and configure MCP server instance
 */
export function createMCPServer(): Server {
  const server = new Server(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
        logging: {},
      },
    }
  );

  // Set up tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getToolDefinitions();
    logger.debug('MCP tools/list request', { toolCount: tools.length });
    
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    
    logger.info('MCP tools/call request', {
      toolName: name,
      sessionId: extra?.sessionId,
    });

    // Create tool context
    const toolContext: ToolContext = {
      sessionId: extra?.sessionId || 'unknown',
      requestId: null, // MCP SDK doesn't expose request ID in this context
      browserManager,
      logger,
    };

    try {
      // Execute the tool using our existing tool registry
      const result = await toolRegistry.execute(name, args || {}, toolContext);
      
      logger.info('MCP tool execution completed', {
        toolName: name,
        sessionId: toolContext.sessionId,
        isError: result.isError,
      });

      // Return result in MCP SDK expected format
      return {
        content: result.content,
        isError: result.isError,
      };
    } catch (error) {
      logger.error('MCP tool execution failed', {
        toolName: name,
        sessionId: toolContext.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Set up logging handler
  server.setNotificationHandler(LoggingMessageNotificationSchema, async (notification) => {
    const { level, data } = notification.params;
    logger.log(level, 'MCP client message', data);
  });

  logger.info('MCP server created', {
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    toolCount: getToolDefinitions().length,
  });

  return server;
}

// Store active transports for session management
export const activeTransports = new Map<string, SSEServerTransport>();

/**
 * Clean up inactive transports
 */
export function cleanupTransports(): void {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [sessionId, transport] of activeTransports.entries()) {
    // Check if transport is still active (this is a simplified check)
    // In a real implementation, you'd want to track last activity
    try {
      // If transport is closed or inactive, remove it
      if (!transport || (transport as any).closed) {
        activeTransports.delete(sessionId);
        logger.debug('Cleaned up inactive MCP transport', { sessionId });
      }
    } catch (error) {
      // Transport is likely dead, remove it
      activeTransports.delete(sessionId);
      logger.debug('Removed dead MCP transport', { sessionId });
    }
  }
}

// Set up periodic cleanup
setInterval(cleanupTransports, 60000); // Every minute

export default {
  createMCPServer,
  activeTransports,
  cleanupTransports,
};