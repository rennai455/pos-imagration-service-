# Railway Configuration Fix - Schema Path in Pre-deploy

## 🔴 Issue: Railway Pre-deploy Command Failing

**Error Still Occurring:**
```
packages/api postinstall$ prisma generate
Error: Could not find Prisma Schema that is required for this command.
```

## Root Cause Analysis

### The Problem

Railway's **Pre-deploy Command** is executing:
```bash
pnpm --filter "@codex/api" prisma migrate deploy
```

This command runs **directly** from the workspace root without the `--schema` flag, so Prisma can't find the schema file.

### Why Our package.json Fix Wasn't Enough

We fixed `package.json` scripts:
```json
{
  "scripts": {
    "postinstall": "prisma generate --schema=./prisma/schema.prisma",
    "prestart": "prisma migrate deploy --schema=./prisma/schema.prisma"
  }
}
```

✅ This works when running `pnpm start` (triggers `prestart` hook)  
❌ This DOESN'T help Railway's custom Pre-deploy Command

### Execution Context Matters

**Railway runs commands from different directories:**

1. **Install phase (postinstall):**
   - Working dir: `/workspace/packages/api`
   - Command: `prisma generate --schema=./prisma/schema.prisma`
   - Schema path: `/workspace/packages/api/prisma/schema.prisma` ✅

2. **Pre-deploy Command (Railway UI):**
   - Working dir: `/workspace` (root)
   - Command: `pnpm --filter "@codex/api" prisma migrate deploy`
   - Prisma looks for: `/workspace/packages/api/schema.prisma` ❌
   - Schema actually at: `/workspace/packages/api/prisma/schema.prisma`

## ✅ Solution Options

### Option 1: Update railway.toml (RECOMMENDED)

Change the `root` directory and simplify commands:

```toml
[service.api]
root = "packages/api"  # Run from package directory
start = "pnpm start"   # Will trigger prestart hook automatically
preStart = "pnpm prisma migrate deploy --schema=./prisma/schema.prisma"
```

**Benefits:**
- Commands run from correct directory context
- Cleaner command syntax
- Matches local development workflow

### Option 2: Update Railway UI Commands

In Railway Dashboard → Deploy settings, update:

**Pre-deploy Command:**
```bash
pnpm --filter "@codex/api" exec prisma migrate deploy --schema=./prisma/schema.prisma
```

**Custom Start Command:**
```bash
pnpm --filter "@codex/api" start
```

**Benefits:**
- Explicit schema paths
- Works from workspace root
- More verbose but clear

### Option 3: Rely on prestart Hook Only

Remove Pre-deploy Command entirely and let `package.json` prestart hook handle migrations:

```toml
[service.api]
root = "packages/api"
start = "pnpm start"  # This will auto-run prestart hook
# No preStart command needed
```

**Benefits:**
- Single source of truth (package.json)
- Automatic hook execution
- Less Railway configuration

## 🎯 Recommended Fix (Option 1)

**Updated railway.toml:**
```toml
# railway.toml
[build]
builder = "NIXPACKS"

[env]
NODE_ENV = "production"
REQUEST_TIMEOUT_MS = "30000"
CONNECTION_TIMEOUT_MS = "60000"
SHUTDOWN_GRACE_MS = "15000"
METRICS_ENABLED = "true"

[service.api]
root = "packages/api"
start = "pnpm start"
preStart = "pnpm prisma migrate deploy --schema=./prisma/schema.prisma"

[service.api.healthcheck]
path = "/health/ready"
interval = 10000
timeout  = 10000
```

**Key Changes:**
1. `root = "packages/api"` - Sets working directory to package
2. `start = "pnpm start"` - Simplified (no filter needed)
3. `preStart` - Schema path is relative to `packages/api`

## Railway UI Configuration

If you prefer using Railway UI instead of railway.toml:

**Settings → Deploy:**

**Pre-deploy Command:**
```
cd packages/api && pnpm prisma migrate deploy --schema=./prisma/schema.prisma
```

