# 🎯 PART C: CONTINUOUS MONITORING & CRITICAL ANALYSIS

## Real-Time Observations

### 1. **Schema Architecture Flaw Identified** 🚨
**CRITICAL**: Your monorepo has a split-brain Prisma setup:

```
packages/db/
  ├── prisma/schema.prisma          ❌ Defined but UNUSED
  └── src/index.ts                  exports { prisma }

packages/api/
  ├── prisma/schema.prisma          ✅ Actually used by API
  ├── src/lib/db.ts                 imports from @prisma/client (NOT @codex/db)
  └── src/routes/ingest.ts          uses local prisma instance
```

**Impact**:
- **Confusion**: Two sources of truth for schema
- **Risk**: Updates to `packages/db` schema won't affect API
- **Waste**: `@codex/db` package is unused despite being a workspace dependency

**Recommendation**: Pick ONE:
- **Option A**: Make API use `@codex/db` (refactor `src/lib/db.ts`)
- **Option B**: Delete `packages/db` entirely (API self-contained)

**My Verdict**: **Option B** for this project. The API is the only consumer, no need for shared package.

---

### 2. **Migration Drift Risk** ⚠️
The `packages/db/prisma/migrations/` folder has:
- `20240318000000_add_rls/` - References tables that don't exist in API schema
- `20251017064721_init/` - Schema doesn't match API schema

**Evidence of drift**:
- RLS migration mentions: `products`, `orders`, `order_items`, `inventory`, `sync_queue`
- API schema only has: `Tenant`, `Store`, `Product`, `User`

**Risk**: Someone might run these migrations against production DB → **SCHEMA CORRUPTION**

**Recommendation**: 
```powershell
# DELETE the misleading migrations
Remove-Item -Recurse packages\db\prisma\migrations\
```

---

### 3. **Docker Compose Observations** 📦

**Found TWO docker-compose files**:
1. `docker-compose.yml` (root) - Simple Postgres 15
2. `packages/api/dev/docker-compose.yml` - Unknown contents

**Issues**:
- Root README mentions `docker compose up -d` but doesn't specify which file
- Database name: `codex_pos_dev` (hardcoded)
- Password: `password` (insecure, fine for dev)
- No volume persistence strategy documented

