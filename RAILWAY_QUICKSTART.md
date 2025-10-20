# 🚂 Railway Deployment - Quick Start

## 📋 Prerequisites Checklist
- [ ] GitHub account connected to Railway
- [ ] Generated `WEBHOOK_SECRET` (32+ chars)
- [ ] Generated `JWT_SECRET` (32+ chars)

## 🚀 Deploy in 5 Minutes

### 1. Generate Secrets (Local)
```powershell
# Generate WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET (save both!)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create Railway Project
1. Go to https://railway.app
2. Click **New Project** → **Deploy from GitHub repo**
3. Select: `rennai455/pos-imagration-service-`
4. Railway auto-detects `railway.toml` ✓

### 3. Add Postgres
1. In project: **+ New** → **Database** → **PostgreSQL**
2. Railway auto-sets `DATABASE_URL` ✓

### 4. Set Environment Variables
**Service → Variables** (paste your generated secrets):

```bash
WEBHOOK_SECRET=<paste-your-32-char-secret>
JWT_SECRET=<paste-your-32-char-secret>
CORS_ALLOWED_ORIGINS=https://your-app.up.railway.app
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

**⚠️ Do NOT set:** `PORT` (auto-injected), `NODE_ENV` (in railway.toml)

### 5. Get Public URL
**Settings → Networking → Generate Domain**

Copy URL (e.g., `https://pos-imagration-service-production.up.railway.app`)

### 6. Update CORS
Update `CORS_ALLOWED_ORIGINS` variable with your actual Railway URL.

## ✅ Verify Deployment

### Check Health
```powershell
$url = "https://your-app.up.railway.app"
curl "$url/health/ready"
# Expected: {"status":"ready","database":"connected",...}
```

### Run Smoke Tests
```powershell
$env:API_URL="https://your-app.up.railway.app"
pnpm smoke
# Expected: All 9 tests pass ✓
```

### Monitor Metrics
```powershell
$env:API_URL="https://your-app.up.railway.app"
pnpm metrics:watch
# Watch: error_rate < 2%, p95 < 1000ms
```

## 🧪 Test HMAC Ingest

### PowerShell
```powershell
$secret = "your-webhook-secret-here"
$payload = '{"tenant":"test","data":"sample"}'
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$signature = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString("x2") }) -join ''

curl -X POST "https://your-app.up.railway.app/pos/square/ingest" `
  -H "Content-Type: application/json" `
  -H "X-Tenant-Id: test-tenant" `
  -H "X-Webhook-Signature: $signature" `
  -d $payload

# Expected: 201 Created (first request)
# Expected: 204 No Content (duplicate request)
```

## 🎯 Success Criteria
- ✅ `/health/ready` → 200
- ✅ `/metrics` shows `build_info{version}` = 1
- ✅ Idempotency: 201 → 204 on duplicate
- ✅ HMAC: 403 on invalid signature
- ✅ Error rate < 2%
- ✅ P95 latency < 1000ms

## 🚨 Common Issues

### "Migration failed"
→ Check `DATABASE_URL` has `sslmode=disable`

### "Health check timeout"
→ Verify Postgres service is running
→ Check Railway logs for DB connection errors

### "CORS error"
→ Verify `CORS_ALLOWED_ORIGINS` includes your frontend URL
→ Format: `https://domain1.com,https://domain2.com` (no spaces)

### "Invalid signature"
→ Verify `WEBHOOK_SECRET` matches
→ Use hex digest (not base64)
→ Signature header: `X-Webhook-Signature`

## 📊 Expected Performance

**Single Replica:**
- Latency: ~50-100ms average
- P95: < 500ms
- Throughput: ~100 req/s
- Memory: ~100-200MB

**Cost:** ~$10-15/month

## 🔄 Auto-Deployment

Every push to `main` triggers:
1. Railway detects changes
2. Runs `pnpm install`
3. Runs `prisma migrate deploy`
4. Builds and starts server
5. Health checks `/health/ready`
6. Routes traffic when healthy

## 📚 Full Documentation
- **Complete Guide:** `RAILWAY_DEPLOYMENT.md`
- **Changes Summary:** `RAILWAY_CHANGES.md`
- **Env Template:** `.env.railway`

## 🆘 Support
- Railway Docs: https://docs.railway.app
- Project Issues: GitHub Issues
- Quick Help: See `RAILWAY_DEPLOYMENT.md` troubleshooting section

---
**Ready to Deploy!** 🎉
