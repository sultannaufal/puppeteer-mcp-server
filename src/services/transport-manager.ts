/**
 * Transport manager for handling multiple MCP transport types
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  ITransportManager,
  ITransportFactory,
  TransportInstance,
  TransportType,
  TransportConfig,
  StreamableHTTPTransportConfig,
  SSETransportConfig
} from '@/types/transport';
import { AuthenticatedRequest } from '@/types/server';
import { transportFactory } from './transport-factory';
import { createMCPServer } from './mcp-server';
import { logger } from '@/utils/logger';
import { ErrorHandler } from '@/utils/errors';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export class TransportManager implements ITransportManager {
  public factory: ITransportFactory;
  private activeTransports: Map<string, TransportInstance> = new Map();
  private sessionToTransport: Map<string, string> = new Map(); // sessionId -> transportId

  constructor(factory?: ITransportFactory) {
    this.factory = factory || transportFactory;
  }

  async handleRequest(
    req: AuthenticatedRequest, 
    res: Response, 
    transportType: TransportType
  ): Promise<void> {
    try {
      switch (transportType) {
        case TransportType.STREAMABLE_HTTP:
          await this.handleStreamableHTTPRequest(req, res);
          break;
        case TransportType.SSE:
          await this.handleSSERequest(req, res);
          break;
        default:
          throw new Error(`Unsupported transport type: ${transportType}`);
      }
    } catch (error) {
      logger.error('Transport manager request handling error', {
        transportType,
        error: error instanceof Error ? error.message : String(error),
        sessionId: req.sessionId,
        method: req.method,
        path: req.path,
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
  }

  private async handleStreamableHTTPRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string;
    const method = req.method.toLowerCase();

    logger.debug('Handling Streamable HTTP request', {
      method,
      sessionId,
      hasBody: !!req.body,
      userSessionId: req.sessionId,
    });

    // Handle different HTTP methods
    switch (method) {
      case 'post':
        await this.handleStreamableHTTPPost(req, res, sessionId);
        break;
      case 'get':
        await this.handleStreamableHTTPGet(req, res, sessionId);
        break;
      case 'delete':
        await this.handleStreamableHTTPDelete(req, res, sessionId);
        break;
      default:
        res.status(405).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32601,
            message: `Method ${req.method} not allowed`,
          },
        });
    }
  }

  private async handleStreamableHTTPPost(
    req: AuthenticatedRequest, 
    res: Response, 
    sessionId?: string
  ): Promise<void> {
    let transport: TransportInstance;

    if (sessionId) {
      // Use existing transport
      const transportId = this.sessionToTransport.get(sessionId);
      if (!transportId) {
        res.status(404).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32001,
            message: 'Session not found',
            data: { sessionId },
          },
        });
        return;
      }

      const existingTransport = this.activeTransports.get(transportId);
      if (!existingTransport) {
        res.status(404).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32001,
            message: 'Transport not found for session',
            data: { sessionId },
          },
        });
        return;
      }

      transport = existingTransport;
    } else if (isInitializeRequest(req.body)) {
      // Create new transport for initialization
      const config: StreamableHTTPTransportConfig = {
        type: TransportType.STREAMABLE_HTTP,
        sessionIdGenerator: () => randomUUID(),
        enableResumability: true,
        onsessioninitialized: (newSessionId: string) => {
          logger.info('Streamable HTTP session initialized', {
            sessionId: newSessionId,
            userSessionId: req.sessionId,
          });
        },
        onsessionclosed: (closedSessionId: string) => {
          logger.info('Streamable HTTP session closed', {
            sessionId: closedSessionId,
          });
          this.cleanupSession(closedSessionId);
        },
      };

      transport = await this.factory.createTransport(config);
      
      // Store transport mappings
      this.activeTransports.set(transport.id, transport);
      
      // Connect to MCP server
      const mcpServer = createMCPServer();
      await mcpServer.connect(transport.transport);

      // Set up transport close handler
      transport.transport.onclose = () => {
        this.activeTransports.delete(transport.id);
        if (transport.sessionId) {
          this.sessionToTransport.delete(transport.sessionId);
        }
      };

    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32602,
          message: 'Invalid request: missing session ID or not an initialization request',
        },
      });
      return;
    }

    // Handle the request with the transport
    const streamableTransport = transport.transport as StreamableHTTPServerTransport;
    await streamableTransport.handleRequest(req, res, req.body);

    // Update session mapping after transport handles the request
    if (streamableTransport.sessionId && !this.sessionToTransport.has(streamableTransport.sessionId)) {
      this.sessionToTransport.set(streamableTransport.sessionId, transport.id);
      transport.sessionId = streamableTransport.sessionId;
    }
  }

  private async handleStreamableHTTPGet(
    req: AuthenticatedRequest, 
    res: Response, 
    sessionId?: string
  ): Promise<void> {
    if (!sessionId) {
      res.status(400).send('Missing session ID for SSE stream');
      return;
    }

    const transportId = this.sessionToTransport.get(sessionId);
    if (!transportId) {
      res.status(404).send('Session not found');
      return;
    }

    const transport = this.activeTransports.get(transportId);
    if (!transport) {
      res.status(404).send('Transport not found');
      return;
    }

    logger.info('Establishing SSE stream', {
      sessionId,
      transportId: transport.id,
      lastEventId: req.headers['last-event-id'],
    });

    const streamableTransport = transport.transport as StreamableHTTPServerTransport;
    await streamableTransport.handleRequest(req, res);
  }

  private async handleStreamableHTTPDelete(
    req: AuthenticatedRequest, 
    res: Response, 
    sessionId?: string
  ): Promise<void> {
    if (!sessionId) {
      res.status(400).send('Missing session ID for termination');
      return;
    }

    const transportId = this.sessionToTransport.get(sessionId);
    if (!transportId) {
      res.status(404).send('Session not found');
      return;
    }

    const transport = this.activeTransports.get(transportId);
    if (!transport) {
      res.status(404).send('Transport not found');
      return;
    }

    logger.info('Terminating session', { sessionId, transportId: transport.id });

    const streamableTransport = transport.transport as StreamableHTTPServerTransport;
    await streamableTransport.handleRequest(req, res);

    // Cleanup will be handled by the transport's onsessionclosed callback
  }

  private async handleSSERequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    // This maintains compatibility with the existing SSE implementation
    // We'll delegate to the existing SSE handler for now
    logger.info('SSE request - delegating to existing implementation', {
      sessionId: req.sessionId,
      method: req.method,
    });

    // For now, we'll throw an error to indicate this should use the existing route
    throw new Error('SSE requests should use the existing /sse endpoint');
  }


  private cleanupSession(sessionId: string): void {
    const transportId = this.sessionToTransport.get(sessionId);
    if (transportId) {
      this.sessionToTransport.delete(sessionId);
      this.activeTransports.delete(transportId);
      
      logger.debug('Session cleaned up', {
        sessionId,
        transportId,
        remainingTransports: this.activeTransports.size,
      });
    }
  }

  getActiveTransports(): Map<string, TransportInstance> {
    return new Map(this.activeTransports);
  }

  async closeTransport(id: string): Promise<void> {
    const transport = this.activeTransports.get(id);
    if (transport) {
      await transport.transport.close();
      this.activeTransports.delete(id);
      
      if (transport.sessionId) {
        this.sessionToTransport.delete(transport.sessionId);
      }

      logger.info('Transport closed', {
        transportId: id,
        type: transport.type,
        sessionId: transport.sessionId,
      });
    }
  }

  async closeAllTransports(): Promise<void> {
    logger.info('Closing all transports', {
      count: this.activeTransports.size,
    });

    const closePromises = Array.from(this.activeTransports.values()).map(
      transport => this.closeTransport(transport.id)
    );

    await Promise.all(closePromises);
    
    this.activeTransports.clear();
    this.sessionToTransport.clear();

    logger.info('All transports closed');
  }

  // Get statistics about active transports
  getStats() {
    return {
      activeTransports: this.activeTransports.size,
      activeSessions: this.sessionToTransport.size,
      factoryStats: this.factory instanceof transportFactory.constructor ? 
        (this.factory as any).getStats() : null,
    };
  }
}

// Singleton instance
export const transportManager = new TransportManager();