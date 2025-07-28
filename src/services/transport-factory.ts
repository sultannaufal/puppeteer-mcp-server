/**
 * Transport factory implementation for creating and managing MCP transports
 */

import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ITransportFactory,
  TransportConfig,
  TransportInstance,
  TransportType,
  SSETransportConfig,
  StreamableHTTPTransportConfig,
  InMemoryEventStore
} from '@/types/transport';
import { logger } from '@/utils/logger';
import { getConfig } from '@/utils/config';

export class TransportFactory implements ITransportFactory {
  private transports: Map<string, TransportInstance> = new Map();
  private eventStores: Map<string, InMemoryEventStore> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async createTransport(
    config: TransportConfig, 
    req?: Request, 
    res?: Response
  ): Promise<TransportInstance> {
    const transportId = randomUUID();
    const now = new Date();

    logger.info('Creating transport', {
      transportId,
      type: config.type,
      sessionId: config.sessionId,
    });

    let transport;
    let sessionId = config.sessionId;

    try {
      switch (config.type) {
        case TransportType.SSE:
          transport = await this.createSSETransport(config as SSETransportConfig, res!);
          sessionId = (transport as SSEServerTransport).sessionId;
          break;

        case TransportType.STREAMABLE_HTTP:
          transport = await this.createStreamableHTTPTransport(config as StreamableHTTPTransportConfig);
          // Session ID will be set by the transport after initialization
          break;

        default:
          throw new Error(`Unsupported transport type: ${(config as any).type}`);
      }

      const instance: TransportInstance = {
        id: transportId,
        type: config.type,
        transport,
        sessionId,
        createdAt: now,
        lastActivity: now,
        metadata: {
          config: { ...config, sessionIdGenerator: undefined }, // Don't store functions
        },
      };

      // Set up transport event handlers
      this.setupTransportHandlers(instance);

      // Store the transport instance
      this.transports.set(transportId, instance);

      logger.info('Transport created successfully', {
        transportId,
        type: config.type,
        sessionId,
        totalTransports: this.transports.size,
      });

      return instance;

    } catch (error) {
      logger.error('Failed to create transport', {
        transportId,
        type: config.type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async createSSETransport(
    config: SSETransportConfig, 
    res: Response
  ): Promise<SSEServerTransport> {
    const appConfig = getConfig();
    
    return new SSEServerTransport(config.endpoint, res, {
      allowedHosts: config.allowedHosts || appConfig.security.corsOrigin !== '*' ? [appConfig.security.corsOrigin] : undefined,
      allowedOrigins: config.allowedOrigins || appConfig.security.corsOrigin !== '*' ? [appConfig.security.corsOrigin] : undefined,
      enableDnsRebindingProtection: config.enableDnsRebindingProtection || false,
    });
  }

  private async createStreamableHTTPTransport(
    config: StreamableHTTPTransportConfig
  ): Promise<StreamableHTTPServerTransport> {
    const appConfig = getConfig();
    
    // Create or reuse event store for resumability
    let eventStore: InMemoryEventStore | undefined;
    if (config.enableResumability !== false) {
      const storeKey = 'default'; // Could be made configurable
      if (!this.eventStores.has(storeKey)) {
        this.eventStores.set(storeKey, new InMemoryEventStore());
      }
      eventStore = this.eventStores.get(storeKey);
    }

    return new StreamableHTTPServerTransport({
      sessionIdGenerator: config.sessionIdGenerator || (() => randomUUID()),
      enableJsonResponse: config.enableJsonResponse || false,
      eventStore,
      allowedHosts: config.allowedHosts || appConfig.security.corsOrigin !== '*' ? [appConfig.security.corsOrigin] : undefined,
      allowedOrigins: config.allowedOrigins || appConfig.security.corsOrigin !== '*' ? [appConfig.security.corsOrigin] : undefined,
      enableDnsRebindingProtection: config.enableDnsRebindingProtection || false,
      onsessioninitialized: config.onsessioninitialized,
      onsessionclosed: config.onsessionclosed,
    });
  }


  private setupTransportHandlers(instance: TransportInstance): void {
    const { transport, id, type } = instance;

    // Set up close handler
    transport.onclose = () => {
      logger.info('Transport closed', { transportId: id, type });
      this.transports.delete(id);
    };

    // Set up error handler
    transport.onerror = (error: Error) => {
      logger.error('Transport error', {
        transportId: id,
        type,
        error: error.message,
      });
    };

    // Set up message handler to update last activity
    const originalOnMessage = transport.onmessage;
    transport.onmessage = (message, extra) => {
      // Update last activity
      instance.lastActivity = new Date();
      
      // Call original handler if it exists
      if (originalOnMessage) {
        originalOnMessage(message, extra);
      }
    };
  }

  getTransport(id: string): TransportInstance | undefined {
    return this.transports.get(id);
  }

  async removeTransport(id: string): Promise<void> {
    const instance = this.transports.get(id);
    if (instance) {
      try {
        await instance.transport.close();
      } catch (error) {
        logger.error('Error closing transport during removal', {
          transportId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.transports.delete(id);
      
      logger.info('Transport removed', {
        transportId: id,
        type: instance.type,
        totalTransports: this.transports.size,
      });
    }
  }

  listTransports(): TransportInstance[] {
    return Array.from(this.transports.values());
  }

  async cleanup(): Promise<void> {
    logger.info('Starting transport factory cleanup');
    
    // Close cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all transports
    const closePromises = Array.from(this.transports.values()).map(async (instance) => {
      try {
        await instance.transport.close();
      } catch (error) {
        logger.error('Error closing transport during cleanup', {
          transportId: instance.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(closePromises);
    this.transports.clear();

    // Cleanup event stores
    for (const eventStore of this.eventStores.values()) {
      eventStore.cleanup();
    }

    logger.info('Transport factory cleanup completed');
  }

  private performCleanup(): void {
    const now = new Date();
    const maxIdleTime = 30 * 60 * 1000; // 30 minutes
    const instancesToRemove: string[] = [];

    // Find idle transports
    for (const [id, instance] of this.transports.entries()) {
      const idleTime = now.getTime() - instance.lastActivity.getTime();
      if (idleTime > maxIdleTime) {
        instancesToRemove.push(id);
      }
    }

    // Remove idle transports
    if (instancesToRemove.length > 0) {
      logger.info('Cleaning up idle transports', {
        count: instancesToRemove.length,
        transportIds: instancesToRemove,
      });

      instancesToRemove.forEach(id => {
        this.removeTransport(id).catch(error => {
          logger.error('Error during idle transport cleanup', {
            transportId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      });
    }

    // Cleanup event stores
    for (const eventStore of this.eventStores.values()) {
      eventStore.cleanup();
    }
  }

  // Get statistics about active transports
  getStats() {
    const stats = {
      total: this.transports.size,
      byType: {} as Record<TransportType, number>,
      eventStores: this.eventStores.size,
    };

    for (const instance of this.transports.values()) {
      stats.byType[instance.type] = (stats.byType[instance.type] || 0) + 1;
    }

    return stats;
  }
}

// Singleton instance
export const transportFactory = new TransportFactory();