# Transport Guide - Multiple MCP Transport Support

This guide explains the multiple transport mechanisms supported by the Puppeteer MCP Server, following the MCP 2025-06-18 specification.

## Overview

The server supports **three transport mechanisms** for maximum compatibility:

1. **🌐 Streamable HTTP Transport** - Modern MCP 2025-06-18 specification (Recommended)
2. **📡 Stdio Transport** - HTTP-based stdio simulation for stateless operation
3. **🔄 Legacy SSE Transport** - Backward compatibility with existing clients

## Transport Comparison

| Feature | Streamable HTTP | Stdio | Legacy SSE |
|---------|----------------|-------|------------|
| **MCP Specification** | 2025-06-18 | 2025-06-18 | 2024-11-05 |
| **Session Management** | ✅ Advanced | ❌ Stateless | ✅ Basic |
| **Resumability** | ✅ Yes | ❌ No | ❌ No |
| **Real-time Streaming** | ✅ SSE | ❌ No | ✅ SSE |
| **HTTP Methods** | POST, GET, DELETE | POST | GET, POST |
| **Use Case** | Modern clients | Simple integrations | Legacy compatibility |

## 1. Streamable HTTP Transport (Recommended)

### Features
- **Session Management**: UUID-based sessions with automatic cleanup
- **Resumability**: Event store with replay capability using `Last-Event-ID`
- **Multiple HTTP Methods**: POST for messages, GET for SSE streams, DELETE for termination
- **DNS Rebinding Protection**: Configurable host and origin validation
- **Advanced Error Handling**: Comprehensive error responses with context

### Usage Examples

#### Initialize Session
```bash
curl -X POST http://localhost:3000/http \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0"}
    },
    "id": 1
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {"listChanged": false}},
    "serverInfo": {"name": "puppeteer-mcp-server", "version": "1.0.0"}
  }
}
```

#### Use Tools with Session
```bash
curl -X POST http://localhost:3000/http \
  -H "Authorization: Bearer your-api-key" \
  -H "Mcp-Session-Id: session-id-from-response" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "puppeteer_navigate",
      "arguments": {"url": "https://example.com"}
    },
    "id": 2
  }'
```

#### Establish SSE Stream
```bash
curl -N -H "Authorization: Bearer your-api-key" \
     -H "Mcp-Session-Id: session-id" \
     -H "Accept: text/event-stream" \
     http://localhost:3000/http
```

#### Resume Stream (Resumability)
```bash
curl -N -H "Authorization: Bearer your-api-key" \
     -H "Mcp-Session-Id: session-id" \
     -H "Last-Event-ID: event_123_1234567890" \
     -H "Accept: text/event-stream" \
     http://localhost:3000/http
```

#### Terminate Session
```bash
curl -X DELETE http://localhost:3000/http \
  -H "Authorization: Bearer your-api-key" \
  -H "Mcp-Session-Id: session-id"
```

### Implementation Details

```typescript
// Session-based request handling
const sessionId = req.headers['mcp-session-id'] as string;
const method = req.method.toLowerCase();

switch (method) {
  case 'post':
    if (sessionId) {
      // Use existing session
      const transport = getTransportBySession(sessionId);
      await transport.handleRequest(req, res, req.body);
    } else if (isInitializeRequest(req.body)) {
      // Create new session
      const transport = await createStreamableHTTPTransport();
      await transport.handleRequest(req, res, req.body);
    }
    break;
    
  case 'get':
    // Establish SSE stream
    const transport = getTransportBySession(sessionId);
    await transport.handleRequest(req, res);
    break;
    
  case 'delete':
    // Terminate session
    await terminateSession(sessionId);
    res.status(200).send('Session terminated');
    break;
}
```

## 2. Stdio Transport

### Features
- **Stateless Operation**: No session management required
- **Simple HTTP Interface**: Single POST endpoint
- **Process Simulation**: Simulates stdin/stdout over HTTP
- **Fast Response**: Immediate processing without session overhead

### Usage Examples

#### Execute Tool
```bash
curl -X POST http://localhost:3000/stdio \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "puppeteer_screenshot",
      "arguments": {"name": "homepage"}
    },
    "id": 1
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Screenshot saved as homepage.png"
      }
    ]
  }
}
```

### Implementation Details

```typescript
// Stateless stdio handling
async function handleStdioRequest(req: Request, res: Response) {
  // Create temporary transport
  const transport = new StdioServerTransport();
  
  try {
    // Connect to MCP server
    const mcpServer = createMCPServer();
    await mcpServer.connect(transport);
    
    // Process message
    const result = await processMessage(req.body);
    res.json(result);
  } finally {
    // Cleanup transport
    await transport.close();
  }
}
```

## 3. Legacy SSE Transport

### Features
- **Backward Compatibility**: Works with existing MCP clients
- **SSE Streaming**: Real-time bidirectional communication
- **Session-based**: Basic session management
- **Established Protocol**: Uses MCP 2024-11-05 specification

### Usage Examples

#### Establish SSE Connection
```bash
curl -N -H "Authorization: Bearer your-api-key" \
     -H "Accept: text/event-stream" \
     http://localhost:3000/sse
```

