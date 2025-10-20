# 🚂 Railway Deployment Checklist

## Pre-Deployment Setup

### 1. Generate Secrets
```bash
# Generate WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository: `rennai455/pos-imagration-service-`
4. Railway will auto-detect `railway.toml`

### 3. Add Postgres Database
1. In your Railway project, click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway creates a Postgres instance and sets `DATABASE_URL`

### 4. Configure Environment Variables

Go to your API service → **Variables** tab and add:

```bash
# Required Variables
DATABASE_URL=postgresql://postgres:<password>@postgres.railway.internal:5432/railway?sslmode=disable
WEBHOOK_SECRET=<paste-generated-secret-from-step-1>
JWT_SECRET=<paste-generated-secret-from-step-1>
CORS_ALLOWED_ORIGINS=https://pos-imagration-service-production.up.railway.app

# Timeouts (already in railway.toml, but can override here)
REQUEST_TIMEOUT_MS=30000
CONNECTION_TIMEOUT_MS=60000
SHUTDOWN_GRACE_MS=15000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Monitoring
METRICS_ENABLED=true
PROMETHEUS_ENABLED=true
```

**⚠️ Important Notes:**
- Railway auto-injects `PORT` - don't set it manually
- Use `postgres.railway.internal` for internal database connection
- Use `sslmode=disable` for Railway's internal network
- `NODE_ENV=production` is set in `railway.toml`

### 5. Set Public Domain (if needed)
1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy the URL (e.g., `https://pos-imagration-service-production.up.railway.app`)
4. Update `CORS_ALLOWED_ORIGINS` with this URL

## Deployment

### 6. Deploy
Railway will automatically deploy when you push to `main`:

```bash
git add .
git commit -m "chore: railway deployment configuration"
git push origin main
```

Or manually trigger from Railway dashboard: **Deployments** → **Deploy**

### 7. Monitor Deployment
1. Watch build logs in Railway dashboard
2. Look for:
   - ✅ `pnpm install` completes
   - ✅ `prisma migrate deploy` runs successfully
   - ✅ Server binds to `0.0.0.0:${PORT}`
   - ✅ Health check `/health/ready` returns 200

## Post-Deployment Validation

### 8. Run Smoke Tests
```bash
# Set your Railway URL
$env:API_URL="https://pos-imagration-service-production.up.railway.app"

# Run smoke tests
pnpm smoke
```

**Expected Results:**
- ✅ `/health` returns 200
- ✅ `/health/ready` returns 200 (DB connected)
- ✅ `/metrics` shows `build_info` gauge
- ✅ Idempotency: 201 → 204 on duplicate POST

### 9. Monitor Metrics
```bash
# Real-time metrics dashboard
$env:API_URL="https://pos-imagration-service-production.up.railway.app"
pnpm metrics:watch
```

**Watch for:**
- ✅ `build_info{version}` = 1
- ✅ `ingest_dedup_total` increments on duplicates
- ✅ Error rate < 2%
- ✅ P95 latency < 1000ms

### 10. Test HMAC Webhook
```bash
# Generate test signature
$secret = "your-webhook-secret"
$payload = '{"test": "data"}'
$signature = (New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList ([Text.Encoding]::UTF8.GetBytes($secret))).ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString("x2") } | Join-String

# Test ingest endpoint
curl -X POST "https://your-railway-url/pos/square/ingest" `
  -H "Content-Type: application/json" `
  -H "X-Tenant-Id: test-tenant" `
  -H "X-Webhook-Signature: $signature" `
  -d $payload
```

**Expected:** 201 Created (first request), 204 No Content (duplicate)

## Production Gates

### 11. Verify CI/CD (Optional)
If you have GitHub Actions setup:

```bash
# Set Railway URL in GitHub repo variables
STAGING_URL=https://pos-imagration-service-production.up.railway.app

# CI will automatically:
# - Run tests
# - Validate metrics
# - Run load tests
# - Deploy on success
```

### 12. Load Test (Optional)
```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon -c 10 -d 30 https://your-railway-url/health
```

**Expected:**
- ✅ Avg latency < 100ms
- ✅ P95 < 500ms
- ✅ 0 errors

## Troubleshooting

### Build Fails
- Check Railway logs: **Deployments** → Click build → View logs
- Verify `pnpm-workspace.yaml` is correct
- Ensure `railway.toml` paths are correct

### Migration Fails
```bash
# View logs
# Look for "prisma migrate deploy" errors

# Common issues:
# - DATABASE_URL not set
# - Database not accessible
# - Migration conflicts
```

### Health Check Fails
```bash
# Check logs for:
# - "Database connection failed"
# - "Health check timeout"
# - "Port already in use"

# Verify:
# - DATABASE_URL is correct
# - Postgres service is running
# - Server binds to 0.0.0.0
```

### CORS Errors
```bash
# Verify CORS_ALLOWED_ORIGINS includes your frontend URL
# Format: "https://domain1.com,https://domain2.com"
# No spaces, comma-separated
```

## Single Replica Limitations

⚠️ **Current Setup: Single Replica Only**

This deployment uses in-memory rate limiter and circuit breaker.

**Limitations:**
- Rate limits are per-instance (not coordinated)
- Circuit breaker state is per-instance
- Can't scale beyond 1 replica

**To Scale Beyond 1 Replica:**
- Implement Redis for distributed state
- See `docs/REDIS_MIGRATION.md` (8-hour migration)
- Estimated cost: +$10/month for Redis

## Monitoring & Maintenance

### Daily Checks
- [ ] Error rate < 2%
- [ ] P95 latency < 1s
- [ ] No failed health checks
- [ ] Dedup counter incrementing

### Weekly Checks
- [ ] Review Railway logs for warnings
- [ ] Check database size/performance
- [ ] Verify backup strategy

### Alerts (Set Up Later)
- Error rate > 5% for 5 minutes
- P95 latency > 2s for 5 minutes
- Health checks failing

## Cost Estimate

**Railway Costs (Single Replica):**
- Postgres: ~$5/month
- API Service: ~$5-10/month (depending on usage)
- **Total: ~$10-15/month**

## Next Steps

✅ Once stable for 24+ hours:
1. Add monitoring/alerting (e.g., Better Stack, Sentry)
2. Set up backups (Railway auto-backups included)
3. Plan Redis migration if scaling needed
4. Add admin UI deployment

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Docs: See `docs/` directory
