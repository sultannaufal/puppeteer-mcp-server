# 🤖 Puppeteer MCP Server

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/sultannaufal/puppeteer-mcp-server)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build Status](https://github.com/sultannaufal/puppeteer-mcp-server/workflows/CI/badge.svg)](https://github.com/sultannaufal/puppeteer-mcp-server/actions)
[![MCP Protocol](https://img.shields.io/badge/MCP-2.0-orange.svg)](https://modelcontextprotocol.io/)

A **self-hosted Puppeteer MCP (Model Context Protocol) server** with remote SSE access, API key authentication, and Docker deployment. This server provides **16 comprehensive Puppeteer tools** including advanced mouse interactions and authentication cookie management, with enhanced security, monitoring, and production-ready features.

## 🌟 Features

### 🔧 **Complete Puppeteer Tool Suite**

#### **Core Browser Tools**
- **`puppeteer_navigate`** - Navigate to URLs with safety validation
- **`puppeteer_screenshot`** - Take full page or element screenshots
- **`puppeteer_click`** - Click elements with retry logic
- **`puppeteer_fill`** - Fill input fields with validation
- **`puppeteer_select`** - Select options from dropdown elements
- **`puppeteer_hover`** - Hover over elements with effect detection
- **`puppeteer_evaluate`** - Execute JavaScript with console capture

#### **🖱️ Advanced Mouse Tools**
- **`puppeteer_mouse_move`** - Precise coordinate movement with smooth interpolation
- **`puppeteer_mouse_click`** - Advanced clicking with button options (left/right/middle/back/forward)
- **`puppeteer_mouse_down`** - Mouse button press for drag operations
- **`puppeteer_mouse_up`** - Mouse button release for drag operations
- **`puppeteer_mouse_wheel`** - Mouse wheel scrolling with deltaX/deltaY control
- **`puppeteer_mouse_drag`** - Complete drag and drop functionality

#### **🍪 Cookie Management Tools**
- **`puppeteer_get_cookies`** - Retrieve cookies for authentication state analysis
- **`puppeteer_set_cookies`** - Set authentication cookies (session tokens, JWT, OAuth)
- **`puppeteer_delete_cookies`** - Delete cookies for logout and cleanup scenarios

### 🚀 **Production Ready**
- **Docker Containerization** - Multi-stage builds with optimization
- **API Key Authentication** - Bearer token security
- **Server-Sent Events (SSE)** - Real-time MCP communication
- **Rate Limiting** - Configurable request throttling
- **Health Monitoring** - Built-in health check endpoints
- **Comprehensive Logging** - Structured logging with Winston

### 🔒 **Security & Performance**
- **Sandboxed Browser** - Secure Chromium execution
- **CORS Support** - Cross-origin resource sharing
- **Security Headers** - Helmet.js protection
- **Memory Management** - Automatic browser cleanup
- **Error Handling** - Comprehensive error management

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Deployment Options](#-deployment-options)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/sultannaufal/puppeteer-mcp-server.git
cd puppeteer-mcp-server

# Start with Docker Compose
docker-compose up -d

# Test the server
curl -H "Authorization: Bearer test-api-key-12345" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:3000/mcp \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Manual Installation

```bash
# Prerequisites: Node.js 18+, npm 8+
npm install
npm run build
npm start
```

## 📦 Installation

### System Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Docker**: >= 20.10 (for containerized deployment)
- **Memory**: >= 1GB RAM recommended
- **OS**: Linux, macOS, Windows (with WSL2 for Docker)

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/sultannaufal/puppeteer-mcp-server.git
cd puppeteer-mcp-server

# 2. Install dependencies
npm install

# 3. Copy environment configuration
cp .env.example .env

# 4. Edit configuration (optional)
nano .env

# 5. Build the project
npm run build

# 6. Start development server
npm run dev
```

### Production Installation

```bash
# 1. Install production dependencies only
npm ci --only=production

# 2. Build the application
npm run build

# 3. Start the server
npm start
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Authentication - CHANGE THIS TO A SECURE VALUE
API_KEY=your-secure-api-key-here

# Puppeteer Configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_LAUNCH_OPTIONS={"headless":true,"args":["--no-sandbox","--disable-setuid-sandbox"]}

# Browser Settings
BROWSER_TIMEOUT=30000
MAX_PAGES_PER_SESSION=5
PAGE_CLEANUP_INTERVAL=300000
SESSION_TIMEOUT=1800000

# Security Settings
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/health

# Screenshot Settings
SCREENSHOT_DEFAULT_WIDTH=800
SCREENSHOT_DEFAULT_HEIGHT=600
SCREENSHOT_MAX_WIDTH=1920
SCREENSHOT_MAX_HEIGHT=1080
SCREENSHOT_QUALITY=80

# Performance Settings
MAX_CONCURRENT_PAGES=10
BROWSER_RESTART_THRESHOLD=100
MEMORY_LIMIT_MB=1024
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_KEY` | Authentication key for API access | `test-api-key-12345` | ✅ |
| `PORT` | Server port | `3000` | ❌ |
| `HOST` | Server host | `0.0.0.0` | ❌ |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` | ❌ |
| `BROWSER_TIMEOUT` | Browser operation timeout (ms) | `30000` | ❌ |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | ❌ |

## 📚 API Documentation

### Authentication

All API endpoints (except health checks) require Bearer token authentication:

```bash
Authorization: Bearer your-api-key-here
```

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345,
  "browser": "ready"
}
```

#### MCP Protocol Endpoint
```http
POST /mcp
Content-Type: application/json
Authorization: Bearer your-api-key
```

**List Available Tools:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Execute Tool:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

#### Server-Sent Events (SSE)
```http
GET /sse
Authorization: Bearer your-api-key
```

### Tool Examples

#### Navigate to a Website
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

#### Take a Screenshot
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_screenshot",
    "arguments": {
      "name": "homepage",
      "width": 1200,
      "height": 800,
      "encoded": true
    }
  }
}
```

#### Click an Element
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_click",
    "arguments": {
      "selector": "#submit-button"
    }
  }
}
```

### 🖱️ Advanced Mouse Tool Examples

#### Move Mouse to Coordinates
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_mouse_move",
    "arguments": {
      "x": 300,
      "y": 200,
      "steps": 10
    }
  }
}
```