#### Send Messages
```bash
curl -X POST "http://localhost:3000/messages?sessionId=session-id" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Transport Selection Guide

### Choose Streamable HTTP When:
- ✅ Building new MCP clients
- ✅ Need session management and resumability
- ✅ Want the latest MCP specification features
- ✅ Require robust error handling and recovery
- ✅ Need real-time streaming with reliability

### Choose Stdio When:
- ✅ Building simple, stateless integrations
- ✅ Don't need session management
- ✅ Want minimal overhead and fast responses
- ✅ Integrating with systems that prefer simple HTTP APIs
- ✅ Testing or prototyping MCP functionality

### Choose Legacy SSE When:
- ✅ Maintaining existing MCP client integrations
- ✅ Need backward compatibility
- ✅ Working with older MCP implementations
- ✅ Gradual migration to newer transports

## Configuration

### Environment Variables

```bash
# Transport-specific settings
TRANSPORT_SESSION_TIMEOUT=1800000          # 30 minutes
TRANSPORT_CLEANUP_INTERVAL=300000          # 5 minutes
TRANSPORT_MAX_SESSIONS=100                 # Maximum concurrent sessions
TRANSPORT_ENABLE_RESUMABILITY=true         # Enable event store
TRANSPORT_DNS_REBINDING_PROTECTION=false   # Enable DNS protection

# Legacy SSE settings (backward compatibility)
SSE_HEARTBEAT_INTERVAL=30000               # 30 seconds
SSE_CONNECTION_TIMEOUT=60000               # 1 minute
```

### Transport Factory Configuration

```typescript
// Configure transport factory
const transportFactory = new TransportFactory({
  streamableHttp: {
    sessionIdGenerator: () => randomUUID(),
    enableResumability: true,
    eventStore: new InMemoryEventStore(),
    allowedHosts: ['localhost', 'your-domain.com'],
    enableDnsRebindingProtection: true
  },
  stdio: {
    enableHttpWrapper: true,
    timeout: 30000
  },
  sse: {
    heartbeatInterval: 30000,
    connectionTimeout: 60000
  }
});
```

## Monitoring and Debugging

### Transport Statistics

```bash
# Get transport statistics
curl -H "Authorization: Bearer your-api-key" \
     http://localhost:3000/stats

# Response
{
  "serverInfo": {
    "supportedTransports": ["sse", "streamable_http", "stdio"]
  },
  "transports": {
    "activeTransports": 3,
    "activeSessions": 2,
    "factoryStats": {
      "total": 3,
      "byType": {
        "streamable_http": 2,
        "stdio": 0,
        "sse": 1
      }
    }
  }
}
```

### Health Check

```bash
# Check transport health
curl -H "Authorization: Bearer your-api-key" \
     http://localhost:3000/health

# Response
{
  "status": "healthy",
  "transports": {
    "active": 3,
    "sessions": 2,
    "types": {
      "sse": "available",
      "streamable_http": "available", 
      "stdio": "available"
    }
  }
}
```

### Debug Logging

```bash
# Enable debug logging for transports
LOG_LEVEL=debug npm start

# Example debug output
{"level":"debug","message":"Transport created","transportId":"uuid","type":"streamable_http","sessionId":"session-uuid"}
{"level":"debug","message":"Session initialized","sessionId":"session-uuid","transportId":"uuid"}
{"level":"debug","message":"Message handled","method":"tools/call","sessionId":"session-uuid"}
```

## Migration Guide

### From Legacy SSE to Streamable HTTP

1. **Update Client Code**:
   ```typescript
   // Old SSE approach
   const eventSource = new EventSource('/sse');
   fetch('/messages?sessionId=id', {method: 'POST', body: message});
   
   // New Streamable HTTP approach
   const initResponse = await fetch('/http', {method: 'POST', body: initMessage});
   const sessionId = initResponse.headers.get('Mcp-Session-Id');
   const eventSource = new EventSource(`/http?sessionId=${sessionId}`);
   ```

2. **Update Headers**:
   ```typescript
   // Add session header for subsequent requests
   headers: {
     'Authorization': 'Bearer api-key',
     'Mcp-Session-Id': sessionId,
     'Content-Type': 'application/json'
   }
   ```

3. **Handle Session Lifecycle**:
   ```typescript
   // Initialize session
   await initializeSession();
   
   // Use session for tools
   await callTool(sessionId, toolName, args);
   
   // Terminate when done
   await terminateSession(sessionId);
   ```

## Best Practices

### Security
- Always use HTTPS in production
- Implement proper API key rotation
- Enable DNS rebinding protection for public deployments
- Validate session IDs and implement session timeouts

### Performance
- Reuse sessions for multiple tool calls
- Implement client-side connection pooling
- Use appropriate transport for your use case
- Monitor transport statistics and optimize accordingly

### Error Handling
- Implement retry logic with exponential backoff
- Handle session expiration gracefully
- Use resumability features for long-running operations
- Log transport errors for debugging

### Monitoring
- Track active sessions and transport usage
- Monitor memory usage and cleanup effectiveness
- Set up alerts for transport failures
- Use structured logging for better observability

This guide provides comprehensive information for implementing and using the multiple transport mechanisms in the Puppeteer MCP Server.