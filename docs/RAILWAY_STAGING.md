# Railway Staging Deployment Guide

## Prerequisites
- Railway account: https://railway.app
- Railway CLI installed: `npm install -g @railway/cli`
- GitHub Container Registry access configured

## Setup Steps

### 1. Create Railway Project
```bash
# Login to Railway
railway login

# Create new project
railway init

# Link to staging environment
railway environment staging
```

### 2. Configure Environment Variables
```bash
# Set required variables
railway variables set DATABASE_URL="postgresql://..."
railway variables set SUPABASE_URL="https://xxx.supabase.co"
railway variables set SUPABASE_ANON_KEY="eyJ..."
railway variables set PORT="4000"
railway variables set NODE_ENV="staging"
railway variables set RATE_LIMIT_MAX="100"

# Optional variables
railway variables set REQUEST_TIMEOUT_MS="30000"
railway variables set SHUTDOWN_GRACE_MS="15000"
railway variables set CORS_ORIGIN="https://admin-staging.example.com"
```

### 3. Configure Single Replica
```bash
# In railway.json or Railway dashboard:
# Set "replicas" to 1 (critical for in-memory rate limiter)
```

### 4. Deploy from GHCR
```bash
# Set image source
railway service add --image ghcr.io/rennai455/pos-imagration-service:main

# Or via Railway dashboard:
# Settings → Deploy → Docker Image → ghcr.io/rennai455/pos-imagration-service:main
```

### 5. Configure Health Checks
```yaml
# In Railway dashboard → Settings → Health Check
healthcheck:
  path: /health/ready
  interval: 30
  timeout: 10
  retries: 3
```

### 6. Get Deployment URL
```bash
railway domain

# Example output: pos-imagration-staging.up.railway.app
```

### 7. Set GitHub Secret
```bash
# Add to GitHub repository secrets:
# STAGING_URL=https://pos-imagration-staging.up.railway.app
```

## Quick Deploy Script
```bash
#!/bin/bash
# deploy-staging.sh

# Get latest image digest
DIGEST=$(docker inspect ghcr.io/rennai455/pos-imagration-service:main --format='{{.Id}}')

# Deploy to Railway
railway up --environment staging --image ghcr.io/rennai455/pos-imagration-service@${DIGEST}

# Wait for health check
echo "Waiting for deployment..."
for i in {1..40}; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://pos-imagration-staging.up.railway.app/startupz)
  echo "Attempt $i: Status $STATUS"
  if [ "$STATUS" = "200" ]; then
    echo "✅ Staging deployment healthy"
    exit 0
  fi
  sleep 5
done

echo "❌ Staging deployment failed health check"
exit 1
```

## Monitoring
```bash
# View logs
railway logs --environment staging

# View metrics
curl https://pos-imagration-staging.up.railway.app/metrics

# Check health
curl https://pos-imagration-staging.up.railway.app/startupz
curl https://pos-imagration-staging.up.railway.app/health/ready
```

## Troubleshooting

### Issue: Health checks failing
```bash
# Check logs for startup errors
railway logs --tail 100

# Verify database connectivity
railway run env | grep DATABASE_URL

# Test connection locally
PGPASSWORD=xxx psql -h host -U user -d db
```

### Issue: Rate limiting not working across requests
**Expected**: This is the documented limitation. Single replica only.
**Fix**: Add Redis backend (see REDIS_MIGRATION.md)

### Issue: Circuit breaker not coordinating
**Expected**: Per-instance state. Single replica only.
**Fix**: Add Redis backend for distributed state.

## Cost Estimate
- **Railway Starter**: $5/month (includes 500 hours)
- **PostgreSQL**: $5-10/month (Supabase free tier or Railway add-on)
- **Total**: ~$10-15/month for staging

## Alternative: Fly.io
See `FLY_STAGING_SETUP.md` for Fly.io deployment instructions.

