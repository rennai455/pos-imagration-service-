# 🧪 MANUAL TESTING CHECKLIST

## Critical Finding During Migration Creation
**ISSUE DISCOVERED**: Your project has TWO separate Prisma schemas:
- `packages/db/prisma/schema.prisma` - Shared DB package (unused!)
- `packages/api/prisma/schema.prisma` - Actual API schema (in use)

The API uses `src/lib/db.ts` which imports from `@prisma/client` (not `@codex/db`).
This is a monorepo anti-pattern but fixing it is out of scope for now.

**Migration created at**: `packages/api/prisma/migrations/20251019000000_add_idempotency_keys/`

---

## ✅ Part A: Migration Created
- [x] Migration SQL created
- [x] Committed to git (commit: a39de69)
- [x] Test script created (scripts/test-migration.ps1)

---

## 🔧 Part B: Manual Testing Steps

### Prerequisites
1. **Start Docker Desktop** (if not already running)
2. **Start PostgreSQL**:
   ```powershell
   cd c:\Users\summa\pos-imagration-service-
   docker-compose up -d
   ```
3. **Wait 5 seconds** for DB to initialize

### Test 1: Run Automated Test Script
```powershell
cd c:\Users\summa\pos-imagration-service-
.\scripts\test-migration.ps1
```

**Expected Output**:
```
🔍 Testing Idempotency Migration...

1️⃣ Checking Docker...
   ✅ Docker is running

2️⃣ Starting PostgreSQL...
[+] Running 1/1
   ✅ Database connected

4️⃣ Applying idempotency migration...
   ✅ Migration applied

5️⃣ Validating idempotency_keys table...
   ✅ Table structure validated

6️⃣ Testing unique constraint...
   ✅ Unique constraint working

7️⃣ Generating Prisma Client...
   ✅ Prisma Client generated

✅ ALL TESTS PASSED!
```

**If test fails**, note the error and continue with manual tests below.

---

### Test 2: Manual Migration Application
```powershell
cd packages\api
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/codex_pos_dev"
pnpm prisma migrate deploy --schema=./prisma/schema.prisma
```

**Expected**: "All migrations have been successfully applied."

---

### Test 3: Verify Table Structure
```powershell
cd packages\api
pnpm prisma studio --schema=./prisma/schema.prisma
```

**Expected**: Browser opens with Prisma Studio showing:
- Tables: Tenant, Store, Product, User, **idempotency_keys**
- Click **idempotency_keys** → Should show columns: id, tenantId, key, createdAt

---

### Test 4: Test Unique Constraint Manually
Open a new PowerShell:
```powershell
cd packages\api
pnpm prisma db execute --stdin --schema=./prisma/schema.prisma
```

Then paste:
```sql
INSERT INTO idempotency_keys (id, "tenantId", key) VALUES ('test1', 't1', 'k1');
INSERT INTO idempotency_keys (id, "tenantId", key) VALUES ('test2', 't1', 'k1');
```

**Expected**:
- First INSERT: ✅ Success
- Second INSERT: ❌ Error: `unique constraint "idempotency_keys_tenantId_key_key"`

Clean up:
```sql
DELETE FROM idempotency_keys WHERE id IN ('test1', 'test2');
```

---

### Test 5: Start API Server
```powershell
cd c:\Users\summa\pos-imagration-service-
pnpm dev:api
```

**Expected**:
```
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "codex_pos_dev"
Codex API running on 127.0.0.1:4000
```

**If error**: "Table 'idempotency_keys' does not exist" → Migration not applied

---

### Test 6: Smoke Test (Requires API Running)
New PowerShell window:
```powershell
$env:API_URL = "http://127.0.0.1:4000"
$env:SOURCE = "demo"
$env:TENANT = "t1"
$env:WEBHOOK_SECRET = "test-secret-key-at-least-32-characters-long"

bash scripts/smoke.sh
```

**Expected**:
```
🔍 Smoke Test for http://127.0.0.1:4000
✅ /healthz => 200
✅ /metrics => 200
✅ /pos/demo/ingest => 201
🎉 All smoke tests passed
```

---

### Test 7: Load Test (Tests Idempotency)
```powershell
$env:WEBHOOK_SECRET = "test-secret-key-at-least-32-characters-long"

node scripts/dedup-loadtest.mjs `
  --url http://127.0.0.1:4000 `
  --source demo `
  --tenant t1 `
  --total 100 `
  --unique 50 `
  --concurrency 10 `
  --out result.json
```

**Expected**:
```json
{"total":100,"duplicates":50,"success":100,"other":0}
```

**Critical**: `other` MUST be 0 (no errors)

Validate:
```powershell
node scripts/check-loadtest-result.mjs result.json 100
```

**Expected**:
```
[check-loadtest-result] total=100 duplicates=50 ratio=0.500 other=0
[check-loadtest-result] OK
```

---

## 🚨 Part C: Critical Analysis & Watch Points

