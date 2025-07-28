/**
 * Transport abstraction types for MCP server
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from './server';

// Transport types supported by the server
export enum TransportType {
  SSE = 'sse',
  STREAMABLE_HTTP = 'streamable_http',
}

// Base transport configuration
export interface BaseTransportConfig {
  type: TransportType;
  sessionId?: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  enableDnsRebindingProtection?: boolean;
}

// SSE transport configuration (legacy)
export interface SSETransportConfig extends BaseTransportConfig {
  type: TransportType.SSE;
  endpoint: string;
}

// Streamable HTTP transport configuration
export interface StreamableHTTPTransportConfig extends BaseTransportConfig {
  type: TransportType.STREAMABLE_HTTP;
  sessionIdGenerator?: () => string;
  enableJsonResponse?: boolean;
  enableResumability?: boolean;
  onsessioninitialized?: (sessionId: string) => void | Promise<void>;
  onsessionclosed?: (sessionId: string) => void | Promise<void>;
}

// Union type for all transport configurations
export type TransportConfig =
  | SSETransportConfig
  | StreamableHTTPTransportConfig;

// Transport instance wrapper
export interface TransportInstance {
  id: string;
  type: TransportType;
  transport: Transport;
  sessionId?: string;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

// Transport factory interface
export interface ITransportFactory {
  createTransport(config: TransportConfig, req?: Request, res?: Response): Promise<TransportInstance>;
  getTransport(id: string): TransportInstance | undefined;
  removeTransport(id: string): Promise<void>;
  listTransports(): TransportInstance[];
  cleanup(): Promise<void>;
}

// Transport manager interface
export interface ITransportManager {
  factory: ITransportFactory;
  handleRequest(req: AuthenticatedRequest, res: Response, transportType: TransportType): Promise<void>;
  getActiveTransports(): Map<string, TransportInstance>;
  closeTransport(id: string): Promise<void>;
  closeAllTransports(): Promise<void>;
}

// Transport handler function type
export type TransportHandler = (
  req: AuthenticatedRequest, 
  res: Response, 
  transportInstance?: TransportInstance
) => Promise<void>;

// Transport route configuration
export interface TransportRoute {
  path: string;
  type: TransportType;
  methods: string[];
  handler: TransportHandler;
  middleware?: any[];
}

// Event store interface for resumability
export interface EventStore {
  storeEvent(streamId: string, message: any): Promise<string>;
  replayEventsAfter(lastEventId: string, options: {
    send: (eventId: string, message: any) => Promise<void>;
  }): Promise<string>;
}

// Simple in-memory event store implementation
export class InMemoryEventStore implements EventStore {
  private events: Map<string, { id: string; streamId: string; message: any; timestamp: Date }[]> = new Map();
  private eventCounter = 0;

  async storeEvent(streamId: string, message: any): Promise<string> {
    const eventId = `event_${++this.eventCounter}_${Date.now()}`;
    const event = {
      id: eventId,
      streamId,
      message,
      timestamp: new Date(),
    };

    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    
    this.events.get(streamId)!.push(event);
    
    // Keep only last 1000 events per stream to prevent memory leaks
    const streamEvents = this.events.get(streamId)!;
    if (streamEvents.length > 1000) {
      streamEvents.splice(0, streamEvents.length - 1000);
    }

    return eventId;
  }

  async replayEventsAfter(lastEventId: string, options: {
    send: (eventId: string, message: any) => Promise<void>;
  }): Promise<string> {
    // Find the stream that contains this event ID
    let targetStreamId = '';
    let startIndex = -1;

    for (const [streamId, events] of this.events.entries()) {
      const eventIndex = events.findIndex(e => e.id === lastEventId);
      if (eventIndex !== -1) {
        targetStreamId = streamId;
        startIndex = eventIndex + 1; // Start after the found event
        break;
      }
    }

    if (startIndex === -1 || !targetStreamId) {
      throw new Error(`Event ID ${lastEventId} not found`);
    }

    const streamEvents = this.events.get(targetStreamId)!;
    const eventsToReplay = streamEvents.slice(startIndex);

    // Replay events
    for (const event of eventsToReplay) {
      await options.send(event.id, event.message);
    }

    return targetStreamId;
  }

  // Cleanup old events
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void { // Default: 24 hours
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [streamId, events] of this.events.entries()) {
      const filteredEvents = events.filter(e => e.timestamp > cutoff);
      if (filteredEvents.length === 0) {
        this.events.delete(streamId);
      } else {
        this.events.set(streamId, filteredEvents);
      }
    }
  }
}