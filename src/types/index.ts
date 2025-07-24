/**
 * Type definitions index - exports all types for easy importing
 */

// MCP Protocol Types
export * from './mcp';

// Puppeteer Types
export * from './puppeteer';

// Server Types
export * from './server';

// Re-export commonly used types for convenience
export type {
  MCPMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  Tool,
  CallToolResult,
  ToolImplementation,
  ToolContext,
  SessionContext,
} from './mcp';

export type {
  NavigateParams,
  ScreenshotParams,
  ClickParams,
  FillParams,
  SelectParams,
  HoverParams,
  EvaluateParams,
  PuppeteerToolName,
  BrowserInstance,
  PageSession,
} from './puppeteer';

export type {
  ServerConfig,
  AuthenticatedRequest,
  SSEConnection,
  HealthCheckResponse,
  MetricsResponse,
  AppContext,
} from './server';