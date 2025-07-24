/**
 * Server-Sent Events (SSE) service for MCP communication
 */

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SSEConnection, SSEManager } from '@/types/server';
import { MCPMessage } from '@/types/mcp';
import { logger, sseLogger } from '@/utils/logger';
import { getConfig } from '@/utils/config';

const config = getConfig();

/**
 * SSE Manager implementation
 */
class SSEManagerImpl implements SSEManager {
  public connections = new Map<string, SSEConnection>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup inactive connections every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000);
  }

  /**
   * Add a new SSE connection
   */
  addConnection(connection: SSEConnection): void {
    this.connections.set(connection.id, connection);
    sseLogger.connect(connection.id, connection.sessionId);
    
    // Set up connection close handler
    connection.response.on('close', () => {
      this.removeConnection(connection.id);
    });

    // Set up error handler
    connection.response.on('error', (error) => {
      sseLogger.error(connection.id, error);
      this.removeConnection(connection.id);
    });

    // Send initial connection confirmation
    this.sendToConnection(connection.id, {
      type: 'connection',
      data: {
        connectionId: connection.id,
        sessionId: connection.sessionId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Remove an SSE connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const duration = Date.now() - connection.createdAt.getTime();
      sseLogger.disconnect(connectionId, connection.sessionId, duration);
      
      // Close the response if it's still open
      if (!connection.response.destroyed) {
        connection.response.end();
      }
      
      this.connections.delete(connectionId);
    }
  }

  /**
   * Send data to a specific connection
   */
  sendToConnection(connectionId: string, data: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isActive || connection.response.destroyed) {
      return false;
    }

    try {
      const sseData = this.formatSSEData(data);
      connection.response.write(sseData);
      connection.lastActivity = new Date();
      
      sseLogger.send(connectionId, data.type || 'data', sseData.length);
      return true;
    } catch (error) {
      sseLogger.error(connectionId, error instanceof Error ? error : new Error(String(error)));
      this.removeConnection(connectionId);
      return false;
    }
  }

  /**
   * Send data to all connections for a specific session
   */
  sendToSession(sessionId: string, data: any): number {
    let sentCount = 0;
    
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.sessionId === sessionId && connection.isActive) {
        if (this.sendToConnection(connectionId, data)) {
          sentCount++;
        }
      }
    }
    
    return sentCount;
  }

  /**
   * Broadcast data to all active connections
   */
  broadcast(data: any): number {
    let sentCount = 0;
    
    for (const connectionId of this.connections.keys()) {
      if (this.sendToConnection(connectionId, data)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }

  /**
   * Clean up inactive connections
   */
  cleanup(): void {
    const now = new Date();
    const timeout = config.browser.sessionTimeout;
    let cleanedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      const inactiveTime = now.getTime() - connection.lastActivity.getTime();
      
      if (inactiveTime > timeout || connection.response.destroyed) {
        this.removeConnection(connectionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('SSE connections cleaned up', {
        cleanedCount,
        activeConnections: this.connections.size,
      });
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    sessionCount: number;
  } {
    const sessions = new Set<string>();
    let activeCount = 0;

    for (const connection of this.connections.values()) {
      sessions.add(connection.sessionId);
      if (connection.isActive && !connection.response.destroyed) {
        activeCount++;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: activeCount,
      sessionCount: sessions.size,
    };
  }

  /**
   * Format data for SSE transmission
   */
  private formatSSEData(data: any): string {
    const lines: string[] = [];
    
    // Add event type if specified
    if (data.event) {
      lines.push(`event: ${data.event}`);
    }
    
    // Add ID if specified
    if (data.id) {
      lines.push(`id: ${data.id}`);
    }
    
    // Add retry if specified
    if (data.retry) {
      lines.push(`retry: ${data.retry}`);
    }
    
    // Add data (required)
    const dataString = typeof data.data === 'string' 
      ? data.data 
      : JSON.stringify(data.data || data);
    
    // Split multi-line data
    const dataLines = dataString.split('\n');
    for (const line of dataLines) {
      lines.push(`data: ${line}`);
    }
    
    // Add empty line to complete the message
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Destroy the SSE manager
   */
  destroy(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections
    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId);
    }
  }
}

// Create singleton instance
export const sseManager = new SSEManagerImpl();

/**
 * Create a new SSE connection
 */
export function createSSEConnection(
  response: Response,
  sessionId: string
): SSEConnection {
  const connectionId = uuidv4();
  const now = new Date();

  // Set SSE headers
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': config.security.corsOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  });

  // Send initial SSE comment to establish connection
  response.write(': SSE connection established\n\n');

  const connection: SSEConnection = {
    id: connectionId,
    sessionId,
    response,
    createdAt: now,
    lastActivity: now,
    isActive: true,
  };

  return connection;
}

/**
 * Send MCP message via SSE
 */
export function sendMCPMessage(
  connectionId: string,
  message: MCPMessage
): boolean {
  return sseManager.sendToConnection(connectionId, {
    event: 'mcp-message',
    data: message,
  });
}

/**
 * Send MCP message to session
 */
export function sendMCPMessageToSession(
  sessionId: string,
  message: MCPMessage
): number {
  return sseManager.sendToSession(sessionId, {
    event: 'mcp-message',
    data: message,
  });
}

/**
 * Send error message via SSE
 */
export function sendErrorMessage(
  connectionId: string,
  error: any,
  requestId?: string | number | null
): boolean {
  return sseManager.sendToConnection(connectionId, {
    event: 'error',
    data: {
      jsonrpc: '2.0',
      id: requestId || null,
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        data: error.data,
      },
    },
  });
}

/**
 * Send heartbeat/ping message
 */
export function sendHeartbeat(connectionId: string): boolean {
  return sseManager.sendToConnection(connectionId, {
    event: 'heartbeat',
    data: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send notification message
 */
export function sendNotification(
  connectionId: string,
  method: string,
  params?: any
): boolean {
  return sseManager.sendToConnection(connectionId, {
    event: 'notification',
    data: {
      jsonrpc: '2.0',
      method,
      params,
    },
  });
}

/**
 * Broadcast notification to all connections
 */
export function broadcastNotification(
  method: string,
  params?: any
): number {
  return sseManager.broadcast({
    event: 'notification',
    data: {
      jsonrpc: '2.0',
      method,
      params,
    },
  });
}

/**
 * Get SSE manager instance
 */
export function getSSEManager(): SSEManager {
  return sseManager;
}

/**
 * Setup heartbeat for connection
 */
export function setupHeartbeat(connectionId: string, intervalMs = 30000): NodeJS.Timeout {
  return setInterval(() => {
    if (!sendHeartbeat(connectionId)) {
      // Connection is dead, clear the interval
      clearInterval(arguments[0] as NodeJS.Timeout);
    }
  }, intervalMs);
}

export default {
  sseManager,
  createSSEConnection,
  sendMCPMessage,
  sendMCPMessageToSession,
  sendErrorMessage,
  sendHeartbeat,
  sendNotification,
  broadcastNotification,
  getSSEManager,
  setupHeartbeat,
};