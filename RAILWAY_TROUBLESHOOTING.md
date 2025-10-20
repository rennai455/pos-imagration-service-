# 🔧 Railway Deployment Troubleshooting

## Error: Cannot find module 'dotenv/config'

### ✅ FIXED (Commit 7940fd6)

**Problem:** Railway container failed to start with:
```
Error: Cannot find module 'dotenv/config'
```

**Root Cause:**
- Server.ts had `import "dotenv/config"` at the top
- In production, Railway injects environment variables directly
- `dotenv` package isn't needed (and may not be installed in production builds)

**Solution Applied:**
Changed from:
```typescript
import "dotenv/config";
```

To:
```typescript
// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv/config');
}
```

**Status:** Fixed and deployed in commit `7940fd6`

---

## Common Railway Deployment Issues

### 1. Build Failures

#### "Cannot find package"
**Solution:** Ensure all dependencies are in `package.json`, not just `devDependencies`

#### "pnpm install failed"
**Solution:** 
- Check `pnpm-workspace.yaml` is correct
- Verify `package.json` lockfile is committed
- Check Railway build logs for specific error

### 2. Migration Failures

#### "Prisma migration failed"
**Symptoms:** Container starts but crashes immediately

**Check:**
```bash
# In Railway logs, look for:
"prisma migrate deploy" output
```

**Common causes:**
- DATABASE_URL not set correctly
- Missing `sslmode=disable` for Railway Postgres internal connection
- Migration conflicts (check Prisma schema)

**Solution:**
```bash
# Verify DATABASE_URL format:
postgresql://user:pass@postgres.railway.internal:5432/railway?sslmode=disable
```

### 3. Health Check Failures

#### "Health check timeout"
**Symptoms:** Railway shows "Unhealthy" status

**Check:**
```bash
# Test health endpoint manually:
curl https://your-app.up.railway.app/health/ready
```

**Common causes:**
- Database connection failing
- Server not binding to 0.0.0.0
- PORT not set (Railway should auto-inject)

**Solution:**
- Check DATABASE_URL is accessible
- Verify `HOST=0.0.0.0` in server.ts
- Don't manually set PORT (Railway injects it)

### 4. Environment Variable Issues

#### "Missing required environment variable"
**Symptoms:** Validation error in Railway logs

**Required Variables:**
```bash
DATABASE_URL              # Auto-set by Railway Postgres
WEBHOOK_SECRET            # Generate with crypto.randomBytes
JWT_SECRET                # Generate with crypto.randomBytes
CORS_ALLOWED_ORIGINS      # Your Railway domain
```

**Solution:**
1. Go to Service → Variables in Railway
2. Add all required variables from `.env.railway` template
3. Redeploy

### 5. CORS Errors

#### "Access-Control-Allow-Origin" error in browser
**Symptoms:** API works in Postman but fails in browser

**Check:**
```bash
# Verify CORS_ALLOWED_ORIGINS includes your frontend
CORS_ALLOWED_ORIGINS=https://frontend.com,https://admin.com
```

**Common mistakes:**
- Spaces in CSV list (❌ `url1, url2`)
- Missing protocol (❌ `domain.com` instead of `https://domain.com`)
- Trailing slashes (❌ `https://domain.com/`)

**Solution:**
```bash
# Correct format (no spaces, with protocol, no trailing slash):
CORS_ALLOWED_ORIGINS=https://domain1.com,https://domain2.com
```

### 6. HMAC Signature Failures

#### "Invalid signature" on ingest endpoint
**Symptoms:** 403 Forbidden on POST `/pos/:source/ingest`

**Check:**
1. WEBHOOK_SECRET matches on both client and server
2. Signature is hex digest (not base64)
3. Header name is `X-Webhook-Signature`
4. Payload is JSON stringified before hashing

**Test signature generation:**
```powershell
$secret = "your-webhook-secret"
$payload = '{"test":"data"}'
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$signature = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString("x2") }) -join ''
Write-Host $signature
```

### 7. Memory/Performance Issues

#### Container OOM (Out of Memory)
**Symptoms:** Container restarts randomly

**Check Railway metrics:**
- Memory usage trending up?
- Restart pattern (regular intervals?)

**Solutions:**
- Increase Railway plan (more memory)
- Check for memory leaks (especially timeout handlers)
- Review connection pooling (Prisma)

#### Slow response times
**Check metrics:**
```bash
# Monitor with:
API_URL=https://your-app.up.railway.app pnpm metrics:watch
```

**Look for:**
- P95 latency > 1000ms → Slow database queries
- Error rate > 2% → Application errors
- High `active_connections` → Connection leak

---

## Quick Diagnostic Commands

### Check if API is responding
```powershell
curl https://your-app.up.railway.app/health
```

### Check database connectivity
```powershell
curl https://your-app.up.railway.app/health/ready
```

### Check metrics
```powershell
curl https://your-app.up.railway.app/metrics
```

### Run full smoke test
```powershell
$env:API_URL="https://your-app.up.railway.app"
pnpm smoke
```

### Watch metrics real-time
```powershell
$env:API_URL="https://your-app.up.railway.app"
pnpm metrics:watch
```

---

## Railway Logs

### View logs in Railway dashboard:
1. Go to your project
2. Click on API service
3. Click **Deployments** tab
4. Click on latest deployment
5. View **Deploy Logs** or **Runtime Logs**

### Common log patterns:

#### Success:
```
✓ prisma migrate deploy completed
✓ Server listening on 0.0.0.0:3000
✓ Health check passed
```

#### Failure:
```
✗ Error: Cannot connect to database
✗ Missing required environment variable
✗ Module not found
```

---

## Getting Help

### 1. Check Railway Status
- https://status.railway.app

### 2. Railway Discord
- https://discord.gg/railway

### 3. Project Documentation
- `RAILWAY_QUICKSTART.md` - Quick start guide
- `RAILWAY_DEPLOYMENT.md` - Full deployment manual
- `.env.railway` - Environment template

### 4. Review Recent Changes
```bash
git log --oneline -10
```

---

## Emergency Rollback

If deployment breaks production:

```bash
# Find last working commit
git log --oneline

# Create rollback branch
git checkout -b rollback/<commit-hash>
git reset --hard <last-good-commit>
git push -f origin rollback/<commit-hash>

# Update Railway to deploy from rollback branch
# (in Railway dashboard: Settings → Service → Branch)
```

---

**Last Updated:** After fixing dotenv/config error (commit 7940fd6)