### What to Watch For:

#### 1. **Migration Application**
- ❌ **RED FLAG**: "Table already exists" → Someone manually created it (bad!)
- ✅ **GREEN**: "All migrations have been successfully applied"

#### 2. **API Startup**
- ❌ **RED FLAG**: Prisma Client generation errors → Run `pnpm prisma generate`
- ❌ **RED FLAG**: "Unknown type: Idempotency" → Client not regenerated
- ✅ **GREEN**: Server starts without errors

#### 3. **Ingest Endpoint**
- ❌ **RED FLAG**: First request returns 500 → Migration not applied
- ❌ **RED FLAG**: Duplicate requests both return 201 → Unique constraint broken
- ✅ **GREEN**: First request 201, duplicate 204

#### 4. **Load Test**
- ❌ **RED FLAG**: `other > 0` → Errors during load test
- ❌ **RED FLAG**: `success < total` → Some requests failed
- ✅ **GREEN**: `success === total && other === 0`

#### 5. **Database State**
After load test, check idempotency_keys table:
```powershell
cd packages\api
pnpm prisma studio --schema=./prisma/schema.prisma
```

**Expected**:
- idempotency_keys table has exactly 50 rows (unique count)
- Each row has distinct (tenantId, key) pair
- All have `createdAt` timestamp

---

## 🎯 Success Criteria

Mark each when complete:

- [ ] Docker Desktop started
- [ ] PostgreSQL running (docker ps shows container)
- [ ] Migration applied successfully
- [ ] Prisma Client regenerated
- [ ] API starts without errors
- [ ] Smoke test passes (healthz + metrics + ingest)
- [ ] Load test passes (100 total, 50 unique, 0 errors)
- [ ] Database has exactly 50 idempotency records
- [ ] Duplicate requests return 204 (not 201)

---

## 🐛 Common Issues & Fixes

### Issue: "Can't reach database server at localhost:5432"
**Fix**: 
```powershell
docker-compose up -d
docker ps  # Verify "codex_pos_dev" container running
```

### Issue: "Table 'idempotency_keys' does not exist"
**Fix**:
```powershell
cd packages\api
pnpm prisma migrate deploy --schema=./prisma/schema.prisma
```

### Issue: "Type 'Idempotency' is not assignable"
**Fix**:
```powershell
cd packages\api
pnpm prisma generate --schema=./prisma/schema.prisma
pnpm dev:api  # Restart server
```

### Issue: Load test shows `other > 0`
**Fix**: Check API logs for errors. Common causes:
- Missing WEBHOOK_SECRET (signature validation fails)
- Database connection pool exhausted (increase pool size)
- Unique constraint violated incorrectly (check migration)

---

## 📊 Performance Benchmarks

**Expected timings on local machine**:

| Test | Duration | Pass Criteria |
|------|----------|---------------|
| Migration apply | 1-2s | No errors |
| Smoke test | 2-5s | All 3 endpoints respond |
| Load test (100 req) | 5-10s | 0 errors, 50 unique |
| Load test (1000 req) | 30-60s | 0 errors |

If significantly slower, check:
- Docker resources (RAM/CPU allocation)
- Disk I/O (SSD vs HDD)
- Antivirus interference

---

## 🔄 Rollback Plan

If migration breaks production:

```powershell
# 1. Revert migration
cd packages\api
pnpm prisma migrate resolve --rolled-back 20251019000000_add_idempotency_keys --schema=./prisma/schema.prisma

# 2. Remove table manually
pnpm prisma db execute --stdin --schema=./prisma/schema.prisma
# Then: DROP TABLE IF EXISTS idempotency_keys;

# 3. Revert git commit
git revert a39de69

# 4. Regenerate client
pnpm prisma generate --schema=./prisma/schema.prisma
```

---

## ✅ Next Steps After All Tests Pass

1. **Commit test results** (optional):
   ```powershell
   echo "All tests passed $(Get-Date)" > MIGRATION_VERIFIED.txt
   git add MIGRATION_VERIFIED.txt
   git commit -m "test: verify idempotency migration"
   ```

2. **Push to trigger CI**:
   ```powershell
   git push origin main
   ```

3. **Watch GitHub Actions**:
   - CI should pass (builds + tests)
   - Tag for staging deployment:
     ```powershell
     git tag v0.1.0-staging
     git push --tags
     ```

4. **Monitor CD Workflow**:
   - Staging deployment
   - Smoke test runs automatically
   - (Load test only on tags matching `v*.*.*`, not `-staging`)

5. **Production Rollout**:
   - Tag release: `git tag v0.1.0`
   - Push tag: `git push --tags`
   - CD runs load test as gate
   - Manual approval for production
   - Deployment + health checks
   - Monitor metrics

---

**CRITICAL REMINDER**: The migration is **IRREVERSIBLE** without data loss once production data exists in idempotency_keys table. Test thoroughly in staging before production!
