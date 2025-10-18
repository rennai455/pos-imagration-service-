# Phase 5 Prep Guide — From Verified → Pilot-Ready+

This guide turns a verified system into a pilot-ready platform with safe, observable deployments.

## Table of Contents
- [Step 1 — Define Scope & Readiness Goals](#step-1--define-scope--readiness-goals)
- [Step 2 — Verify Environments & Promotion Flow](#step-2--verify-environments--promotion-flow)
- [Step 3 — Implement Config Endpoint & Admin Flags](#step-3--implement-config-endpoint--admin-flags)
- [Step 4 — Observability & Alerts](#step-4--observability--alerts)
- [Step 5 — Validate Reliability & Security](#step-5--validate-reliability--security)
- [Step 6 — CI/CD Gating Checks](#step-6--cicd-gating-checks)
- [Step 7 — Runbooks & Disaster Recovery](#step-7--runbooks--disaster-recovery)
- [Step 8 — Reconciliation & Drift Detection](#step-8--reconciliation--drift-detection)
- [Step 9 — Pilot Onboarding Flow](#step-9--pilot-onboarding-flow)
- [Step 10 — Final Validation & Go/No-Go](#step-10--final-validation--gono-go)
- [Step 11 — Tag & Promote](#step-11--tag--promote)
- [Step 12 — Post-Launch Watch](#step-12--postlaunch-watch)

---

### Step 1 — Define Scope & Readiness Goals
**Purpose:** Lock scope and success criteria before changes.
**Actions:**
- Update `ROADMAP.md` with integrations, pilot objectives, and owners (API, SDK, Admin, CI/CD).
- Define SLOs:
  - P95 ingest latency < **1s**
  - Error rate < **1%/5m**
  - Background sync success > **98%/day**
- Freeze scope for Phase 5.
**✅ Output:** `ROADMAP.md` updated with “Phase 5 readiness” targets and owners.

### Step 2 — Verify Environments & Promotion Flow
**Purpose:** Ensure deploys are deterministic and reversible.
**Actions:**
- `staging` auto-deploys from `main`; `production` promotes from **tagged** releases (`v*`).
- Protect `production` environment (approval required).
- Confirm digest-pinned image deploys in `.github/workflows/cd.yml`.
**✅ Output:** Reproducible promotions, approval gate visible in GitHub Environments.

### Step 3 — Implement Config Endpoint & Admin Flags
**Purpose:** Runtime control of risky features.
**Actions:**
- Add `/config` (cache for 30s) returning:
  ```json
  { "syncEnabled": true, "minIntervalSec": 900, "retryCap": 3 }
  ```
- Admin page to edit flags (backed by DB/config table).
- SDK: read `/config` on startup; if `syncEnabled=false`, do not schedule background sync.
**✅ Output:** Flip flags from Admin; SDK behavior changes without redeploy.

### Step 4 — Observability & Alerts
**Purpose:** Detect issues before users feel them.
**Actions:**
- Import Grafana JSON: `infra/observability/grafana/codex-ingest-dashboard.json`.
- Hook Prometheus to `/metrics`.
- Alerts:
  - P95 ingest > 1s for 10m → page
  - 5xx/4xx rate > 2% (5m) → page
  - No ingests (15m, business hours) → warn
  - DLQ > 10 in 5m → warn
- Ensure logs carry `rid` + `tenantId`.
**✅ Output:** Dashboards live and alerts posting to your on-call channel.

### Step 5 — Validate Reliability & Security
**Purpose:** Harden before real store traffic.
**Actions:**
- Idempotency: unique `(tenantId,idempotencyKey)` + tests.
- Rate limiting: flood test returns 429s without error spikes.
- HMAC verifier: invalid signature → 401; add test.
- Graceful shutdown: SIGTERM → drain + close DB.
- RLS: cross-tenant read/write test returns 0.
**✅ Output:** All reliability/security tests green.

### Step 6 — CI/CD Gating Checks
**Purpose:** Enforce reliability before promotion.
**Actions:**
- Smoke gate runs after staging deploy:
  ```bash
  ./scripts/smoke.sh  # checks /healthz, /metrics, and signed ingest
  ```
- Load-test gate runs on tag:
  ```bash
  node scripts/dedup-loadtest.mjs --url "$STAGING_URL" --total 1000 --unique 200 --concurrency 50 --out result.json
  node scripts/check-loadtest-result.mjs result.json 1000 0.2
  ```
- Upload `/metrics` snapshot as CI artifact (baseline tracking).
**✅ Output:** Staging fails fast on smoke; production blocked unless load-test gate passes.

### Step 7 — Runbooks & Disaster Recovery
**Purpose:** Make recovery mechanical, not heroic.
**Actions:**
- [`infra/runbooks/deploy.md`](../infra/runbooks/deploy.md): exact deploy + verification steps.
- [`infra/runbooks/rollback.md`](../infra/runbooks/rollback.md): redeploy pinned digest (via `rollback.yml`).
- [`infra/runbooks/oncall.md`](../infra/runbooks/oncall.md): playbooks for latency spike, 5xx burst, webhook flood.
- Test rollback on staging (recover `/healthz` in < 60s).
**✅ Output:** Usable docs + proven rollback path.

### Step 8 — Reconciliation & Drift Detection
**Purpose:** Keep data honest over time.
**Actions:**
- Nightly job compares source → `events_enriched`.
- Alert if drift > 1%.
- Admin “Health” card showing drift % and last reconcile.
**✅ Output:** Continuous integrity checks with visible status.

### Step 9 — Pilot Onboarding Flow
**Purpose:** Onboard tenants in < 10 minutes.
**Actions:**
- Script or doc to provision tenant:
  - Supabase schema + RLS seeds
  - API key + config
  - (Optional) Stripe test products
  - SDK device/login setup
**✅ Output:** Repeatable, documented onboarding.

### Step 10 — Final Validation & Go/No-Go
**Purpose:** Prove stability under stress.
**Actions:**
- Manual stage validation:
  ```bash
  node scripts/dedup-loadtest.mjs --url "$STAGING_URL" --source demo --tenant t1 --total 2000 --unique 400 --concurrency 75 --out result.json
  node scripts/check-loadtest-result.mjs result.json 2000 0.2
  ```
- Watch Grafana: throughput, P95 latency, dedup ratios.
- Flip `syncEnabled=false` → SDK pauses sync live.
- Staging rollback drill → `/healthz` green again in < 60s.
**✅ Output:** Evidence of operational confidence captured (metrics + notes).

### Step 11 — Tag & Promote
**Purpose:** Cut and deploy a live release safely.
**Actions:**
- Tag release:
  ```bash
  git tag v0.1.0 && git push origin v0.1.0
  ```
- Pipeline: build/push → load-test gate → manual approval → prod promotion (digest-pinned).
- Post-deploy smoke runs on prod; archive metrics artifact.
**✅ Output:** `v0.1.0` live; parity with staging guaranteed.

### Step 12 — Post-Launch Watch
**Purpose:** Ensure stability and capture learnings.
**Actions:**
- Daily: review SLOs & error budget.
- Weekly: dedup outliers, reconcile reports, pilot feedback in `/docs/pilot-notes.md`.
- Plan next integration behind feature flags.
**✅ Output:** Phase 5 complete; ready to scale to Phase 6.

---

## Appendix A — Useful Commands
```bash
# Load test (CI-sized)
node scripts/dedup-loadtest.mjs --url "$STAGING_URL" --total 1000 --unique 200 --concurrency 50 --out result.json
node scripts/check-loadtest-result.mjs result.json 1000 0.2

# Load test (manual, larger)
node scripts/dedup-loadtest.mjs --url "$STAGING_URL" --total 2000 --unique 400 --concurrency 75 --out result.json
node scripts/check-loadtest-result.mjs result.json 2000 0.2

# Tag and promote
git tag v0.1.0 && git push origin v0.1.0

# Emergency rollback (example, provider command commented)
gh workflow run rollback.yml -f environment=production -f image_digest=sha256:YOUR_OLD_DIGEST
# flyctl deploy --image ghcr.io/ORG/REPO@sha256:YOUR_OLD_DIGEST --config infra/app/fly.prod.toml
# gcloud run deploy api --image=ghcr.io/ORG/REPO@sha256:YOUR_OLD_DIGEST --region=$GCLOUD_REGION
```

---

Validated at v0.2.0
