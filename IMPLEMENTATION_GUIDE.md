# Implementation Guide

This guide provides detailed implementation details and code examples for the Puppeteer MCP Server.

## Key Technical Decisions

### 1. MCP Protocol over SSE

The Model Context Protocol (MCP) will be implemented over Server-Sent Events (SSE) instead of the standard stdio transport. This enables remote access while maintaining the MCP protocol structure.

**SSE Implementation Pattern:**
```typescript
// Client sends HTTP POST with MCP message
POST /mcp
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "puppeteer_navigate",
    "arguments": { "url": "https://example.com" }
  }
}

// Server responds via SSE stream
GET /sse
Authorization: Bearer <api_key>

data: {"jsonrpc":"2.0","id":"1","result":{"content":[{"type":"text","text":"Navigated to https://example.com"}]}}
```

### 2. Browser Lifecycle Management

**Single Browser Instance Strategy:**
- One browser instance per server container
- Pages are created/destroyed per request
- Browser survives across requests for performance
- Automatic cleanup of stale pages

```typescript
class BrowserManager {
  private browser: Browser | null = null;
  private activePagesMap = new Map<string, Page>();

  async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch(this.getLaunchOptions());
    }
    return this.browser;
  }

  async getPage(sessionId: string): Promise<Page> {
    const browser = await this.ensureBrowser();
    
    if (!this.activePagesMap.has(sessionId)) {
      const page = await browser.newPage();
      this.activePagesMap.set(sessionId, page);
    }
    
    return this.activePagesMap.get(sessionId)!;
  }
}
```

### 3. Authentication Strategy

**Bearer Token Authentication:**
```typescript
interface AuthMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
}

const authenticateApiKey: AuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: -32001, message: 'Missing or invalid authorization header' }
    });
  }
  
  const token = authHeader.substring(7);
  if (token !== process.env.API_KEY) {
    return res.status(401).json({
      error: { code: -32001, message: 'Invalid API key' }
    });
  }
  
  next();
};
```

### 4. Tool Implementation Pattern

Each tool follows a consistent pattern:

```typescript
interface ToolImplementation {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(params: any, context: ToolContext): Promise<ToolResult>;
}

// Example: puppeteer_navigate
export const navigateTool: ToolImplementation = {
  name: "puppeteer_navigate",
  description: "Navigate to a URL",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to navigate to" },
      launchOptions: { type: "object", description: "Puppeteer launch options" },
      allowDangerous: { type: "boolean", description: "Allow dangerous launch options" }
    },
    required: ["url"]
  },
  
  async execute(params, context) {
    const { url, launchOptions, allowDangerous } = params;
    const page = await context.browserManager.getPage(context.sessionId);
    
    try {
      await page.goto(url);
      return {
        content: [{
          type: "text",
          text: `Navigated to ${url}`
        }],
        isError: false
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to navigate: ${error.message}`
        }],
        isError: true
      };
    }
  }
};
```

## Environment Configuration

**Complete Environment Variables:**
```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Authentication
API_KEY=your-super-secure-api-key-change-this

# Puppeteer Configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_LAUNCH_OPTIONS={"headless":true,"args":["--no-sandbox","--disable-setuid-sandbox"]}

# Browser Settings
BROWSER_TIMEOUT=30000
MAX_PAGES_PER_SESSION=5
PAGE_CLEANUP_INTERVAL=300000

# Security Settings
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## Docker Implementation

**Multi-stage Dockerfile:**
```dockerfile
# Build stage
FROM node:18-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM node:18-bookworm-slim AS runtime

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

# Set up application
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Build TypeScript
RUN npm run build

# Switch to non-root user
USER pptruser

# Environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

## Error Handling Strategy

**Comprehensive Error Handling:**
```typescript
class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// Error codes following JSON-RPC 2.0 specification
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // Custom MCP errors
  AUTHENTICATION_ERROR: -32001,
  BROWSER_ERROR: -32002,
  TIMEOUT_ERROR: -32003,
  VALIDATION_ERROR: -32004
} as const;

// Global error handler
export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  
  if (error instanceof MCPError) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: error.code,
        message: error.message,
        data: error.data
      }
    });
  }
  
  // Generic server error
  res.status(500).json({
    jsonrpc: "2.0",
    id: req.body?.id || null,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: "Internal server error"
    }
  });
};
```

## Testing Strategy

**Test Structure:**
```typescript
// Unit test example
describe('NavigateTool', () => {
  let mockBrowserManager: jest.Mocked<BrowserManager>;
  let mockPage: jest.Mocked<Page>;
  
  beforeEach(() => {
    mockPage = {
      goto: jest.fn(),
    } as any;
    
    mockBrowserManager = {
      getPage: jest.fn().mockResolvedValue(mockPage),
    } as any;
  });
  
  it('should navigate to URL successfully', async () => {
    mockPage.goto.mockResolvedValue(undefined);
    
    const result = await navigateTool.execute(
      { url: 'https://example.com' },
      { browserManager: mockBrowserManager, sessionId: 'test' }
    );
    
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Navigated to https://example.com');
  });
});

// Integration test example
describe('MCP Server Integration', () => {
  let server: Server;
  let apiKey: string;
  
  beforeAll(async () => {
    apiKey = 'test-api-key';
    process.env.API_KEY = apiKey;
    server = await startTestServer();
  });
  
  it('should handle complete MCP workflow', async () => {
    // Test authentication
    const response = await request(server)
      .post('/mcp')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/list'
      });
      
    expect(response.status).toBe(200);
    expect(response.body.result.tools).toHaveLength(7);
  });
});
```

## Performance Considerations

**Resource Management:**
- Browser instance pooling for high-load scenarios
- Page cleanup after configurable timeout
- Memory monitoring and automatic restarts
- Request rate limiting per API key

**Monitoring Metrics:**
- Active browser instances
- Page count per session
- Memory usage trends
- Request latency percentiles
- Error rates by tool

This implementation guide provides the foundation for building a robust, production-ready Puppeteer MCP server that can handle real-world usage scenarios while maintaining security and performance standards.