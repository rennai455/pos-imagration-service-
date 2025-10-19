# Redis Migration Plan - Multi-Replica Scaling

**Status**: 📋 Planning Phase  
**Priority**: P1 (Required for production scaling)  
**Effort**: 6-8 hours  
**Risk**: Medium

---

## Problem Statement

Current limitations blocking multi-replica deployment:
1. **Rate Limiter**: In-memory only, not coordinated across replicas
2. **Circuit Breaker**: Per-instance state, no cross-replica coordination
3. **Scaling Impact**: N replicas = N × rate limit (unacceptable)

---

## Solution Overview

Implement **Redis-backed distributed state** for:
- Rate limiting (sliding window algorithm)
- Circuit breaker state (failure counts, open/closed status)
- Idempotency cache (optional optimization)

---

## Architecture

### Current (In-Memory)
```
┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │
│  Rate: 100  │     │  Rate: 100  │
│  Breaker: ✓ │     │  Breaker: ✓ │
└─────────────┘     └─────────────┘
    ↓ 100 req           ↓ 100 req
Total: 200 req (WRONG - should be 100)
```

### Target (Redis)
```
┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────┬───────────┘
               ↓
       ┌──────────────┐
       │    Redis     │
       │  Rate: 100   │
       │  Breaker: ✓  │
       └──────────────┘
Total: 100 req (CORRECT - shared limit)
```

---

## Implementation Plan

### Phase 1: Redis Setup (1 hour)

#### 1.1 Add Redis Dependency
```bash
cd packages/api
pnpm add ioredis
pnpm add -D @types/ioredis
```

#### 1.2 Create Redis Client
```typescript
// packages/api/src/lib/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Reconnect on readonly errors
    }
    return false;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export default redis;
```

#### 1.3 Add Environment Variable
```bash
REDIS_URL=redis://localhost:6379
# Or for production:
REDIS_URL=redis://:password@host:6379
```

---

### Phase 2: Distributed Rate Limiter (2 hours)

#### 2.1 Implement Sliding Window Algorithm
```typescript
// packages/api/src/utils/redis-rate-limiter.ts
import redis from '../lib/redis';

export class RedisRateLimiter {
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  async isAllowed(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redisKey = `ratelimit:${key}`;

    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();
    
    // Remove old entries outside window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    
    // Count requests in current window
    pipeline.zcard(redisKey);
    
    // Add current request with timestamp
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(redisKey, Math.ceil(this.windowMs / 1000));
    
    const results = await pipeline.exec();
    
    // Extract count (results[1] is zcard result)
    const count = results?.[1]?.[1] as number || 0;
    
    const allowed = count < this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count - 1);
    const resetAt = now + this.windowMs;
    
    return { allowed, remaining, resetAt };
  }

  async getRemainingRequests(key: string): Promise<number> {
    const result = await this.isAllowed(key);
    return result.remaining;
  }
}
```

#### 2.2 Update Middleware
```typescript
// packages/api/src/utils/middleware.ts
import { RedisRateLimiter } from './redis-rate-limiter';

// Replace in-memory rate limiter
const rateLimiter = new RedisRateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX || "100"),
  parseInt(process.env.RATE_LIMIT_WINDOW || "60000")
);

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (request as any).tenantId || 'anonymous';
  const key = `${tenantId}:${request.ip}`;

  const result = await rateLimiter.isAllowed(key);
  
  // Add rate limit headers
  reply.header('X-RateLimit-Limit', process.env.RATE_LIMIT_MAX || "100");
  reply.header('X-RateLimit-Remaining', result.remaining.toString());
  reply.header('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString());

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    reply.header('Retry-After', retryAfter.toString());
    
    const error: any = new Error('Rate limit exceeded. Please try again later.');
    error.statusCode = 429;
    throw error;
  }
}
```

---

### Phase 3: Distributed Circuit Breaker (2 hours)

#### 3.1 Implement Redis-Backed Circuit Breaker
```typescript
// packages/api/src/utils/redis-circuit-breaker.ts
import redis from '../lib/redis';

export class RedisCircuitBreaker {
  private readonly keyPrefix: string;

  constructor(
    private readonly name: string,
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly resetTimeout: number = 30000
  ) {
    this.keyPrefix = `circuit:${name}`;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.getState();
    
    if (state === 'OPEN') {
      const lastFailureTime = await redis.get(`${this.keyPrefix}:last_failure`);
      const elapsed = Date.now() - parseInt(lastFailureTime || '0');
      
      if (elapsed >= this.resetTimeout) {
        await redis.set(`${this.keyPrefix}:state`, 'HALF_OPEN');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      await this.onSuccess();
      return result;
    } catch (error) {
      await this.onFailure();
      throw error;
    }
  }

  private async getState(): Promise<'CLOSED' | 'OPEN' | 'HALF_OPEN'> {
    const state = await redis.get(`${this.keyPrefix}:state`);
    return (state as any) || 'CLOSED';
  }

  private async onSuccess(): Promise<void> {
    await redis.set(`${this.keyPrefix}:failures`, '0');
    await redis.set(`${this.keyPrefix}:state`, 'CLOSED');
  }

  private async onFailure(): Promise<void> {
    const failures = await redis.incr(`${this.keyPrefix}:failures`);
    await redis.set(`${this.keyPrefix}:last_failure`, Date.now().toString());
    
    if (failures >= this.threshold) {
      await redis.set(`${this.keyPrefix}:state`, 'OPEN');
    }
    
    // Expire failure count after timeout
    await redis.expire(`${this.keyPrefix}:failures`, Math.ceil(this.timeout / 1000));
  }
}
```

