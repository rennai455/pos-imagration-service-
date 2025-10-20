# Railway Cache Bypass - Force Rebuild

## 🚨 Current Situation

Railway is building from a **cached/old version** of the Dockerfile, despite our fixes being on GitHub.

### Evidence

**Railway Error Shows:**
```
RUN pnpm --filter @codex/db prisma generate
❌ None of the selected packages has a "prisma" script
```

**Our Current Dockerfile (commit ec6585d):**
```dockerfile
RUN pnpm --filter @codex/db exec prisma generate
```

Notice: Railway is running WITHOUT `exec` - it's using an old cached build!

## ✅ Verification of Current State

### Git Repository State

```bash
$ git log --oneline -5
05decca (HEAD, origin/main) chore: trigger Railway rebuild
786b074 docs: exec prisma fix
ec6585d fix(docker): use exec prisma  ← THE FIX IS HERE!
27f4c89 docs: Railway troubleshooting
0f285b5 fix(dockerfile): --ignore-scripts
```

### Dockerfile Verification

```bash
$ git show ec6585d:Dockerfile | grep "exec prisma"
RUN pnpm --filter @codex/db exec prisma generate  ✅
```

### packages/db/package.json Verification

```json
{
  "prisma": {
    "schema": "prisma/schema.prisma"  ✅
  },
  "dependencies": {
    "@prisma/client": "5.22.0",  ✅
    "prisma": "5.22.0"  ✅
  }
}
```

**All fixes are correct and committed!**

## 🔄 Cache Bypass Strategy

### Attempt #1: Empty Commit (05decca)

```bash
git commit --allow-empty -m "chore: trigger Railway rebuild"
git push
```

**Purpose:** Force new commit SHA to bypass Railway's cache

### If That Doesn't Work

#### Option A: Railway UI - Clear Build Cache

1. Railway Dashboard → Your Service
2. Settings → Danger Zone
3. "Clear Build Cache"
4. Trigger new deployment

#### Option B: Railway UI - Manual Redeploy

1. Railway Dashboard → Deployments
2. Find deployment `ec6585d` or later
3. Click three dots → "Redeploy"
4. Ensure deploying from `main` branch

#### Option C: Add Dummy Line to Dockerfile

```dockerfile
# Force rebuild - timestamp: 2025-10-20
FROM node:20-alpine AS deps
```

Commit and push - forces Docker to rebuild from scratch.

## 📊 What Railway Should Show (Correct Build)

When Railway uses the CORRECT Dockerfile:

```
build
COPY . .
  ✅ All source copied

build  
RUN pnpm --filter @codex/db exec prisma generate
  ✅ Environment variables loaded from .env
  ✅ Prisma schema loaded from prisma/schema.prisma
  ✅ Generated Prisma Client (v5.22.0) to .../node_modules/@prisma/client

build
RUN pnpm --filter @codex/db build
  ✅ Compiling TypeScript...
  ✅ Successfully compiled 3 files

build
RUN pnpm --filter @codex/api build
  ✅ Compiling TypeScript...
  ✅ Successfully compiled
```

## 🎯 Key Indicators of Success

### ✅ Good Signs:

- "exec prisma generate" appears in build log
- "Prisma schema loaded from prisma/schema.prisma"
- "Generated Prisma Client (v5.22.0)"
- No TypeScript errors about ".prisma/client"

### ❌ Bad Signs (Still Using Old Build):

- "prisma generate" WITHOUT "exec"
- "None of the selected packages has a 'prisma' script"
- TS2307: Cannot find module '.prisma/client/default'

## 🔍 Troubleshooting Timeline

| Time | Action | Status |
|------|--------|--------|
| Earlier | Fixed Dockerfile with `exec prisma` | ✅ Committed (ec6585d) |
| Earlier | Fixed packages/db/package.json | ✅ Committed (ec6585d) |
| Now | Empty commit to bypass cache | ✅ Pushed (05decca) |
| Next | Wait for Railway rebuild | ⏳ In progress |

## 📝 All Critical Commits

```
05decca - Empty commit (cache bypass)
786b074 - Documentation
ec6585d - exec prisma fix (THE CRITICAL ONE!) ✅
27f4c89 - Documentation
0f285b5 - --ignore-scripts fix
388dacf - Empty commit (earlier cache bypass attempt)
d74f1de - Copy schemas attempt
e4daf37 - Prisma config
382ecbc - Railway root
022c827 - Prisma in dependencies
```

## 🚀 Expected Timeline

**If empty commit works:**
- Railway detects push: ~10-30 seconds
- Build starts: ~30-60 seconds
- Build completes: ~3-5 minutes
- **Total:** 5-7 minutes from push

**If Railway still caches:**
- Try "Clear Build Cache" in Railway UI
- Or manual redeploy from Dashboard
- This forces complete rebuild

## ✅ Success Criteria

Railway build log MUST show these exact lines:

1. ✅ `RUN pnpm --filter @codex/db exec prisma generate` (with "exec"!)
2. ✅ `Prisma schema loaded from prisma/schema.prisma`
3. ✅ `Generated Prisma Client (v5.22.0)`
4. ✅ `RUN pnpm --filter @codex/db build` succeeds
5. ✅ `RUN pnpm --filter @codex/api build` succeeds

If you see "None of the selected packages has a 'prisma' script" again, Railway is STILL using cached Dockerfile.

---

**Current Status:** Empty commit pushed to force rebuild  
**Next Step:** Monitor Railway deployment for commit `05decca` or later  
**Fallback:** Use Railway UI to manually clear cache or redeploy