#### Click at Precise Coordinates
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_mouse_click",
    "arguments": {
      "x": 400,
      "y": 300,
      "button": "right",
      "clickCount": 2
    }
  }
}
```

#### Drag and Drop Operation
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_mouse_drag",
    "arguments": {
      "startX": 100,
      "startY": 100,
      "endX": 300,
      "endY": 200,
      "steps": 15,
      "delay": 50
    }
  }
}
```

#### Mouse Wheel Scrolling
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_mouse_wheel",
    "arguments": {
      "x": 400,
      "y": 300,
      "deltaY": -120
    }
  }
}
```

#### Mouse Button Press and Release
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_mouse_down",
    "arguments": {
      "x": 200,
      "y": 150,
      "button": "left"
    }
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_mouse_up",
    "arguments": {
      "x": 250,
      "y": 200,
      "button": "left"
    }
  }
}
```

### 🍪 Cookie Management Tool Examples

#### Set Authentication Cookies
```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_set_cookies",
    "arguments": {
      "cookies": [
        {
          "name": "session_token",
          "value": "abc123def456...",
          "domain": ".example.com",
          "httpOnly": true,
          "secure": true,
          "sameSite": "Lax"
        },
        {
          "name": "csrf_token",
          "value": "xyz789uvw012...",
          "domain": ".example.com",
          "path": "/api",
          "secure": true,
          "sameSite": "Strict"
        }
      ]
    }
  }
}
```

#### Get Authentication State
```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_get_cookies",
    "arguments": {
      "names": ["session_token", "csrf_token"],
      "domain": ".example.com"
    }
  }
}
```

#### Logout and Cookie Cleanup
```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "puppeteer_delete_cookies",
    "arguments": {
      "cookies": [
        {
          "name": "*",
          "domain": ".example.com"
        }
      ]
    }
  }
}
```

## 🐳 Deployment Options

### Coolify Deployment (Easiest)

**One-click deployment with automatic HTTPS and monitoring**

