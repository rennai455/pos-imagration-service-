# 🚀 Deployment Quick Reference

**Last Updated**: October 19, 2025  
**Status**: Ready for staging deployment

---

## ⚡ Quick Start (5 Minutes)

### 1. Deploy to Staging (Railway - Easiest)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Set environment variables (copy from .env.example)
railway variables set DATABASE_URL="postgresql://..."
railway variables set SUPABASE_URL="https://..."
railway variables set SUPABASE_ANON_KEY="..."
railway variables set PORT="4000"
railway variables set NODE_ENV="staging"

# Deploy from GitHub Container Registry
railway service add --image ghcr.io/rennai455/pos-imagration-service:main

# Get URL
railway domain
# Example: pos-imagration-staging.up.railway.app
```

### 2. Run Smoke Tests
```bash
# Test locally
node scripts/smoke-test.mjs

# Test staging
API_URL=https://pos-imagration-staging.up.railway.app node scripts/smoke-test.mjs
```

### 3. Monitor Metrics
```bash
# Watch metrics in real-time
API_URL=https://pos-imagration-staging.up.railway.app node scripts/monitor-metrics.mjs

# One-time snapshot
WATCH=false API_URL=https://... node scripts/monitor-metrics.mjs
```

---

## 📊 Key Metrics to Monitor

| Metric | Target | Command |
|--------|--------|---------|
| Error Rate | ≤ 2% | `curl .../metrics \| grep http_requests_total` |
| P95 Latency | ≤ 1s | Check monitor-metrics.mjs output |
| Dedup Count | > 0 | `curl .../metrics \| grep ingest_dedup_total` |
| Health Status | 200 | `curl .../health/ready` |

---

## 🛠 Common Commands

### Health Checks
```bash
# Startup probe (cold start)
curl https://your-app.railway.app/startupz

# Readiness probe (traffic gate)
curl https://your-app.railway.app/health/ready

# Liveness probe (process alive)
curl https://your-app.railway.app/livez

# Legacy health
curl https://your-app.railway.app/api/health
```

### Metrics
```bash
# Fetch all metrics
curl https://your-app.railway.app/metrics

# Check specific metrics
curl -s https://your-app.railway.app/metrics | grep -E "(build_info|ingest_dedup_total|http_requests_total)"

# Calculate error rate
curl -s https://your-app.railway.app/metrics | grep 'http_requests_total{.*status_code="5'
```

### Logs
```bash
# Railway
railway logs --tail 100

# Fly.io
fly logs --app pos-imagration-staging

# Filter errors
railway logs | grep -i error
```

---

## 🚨 Troubleshooting

### Deployment fails health check
```bash
# Check logs for errors
railway logs --tail 50

# Verify DATABASE_URL
railway variables | grep DATABASE_URL

# Test DB connection
railway run psql $DATABASE_URL
```

### Rate limiting not working
```bash
# Expected: Single replica limitation
# Check replica count
railway service | grep replicas

# Should be 1 (not more)
# If > 1: See docs/REDIS_MIGRATION.md
```

### Metrics not showing dedups
```bash
# Send duplicate request
curl -X POST https://your-app.railway.app/api/products \
  -H "Idempotency-Key: test-123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":9.99,"stock":10,"storeId":"test"}'

# Send again (should get 204)
curl -X POST https://your-app.railway.app/api/products \
  -H "Idempotency-Key: test-123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":9.99,"stock":10,"storeId":"test"}'

# Check metrics
curl -s https://your-app.railway.app/metrics | grep ingest_dedup_total
```

---

## 📋 Pre-Production Checklist

Before promoting to production:

- [ ] Staging deployed with single replica
- [ ] Smoke tests passing (`node scripts/smoke-test.mjs`)
- [ ] Metrics monitored for 24h
- [ ] Error rate < 2% sustained
- [ ] P95 latency < 1s sustained
- [ ] Dedup counter incrementing correctly
- [ ] No memory leaks (check Railway/Fly metrics)
- [ ] Database migrations applied
- [ ] Backup/rollback plan documented

---

## 🔄 Redis Migration (Future)

When you need to scale beyond 1 replica:

1. **Read**: `docs/REDIS_MIGRATION.md`
2. **Provision**: Redis instance (Upstash, Redis Cloud, etc.)
3. **Implement**: Phase 1-5 (~8 hours)
4. **Test**: Load test with 3 replicas
5. **Deploy**: Scale to multiple replicas

**Estimate**: 2 working days  
**Cost**: +$15-30/month

---

## 📖 Full Documentation

- **Production Guide**: `resources/PHASE_6_PRODUCTION_GUIDE.md`
- **Production Audit**: `PRODUCTION_AUDIT.md`
- **Railway Setup**: `docs/RAILWAY_STAGING.md`
- **Fly.io Setup**: `docs/FLY_STAGING_SETUP.md`
- **Redis Migration**: `docs/REDIS_MIGRATION.md`
- **Production Ready Summary**: `PRODUCTION_READY.md`

---

## 🆘 Support

### Issue: Can't access /metrics
**Check**: Endpoint exists and returns Prometheus format
```bash
curl -v https://your-app.railway.app/metrics
```

### Issue: Idempotency not enforcing
**Check**: Middleware order and Prisma model
```bash
# Verify middleware registered
grep -n "idempotencyMiddleware" packages/api/src/server.ts

# Verify Prisma model exists
grep -A 5 "model Idempotency" packages/api/prisma/schema.prisma
```

### Issue: GitHub Actions failing
**Check**: STAGING_URL configured
```bash
# In GitHub repo → Settings → Secrets and variables → Actions → Variables
# Add: STAGING_URL = https://your-app.railway.app
```

---

## 🎯 Next Steps

1. **Deploy staging** (use Railway or Fly.io guide)
2. **Set GitHub variable**: `STAGING_URL`
3. **Run smoke tests**: Verify all endpoints
4. **Monitor 24h**: Check metrics dashboard
5. **Plan Redis**: Review migration doc if scaling needed

---

**Commit**: `a9d1dc1`  
**Branch**: `main`  
**Status**: 🟢 Ready to deploy

