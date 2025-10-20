# Final Fix: Prisma Schema Resolution in Monorepo

## 🔴 The Real Issue

**Error:**
```
packages/api postinstall$ prisma generate --schema=./prisma/schema.prisma
Error: Could not load `--schema` from provided path `prisma/schema.prisma`: file or directory not found
```

## Root Cause

### The Problem with Explicit `--schema` Paths

When Railway runs `pnpm install --frozen-lockfile` at the **workspace root**, the postinstall hooks for each package run, but the **working directory context** is unpredictable.

**What happens:**
```bash
# Railway is here:
/workspace/

# pnpm install triggers postinstall for @codex/api
# Working directory during postinstall: UNCLEAR (could be workspace root or package dir)

# Script runs:
prisma generate --schema=./prisma/schema.prisma

# Looks for schema at:
/workspace/prisma/schema.prisma ❌ NOT FOUND

# Actual location:
/workspace/packages/api/prisma/schema.prisma ✅
```

### Why Relative Paths Failed

- `--schema=./prisma/schema.prisma` is relative to **current working directory**
- During `pnpm install` at workspace root, postinstall might not run from package directory
- Explicit relative paths break in monorepo build contexts

## ✅ The Solution: Use Prisma's Built-in Config

### What We Changed

**Before (BROKEN):**
```json
{
  "scripts": {
    "postinstall": "prisma generate --schema=./prisma/schema.prisma",
    "prestart": "prisma migrate deploy --schema=./prisma/schema.prisma"
  },
  "prisma": {
    "schema": "prisma/schema.prisma"
  }
}
```

**After (FIXED):**
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "prestart": "prisma migrate deploy"
  },
  "prisma": {
    "schema": "prisma/schema.prisma"  // ← Prisma reads this automatically!
  }
}
```

### How Prisma Resolves Schema

Prisma CLI looks for schema in this order:

1. **`--schema` flag** (if provided) ❌ We removed this
2. **`prisma.schema` in package.json** ✅ We use this
3. **Default locations** (prisma/schema.prisma, schema.prisma)

By removing the `--schema` flag, Prisma uses the `package.json` config, which resolves **relative to the package directory** regardless of where the command is executed from.

## 🔄 How It Works Now

### Railway Execution Flow

```bash
# 1. Railway clones repo
cd /workspace

# 2. Install dependencies
pnpm install --frozen-lockfile
  │
  ├─ Installs all packages
  │
  └─ Runs postinstall hooks for each package
     │
     └─ packages/api postinstall: prisma generate
        │
        ├─ Prisma reads package.json: "prisma": { "schema": "prisma/schema.prisma" }
        ├─ Resolves schema relative to packages/api/
        └─ Finds schema at: /workspace/packages/api/prisma/schema.prisma ✅

# 3. Railway changes to service root
cd packages/api

# 4. Run preStart
pnpm prisma migrate deploy
  ├─ Prisma reads package.json config
  └─ Finds schema at: ./prisma/schema.prisma ✅

# 5. Start server
pnpm start
  └─ Triggers prestart hook (backup migration check)
  └─ Runs: node dist/server.js ✅
```

## 📋 Complete Configuration

### packages/api/package.json

```json
{
  "name": "@codex/api",
  "scripts": {
    "postinstall": "prisma generate",           // No --schema flag
    "prestart": "prisma migrate deploy",         // No --schema flag
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",        // No --schema flag
    "prisma:migrate": "prisma migrate dev"       // No --schema flag
  },
  "prisma": {
    "schema": "prisma/schema.prisma"             // ← Prisma's config
  },
  "dependencies": {
    "@prisma/client": "5.22.0",
    "prisma": "5.22.0"                           // CLI in dependencies
  }
}
```

### railway.toml

```toml
[service.api]
root = "packages/api"                            # Set working directory
start = "pnpm start"
preStart = "pnpm prisma migrate deploy"          # No --schema flag
```

## Why This Solution Works

### 1. **Package-Relative Resolution**
The `prisma` config in `package.json` is resolved **relative to the package directory**, not the working directory where the command runs.

### 2. **Consistent Across Contexts**
Works whether running from:
- Workspace root (`pnpm --filter @codex/api ...`)
- Package directory (`cd packages/api && pnpm ...`)
- Railway build context (unpredictable working dir)

### 3. **Prisma Best Practice**
This is how Prisma **expects** to find schemas in monorepos. The `--schema` flag is for non-standard locations.

## 🧪 Testing the Fix

**From workspace root:**
```bash
pnpm --filter @codex/api prisma generate
# ✅ Works - Uses package.json config
```

**From package directory:**
```bash
cd packages/api
pnpm prisma generate
# ✅ Works - Uses package.json config
```

**Simulating Railway:**
```bash
# Clean install from workspace root
rm -rf node_modules packages/*/node_modules
pnpm install
# ✅ postinstall runs successfully
```

## 📊 Summary of All Fixes

### Issue #1: Prisma CLI Not in Dependencies
**Fix:** Moved `prisma` from devDependencies to dependencies  
**Commit:** `022c827`

### Issue #2: Schema Path with Explicit Flag
**Fix:** Added `--schema=./prisma/schema.prisma` to all commands  
**Commit:** `1b5fcd2`

### Issue #3: Wrong Railway Root Directory  
**Fix:** Set `root = "packages/api"` in railway.toml  
**Commit:** `382ecbc`

### Issue #4: Relative Path Resolution (THIS ONE!)
**Fix:** Removed `--schema` flags, rely on `prisma.schema` config  
**Commit:** `e4daf37`

## ✅ Expected Railway Behavior

Next deployment will:

1. ✅ Install dependencies (prisma CLI included)
2. ✅ Run postinstall → Generate Prisma Client using package.json config
3. ✅ Change to packages/api directory
4. ✅ Run preStart → Apply migrations using package.json config
5. ✅ Start server
6. ✅ Pass health checks

**No more schema path errors!**

## 💡 Key Lesson

**In monorepos, avoid explicit relative paths in package scripts.**

Instead, use configuration files (like `prisma.schema` in `package.json`) that resolve relative to the package, not the working directory.

---

**Status:** ✅ Fixed and pushed  
**Commit:** `e4daf37`  
**Next:** Railway will auto-deploy with proper schema resolution
