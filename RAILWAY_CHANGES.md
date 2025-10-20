# ✅ Railway Deployment Configuration - Summary

## What Was Changed

All code and configuration changes have been applied to prepare your API for Railway deployment with Postgres.

### 📦 Files Modified/Created

#### **New Files**
1. `railway.toml` - Railway deployment configuration
2. `.env.railway` - Environment variables template
3. `RAILWAY_DEPLOYMENT.md` - Complete deployment guide

#### **Modified Files**
1. `packages/api/src/server.ts`
   - Changed host to `0.0.0.0` (Railway requirement)
   - Updated CORS to use `CORS_ALLOWED_ORIGINS` env var
   - Added `/health/ready` endpoint for Railway health checks

2. `packages/api/src/utils/env.ts`
   - Added validation for `WEBHOOK_SECRET` (min 32 chars)
   - Added validation for `CORS_ALLOWED_ORIGINS`
   - Added validation for timeouts: `REQUEST_TIMEOUT_MS`, `CONNECTION_TIMEOUT_MS`, `SHUTDOWN_GRACE_MS`
   - Made Supabase vars optional (not required for Railway)
   - Changed `DATABASE_URL` validation to accept Railway format

3. `packages/api/src/routes/ingest.ts`
   - Added HMAC signature verification using `WEBHOOK_SECRET`
   - Returns 401 if signature missing
   - Returns 403 if signature invalid
   - Validates signature BEFORE database operations
   - Increments `ingest_dedup_total` metric on duplicates

4. `packages/api/package.json`
   - Added `"prestart": "prisma migrate deploy"` script
   - Migrations run automatically before server starts

5. `package.json` (root)
   - Added `"smoke": "node scripts/smoke-test.mjs"` script
   - Added `"metrics:watch": "node scripts/monitor-metrics.mjs"` script

## 🔧 Configuration Details

### railway.toml
```toml
[build]
builder = "NIXPACKS"

[env]
NODE_ENV = "production"
REQUEST_TIMEOUT_MS = "30000"
CONNECTION_TIMEOUT_MS = "60000"
SHUTDOWN_GRACE_MS = "15000"
METRICS_ENABLED = "true"

[service.api]
root = "."
start = "pnpm --filter @codex/api start"
preStart = "pnpm --filter @codex/api prisma migrate deploy"

[service.api.healthcheck]
path = "/health/ready"
interval = 10000
timeout  = 10000
```

### Required Environment Variables
Set these in Railway UI (Service → Variables):

```bash
# Database (Railway injects this, but verify format)
DATABASE_URL=postgresql://postgres:<password>@postgres.railway.internal:5432/railway?sslmode=disable

# Security (generate strong secrets)
WEBHOOK_SECRET=<32-char-random-hex>
JWT_SECRET=<32-char-random-hex>

# CORS (update with your actual domain after deployment)
CORS_ALLOWED_ORIGINS=https://pos-imagration-service-production.up.railway.app

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

**Generate secrets with:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## ✅ Verification Checklist

### Build & Compilation
- [x] API builds successfully (`pnpm build`)
- [x] No TypeScript compilation errors
- [x] All required dependencies present

### Configuration
- [x] `railway.toml` created at repo root
- [x] Server binds to `0.0.0.0`
- [x] Prisma migrations run on boot
- [x] Health endpoints configured:
  - `/health` - Basic liveness
  - `/livez` - Kubernetes-style liveness
  - `/startupz` - Startup probe
  - `/health/ready` - Railway health check

### Security
- [x] HMAC signature validation on ingest endpoints
- [x] CORS restricted to allowed origins
- [x] Pino redaction for sensitive headers
- [x] Environment variable validation with Zod

### Observability
- [x] Metrics singleton pattern (no double-registration)
- [x] Safe route labels (no raw URLs)
- [x] Histograms named `*_seconds`
- [x] `ingest_dedup_total` counter for idempotency
- [x] Build info gauge with version

### Idempotency
- [x] Prisma model exists: `Idempotency`
- [x] Database enforcement via unique constraint
- [x] Returns 204 on duplicate requests
- [x] Metrics increment on deduplication

## 🚀 Next Steps

### 1. Deploy to Railway
```bash
# Push to GitHub (triggers Railway auto-deploy)
git push origin main

# Or manually deploy from Railway dashboard
```

### 2. Configure Environment Variables
Follow `.env.railway` template and set all required variables in Railway UI.

### 3. Run Smoke Tests
```powershell
$env:API_URL="https://your-railway-url.up.railway.app"
pnpm smoke
```

### 4. Monitor Metrics
```powershell
$env:API_URL="https://your-railway-url.up.railway.app"
pnpm metrics:watch
```

### 5. Test HMAC Webhook
Use the example in `RAILWAY_DEPLOYMENT.md` to test ingest endpoint with valid signature.

## 📊 Success Criteria

After deployment, verify:
- ✅ `/health/ready` returns 200 (DB connected)
- ✅ `/metrics` shows `build_info` = 1
- ✅ Idempotency works: 201 → 204 on duplicate POST
- ✅ HMAC validation blocks invalid signatures
- ✅ Error rate < 2%
- ✅ P95 latency < 1000ms

## 🚨 Known Limitations

**Single Replica Only**
- Rate limiter is in-memory (per-instance)
- Circuit breaker is per-instance
- Cannot scale beyond 1 replica without Redis

**To scale beyond 1 replica:**
- Implement Redis-backed rate limiter
- Implement Redis-backed circuit breaker
- See `docs/REDIS_MIGRATION.md` for plan (8h estimate)

## 📚 Documentation

- **Full Guide:** `RAILWAY_DEPLOYMENT.md`
- **Environment Template:** `.env.railway`
- **Redis Migration:** `docs/REDIS_MIGRATION.md`
- **Smoke Tests:** `scripts/smoke-test.mjs`
- **Metrics Dashboard:** `scripts/monitor-metrics.mjs`

## 💰 Cost Estimate

**Railway (Single Replica):**
- Postgres: ~$5/month
- API Service: ~$5-10/month
- **Total: ~$10-15/month**

## 🆘 Troubleshooting

See **Troubleshooting** section in `RAILWAY_DEPLOYMENT.md` for common issues:
- Build failures
- Migration failures
- Health check failures
- CORS errors

---

**Commit:** `c0532b1`  
**Status:** ✅ Ready for Railway deployment  
**Date:** October 20, 2025
