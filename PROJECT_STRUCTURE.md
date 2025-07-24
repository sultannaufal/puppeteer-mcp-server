# Project Structure

This document outlines the complete file structure for the Puppeteer MCP Server project.

```
puppeteer-mcp-server/
├── src/
│   ├── types/
│   │   ├── mcp.ts                 # MCP protocol type definitions
│   │   ├── puppeteer.ts           # Puppeteer-specific types
│   │   └── server.ts              # Server configuration types
│   ├── middleware/
│   │   ├── auth.ts                # API key authentication middleware
│   │   ├── cors.ts                # CORS configuration
│   │   └── logging.ts             # Request logging middleware
│   ├── tools/
│   │   ├── base.ts                # Base tool interface and utilities
│   │   ├── navigate.ts            # puppeteer_navigate implementation
│   │   ├── screenshot.ts          # puppeteer_screenshot implementation
│   │   ├── click.ts               # puppeteer_click implementation
│   │   ├── fill.ts                # puppeteer_fill implementation
│   │   ├── select.ts              # puppeteer_select implementation
│   │   ├── hover.ts               # puppeteer_hover implementation
│   │   ├── evaluate.ts            # puppeteer_evaluate implementation
│   │   └── index.ts               # Tool registry and exports
│   ├── services/
│   │   ├── browser.ts             # Browser lifecycle management
│   │   ├── mcp-server.ts          # Core MCP server implementation
│   │   └── sse.ts                 # Server-Sent Events handler
│   ├── utils/
│   │   ├── config.ts              # Environment configuration
│   │   ├── logger.ts              # Logging utilities
│   │   ├── validation.ts          # Parameter validation
│   │   └── errors.ts              # Custom error classes
│   ├── routes/
│   │   ├── health.ts              # Health check endpoint
│   │   ├── sse.ts                 # SSE endpoint handler
│   │   └── metrics.ts             # Metrics endpoint (optional)
│   ├── app.ts                     # Express app configuration
│   └── server.ts                  # Main server entry point
├── tests/
│   ├── unit/
│   │   ├── tools/                 # Unit tests for each tool
│   │   ├── middleware/            # Middleware tests
│   │   └── services/              # Service tests
│   ├── integration/
│   │   ├── mcp-protocol.test.ts   # MCP protocol integration tests
│   │   ├── auth.test.ts           # Authentication flow tests
│   │   └── browser.test.ts        # Browser automation tests
│   └── fixtures/
│       ├── test-pages/            # HTML test pages
│       └── mock-data/             # Mock data for tests
├── docker/
│   ├── Dockerfile                 # Production Dockerfile
│   ├── Dockerfile.dev             # Development Dockerfile
│   └── docker-entrypoint.sh       # Container startup script
├── docs/
│   ├── API.md                     # API documentation
│   ├── DEPLOYMENT.md              # Deployment guide
│   └── TROUBLESHOOTING.md         # Common issues and solutions
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore rules
├── .dockerignore                  # Docker ignore rules
├── package.json                   # Node.js dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── jest.config.js                 # Jest testing configuration
├── docker-compose.yml             # Docker Compose configuration
├── docker-compose.dev.yml         # Development Docker Compose
├── README.md                      # Project documentation
├── TECHNICAL_SPECIFICATION.md     # Technical specification (already created)
└── PROJECT_STRUCTURE.md           # This file
```

## Key Components

### Core Services
- **`src/services/mcp-server.ts`**: Implements the MCP protocol handling
- **`src/services/browser.ts`**: Manages Puppeteer browser lifecycle
- **`src/services/sse.ts`**: Handles Server-Sent Events communication

### Tool Implementation
- Each tool in `src/tools/` implements a specific Puppeteer operation
- All tools extend a base interface for consistency
- Tools are registered in `src/tools/index.ts`

### Configuration Management
- **`src/utils/config.ts`**: Centralizes all environment variable handling
- **`.env.example`**: Template for required environment variables
- Docker environment variables passed through compose files

### Security & Middleware
- **`src/middleware/auth.ts`**: Bearer token authentication
- **`src/middleware/cors.ts`**: Cross-origin resource sharing
- **`src/middleware/logging.ts`**: Request/response logging

### Testing Strategy
- Unit tests for individual components
- Integration tests for full workflows
- Test fixtures for browser automation scenarios

### Docker Configuration
- Multi-stage builds for optimized production images
- Separate development and production configurations
- Health checks and proper signal handling

## Implementation Order

The todo list follows this implementation order:

1. **Foundation** (Items 1-5): Basic project setup and core infrastructure
2. **Tool Implementation** (Items 6-12): Port all Puppeteer tools
3. **MCP Integration** (Items 13-15): Complete MCP protocol implementation
4. **Containerization** (Items 16-17): Docker setup
5. **Quality & Documentation** (Items 18-19): Error handling and docs
6. **Testing & Validation** (Items 20-22): Comprehensive testing

This structure ensures a maintainable, scalable, and well-documented codebase that follows Node.js and TypeScript best practices.