# 🔍 DEPLOYMENT MONITORING GUIDE

## 📺 Where to Watch

### **Primary Monitoring Locations:**

1. **🎬 Main Actions Dashboard**
   ```
   https://github.com/rennai455/pos-imagration-service-/actions
   ```
   Shows all workflows and their status

2. **🚀 CD Workflow (Continuous Delivery)**
   ```
   https://github.com/rennai455/pos-imagration-service-/actions/workflows/cd.yml
   ```
   Filtered view of just deployment runs

3. **🔨 CI Workflow (Continuous Integration)**
   ```
   https://github.com/rennai455/pos-imagration-service-/actions/workflows/ci.yml
   ```
   Build and test runs

4. **📦 Container Packages**
   ```
   https://github.com/rennai455/pos-imagration-service-/pkgs/container/pos-imagration-service-
   ```
   See built Docker images

---

## 🎯 What to Watch For

### **CD Workflow Stages:**

#### 1️⃣ **Build and Push Image** (3-5 minutes)
**Status Indicators:**
- 🟡 Yellow spinner = Running
- ✅ Green checkmark = Success
- ❌ Red X = Failed

**What's Happening:**
```
Setting up Docker Buildx
Building for linux/amd64,linux/arm64
Pushing to ghcr.io/rennai455/pos-imagration-service-
Generating image tags:
  - v0.1.0-staging
  - sha-<commit-hash>
  - latest (if main branch)
```

**Click into job to see:**
- Build logs (real-time)
- Layer caching status
- Push progress

#### 2️⃣ **Load Test Gate** (30 seconds - 2 minutes)
**Triggers:** Only on tag push (like v0.1.0-staging)

**What's Happening:**
```
Checking out code
Running: node scripts/dedup-loadtest.mjs
  --url $STAGING_URL
  --total 100
  --unique 50
Validating: node scripts/check-loadtest-result.mjs
```

**Expected Results:**
- ✅ Success: `{"total":100,"duplicates":50,"success":100,"other":0}`
- ❌ Failure: If STAGING_URL not set or unreachable

#### 3️⃣ **Deploy Staging** (Skipped for tags)
**Triggers:** Only on push to main branch (not tags)

**Why Skipped:**
You pushed a tag (`v0.1.0-staging`), not a branch update.

#### 4️⃣ **Deploy Production** (Blocked)
**Triggers:** Only on tags starting with `v`
**Requirements:**
- Load test must pass
- Manual approval in GitHub environment protection

---

## 📊 Real-Time Monitoring

### **In GitHub Actions UI, You'll See:**

```
┌─────────────────────────────────────────┐
│ Continuous Delivery                     │
│ Run #X • v0.1.0-staging                 │
├─────────────────────────────────────────┤
│ 🔨 Build and Push Image                 │
│    └─ 🟡 In progress... (2m 13s)        │
│                                         │
│ 🧪 Load Test Gate (tags)                │
│    └─ ⏸️ Waiting for build...           │
│                                         │
│ 📦 Deploy to Staging                    │
│    └─ ⊘ Skipped (tag push)              │
│                                         │
│ 🚀 Deploy to Production                 │
│    └─ ⏸️ Blocked (needs load test)      │
└─────────────────────────────────────────┘
```

### **Click on "Build and Push Image" to See:**

**Step-by-step progress:**
```
✅ Set up job
✅ Run actions/checkout@v4
✅ Run docker/setup-buildx-action@v3
✅ Run docker/login-action@v3
🟡 Run docker/metadata-action@v5
🟡 Run docker/build-push-action@v6
   ├─ #1 [internal] load build definition
   ├─ #2 [internal] load metadata
   ├─ #3 [linux/amd64 1/5] FROM node:20-alpine
   ├─ #4 [linux/arm64 1/5] FROM node:20-alpine
   └─ #5 [linux/amd64 2/5] RUN corepack enable...
```

---

## 🔔 Success Indicators

### **✅ Build Success:**
You should see:
```
Successfully pushed 
ghcr.io/rennai455/pos-imagration-service-:v0.1.0-staging
```

**Then check Packages tab:**
- New image appears with tag `v0.1.0-staging`
- Digest shown (sha256:xxx...)
- Manifest for both amd64 and arm64

### **⚠️ Load Test Expected Failure:**
```
Error: STAGING_URL is not defined
```
This is **expected** because we haven't configured the GitHub variable yet.

