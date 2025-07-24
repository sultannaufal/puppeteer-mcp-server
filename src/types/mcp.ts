/**
 * Model Context Protocol (MCP) Type Definitions
 * Based on MCP specification for remote server implementation
 */

// JSON-RPC 2.0 Base Types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP Protocol Messages
export type MCPMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// Content Types
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export type Content = TextContent | ImageContent;

// Tool Definition
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Tool Call Request/Response
export interface CallToolRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface CallToolResult {
  content: Content[];
  isError?: boolean;
}

// Server Capabilities
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

// Initialize Request/Response
export interface InitializeRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: ClientCapabilities;
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface ClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: {};
}

// List Tools Request/Response
export interface ListToolsRequest {
  method: 'tools/list';
  params?: {};
}

export interface ListToolsResult {
  tools: Tool[];
}

// Ping Request/Response
export interface PingRequest {
  method: 'ping';
  params?: {};
}

export interface PingResult {
  // Empty object response
}

// Notification Types
export interface ToolListChangedNotification {
  method: 'notifications/tools/list_changed';
  params?: {};
}

// Error Codes (JSON-RPC 2.0 + MCP specific)
export const ErrorCodes = {
  // JSON-RPC 2.0 Standard Errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP Specific Errors
  AUTHENTICATION_ERROR: -32001,
  BROWSER_ERROR: -32002,
  TIMEOUT_ERROR: -32003,
  VALIDATION_ERROR: -32004,
  RESOURCE_NOT_FOUND: -32005,
  RATE_LIMIT_EXCEEDED: -32006,
} as const;

// Session Management
export interface SessionContext {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

// Server Configuration
export interface MCPServerConfig {
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
  capabilities: ServerCapabilities;
}

// Tool Context for execution
export interface ToolContext {
  sessionId: string;
  requestId: string | number | null;
  browserManager: any; // Will be typed properly in browser.ts
  logger: any; // Will be typed properly in logger.ts
}

// Tool Implementation Interface
export interface ToolImplementation {
  name: string;
  description: string;
  inputSchema: Tool['inputSchema'];
  execute(params: any, context: ToolContext): Promise<CallToolResult>;
}

// SSE Message Types
export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

// Request/Response Mapping
export interface MCPMethodMap {
  'initialize': {
    params: InitializeRequest['params'];
    result: InitializeResult;
  };
  'tools/list': {
    params: ListToolsRequest['params'];
    result: ListToolsResult;
  };
  'tools/call': {
    params: CallToolRequest['params'];
    result: CallToolResult;
  };
  'ping': {
    params: PingRequest['params'];
    result: PingResult;
  };
}

// Type guards
export function isJSONRPCRequest(message: any): message is JSONRPCRequest {
  return (
    message &&
    message.jsonrpc === '2.0' &&
    typeof message.method === 'string' &&
    (message.id === undefined || 
     typeof message.id === 'string' || 
     typeof message.id === 'number' || 
     message.id === null)
  );
}

export function isJSONRPCResponse(message: any): message is JSONRPCResponse {
  return (
    message &&
    message.jsonrpc === '2.0' &&
    (message.id === undefined || 
     typeof message.id === 'string' || 
     typeof message.id === 'number' || 
     message.id === null) &&
    (message.result !== undefined || message.error !== undefined)
  );
}

export function isJSONRPCNotification(message: any): message is JSONRPCNotification {
  return (
    message &&
    message.jsonrpc === '2.0' &&
    typeof message.method === 'string' &&
    message.id === undefined
  );
}