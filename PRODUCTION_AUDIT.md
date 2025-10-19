# Production Readiness Audit - pos-imagration-service
**Date**: October 19, 2025  
**Status**: 🔴 CRITICAL ISSUES FOUND - DO NOT DEPLOY

---

## 🚨 Critical Issues (P0 - Blocking)

### 1. **Unawaited Async in Hooks** - server.ts Lines 92-93, 99-100
```typescript
// BROKEN: onRequest/onResponse hooks not awaited
server.addHook('onRequest', async () => { activeRequests++; });
server.addHook('onResponse', async () => { activeRequests = Math.max(0, activeRequests - 1); });
```
**Impact**: Race conditions on shutdown, inaccurate metrics  
**Fix**: Synchronous increment or atomic counter

---

### 2. **Idempotency Not Enforced** - middleware.ts Lines 11-38
```typescript
// BROKEN: Key stored but never checked against DB
(request as any).idempotencyKey = idempotencyKey;
// NO enforcement of Prisma Idempotency model!
```
**Impact**: Duplicate writes will succeed, no deduplication  
**Fix**: Insert into `Idempotency` table, return 204 on conflict

---

### 3. **Metrics Double-Registration Risk** - metrics.ts Lines 58-62
```typescript
register.registerMetric(httpRequestDuration); // Already auto-registered by constructor
register.registerMetric(httpRequestTotal);    // Causes crash on HMR
```
**Impact**: Process crash on reload in dev, undefined behavior  
**Fix**: Remove explicit `registerMetric` calls (already in `registers: [register]`)

---

### 4. **Missing Dedup Metric** - metrics.ts
```typescript
// MISSING: ingest_dedup_total{tenant,source}
```
**Impact**: Cannot observe idempotency hit rate  
**Fix**: Add Counter `ingest_dedup_total`

---

### 5. **Health /ready Uses Wrong Timeout Logic** - health.ts Lines 85-94
```typescript
const timeout = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Database check timeout')), readinessTimeout)
})
const dbCheck = db.$queryRaw`SELECT 1`
await Promise.race([dbCheck, timeout]) // Timeout promise never cleaned up!
```
**Impact**: Timeout fires even after success, memory leak  
**Fix**: Use AbortController or clearTimeout

---

### 6. **Circuit Breaker Not Shared** - reliability.ts Line 73-104
```typescript
export class CircuitBreaker {
  private failures = 0; // Per-instance state
```
**Impact**: Each replica has independent state, no coordination  
**Fix**: Back with Redis/Supabase KV or document single-replica limitation

---

### 7. **Rate Limiter Not Distributed** - middleware.ts Lines 5-8
```typescript
const rateLimiter = new RateLimiter(...)  // In-memory only
```
**Impact**: Scaling to N replicas = N × rate limit  
**Fix**: Redis-backed or document single-replica limitation

---

### 8. **Shutdown Race Condition** - server.ts Lines 233-239
```typescript
await Promise.race([
  server.close(),
  new Promise((resolve) => setTimeout(resolve, graceMs))
])
// No check if timeout won or close won - exits either way
```
**Impact**: Connections may be dropped mid-flight  
**Fix**: Log which path resolved, emit metrics snapshot

---

### 9. **Build Info Registered Twice** - metrics.ts Lines 67-75
```typescript
export const buildInfo = g.__codexBuildInfo || new client.Gauge(...)
if (!g.__codexBuildInfo) {
  buildInfo.set({ version: ... }, 1)
  g.__codexBuildInfo = buildInfo
}
// Later: register.registerMetric(buildInfo) <- Already in registers!
```
**Impact**: Duplicate metric family error  
**Fix**: Remove line 93 `register.registerMetric(buildInfo)`

---

### 10. **No /startupz vs /ready Separation** - server.ts Lines 147-160
```typescript
server.get('/startupz', async (_req, reply) => {
  // Same as /ready but with 503 instead of proper lifecycle
})
```
**Impact**: CD gate polls wrong endpoint, cold start delays hidden  
**Fix**: `/startupz` should be initial gate, `/ready` for traffic

---

## ⚠️ High Priority Issues (P1 - Fix Before Prod)

### 11. **No db_query_duration_seconds Histograms**
- Declared in metrics.ts but never `.observe()`d
- Cannot tune query performance

### 12. **PII Redaction Incomplete**
- Only headers redacted, not query params or request bodies
- Add `redact: ['req.query', 'req.body.password']`

### 13. **Missing X-RateLimit-* Headers on Success**
- Only added in middleware, not in error handler path

### 14. **Unbounded Retry on 5xx**
- reliability.ts line 30: retries all 5xx forever
- Should have circuit breaker integration

### 15. **No Migration Status Check in CI**
- No `prisma migrate status` gate

---

## 📋 Acceptance Checklist Status

| Check | Status | Blocker? |
|-------|--------|----------|
| Prisma migrations applied | ❓ | No |
| Jest tests all green | ✅ | No |
| /health/ready returns 200 | ⚠️ Timeout bug | **YES** |
| Loadtest P95 ≤ 1.0s | ❌ Not run | **YES** |
| Metrics snapshot uploaded | ❌ | **YES** |
| Registry singleton validated | ❌ Double-reg bug | **YES** |
| Dedup counter visible | ❌ Missing | **YES** |
| SDK uses secure-store | ❓ | No |
| Redaction test passes | ❌ | **YES** |
| Distributed limiter live | ❌ In-memory only | **YES** |
| Docs footer matches version | ❓ | No |

---

## 🎯 Patch Order (Critical Path)

1. **Remove metrics double-registration** (5 min) - prevents crash
2. **Fix idempotency enforcement** (30 min) - core feature
3. **Add ingest_dedup_total metric** (5 min) - observability
4. **Fix async hook race conditions** (10 min) - correctness
5. **Fix /ready timeout cleanup** (15 min) - memory leak
6. **Add distributed rate limiter** (60 min) - scalability
7. **Create load test script** (45 min) - validation
8. **Add CI gates** (30 min) - automation
9. **Update documentation** (20 min) - handoff

**Total Estimated Time**: ~4 hours  
**Recommended**: Allocate 6 hours with testing buffer

---

## 📊 Risk Assessment

- **Current Risk Level**: 🔴 **HIGH** - Multiple correctness bugs
- **After Patches**: 🟡 **MEDIUM** - Single-replica limitations documented
- **Production Ready**: Requires Redis for multi-replica or single-replica deployment

---

