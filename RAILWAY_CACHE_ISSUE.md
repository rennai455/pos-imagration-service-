# Railway Docker Build Caching Issue

## 🔴 Problem: Railway Using Old Dockerfile

### Symptoms
- Local Dockerfile has COPY commands for `packages/api/prisma` and `packages/db/prisma`
- Railway build logs show NO such COPY commands
- Error still occurs at old line 18 (should be line 22 after our additions)
- GitHub has the correct Dockerfile (verified with `git show origin/main:Dockerfile`)

### Evidence

**Expected in Railway Build Log:**
```
deps
COPY packages/api/prisma ./packages/api/prisma
COPY packages/db/prisma ./packages/db/prisma
RUN pnpm install --frozen-lockfile
```

**Actually Seeing:**
```
deps
COPY apps/sdk/package.json ./apps/sdk/
RUN pnpm install --frozen-lockfile  ← Immediately after, no prisma COPY
```

**Dockerfile Line Numbers:**
- Railway error: `Dockerfile:18` → RUN pnpm install
- Current Dockerfile: Line 22 → RUN pnpm install (after 2 new COPY lines)

## 🔍 Root Causes

### 1. Railway Docker Layer Caching
Railway aggressively caches Docker layers. If it thinks nothing changed, it uses cached layers even if the Dockerfile was updated.

### 2. Git SHA vs File Content
Railway might cache based on file timestamps or Git tree hashes, not just commit SHAs.

### 3. Build Context Caching
The build context (files sent to Docker) might be cached separately from the Dockerfile itself.

## ✅ Solutions Applied

### Solution 1: Empty Commit (DONE)
```bash
git commit --allow-empty -m "chore: force Railway rebuild"
git push
```

**Commit:** `388dacf`

This forces a new commit SHA, which should bypass Railway's cache.

### Solution 2: Check Railway Settings

In Railway dashboard:
1. Go to service settings
2. Check "Build Command" - make sure it's not overridden
3. Check "Root Directory" - should be `.` or empty (we set root in railway.toml)
4. Check "Dockerfile Path" - should be empty or `Dockerfile`

### Solution 3: Manual Redeploy

If empty commit doesn't work:
1. Railway dashboard → Deployments
2. Find latest deployment
3. Click three dots → "Redeploy"
4. Ensure it's using branch `main`

### Solution 4: Clear Railway Cache

In Railway dashboard:
1. Settings → "Clear Build Cache"
2. This forces a complete rebuild from scratch

## 🎯 What Should Happen After Fix

### Correct Build Log Sequence:

```
deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY apps/admin/package.json ./apps/admin/
COPY apps/sdk/package.json ./apps/sdk/

deps
COPY packages/api/prisma ./packages/api/prisma  ← MUST SEE THIS!
COPY packages/db/prisma ./packages/db/prisma    ← AND THIS!

deps
RUN pnpm install --frozen-lockfile
   ✅ packages/api postinstall$ prisma generate
   ✅ Prisma schema loaded from prisma/schema.prisma
   ✅ Generated Prisma Client (v5.22.0)
```

## 🧪 Verification Commands

### 1. Verify Local Dockerfile
```bash
# Check local file
cat Dockerfile | grep -A2 "Copy Prisma"

# Expected:
# # Copy Prisma schema files (needed for postinstall hook)
# COPY packages/api/prisma ./packages/api/prisma
# COPY packages/db/prisma ./packages/db/prisma
```

### 2. Verify GitHub Dockerfile
```bash
# Check what's on GitHub
git show origin/main:Dockerfile | grep -A2 "Copy Prisma"

# Should match local
```

### 3. Verify Commit History
```bash
git log --oneline -5

# Should show:
# 388dacf (HEAD -> main, origin/main) chore: force Railway rebuild
# 5e50a6b docs: Dockerfile fix
# d74f1de fix(dockerfile): copy Prisma schemas  ← The important one
```

### 4. Check Dockerfile in Commit
```bash
git show d74f1de --stat

# Should show:
# Dockerfile | 4 insertions(+)
```

## 🔬 Debugging Railway's Dockerfile Source

### Check Railway Environment Variables

In Railway, check if these are set (they override behavior):
- `RAILWAY_DOCKERFILE_PATH` - Custom Dockerfile location
- `NIXPACKS_BUILD_CMD` - Overrides build command
- `RAILWAY_RUN_UID` - User ID for running

### Check railway.toml Conflicts

Our `railway.toml`:
```toml
[build]
builder = "NIXPACKS"  ← Uses nixpacks, but should still respect Dockerfile

[service.api]
root = "packages/api"  ← This might cause issues!
```

**Potential Issue:** Setting `root = "packages/api"` might change the build context, making COPY paths invalid!

## 🚨 Alternative Fix: Adjust for Railway Root

If Railway's `root = "packages/api"` changes the build context, the Dockerfile COPY paths become invalid.

### Current Dockerfile (assumes root = `.`):
```dockerfile
COPY packages/api/prisma ./packages/api/prisma
```

### If root = `packages/api`:
```dockerfile
COPY prisma ./prisma  ← Relative to packages/api/
```

**BUT** our Dockerfile is at the workspace root, so `root` shouldn't affect it. Let me verify...

## 📝 Railway.toml Root Setting Impact

The `root` setting in railway.toml affects:
- **Start command** working directory
- **PreStart command** working directory
- **NOT** Docker build context (that's always repo root)

So our Dockerfile paths should be correct.

## ✅ Most Likely Solution

**Empty commit `388dacf` should trigger Railway to:**
1. Fetch latest commit from GitHub
2. Load Dockerfile from that commit
3. Build with correct COPY commands
4. Successfully generate Prisma Client

**Next deployment should show the prisma COPY commands in the build log!**

---

## 📊 All Commits Timeline

```
388dacf - chore: force Railway rebuild (empty commit)
5e50a6b - docs: Dockerfile fix explanation
d74f1de - fix(dockerfile): copy Prisma schemas ← THE FIX
679273e - docs: prisma config
e4daf37 - fix(prisma): use package.json config
382ecbc - fix(railway): set root directory
744f0c2 - docs: Railway fixes
1b5fcd2 - fix(api): schema paths
022c827 - fix(api): prisma in dependencies
```

---

**Status:** Empty commit pushed to force rebuild  
**Expected:** Railway will use latest Dockerfile with prisma COPY commands  
**Watch For:** Build log showing COPY commands for prisma directories
