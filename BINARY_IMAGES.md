# Binary Image Support for HTTP Transport

This document explains the optional binary image serving feature for the Puppeteer MCP Server's HTTP transport.

## Overview

By default, the MCP protocol requires images to be base64-encoded within JSON responses. While this works well for small images and maintains protocol compliance, it has some drawbacks:

- **60% size overhead**: Base64 encoding increases data size by ~33%, and JSON escaping adds more overhead
- **Memory usage**: Large base64 strings consume significant memory
- **Network efficiency**: Larger payloads mean slower transfers

The binary image serving feature provides an optional, more efficient alternative for HTTP transport users.

## How It Works

When enabled, instead of returning base64-encoded image data, the server:

1. **Stores the image temporarily** on disk with a unique ID
2. **Returns a URL reference** to the binary image instead of base64 data
3. **Serves the binary image** directly via HTTP with proper caching headers
4. **Automatically cleans up** expired images

## Configuration

Add these environment variables to enable binary image serving:

```bash
# Enable binary image serving (default: false)
SCREENSHOT_ENABLE_BINARY_SERVING=true

# How long image URLs remain valid in seconds (default: 3600 = 1 hour)
SCREENSHOT_BINARY_URL_TTL=3600

# How often to clean up expired images in milliseconds (default: 300000 = 5 minutes)
SCREENSHOT_CLEANUP_INTERVAL=300000
```

## Usage

### Standard Base64 Response (Default)
```json
{
  "jsonrpc": "2.0",
  "id": "screenshot-1",
  "method": "tools/call",
  "params": {
    "name": "puppeteer_screenshot",
    "arguments": {
      "name": "homepage",
      "encoded": false
    }
  }
}
```

Returns MCP image content with base64 data.

### Binary URL Response (Efficient)
```json
{
  "jsonrpc": "2.0",
  "id": "screenshot-1", 
  "method": "tools/call",
  "params": {
    "name": "puppeteer_screenshot",
    "arguments": {
      "name": "homepage",
      "useBinaryUrl": true
    }
  }
}
```

Returns a response like:
```json
{
  "jsonrpc": "2.0",
  "id": "screenshot-1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Screenshot 'homepage' captured successfully (full page)\nSize: 245KB\nDuration: 1250ms\nPage: Example Site (https://example.com)\nBinary URL: /images/abc123-def456-789\nExpires: 2024-01-15T15:30:00.000Z\nFormat: Binary PNG (more efficient than base64)"
      },
      {
        "type": "text", 
        "text": "Binary Image URL: /images/abc123-def456-789"
      }
    ],
    "isError": false
  }
}
```

## API Endpoints

When binary serving is enabled, these endpoints become available:

### Get Binary Image
```
GET /images/{id}
```
Returns the raw binary image with appropriate headers:
- `Content-Type: image/png`
- `Cache-Control: public, max-age=3600`
- `ETag` and `Last-Modified` for caching
- Supports conditional requests (`If-None-Match`, `If-Modified-Since`)

### Get Image Metadata
```
GET /images/{id}/info
```
Returns JSON metadata about the image:
```json
{
  "id": "abc123-def456-789",
  "sessionId": "session-uuid",
  "filename": "homepage",
  "mimeType": "image/png",
  "size": 250880,
  "createdAt": "2024-01-15T14:30:00.000Z",
  "expiresAt": "2024-01-15T15:30:00.000Z",
  "url": "/images/abc123-def456-789"
}
```

### Get Storage Statistics
```
GET /images/stats
```
Returns storage statistics for monitoring:
```json
{
  "totalImages": 15,
  "totalSize": 5242880,
  "totalSizeMB": 5.0,
  "oldestImage": "2024-01-15T14:00:00.000Z",
  "newestImage": "2024-01-15T14:30:00.000Z"
}
```

## Benefits

### Efficiency Gains
- **~60% smaller responses** for large images
- **Direct binary serving** with HTTP caching
- **Reduced memory usage** in JSON parsing
- **Better browser caching** with proper HTTP headers

### Compatibility
- **Fully optional**: Disabled by default, no breaking changes
- **Graceful fallback**: Falls back to base64 if storage fails
- **MCP compliant**: Still returns proper MCP responses with URL references

### Performance
- **Automatic cleanup**: Expired images are automatically removed
- **Configurable TTL**: Control how long images remain available
- **HTTP caching**: Browsers can cache images efficiently

## Security Considerations

- **No authentication required** for image serving (images are temporary and have UUIDs)
- **Automatic expiration** prevents indefinite storage
- **Safe file handling** with sanitized filenames
- **Directory traversal protection** built-in

## Storage Management

Images are stored in `temp/images/` directory with:
- **UUID-based filenames** for security
- **Automatic cleanup** of expired images
- **Configurable cleanup intervals**
- **Graceful shutdown** cleanup

## Example Usage

```bash
# Enable binary serving
export SCREENSHOT_ENABLE_BINARY_SERVING=true

# Take a screenshot with binary URL
curl -X POST http://localhost:3000/http \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test",
    "method": "tools/call", 
    "params": {
      "name": "puppeteer_screenshot",
      "arguments": {
        "name": "test-image",
        "useBinaryUrl": true
      }
    }
  }'

# Access the binary image directly
curl http://localhost:3000/images/abc123-def456-789 \
  -o screenshot.png
```

## Monitoring

Monitor binary image usage through:
- **Server logs**: Image storage and cleanup events
- **Statistics endpoint**: `/images/stats` for current usage
- **Health checks**: Storage errors are logged and handled gracefully

This feature provides a significant efficiency improvement for HTTP transport users while maintaining full backward compatibility and MCP protocol compliance.