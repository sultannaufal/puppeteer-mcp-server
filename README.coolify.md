# 🚀 Coolify Deployment Guide

Deploy your Puppeteer MCP Server to Coolify in minutes with automatic HTTPS, monitoring, and zero configuration.

## 🎯 Quick Deploy

1. **Fork or Clone Repository**
   ```bash
   git clone https://github.com/sultannaufal/puppeteer-mcp-server.git
   ```

2. **Create Project in Coolify**
   - Open your Coolify dashboard
   - Click **"New Project"** → **"Public Repository"**
   - Repository URL: `https://github.com/sultannaufal/puppeteer-mcp-server.git`
   - Docker Compose File: `docker-compose.coolify.yml`

3. **Deploy**
   - Click **"Deploy"**
   - Coolify handles everything automatically!

## ✨ What Coolify Provides

- **🌐 Custom Domain**: Your app gets a domain like `https://your-app.coolify.domain.com`
- **🔒 SSL Certificate**: HTTPS enabled automatically
- **📊 Health Monitoring**: Built-in monitoring with `/health` endpoint
- **🔄 Auto Restart**: Automatic recovery from failures
- **📝 Persistent Storage**: Logs and screenshots saved automatically
- **⚙️ Environment Variables**: Easy configuration through Coolify UI

## 🧪 Test Your Deployment

After deployment, test your server:

```bash
# Replace with your actual Coolify URL and the API key you set
export COOLIFY_URL="https://your-app.coolify.domain.com"
export API_KEY="your-api-key-from-coolify-ui"

# Health check
curl $COOLIFY_URL/health

# List available tools
curl -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -X POST $COOLIFY_URL/mcp \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Take a screenshot
curl -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -X POST $COOLIFY_URL/mcp \
     -d '{
       "jsonrpc":"2.0",
       "id":2,
       "method":"tools/call",
       "params":{
         "name":"puppeteer_navigate",
         "arguments":{"url":"https://example.com"}
       }
     }'
```

## ⚙️ Environment Variables

Set these in Coolify's Environment Variables section:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | ✅ | - | Your secure API key for authentication |
| `LOG_LEVEL` | ❌ | `info` | Logging level (debug, info, warn, error) |
| `MAX_PAGES` | ❌ | `10` | Max concurrent browser pages |
| `BROWSER_TIMEOUT` | ❌ | `30000` | Browser operation timeout (ms) |
| `RATE_LIMIT_MAX` | ❌ | `100` | Max requests per time window |

## 🔧 Troubleshooting

**Build Failed?**
- Check that `docker-compose.coolify.yml` exists in your repository root
- Verify your repository is accessible
- Ensure Docker build context is correct

**App Not Starting?**
- Check application logs in Coolify dashboard
- Verify environment variables are set correctly
- Check if browser dependencies are properly installed

**Can't Access App?**
- Ensure domain is properly configured in Coolify
- Check SSL certificate status in Coolify dashboard
- Verify Traefik labels are correctly applied
- Check if the application is listening on the correct port (3000)

**Labels and Routing Issues?**
- Coolify automatically adds required labels (`coolify.managed=true`, `coolify.applicationId`, `coolify.type=application`)
- Traefik labels are handled automatically for routing and HTTPS
- Custom domain configuration is managed through Coolify UI

## 📚 Full Documentation

For complete deployment options and advanced configuration, see:
- [Main README](README.md)
- [Full Deployment Guide](DEPLOYMENT.md)

## 🎉 That's It!

Your Puppeteer MCP Server is now running on Coolify with:
- ✅ Production-ready configuration
- ✅ Automatic HTTPS and monitoring  
- ✅ Secure API key authentication
- ✅ Persistent storage for logs and screenshots
- ✅ Health checks and auto-recovery

Happy automating! 🤖