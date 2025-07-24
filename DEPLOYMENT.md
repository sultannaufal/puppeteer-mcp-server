# 🚀 Deployment Guide

This guide covers various deployment options for the Puppeteer MCP Server, from local development to production cloud deployments.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployments](#cloud-deployments)
- [Traditional Server Deployment](#traditional-server-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 1 core | 2+ cores |
| **Memory** | 1GB RAM | 2GB+ RAM |
| **Storage** | 2GB | 5GB+ |
| **Network** | 1Mbps | 10Mbps+ |

### Software Requirements

- **Docker**: >= 20.10 (for containerized deployment)
- **Node.js**: >= 18.0.0 (for manual deployment)
- **npm**: >= 8.0.0 (for manual deployment)
- **Git**: Latest version

### Security Considerations

- **API Key**: Generate a strong, unique API key (32+ characters)
- **Network**: Ensure proper firewall configuration
- **SSL/TLS**: Use HTTPS in production environments
- **Updates**: Keep system and dependencies updated

## 🐳 Docker Deployment

### Quick Start with Docker Compose

**Recommended for most users**

```bash
# 1. Clone the repository
git clone https://github.com/sultannaufal/puppeteer-mcp-server.git
cd puppeteer-mcp-server

# 2. Configure environment
cp .env.example .env
nano .env  # Edit configuration

# 3. Start the server
docker-compose up -d

# 4. Verify deployment
curl http://localhost:3000/health
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  puppeteer-mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_KEY=${API_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - ./logs:/app/logs
      - ./screenshots:/app/screenshots
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - puppeteer-network

networks:
  puppeteer-network:
    driver: bridge
```

### Standalone Docker Deployment

```bash
# 1. Build the image
docker build -t puppeteer-mcp-server .

# 2. Run the container
docker run -d \
  --name puppeteer-mcp-server \
  -p 3000:3000 \
  -e API_KEY=your-secure-api-key \
  -e NODE_ENV=production \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/screenshots:/app/screenshots \
  --restart unless-stopped \
  puppeteer-mcp-server

# 3. Check logs
docker logs puppeteer-mcp-server

# 4. Test the deployment
curl -H "Authorization: Bearer your-secure-api-key" \
     http://localhost:3000/mcp \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Docker Environment Variables

```bash
# Required
API_KEY=your-secure-api-key-here

# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Browser Settings
BROWSER_TIMEOUT=30000
MAX_PAGES_PER_SESSION=5

# Security
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Coolify Deployment

**Coolify** is a self-hosted alternative to Heroku/Netlify/Vercel that makes deployment simple and secure.

#### Prerequisites

- Coolify instance running (v4.0+)
- Git repository access
- Domain name (optional but recommended)

#### Quick Deployment

1. **Create New Project in Coolify**
   - Go to your Coolify dashboard
   - Click "New Project" → "Public Repository"
   - Enter repository URL: `https://github.com/sultannaufal/puppeteer-mcp-server.git`

2. **Configure Build Settings**
   - **Build Pack**: Docker
   - **Docker Compose File**: `docker-compose.coolify.yml`
   - **Port**: 3000 (auto-detected)

3. **Environment Variables**
   
   Coolify will automatically generate secure values for:
   - `SERVICE_PASSWORD_PUPPETEER_MCP_SERVER` (used as API_KEY)
   - `SERVICE_FQDN_PUPPETEER_MCP_SERVER` (your domain)
   - `SERVICE_URL_PUPPETEER_MCP_SERVER` (full URL)

   Optional variables you can set:
   ```bash
   # Performance tuning
   MEMORY_LIMIT=1024
   CPU_LIMIT=2
   MAX_PAGES=15
   
   # Logging
   LOG_LEVEL=info
   
   # Browser settings
   BROWSER_TIMEOUT=45000
   
   # Rate limiting
   RATE_LIMIT_MAX=200
   RATE_LIMIT_WINDOW=900000
   ```

4. **Deploy**
   - Click "Deploy"
   - Coolify will build and deploy automatically
   - Access your server at the generated URL

#### Coolify-Specific Features

**Automatic SSL/TLS**
- Coolify automatically provisions SSL certificates
- HTTPS is enabled by default

**Domain Management**
- Custom domains supported
- Automatic DNS configuration
- Wildcard domains available

**Monitoring**
- Built-in health checks using `/health` endpoint
- Resource usage monitoring
- Automatic restarts on failure

**Scaling**
- Easy horizontal scaling through Coolify UI
- Resource limit adjustments
- Load balancing included

#### Storage Configuration

The Coolify compose file includes persistent storage for:

```yaml
volumes:
  # Application logs
  - type: bind
    source: ./logs
    target: /app/logs
    is_directory: true
  
  # Screenshots storage
  - type: bind
    source: ./screenshots
    target: /app/screenshots
    is_directory: true
```

#### Testing Your Deployment

```bash
# Get your Coolify-generated URL and API key from the dashboard
export COOLIFY_URL="https://your-app.coolify.domain.com"
export API_KEY="your-generated-api-key"

# Test health endpoint
curl $COOLIFY_URL/health

# Test MCP endpoint
curl -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -X POST $COOLIFY_URL/mcp \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test SSE endpoint
curl -H "Authorization: Bearer $API_KEY" \
     -H "Accept: text/event-stream" \
     $COOLIFY_URL/sse
```

#### Coolify Advantages

- **Zero Configuration**: Works out of the box
- **Automatic HTTPS**: SSL certificates managed automatically
- **Built-in Monitoring**: Health checks and resource monitoring
- **Easy Updates**: Git-based deployments with automatic rebuilds
- **Cost Effective**: Self-hosted alternative to cloud platforms
- **Security**: Automatic API key generation and secure defaults

#### Troubleshooting Coolify Deployment

**Build Failures**
```bash
# Check build logs in Coolify dashboard
# Common issues:
# - Dockerfile not found: Ensure docker-compose.coolify.yml is in root
# - Memory limits: Increase build resources in Coolify settings
```

**Runtime Issues**
```bash
# Check application logs in Coolify dashboard
# Common issues:
# - Browser launch failures: Coolify handles this automatically
# - Memory issues: Adjust MEMORY_LIMIT environment variable
```

**Network Issues**
```bash
# Coolify handles networking automatically
# If issues persist:
# - Check domain configuration in Coolify
# - Verify SSL certificate status
# - Test internal connectivity
```

## ☁️ Cloud Deployments

### AWS ECS (Elastic Container Service)

#### 1. Build and Push to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name puppeteer-mcp-server

# Get login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build and tag image
docker build -t puppeteer-mcp-server .
docker tag puppeteer-mcp-server:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/puppeteer-mcp-server:latest

# Push image
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/puppeteer-mcp-server:latest
```

#### 2. ECS Task Definition

```json
{
  "family": "puppeteer-mcp-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "puppeteer-mcp-server",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/puppeteer-mcp-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:puppeteer-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/puppeteer-mcp-server",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3000/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### 3. ECS Service with Load Balancer

```bash
# Create ECS service
aws ecs create-service \
  --cluster puppeteer-cluster \
  --service-name puppeteer-mcp-server \
  --task-definition puppeteer-mcp-server:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345,subnet-67890],securityGroups=[sg-abcdef],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/puppeteer-tg/1234567890123456,containerName=puppeteer-mcp-server,containerPort=3000"
```

### Google Cloud Run

```bash
# 1. Build and push to Container Registry
gcloud builds submit --tag gcr.io/your-project-id/puppeteer-mcp-server

# 2. Deploy to Cloud Run
gcloud run deploy puppeteer-mcp-server \
  --image gcr.io/your-project-id/puppeteer-mcp-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars API_KEY=your-secure-api-key \
  --memory 2Gi \
  --cpu 1 \
  --concurrency 10 \
  --timeout 300 \
  --max-instances 10

# 3. Get service URL
gcloud run services describe puppeteer-mcp-server \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)'
```

### Azure Container Instances

```bash
# 1. Create resource group
az group create --name puppeteer-rg --location eastus

# 2. Create container registry
az acr create --resource-group puppeteer-rg \
  --name puppeteerregistry --sku Basic

# 3. Build and push image
az acr build --registry puppeteerregistry \
  --image puppeteer-mcp-server:latest .

# 4. Deploy container instance
az container create \
  --resource-group puppeteer-rg \
  --name puppeteer-mcp-server \
  --image puppeteerregistry.azurecr.io/puppeteer-mcp-server:latest \
  --cpu 1 \
  --memory 2 \
  --registry-login-server puppeteerregistry.azurecr.io \
  --registry-username puppeteerregistry \
  --registry-password $(az acr credential show --name puppeteerregistry --query "passwords[0].value" -o tsv) \
  --dns-name-label puppeteer-mcp-server \
  --ports 3000 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables API_KEY=your-secure-api-key
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: puppeteer-mcp-server
services:
- name: web
  source_dir: /
  github:
    repo: yourusername/puppeteer-mcp-server
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3000
  health_check:
    http_path: /health
  envs:
  - key: NODE_ENV
    value: production
  - key: API_KEY
    value: your-secure-api-key
    type: SECRET
  - key: PORT
    value: "3000"
```

## 🖥️ Traditional Server Deployment

### Ubuntu/Debian Server

#### 1. System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies for Puppeteer
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  fonts-ipafont-gothic \
  fonts-wqy-zenhei \
  fonts-thai-tlwg \
  fonts-kacst \
  fonts-freefont-ttf \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  lsb-release

# Create application user
sudo useradd -m -s /bin/bash puppeteer
sudo usermod -aG audio,video puppeteer
```

#### 2. Application Deployment

```bash
# Switch to application user
sudo su - puppeteer

# Clone repository
git clone https://github.com/yourusername/puppeteer-mcp-server.git
cd puppeteer-mcp-server

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Configure environment
cp .env.example .env
nano .env  # Edit configuration

# Test application
npm start
```

#### 3. Process Management with PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'puppeteer-mcp-server',
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by PM2
```

#### 4. Systemd Service (Alternative to PM2)

```bash
# Create systemd service file
sudo tee /etc/systemd/system/puppeteer-mcp-server.service > /dev/null << EOF
[Unit]
Description=Puppeteer MCP Server
After=network.target

[Service]
Type=simple
User=puppeteer
WorkingDirectory=/home/puppeteer/puppeteer-mcp-server
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/home/puppeteer/puppeteer-mcp-server/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/puppeteer/puppeteer-mcp-server/logs
ReadWritePaths=/home/puppeteer/puppeteer-mcp-server/screenshots

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable puppeteer-mcp-server
sudo systemctl start puppeteer-mcp-server

# Check service status
sudo systemctl status puppeteer-mcp-server
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/puppeteer-mcp-server
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy configuration
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # SSE specific configuration
    location /sse {
        proxy_pass http://127.0.0.1:3000/sse;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE specific settings
        proxy_cache off;
        proxy_buffering off;
        proxy_read_timeout 24h;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
```

## ☸️ Kubernetes Deployment

### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: puppeteer-mcp

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: puppeteer-config
  namespace: puppeteer-mcp
data:
  NODE_ENV: "production"
  PORT: "3000"
  HOST: "0.0.0.0"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  BROWSER_TIMEOUT: "30000"
  MAX_PAGES_PER_SESSION: "5"
  CORS_ORIGIN: "*"
  RATE_LIMIT_WINDOW: "900000"
  RATE_LIMIT_MAX: "100"
```

### Secret for API Key

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: puppeteer-secrets
  namespace: puppeteer-mcp
type: Opaque
data:
  API_KEY: eW91ci1zZWN1cmUtYXBpLWtleS1oZXJl  # base64 encoded
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: puppeteer-mcp-server
  namespace: puppeteer-mcp
  labels:
    app: puppeteer-mcp-server
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
        envFrom:
        - configMapRef:
            name: puppeteer-config
        - secretRef:
            name: puppeteer-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: logs
          mountPath: /app/logs
        - name: screenshots
          mountPath: /app/screenshots
      volumes:
      - name: logs
        emptyDir: {}
      - name: screenshots
        emptyDir: {}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
```

### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: puppeteer-mcp-service
  namespace: puppeteer-mcp
spec:
  selector:
    app: puppeteer-mcp-server
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: puppeteer-mcp-ingress
  namespace: puppeteer-mcp
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: puppeteer-mcp-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: puppeteer-mcp-service
            port:
              number: 80
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: puppeteer-mcp-hpa
  namespace: puppeteer-mcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: puppeteer-mcp-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n puppeteer-mcp

# Check service
kubectl get svc -n puppeteer-mcp

# Check ingress
kubectl get ingress -n puppeteer-mcp

# View logs
kubectl logs -f deployment/puppeteer-mcp-server -n puppeteer-mcp
```

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# Basic health check
curl http://your-domain.com/health

# Detailed health check with authentication
curl -H "Authorization: Bearer your-api-key" \
     http://your-domain.com/health/detailed
```

### Log Management

```bash
# Docker logs
docker logs puppeteer-mcp-server --tail 100 -f

# PM2 logs
pm2 logs puppeteer-mcp-server

# Systemd logs
sudo journalctl -u puppeteer-mcp-server -f

# Kubernetes logs
kubectl logs -f deployment/puppeteer-mcp-server -n puppeteer-mcp
```

### Performance Monitoring

```bash
# Monitor resource usage (Docker)
docker stats puppeteer-mcp-server

# Monitor with PM2
pm2 monit

# System monitoring
htop
iostat -x 1
```

### Backup and Recovery

```bash
# Backup configuration
tar -czf backup-$(date +%Y%m%d).tar.gz .env logs/ screenshots/

# Database backup (if applicable)
# No database required for this application

# Container backup
docker commit puppeteer-mcp-server puppeteer-mcp-server:backup-$(date +%Y%m%d)
```

### Updates and Maintenance

```bash
# Update Docker deployment
docker-compose pull
docker-compose up -d

# Update manual deployment
git pull origin main
npm ci --only=production
npm run build
pm2 restart puppeteer-mcp-server

# Update Kubernetes deployment
kubectl set image deployment/puppeteer-mcp-server \
  puppeteer-mcp-server=puppeteer-mcp-server:latest \
  -n puppeteer-mcp
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Browser Launch Failures

**Symptoms:**
- "Failed to launch browser" errors
- Browser timeout issues

**Solutions:**
```bash
# Check Chromium installation
which chromium-browser
chromium-browser --version

# Install missing dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Check browser permissions
ls -la /usr/bin/chromium*

# Test browser launch manually
chromium-browser --headless --no-sandbox --dump-dom https://example.com
```

#### 2. Memory Issues

**Symptoms:**
- Container OOM kills
- High memory usage
- Browser crashes

**Solutions:**
```bash
# Increase container memory limits
docker run --memory=2g puppeteer-mcp-server

# Monitor memory usage
docker stats puppeteer-mcp-server

# Configure browser memory limits in .env
MAX_PAGES_PER_SESSION=3
BROWSER_RESTART_THRESHOLD=50
MEMORY_LIMIT_MB=1024
```

#### 3. Network Connectivity

**Symptoms:**
- Connection timeouts
- SSL certificate errors
- DNS resolution failures

**Solutions:**
```bash
# Test network connectivity
curl -I https://example.com

# Check DNS resolution
nslookup example.com

# Test from container
docker exec puppeteer-mcp-server curl -I https://example.com

# Check firewall rules
sudo ufw status
sudo iptables -L
```

#### 4. Authentication Issues

**Symptoms:**
- "Invalid API key" errors
- 401 Unauthorized responses

**Solutions:**
```bash
# Verify API key configuration
echo $API_KEY

# Test authentication
curl -H "Authorization: Bearer your-api-key" \
     http://localhost:3000/health

# Check environment variables
docker exec puppeteer-mcp-server env | grep API_KEY
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Docker debug mode
docker run -e LOG_LEVEL=debug puppeteer-mcp-server

# Kubernetes debug
kubectl set env deployment/puppeteer-mcp-server LOG_LEVEL=debug -n puppeteer-mcp
```

### Performance Tuning

```bash
# Optimize browser settings
PUPPETEER_LAUNCH_OPTIONS='{"headless":"new","args":["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu","--disable-web-security","--disable-features=VizDisplayCompositor"]}'

# Adjust timeouts
BROWSER_TIMEOUT=60000
SESSION_TIMEOUT=3600000

# Configure resource limits
MAX_CONCURRENT_PAGES=5
BROWSER_RESTART_THRESHOLD=100
```

## 📞 Support

For deployment issues:

- **GitHub Issues**: [Report deployment problems](https://github.com/yourusername/puppeteer-mcp-server/issues)
- **Documentation**: [Check the wiki](https://github.com/yourusername/puppeteer-mcp-server/wiki)
- **Community**: [Join discussions](https://github.com/yourusername/puppeteer-mcp-server/discussions)
- **Email**: support@yourproject.com

---

**Happy Deploying! 🚀**