**Test when Docker starts**:
```powershell
docker-compose up -d
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Watch for**:
- Container name (should match schema DATABASE_URL)
- Port 5432 actually mapped
- Volume mount point (data persistence)

---

### 4. **Load Test Script Quality** ✅

**Reviewed**: `scripts/dedup-loadtest.mjs`

**Strengths**:
- ✅ Proper HMAC signature generation
- ✅ Configurable via CLI args + env vars
- ✅ Shuffles duplicate plan for realistic load
- ✅ Concurrent workers (respects --concurrency)
- ✅ JSON output for programmatic validation
- ✅ Exit code 2 if `other > 0` (CI-friendly)

**Potential Issues**:
- Uses `fetch()` - Requires Node 18+ (you have 20, fine)
- No timeout per request (could hang indefinitely)
- No retry on network errors (intentional for load testing)

**Critical Line 98**:
```javascript
const res = await fetch(`${API_URL}/pos/${encodeURIComponent(SOURCE)}/ingest`, {
```

**Watch when running**:
- If requests hang → Add `signal: AbortSignal.timeout(5000)`
- If `other > 0` → Check API logs for specific errors

---

### 5. **Check-Loadtest Script** ✅

**Reviewed**: `scripts/check-loadtest-result.mjs`

**Perfect implementation**:
- ✅ Validates `other === 0` (no errors)
- ✅ Validates `total === expected`
- ✅ Validates `dedup ratio >= 0.2` (20% duplicates minimum)
- ✅ Clear error messages
- ✅ Exit code 1 on failure

**Edge case**: If load test sends 100 total with 99 unique, ratio = 0.01 → FAIL
This is **CORRECT BEHAVIOR** - you want meaningful duplicate testing.

---

### 6. **Smoke Test Script** 🆕

**Created**: `scripts/smoke.sh`

**Issue Found**: Not yet tested, requires Bash on Windows

**Windows Execution Options**:
1. **Git Bash** (if installed with Git for Windows)
2. **WSL** (Windows Subsystem for Linux)
3. **Rewrite to PowerShell** (recommended for Windows-first project)

**Recommendation**: Create `scripts/smoke.ps1`:
```powershell
# Convert bash script to PowerShell for native Windows support
```

**Test when API is running**:
```powershell
bash scripts/smoke.sh
# OR after conversion:
.\scripts\smoke.ps1
```

---

### 7. **Environment Variable Gaps** 📝

**Missing from .env.example**:
- `WEBHOOK_SECRET` - **CRITICAL** for HMAC verification
- `SHUTDOWN_GRACE_MS` - Defaults to 15000
- `READINESS_TIMEOUT` - Defaults to 5000
- `LIVENESS_TIMEOUT` - Defaults to 2000

**Recommendation**: Add to `packages/api/.env.example`:
```bash
# Webhook security
WEBHOOK_SECRET="your-webhook-secret-min-32-chars"  # CRITICAL: Change in production

# Graceful shutdown
SHUTDOWN_GRACE_MS="15000"  # Max time to wait for inflight requests (15s)

# Health check timeouts
READINESS_TIMEOUT="5000"   # Database ping timeout (5s)
LIVENESS_TIMEOUT="2000"    # Memory check timeout (2s)
```

---

### 8. **CD Workflow Analysis** 🔄

**File**: `.github/workflows/cd.yml`

**Health Gate (Lines 67-79)**:
```yaml
for i in {1..40}; do
  if curl -f "$DEPLOY_URL/livez"; then exit 0; fi
  sleep $((i < 5 ? 2 : 10))
done
```

**Issues**:
- ❌ Bash syntax in GitHub Actions (fine, but inconsistent with Windows dev env)
- ⚠️ Linear backoff: 2s × 4, then 10s × 36 = **368 seconds max wait**
- ⚠️ No health check on `/healthz` (only `/livez`)

**Recommendation**: Improve backoff and check both endpoints:
```yaml
- name: Wait for deployment health
  run: |
    for i in {1..10}; do
      if curl -f "$DEPLOY_URL/healthz" && curl -f "$DEPLOY_URL/livez"; then
        echo "✅ Deployment healthy"
        exit 0
      fi
      sleep $((2 ** (i < 6 ? i : 6)))  # Exponential: 2,4,8,16,32,64 (max)
    done
    echo "❌ Health check timeout"
    exit 1
```

**Max wait time**: 2+4+8+16+32+64+64+64+64+64 = **382 seconds** (similar, but better distribution)

---

### 9. **Test Coverage Gaps** ⚠️

**Found**: `packages/api/tests/health.test.ts` - 8 tests passing

**Missing Tests**:
1. **Idempotency integration test** - POST /pos/:source/ingest with duplicates
2. **Tenant isolation test** - Verify tenantId scoping works
3. **Webhook signature validation** - Test HMAC verification
4. **Load test in CI** - Currently only manual

**Recommendation**: Create `packages/api/tests/ingest.test.ts`:
```typescript
describe('/pos/:source/ingest', () => {
  it('should accept first request', async () => {
    // POST with valid HMAC → expect 201
  });

  it('should reject duplicate with 204', async () => {
    // Same tenantId + key → expect 204
  });

  it('should accept different tenant', async () => {
    // Same key, different tenantId → expect 201
  });
});
```

---

### 10. **Production Readiness Score** 📊

| Category | Score | Blocker | Notes |
|----------|-------|---------|-------|
| **Migration** | 8/10 | ❌ | Created but NOT TESTED yet |
| **Load Tests** | 9/10 | ✅ | Scripts exist, need execution |
| **Smoke Tests** | 6/10 | ⚠️ | Bash script on Windows env |
| **CI/CD** | 8/10 | ✅ | Workflows complete, need tweaking |
| **Monitoring** | 7/10 | ✅ | Metrics exist, no dashboards |
| **Documentation** | 5/10 | ⚠️ | Outdated README, no runbook |
| **Security** | 7/10 | ⚠️ | HMAC + rate limiting, but no secrets rotation |
| **Schema Integrity** | 3/10 | 🚨 | **CRITICAL**: Dual schema setup |

**Overall**: **6.5/10** - Close to production, but critical blocker (untested migration).

---

## 🔍 Watch Points During Manual Testing

### When you run `.\scripts\test-migration.ps1`:

**Watch console for**:
1. ✅ "Docker is running" → If ❌, you'll see: "Docker is NOT running"
2. ✅ "Database connected" → If stuck on "Waiting for DB...", check:
   ```powershell
   docker logs pos-imagration-service--db-1
   ```
3. ✅ "Migration applied" → If fails, error will show Prisma exit code
4. ✅ "Unique constraint working" → If fails, the `@@unique([tenantId, key])` isn't in effect

**If step 3 fails with "migration already applied"**:
```powershell
cd packages\api
pnpm prisma migrate resolve --applied 20251019000000_add_idempotency_keys --schema=./prisma/schema.prisma
```

### When you run smoke test:

**Expected sequence**:
```
🔍 Smoke Test for http://127.0.0.1:4000
Testing /healthz... ✅ 200
Testing /metrics... ✅ 200
Generating HMAC for /pos/demo/ingest...
Testing /pos/demo/ingest... ✅ 201
🎉 All smoke tests passed
```

**If /pos/:source/ingest fails**:
- Check API logs for error
- Common: "Invalid signature" → WEBHOOK_SECRET mismatch
- Common: "Table idempotency_keys does not exist" → Migration not applied

### When you run load test:

**Expected output**:
```json
{"total":100,"duplicates":50,"success":100,"other":0}
```

**If `other > 0`**:
1. Check API logs: `docker logs -f <api-container-name>`
2. Check DB connection pool: `pnpm prisma db execute --stdin` → `SHOW max_connections;`
3. Check concurrency: Reduce `--concurrency 10` to `--concurrency 5`

**If `success < total`**:
- Network timeout → Add timeout to fetch() in dedup-loadtest.mjs
- Rate limiting triggered → Check rate limit config (should exclude /pos/*)
- Signature failures → Verify WEBHOOK_SECRET consistency

---

## 🎬 Recommended Execution Order

1. **Start Docker Desktop** (manual, watch task tray icon)
2. **Run test-migration.ps1** (automated validation)
3. **Start API server** (`pnpm dev:api`, watch startup logs)
4. **Run smoke test** (validate basic endpoints)
5. **Run load test (small)** (10 total, 5 unique - quick sanity check)
6. **Check DB state** (Prisma Studio - verify 5 rows in idempotency_keys)
7. **Run load test (full)** (100 total, 50 unique - stress test)
8. **Commit results** (create MIGRATION_VERIFIED.txt)
9. **Push to GitHub** (trigger CI)
10. **Watch GitHub Actions** (CI should pass with new migration)

---

## 🚨 Red Flags to Abort

**STOP and report if you see**:
1. ❌ Migration script shows "Table already exists" - Indicates manual DB tampering
2. ❌ Unique constraint test passes duplicate insert - Constraint not working
3. ❌ Load test `other > 50%` - More than half requests failing
4. ❌ API startup shows "Type 'Idempotency' is not assignable" - Client not regenerated
5. ❌ Database has > 50 rows after 50-unique load test - Duplicates being inserted

**Any of these = ROLLBACK immediately.**

---

## ✅ Success Signals

**Proceed to production if you see**:
1. ✅ All 7 steps in test-migration.ps1 pass
2. ✅ Smoke test: 3/3 endpoints respond correctly
3. ✅ Load test (100,50): `{"total":100,"duplicates":50,"success":100,"other":0}`
4. ✅ DB has exactly 50 rows (unique count matches)
5. ✅ Subsequent load test with same keys: All return 204 (cached)
6. ✅ CI passes on GitHub Actions
7. ✅ No errors in API logs during load test

**If all 7 ✅, you're ready for staging deployment.**

---

## 📝 Log What You See

As you run tests, document actual results here:

### Test Migration Results:
```
Date/Time: _______________
Docker Status: ___________
DB Connection: ___________
Migration Apply: __________
Unique Constraint: ________
Client Generation: ________
Duration: ______________
Notes: _________________
```

### Smoke Test Results:
```
Date/Time: _______________
/healthz: _______________
/metrics: _______________
/pos/demo/ingest: ________
Errors: _________________
```

### Load Test Results:
```
Date/Time: _______________
Config: total=___ unique=___ concurrency=___
Output: {"total":___,"duplicates":___,"success":___,"other":___}
Duration: _______________
DB Row Count: ___________
Errors: _________________
```

---

**READY TO START TESTING?** 

1. Open Docker Desktop
2. Wait for it to fully start (whale icon in task tray)
3. Run: `.\scripts\test-migration.ps1`
4. Report back any errors or unexpected behavior

**I'll be watching your output and analyzing in real-time.** 🔍
