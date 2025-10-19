# Codex Retail OS — Next Steps & Instructions (Phase 4.5 → 5)

**Project owner:** Renn
**Context:** Captured post–Phase 4.5 (Expo Go readiness)

---

## 1) Server-Side: Do-Now Checklist (Critical Path)

**Goal:** Lock in reliability + deployment hygiene before Phase 5 automation.

### ✅ Run & Validate Core Services

* [ ] **API**: `pnpm run dev --filter @codex/api` (Fastify on `0.0.0.0:4000`)
  * Confirm health route (e.g., `/healthz`) and version header.
* [ ] **Prisma**: `pnpm prisma migrate deploy --filter @codex/db`
  * Add **automated migrations** to CI/boot (see §6.1).
* [ ] **SQLite/Prisma client** (for local scripts): verify CRUD + index coverage.
* [ ] **Build/lint monorepo**: `pnpm -r build && pnpm -r lint`
  * Ensure type-safety across packages (no `any` escapes in boundary layers).

### 🔒 Security & Tenancy

* [ ] Swap **AsyncStorage → expo-secure-store** (SDK) for token persistence.
* [ ] Audit JWT scopes/expiry; rotate Supabase service keys in `.env` (dev vs prod).
* [ ] CORS policy: permissive in dev, strict origin allowlist in staging/prod.

### 🧪 Reliability & Data Safety

* [ ] **Exponential backoff** on API calls (client + SDK) with jitter.
* [ ] **Schema versioning**: manage `PRAGMA user_version` with migration steps.
* [ ] **Conflict resolution**: use `updatedAt` + last-writer-wins **only** with server-side audit trail; log divergences.
* [ ] **E2E smoke** (Cypress/Playwright): offline/online flows, session restore, sync retry.

### 🧰 Developer Ergonomics

* [ ] Add `.npmrc`: `registry=https://registry.npmjs.org/` (proxy issues)
* [ ] Add `"start:expo:clean": "expo start -c"` script for Metro resets.
* [ ] Make `EXPO_PUBLIC_API_URL` the single source for SDK base URL in dev.

**Honest risk callout:** Until backoff, schema versioning, and token security land, a flaky network or app update can corrupt local caches or leak tokens in shared devices. Treat these as **release blockers** for any pilot.

---

## 2) SDK (Expo) Preflight Setup

### Install & Verify

```bash
pnpm install --filter @codex/sdk
pnpm --filter @codex/sdk tsc -p .
```

* Ensure **no missing native modules**: `expo-barcode-scanner`, `expo-sqlite`, `@react-native-community/netinfo`, `expo-secure-store`.
* Run Metro (Codespaces tunnel):

```bash
npx expo start --tunnel --filter @codex/sdk
```

* In `.env` (SDK app):

```
EXPO_PUBLIC_API_URL=https://<codespace-name>-4000.app.github.dev
```

### Critical SDK Behaviors to Validate

* **Offline-first**: enqueue writes, replay on reconnect (with backoff).
* **Barcode scan**: UI latency < 150ms; debounce duplicate scans.
* **Session**: token refresh under airplane mode → reconnect path.
* **Background sync**: `expo-task-manager` + `expo-background-fetch` (idempotent jobs).

**Honest risk callout:** Background tasks are often killed by OS; design for **eventually consistent** sync, not guaranteed periodicity. Log every run + duration.

---

## 3) What Will Not Work in Codespaces (and Realistic Workarounds)

| Function                         | Why It Won't Work        | Workaround                    |
| -------------------------------- | ------------------------ | ----------------------------- |
| Barcode / camera                 | No camera device layer   | Test on phone via **Expo Go** |
| SQLite persistence               | No stable native storage | Mock in dev; verify on device |
| Background tasks / notifications | Requires device daemons  | Device-only testing           |
| Wi‑Fi/Bluetooth scanning         | Requires hardware stack  | Device-only testing           |

**Developer loop:** Codespaces for code/automation; device for sensors/storage. Anything sensor-bound is **device-orchestrated**.

---

## 4) Hybrid Workflow (Recommended)

1. **Codespaces:** code, install, commit, run API `:4000` and Metro `:8081` via tunnel.
2. **Expo Go on phone:** scan QR from tunnel output.
3. **Backend link:** use Codespace domain in `.env` → global reach.

**Ports to expose:** `4000` (API) and `8081` (Metro). Ensure visibility in Codespaces.

---

## 5) Critical Gotchas & Fixes

### 5.1 CORS (dev vs prod)

```ts
server.register(require('@fastify/cors'), {
  origin: process.env.NODE_ENV === 'development' ? true : [/\.yourdomain\.com$/],
  credentials: true,
});
```

**Note:** Validate preflight (`OPTIONS`) handling for barcode upload endpoints.

### 5.2 Expo Go Networking

