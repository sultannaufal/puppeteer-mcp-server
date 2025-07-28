/**
 * Server configuration and Express-related type definitions
 */

import type { Request, Response, NextFunction } from 'express';
import { SessionContext, ToolContext } from './mcp';

// Environment Configuration
export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  apiKey: string;
  
  // Puppeteer Configuration
  puppeteer: {
    skipChromiumDownload: boolean;
    executablePath?: string;
    launchOptions: string; // JSON string
  };
  
  // Browser Settings
  browser: {
    timeout: number;
    maxPagesPerSession: number;
    pageCleanupInterval: number;
    sessionTimeout: number;
  };
  
  // Security Settings
  security: {
    corsOrigin: string;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  
  // Logging
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'simple';
  };
  
  // Health Check
  healthCheck: {
    enabled: boolean;
    path: string;
  };
  
  // Metrics
  metrics: {
    enabled: boolean;
    path: string;
  };
  
  // Screenshot Settings
  screenshot: {
    defaultWidth: number;
    defaultHeight: number;
    maxWidth: number;
    maxHeight: number;
    quality: number;
    enableBinaryServing: boolean;
    binaryUrlTtl: number; // TTL in seconds for binary image URLs
    cleanupInterval: number; // Cleanup interval in milliseconds
  };
  
  // Performance Settings
  performance: {
    maxConcurrentPages: number;
    browserRestartThreshold: number;
    memoryLimitMB: number;
  };
  
}

// Express Request Extensions
export interface AuthenticatedRequest extends Request {
  sessionId?: string;
  toolContext?: ToolContext;
}

// Middleware Types
export type AuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void;

export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// SSE Connection Management
export interface SSEConnection {
  id: string;
  sessionId: string;
  response: Response;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface SSEManager {
  connections: Map<string, SSEConnection>;
  addConnection(connection: SSEConnection): void;
  removeConnection(connectionId: string): void;
  sendToConnection(connectionId: string, data: any): boolean;
  sendToSession(sessionId: string, data: any): number;
  cleanup(): void;
}

// Rate Limiting
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  browser?: {
    isHealthy: boolean;
    pageCount: number;
    memoryUsage?: number;
    error?: string;
  };
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  connections?: {
    total: number;
    active: number;
    sessions: number;
  };
  error?: string;
}

// Metrics Response
export interface MetricsResponse {
  timestamp: string;
  uptime: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per minute
  };
  browser: {
    pageCount: number;
    sessionCount: number;
    restartCount: number;
    memoryUsage: number;
  };
  tools: {
    [toolName: string]: {
      callCount: number;
      successCount: number;
      errorCount: number;
      averageResponseTime: number;
    };
  };
  system: {
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    cpuUsage?: number;
  };
}

// Session Management
export interface SessionManager {
  sessions: Map<string, SessionContext>;
  createSession(): SessionContext;
  getSession(sessionId: string): SessionContext | undefined;
  updateSession(sessionId: string, updates: Partial<SessionContext>): void;
  removeSession(sessionId: string): void;
  cleanupExpiredSessions(): number;
}

// Tool Registry
export interface ToolRegistry {
  tools: Map<string, any>; // ToolImplementation from mcp.ts
  registerTool(tool: any): void;
  getTool(name: string): any | undefined;
  listTools(): any[];
  hasTools(): boolean;
}

// Server State
export interface ServerState {
  isRunning: boolean;
  startTime: Date;
  requestCount: number;
  errorCount: number;
  lastError?: {
    message: string;
    timestamp: Date;
    stack?: string;
  };
}

// CORS Configuration
export interface CORSConfig {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

// Compression Configuration
export interface CompressionConfig {
  level?: number;
  threshold?: number;
  filter?: (req: Request, res: Response) => boolean;
}

// Security Headers Configuration
export interface SecurityConfig {
  contentSecurityPolicy?: boolean | object;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  dnsPrefetchControl?: boolean;
  frameguard?: boolean | object;
  hidePoweredBy?: boolean;
  hsts?: boolean | object;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: boolean | object;
  xssFilter?: boolean;
}

// Application Context
export interface AppContext {
  config: ServerConfig;
  browserManager: any; // Will be typed in browser service
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  sseManager: SSEManager;
  logger: any; // Will be typed in logger utility
  state: ServerState;
}

// Error Response Format
export interface ErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

// Success Response Format
export interface SuccessResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result: any;
}

// HTTP Status Codes
export const HttpStatusCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Content Types
export const ContentTypes = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  SSE: 'text/event-stream',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
} as const;