```bash
# 1. Use the Coolify-optimized compose file
# Repository: https://github.com/sultannaufal/puppeteer-mcp-server.git
# Docker Compose File: docker-compose.coolify.yml

# 2. Coolify auto-generates:
# - Secure API key (SERVICE_PASSWORD_PUPPETEER_MCP_SERVER)
# - Domain and SSL certificate
# - Health monitoring and auto-restart

# 3. Test your deployment
curl https://your-app.coolify.domain.com/health
```

**Benefits:**
- ✅ **Zero Configuration** - Works out of the box
- ✅ **Automatic HTTPS** - SSL certificates managed automatically
- ✅ **Built-in Monitoring** - Health checks and resource monitoring
- ✅ **Easy Updates** - Git-based deployments with automatic rebuilds
- ✅ **Cost Effective** - Self-hosted alternative to cloud platforms

[📖 **Full Coolify Guide**](DEPLOYMENT.md#coolify-deployment)

### Docker Deployment (Recommended)

#### Using Docker Compose
```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

#### Using Docker directly
```bash
# Build the image
docker build -t puppeteer-mcp-server .

# Run the container
docker run -d \
  --name puppeteer-mcp-server \
  -p 3000:3000 \
  --env-file .env \
  puppeteer-mcp-server
```

### Cloud Deployment

#### AWS ECS
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker build -t puppeteer-mcp-server .
docker tag puppeteer-mcp-server:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/puppeteer-mcp-server:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/puppeteer-mcp-server:latest
```

#### Google Cloud Run
```bash
# Deploy to Cloud Run
gcloud run deploy puppeteer-mcp-server \
  --image gcr.io/your-project/puppeteer-mcp-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: puppeteer-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: puppeteer-mcp-server
  template:
    metadata:
      labels:
        app: puppeteer-mcp-server
    spec:
      containers:
      - name: puppeteer-mcp-server
        image: puppeteer-mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: api-key
```

### Traditional Server Deployment

#### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start dist/server.js --name "puppeteer-mcp-server"

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Using systemd
```ini
# /etc/systemd/system/puppeteer-mcp-server.service
[Unit]
Description=Puppeteer MCP Server
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/puppeteer-mcp-server
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 🛠️ Development

### Project Structure

```
puppeteer-mcp-server/
├── src/
│   ├── tools/              # Puppeteer tool implementations
│   │   ├── base.ts         # Base tool class and registry
│   │   ├── navigate.ts     # Navigation tool
│   │   ├── screenshot.ts   # Screenshot tool
│   │   ├── click.ts        # Element click tool
│   │   ├── fill.ts         # Form filling tool
│   │   ├── select.ts       # Dropdown selection tool
│   │   ├── hover.ts        # Element hover tool
│   │   ├── evaluate.ts     # JavaScript execution tool
│   │   ├── mouse-move.ts   # 🖱️ Precise mouse movement
│   │   ├── mouse-click.ts  # 🖱️ Coordinate-based clicking
│   │   ├── mouse-down.ts   # 🖱️ Mouse button press
│   │   ├── mouse-up.ts     # 🖱️ Mouse button release
│   │   ├── mouse-wheel.ts  # 🖱️ Mouse wheel scrolling
│   │   ├── mouse-drag.ts   # 🖱️ Drag and drop operations
│   │   ├── get-cookies.ts  # 🍪 Cookie retrieval and analysis
│   │   ├── set-cookies.ts  # 🍪 Authentication cookie setting
│   │   ├── delete-cookies.ts # 🍪 Cookie deletion and cleanup
│   │   └── index.ts        # Tool exports
│   ├── services/           # Core services
│   │   ├── browser.ts      # Browser lifecycle management
│   │   └── mcp-server.ts   # MCP server implementation
│   ├── routes/             # HTTP route handlers
│   │   ├── health.ts       # Health check endpoints
│   │   └── mcp.ts          # MCP protocol endpoints
│   ├── middleware/         # Express middleware
│   │   └── auth.ts         # Authentication middleware
│   ├── utils/              # Utility functions
│   │   ├── config.ts       # Configuration management
│   │   ├── logger.ts       # Logging utilities
│   │   ├── errors.ts       # Error handling
│   │   └── validation.ts   # Parameter validation
│   ├── types/              # TypeScript type definitions
│   │   ├── mcp.ts          # MCP protocol types
│   │   ├── puppeteer.ts    # Puppeteer tool types
│   │   └── server.ts       # Server types
│   ├── app.ts              # Express application setup
│   └── server.ts           # Server entry point
├── dist/                   # Compiled JavaScript output
├── logs/                   # Application logs
├── screenshots/            # Screenshot storage
├── tests/                  # Test files
├── Dockerfile              # Docker container definition
├── docker-compose.yml      # Docker Compose configuration
├── package.json            # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── .env                    # Environment variables
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run clean        # Clean build directory

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run format       # Format code with Prettier

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run Docker container
npm run docker:compose  # Start with Docker Compose
```

### Adding New Tools

1. Create a new tool file in `src/tools/`:

```typescript
// src/tools/my-tool.ts
import { BaseTool } from './base';
import { ToolResult } from '@/types/mcp';

export class MyTool extends BaseTool {
  name = 'my_tool';
  description = 'Description of my tool';
  
  inputSchema = {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      }
    },
    required: ['param1']
  };

  async execute(args: any): Promise<ToolResult> {
    // Tool implementation
    return {
      content: [{ type: 'text', text: 'Tool result' }],
      isError: false
    };
  }
}
```

2. Register the tool in `src/tools/index.ts`:

```typescript
import { MyTool } from './my-tool';