**Custom Start Command:**
```
cd packages/api && pnpm start
```

**OR (from workspace root):**

**Pre-deploy Command:**
```
pnpm --filter @codex/api exec prisma migrate deploy --schema=./prisma/schema.prisma
```

**Custom Start Command:**
```
pnpm --filter @codex/api start
```

## 🔄 Execution Flow After Fix

```
1. Railway pulls latest code (commit 1b5fcd2 with schema paths)

2. Install dependencies
   └─ pnpm install --frozen-lockfile
   └─ postinstall hook runs (per package)
      └─ packages/api: prisma generate --schema=./prisma/schema.prisma ✅

3. Build application
   └─ pnpm build (if needed)

4. Pre-deploy (from packages/api directory)
   └─ pnpm prisma migrate deploy --schema=./prisma/schema.prisma ✅

5. Start server (from packages/api directory)
   └─ pnpm start
      └─ Triggers prestart hook (optional backup)
      └─ Executes: node dist/server.js ✅

6. Health check
   └─ GET /health/ready → 200 OK ✅
```

## Directory Structure Reference

```
/workspace/                           ← Railway execution root
├── packages/
│   └── api/
│       ├── package.json              ← Scripts with --schema flag
│       ├── prisma/
│       │   └── schema.prisma         ← The actual schema file
│       ├── dist/
│       │   └── server.js
│       └── src/
├── railway.toml                      ← Service configuration
└── pnpm-workspace.yaml
```

## Testing the Fix

**Local test from workspace root:**
```bash
# Simulate Railway's pre-deploy command
cd packages/api
pnpm prisma migrate deploy --schema=./prisma/schema.prisma

# Expected output:
# "Prisma schema loaded from prisma/schema.prisma"
# "Database is already up to date" OR "Migration applied successfully"
```

**Test from workspace root (monorepo style):**
```bash
# From workspace root
pnpm --filter @codex/api exec prisma migrate deploy --schema=./prisma/schema.prisma

# Expected: Same success output
```

## Verification Checklist

After deploying with the fix:

- [ ] Railway build completes without schema errors
- [ ] Pre-deploy command finds schema successfully
- [ ] Migrations run (check Railway logs for "Migration applied" or "Database is already up to date")
- [ ] Server starts successfully
- [ ] Health check endpoint responds
- [ ] No "Could not find Prisma Schema" errors in logs

## What to Update in Railway UI

Based on your screenshot, update these fields:

1. **Pre-deploy Command:** Change to:
   ```
   cd packages/api && pnpm prisma migrate deploy --schema=./prisma/schema.prisma
   ```

2. **Custom Start Command:** Change to:
   ```
   cd packages/api && pnpm start
   ```

**OR** use the railway.toml approach (commit and push the updated file).

## 📝 Files to Commit

If using railway.toml approach:

```bash
git add railway.toml
git commit -m "fix(railway): set correct root directory and schema path for monorepo

- Change root to packages/api for correct working directory
- Update preStart with explicit schema path relative to root
- Simplify start command (no filter needed from package dir)
- Fixes schema not found error in Railway pre-deploy"

git push
```

## Railway Auto-Detection vs Explicit Config

**Railway's auto-detection might:**
- Run commands from workspace root
- Not understand monorepo structure
- Miss custom schema locations

**Explicit configuration ensures:**
- ✅ Correct working directory
- ✅ Proper schema path resolution
- ✅ Predictable build behavior

## Final Recommendation

**Use the updated `railway.toml` with `root = "packages/api"`** - this is the cleanest solution and ensures all commands run from the correct directory context.

Then in Railway UI, you can either:
1. Keep the UI commands empty (let railway.toml handle it), OR
2. Update them to match railway.toml for visibility

---

**Status:** Ready to commit and deploy  
**Impact:** Critical - Fixes schema path resolution for Railway  
**Files Changed:** `railway.toml`  
**Next:** Commit + push → Railway auto-deploys