* Fastify must bind to `0.0.0.0`.
* Prefer `--lan` on local Wi‑Fi, `--tunnel` in Codespaces.

### 5.3 Package Registry / Proxy

* `.npmrc` with public registry to avoid corporate/proxy PNPM stalls.

### 5.4 Env Surfacing

* Use `EXPO_PUBLIC_*` for any var the app must read in **Expo Go**.

---

## 6) Phase 5 – Deployment & Automation (Actionable Plan)

**Target:** 9.5/10 readiness; "push-to-preview" + "one-command deploy".

### 6.1 CI/CD (GitHub Actions)

* Job: lint → test → build → **EAS preview** (SDK) + Next.js preview (admin).
* Add step: `prisma migrate deploy` on API start; fail-fast on drift.
* Cache PNPM + Turbo to keep CI < 8m.

### 6.2 `codex deploy <store>` CLI

* Provisions: Supabase project (DB + RLS seeds), storage buckets, Stripe products, Vercel app (admin), API service URL wiring.
* Idempotency: re-run safe; no double-seeding.
* Output: admin URL + store URL + API key.

### 6.3 Versioning & Releases

* `semantic-release` with conventional commits → **auto tags/changelogs**.
* Canary channel for SDK via EAS updates.

### 6.4 Monitoring & Logs

* Rollbar/Sentry for admin + SDK; Supabase **log streaming** into a "monitoring" schema.
* API structured logging (request id, tenant id, duration, retry count).

### 6.5 Background Sync (Productionizing)

* `expo-task-manager` + `expo-background-fetch` with **server-driven backoff** window (config endpoint returns minInterval).
* Guardrails: kill switch via remote config; cap job time; dedupe by **job run id**.

### 6.6 Data Safety

* Local migration: bump `user_version`, run adapters to reshape tables; verify counts before/after.
* Server reconciliation route: `POST /sync/diagnose` to return server truth for suspect items.

**Exit criteria for Phase 5:**

* [ ] Green CI on PRs (lint, tests, build, EAS/Next previews).
* [ ] One-command `codex deploy` provisions a new tenant end-to-end in < 10 min (non-blocking scripts).
* [ ] Background sync runs reliably with jitter/backoff; telemetry proves runs & reconciliations.
* [ ] Secure token storage on device; no tokens in AsyncStorage.
* [ ] E2E suite validates offline → online flows.

---

## 7) Ideal Test Flow (Human-in-the-Loop)

**Tab A (API):**

```bash
pnpm run dev --filter @codex/api
```

**Tab B (Expo):**

```bash
npx expo start --tunnel --filter @codex/sdk
```

**Then:**

* Open Expo Go → scan QR → app opens.
* Log in, scan 3–5 items (happy path + duplicates).
* Toggle airplane mode → create edits → reconnect → confirm sync + conflict strategy.
* Kill app → relaunch → confirm session + cache integrity.

---

## 8) Brutally Honest Gaps (Blockers Before Paid Pilots)

1. **Background sync not productionized** → manual-only sync is not acceptable for staff workflows.
2. **Token security** not hardened on device → liability in shared-retail settings.
3. **Offline schema upgrades** lack migration adapters → risk of silent data loss.
4. **No backoff** → transient outages will cascade into 429/5xx storms.
5. **Missing E2E device tests** → regressions likely in camera/sync/rehydration.

**Recommendation:** Treat the above as **must-fix** before onboarding any external store.

---

## 9) Acceptance Checklist (Per Tenant Launch)

* [ ] `codex deploy <store>` succeeded; URLs + keys recorded.
* [ ] Admin can CRUD inventory; SDK can scan and sync same inventory.
* [ ] Stripe test charges succeed; webhooks processed.
* [ ] Monitoring receiving errors + traces; alert channel wired.
* [ ] Recovery drill: simulate server outage + reconnection → no data loss.

---

## 10) Owner & RACI (Lightweight)

* **Owner:** Renn
* **Approver:** @dallas
* **Contributors:** API (backend), Admin (web), SDK (mobile)
* **Informed:** Investor stakeholders (weekly digest)

---

### Appendix A — Quick Commands

```bash
# API
pnpm run dev --filter @codex/api

# Migrations
pnpm --filter @codex/db prisma migrate deploy

# Expo (Codespaces)
npx expo start --tunnel --filter @codex/sdk

# Clean Metro cache
pnpm --filter @codex/sdk run start:expo:clean
```

### Appendix B — Env Patterns

```
EXPO_PUBLIC_API_URL=...
NEXT_PUBLIC_API_URL=...
# Never expose secrets via EXPO_PUBLIC_* or NEXT_PUBLIC_*
```

---

**Bottom line:** You are close to "deployable platform." Convert the remaining **operational risks** into code (backoff, migrations, background jobs, token security) before running paid pilots. This is where reliability beats feature breadth.