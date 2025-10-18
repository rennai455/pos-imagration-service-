# Phase 6 — Production Readiness Guide

Concise operational guidance to run, observe, scale, and recover the platform in production.

## Scope
- Resilience under redeploys and restarts
- Deep, actionable observability
- Health verification for auto-scaling
- Cost awareness and usage reporting
- Disaster recovery drills and backups
- Compliance and supply-chain hygiene

## Operational Hardening
- Graceful shutdown: SIGTERM/SIGINT drains connections and closes DB.
- Retries: decorrelated jitter for outbound calls (POS/Supabase).
- Idempotency: enforce (tenantId, key) uniqueness at DB level.
- Background retries: queue interface for async reprocessing (provider TBD).

## Observability
- Metrics: `/metrics` exposes build_info, HTTP, retry_attempts_total, ingest_latency_seconds.
- Logs: include rid, tenantId, version, path, latency_ms; route to your log sink.
- Dashboards: P50/P95 per tenant, retry and error budgets, throughput.
- Alerts: P95 > 1s (10m), 4xx/5xx > 2% (5m), no ingests (15m).

## Health & Scaling
- Endpoints:
  - `/startupz` checks DB (and notes Supabase presence)
  - `/livez` returns service responding
- CI health gate: poll `/livez` post-deploy until 200.
- Concurrency: set `REQUEST_TIMEOUT_MS`, `CONNECTION_TIMEOUT_MS`, `MAX_REQUESTS_PER_SOCKET` via env.

## Cost & Efficiency
- Metrics: DB connection count and durations.
- Usage: daily cron to write per-tenant snapshot (throughput, retries).
- Admin view: top tenants by throughput and compute minutes.

## DR & Runbooks
- Weekly rollback drill using rollback.yml.
- DB snapshots daily; verify restore.
- Runbooks:
  - [deploy](../infra/runbooks/deploy.md)
  - [rollback](../infra/runbooks/rollback.md)
  - [oncall](../infra/runbooks/oncall.md)
  - restore (infra/runbooks/restore.md)

## Compliance & Security
- Secrets in environment vaults.
- TLS-only; block mixed content.
- Rotate WEBHOOK_SECRET/API tokens quarterly.
- CI audit gate: high-severity vulnerabilities fail.

## Acceptance
- Uptime 99.9% (excl. deploys)
- P95 latency < 1s; error < 1%
- Rollback < 60s; RTO ≤ 15m
- Pilot onboarding < 10 minutes
- Validation Tag: v0.2.0

Validated at v0.2.0