// Add to the tools array
export const tools = [
  // ... existing tools
  new MyTool(),
];
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testNamePattern="Tool Tests"

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Debugging

#### Enable Debug Logging
```bash
LOG_LEVEL=debug npm run dev
```

#### Browser Debugging
```bash
# Enable visible browser for debugging
PUPPETEER_LAUNCH_OPTIONS='{"headless":false,"devtools":true}' npm run dev
```

#### Docker Debugging
```bash
# Run container with debug output
docker run -it --rm \
  -e LOG_LEVEL=debug \
  -p 3000:3000 \
  puppeteer-mcp-server
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run the test suite**: `npm test`
6. **Commit your changes**: `git commit -m 'Add amazing feature'`
7. **Push to the branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Development Guidelines

#### Code Style
- Use **TypeScript** for all new code
- Follow **ESLint** and **Prettier** configurations
- Write **comprehensive tests** for new features
- Add **JSDoc comments** for public APIs
- Use **conventional commit messages**

#### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/modifications
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(tools): add new web scraping tool
fix(auth): resolve API key validation issue
docs(readme): update deployment instructions
```

#### Pull Request Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain what changes were made and why
- **Tests**: Include tests for new functionality
- **Documentation**: Update relevant documentation
- **Breaking Changes**: Clearly mark any breaking changes

#### Code Review Process

1. All PRs require at least one review
2. All tests must pass
3. Code coverage should not decrease
4. Documentation must be updated for new features
5. Breaking changes require discussion

### Reporting Issues

When reporting issues, please include:

- **Environment details** (OS, Node.js version, Docker version)
- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Error messages** and logs
- **Screenshots** if applicable

### Feature Requests

For feature requests, please:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** and motivation
3. **Provide examples** of how the feature would be used
4. **Consider implementation** complexity and alternatives

### Security Issues

For security vulnerabilities:

1. **Do not** create public issues
2. **Report** security concerns via GitHub Issues with the "security" label
3. **Include** detailed information about the vulnerability
4. **Allow time** for the issue to be addressed before disclosure

## 🙏 Acknowledgments

- **[Model Context Protocol](https://modelcontextprotocol.io/)** - For the MCP specification
- **[Puppeteer](https://pptr.dev/)** - For browser automation capabilities
- **[Express.js](https://expressjs.com/)** - For the web server framework
- **[TypeScript](https://www.typescriptlang.org/)** - For type safety and developer experience
- **Original MCP Puppeteer Server** - For the initial tool implementations

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/sultannaufal/puppeteer-mcp-server/wiki)
- **Issues**: [GitHub Issues](https://github.com/sultannaufal/puppeteer-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sultannaufal/puppeteer-mcp-server/discussions)

---

**Made with ❤️ by the Puppeteer MCP Server team**

[![Star this repo](https://img.shields.io/github/stars/sultannaufal/puppeteer-mcp-server?style=social)](https://github.com/sultannaufal/puppeteer-mcp-server)
[![Follow on GitHub](https://img.shields.io/github/followers/sultannaufal?style=social)](https://github.com/sultannaufal)