---

## 🛠️ If Build Fails

### **Common Issues:**

**1. Dockerfile Error**
```
ERROR [linux/amd64 3/5] RUN pnpm install
```
**Fix:** Check Dockerfile syntax, package.json validity

**2. Permission Error**
```
ERROR: failed to push: unauthorized
```
**Fix:** Check GITHUB_TOKEN permissions in workflow

**3. Timeout**
```
Error: The operation was canceled.
```
**Fix:** Increase timeout or check network issues

### **Debugging:**
Click into the failed step → See full logs → Search for "ERROR"

---

## 📦 After Successful Build

### **Verify Image Published:**

1. Go to: https://github.com/rennai455?tab=packages
2. Look for: `pos-imagration-service-`
3. Click on it
4. You should see:
   - Tag: `v0.1.0-staging`
   - Size: ~XX MB
   - Pushed: Just now
   - Platforms: linux/amd64, linux/arm64

### **Pull and Test Locally:**
```powershell
# Pull the built image
docker pull ghcr.io/rennai455/pos-imagration-service-:v0.1.0-staging

# Verify it works
docker run --rm -p 4000:4000 `
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/codex_pos_dev" `
  -e WEBHOOK_SECRET="test-secret-key-at-least-32-characters-long" `
  ghcr.io/rennai455/pos-imagration-service-:v0.1.0-staging
```

---

## 🎬 Live Monitoring Commands

### **PowerShell Terminal Commands:**

```powershell
# Open all monitoring pages
Start-Process "https://github.com/rennai455/pos-imagration-service-/actions"
Start-Process "https://github.com/rennai455/pos-imagration-service-/actions/workflows/cd.yml"
Start-Process "https://github.com/rennai455/pos-imagration-service-/pkgs/container/pos-imagration-service-"

# Check latest run status via GitHub CLI (if installed)
gh run list --workflow=cd.yml --limit 1

# Watch logs in real-time
gh run watch
```

---

## ⏱️ Expected Timeline

| Stage | Duration | Status |
|-------|----------|--------|
| Trigger (tag push) | Instant | ✅ Done |
| Queue | 5-30s | 🟡 May vary |
| Setup job | 10-20s | Fast |
| Checkout code | 5-10s | Fast |
| Docker setup | 10-15s | Fast |
| **Build multi-platform** | **2-4 min** | **Slowest** |
| Push to GHCR | 20-40s | Network dependent |
| Load test | 30-60s | Will fail (no URL) |
| **Total** | **3-6 min** | **Typical** |

---

## 🎯 What Success Looks Like

### **Perfect Run:**
```
✅ Build and Push Image (3m 24s)
   └─ Successfully pushed to ghcr.io
   └─ Image digest: sha256:abc123...
   └─ Tags: v0.1.0-staging, sha-f754d12...

❌ Load Test Gate (12s)
   └─ Error: STAGING_URL not configured
   └─ This is EXPECTED - we haven't deployed yet

⊘ Deploy to Staging (skipped)
   └─ Condition not met (tag push, not branch)

⊘ Deploy to Production (skipped)
   └─ Blocked by load test failure
```

**Verdict:** ✅ **BUILD SUCCESS** (load test failure is expected)

---

## 🚀 After Build Completes

### **Next Steps:**

**Option A: Test Locally**
```powershell
docker pull ghcr.io/rennai455/pos-imagration-service-:v0.1.0-staging
# Then run with docker run (see commands above)
```

**Option B: Deploy to Fly.io**
```powershell
flyctl launch --image ghcr.io/rennai455/pos-imagration-service-:v0.1.0-staging
```

**Option C: Configure CD and Redeploy**
1. Choose hosting provider
2. Add STAGING_URL to GitHub repo variables
3. Add WEBHOOK_SECRET to GitHub secrets
4. Update CD workflow deploy commands
5. Re-tag: `git tag -f v0.1.0-staging && git push --tags --force`

---

## 📱 Mobile Monitoring

If you want to watch on phone:
1. Install GitHub Mobile app
2. Navigate to: Actions → Continuous Delivery
3. Get push notifications when workflow completes

---

**🎬 START WATCHING NOW:**

Primary URL: https://github.com/rennai455/pos-imagration-service-/actions

Look for the newest run with tag `v0.1.0-staging` 🚀