#### 3.2 Update Reliability Module
```typescript
// packages/api/src/utils/reliability.ts
import { RedisCircuitBreaker } from './redis-circuit-breaker';

// Replace in-memory circuit breaker
export function createCircuitBreaker(name: string) {
  return new RedisCircuitBreaker(name);
}
```

---

### Phase 4: Testing (2 hours)

#### 4.1 Unit Tests
```typescript
// packages/api/tests/redis-rate-limiter.test.ts
import { RedisRateLimiter } from '../src/utils/redis-rate-limiter';

describe('RedisRateLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = new RedisRateLimiter(10, 60000);
    const result = await limiter.isAllowed('test-key');
    expect(result.allowed).toBe(true);
  });

  it('should block requests over limit', async () => {
    const limiter = new RedisRateLimiter(2, 60000);
    await limiter.isAllowed('test-key-2');
    await limiter.isAllowed('test-key-2');
    const result = await limiter.isAllowed('test-key-2');
    expect(result.allowed).toBe(false);
  });

  it('should reset after window expires', async () => {
    const limiter = new RedisRateLimiter(1, 100); // 100ms window
    await limiter.isAllowed('test-key-3');
    await new Promise(resolve => setTimeout(resolve, 150));
    const result = await limiter.isAllowed('test-key-3');
    expect(result.allowed).toBe(true);
  });
});
```

#### 4.2 Integration Test
```bash
# Start Redis locally
docker run -d -p 6379:6379 redis:7-alpine

# Run multi-replica test
REDIS_URL=redis://localhost:6379 pnpm test:integration
```

#### 4.3 Load Test with Multiple Replicas
```bash
# Start 3 replicas
PORT=4001 REDIS_URL=redis://localhost:6379 pnpm start &
PORT=4002 REDIS_URL=redis://localhost:6379 pnpm start &
PORT=4003 REDIS_URL=redis://localhost:6379 pnpm start &

# Load balance across replicas
for i in {1..300}; do
  PORT=$((4001 + ($i % 3)))
  curl http://localhost:$PORT/api/health &
done
wait

# Verify rate limit enforced globally
redis-cli zcard "ratelimit:default:127.0.0.1"
# Should be ≤ 100 (not 300)
```

---

### Phase 5: Deployment (1 hour)

#### 5.1 Provision Redis
```bash
# Railway
railway add --service redis

# Fly.io
fly redis create pos-redis --org personal

# Or use managed service:
# - Upstash Redis (serverless, $0.20/100k requests)
# - Redis Cloud (free tier: 30MB)
# - AWS ElastiCache
```

#### 5.2 Update Environment Variables
```bash
# Staging
railway variables set REDIS_URL="redis://..." --environment staging

# Production
railway variables set REDIS_URL="redis://..." --environment production
```

#### 5.3 Scale to Multiple Replicas
```bash
# Railway
railway scale --replicas 3 --environment production

# Fly.io
fly scale count 3 --app pos-imagration-production
```

---

## Migration Strategy

### Option A: Blue-Green Deployment
1. Deploy new version with Redis to staging
2. Run load tests with 3 replicas
3. Verify metrics (rate limit global, circuit breaker coordinated)
4. Switch production traffic to new version
5. Monitor for 24h, rollback if issues

### Option B: Shadow Mode
1. Deploy with Redis but keep in-memory as primary
2. Log discrepancies between Redis and in-memory
3. Fix bugs, tune Redis performance
4. Flip flag to make Redis primary
5. Remove in-memory after 1 week

**Recommendation**: Option A (cleaner, less complexity)

---

## Rollback Plan

### If Redis fails
1. Scale back to single replica immediately
2. Revert to previous Docker image tag
3. Investigate Redis connection issues
4. Fix and redeploy

### If performance degrades
1. Check Redis latency: `redis-cli --latency`
2. Enable Redis pipelining (already in code)
3. Add local cache layer (optional)
4. Increase Redis connection pool

---

## Cost Estimates

### Redis Hosting
- **Upstash Redis**: $0.20/100k requests (~$10-20/month)
- **Redis Cloud**: Free tier (30MB) or $7/month (1GB)
- **Railway Redis**: ~$5/month
- **Fly.io Redis**: ~$1.94/month (256MB)

### Compute Scaling
- **3 replicas** (from 1): +$10-15/month
- **Total increase**: ~$15-30/month

**ROI**: Enables horizontal scaling, worth the cost for production.

---

## Success Criteria

- [ ] Rate limiter enforces global limit across all replicas
- [ ] Circuit breaker coordinates state across all replicas
- [ ] Load test passes with 3 replicas (P95 < 1s, no over-limit)
- [ ] Redis failover handled gracefully (falls back to allowing requests)
- [ ] Monitoring dashboards show Redis metrics
- [ ] Documentation updated with Redis setup instructions

---

## Timeline

| Phase | Duration | Blocking |
|-------|----------|----------|
| Redis Setup | 1 hour | - |
| Rate Limiter | 2 hours | Phase 1 |
| Circuit Breaker | 2 hours | Phase 1 |
| Testing | 2 hours | Phase 2, 3 |
| Deployment | 1 hour | Phase 4 |
| **Total** | **8 hours** | - |

Add 2 hours buffer for debugging/edge cases = **~10 hours total**

---

## Next Steps

1. **Schedule migration**: Allocate dedicated time block
2. **Provision Redis**: Set up staging Redis instance
3. **Implement Phase 1**: Redis client and connection
4. **Test locally**: Verify Redis connection works
5. **Continue phases**: Rate limiter → Circuit breaker → Testing → Deploy

---

**Status**: 📋 Ready to implement  
**Approval**: Pending stakeholder review  
**ETA**: ~2 working days

