// Retry utility with exponential backoff and jitter
export interface RetryOptions {
  attempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean; // retained for compatibility
  labels?: { tenant?: string; service?: string };
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 5,
    baseDelay = 250,
    maxDelay = 5000,
    jitter = true,
    labels,
  } = options;

  let lastError: Error;
  // Decorrelated jitter base, see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
  let sleepMs = baseDelay;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === attempts) {
        throw lastError;
      }

      // Decorrelated jitter: sleep = min(maxDelay, random(baseDelay, sleepMs * 3))
      let delay = baseDelay;
      if (jitter) {
        const upper = Math.max(baseDelay, Math.min(maxDelay, sleepMs * 3));
        const lower = baseDelay;
        delay = Math.floor(lower + Math.random() * (upper - lower));
      } else {
        delay = Math.min(maxDelay, sleepMs * 2);
      }
      sleepMs = delay;

      console.log(
        `Retry attempt ${attempt}/${attempts} failed: ${lastError.message}. Retrying in ${Math.round(delay)}ms`
      );

      try {
        const { retryAttemptsTotal } = await import('./metrics');
        retryAttemptsTotal.inc({ tenant: labels?.tenant || 'unknown', service: labels?.service || 'generic' });
      } catch {}

      await sleep(delay);
    }
  }

  throw lastError!;
}

// Helper function for delays
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Circuit breaker implementation
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

// Idempotency key generation
export function generateIdempotencyKey(data: any): string {
  const crypto = require('crypto');
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Request deduplication store (in-memory for now)
const requestStore = new Map<string, { timestamp: number; result: any }>();
const DEDUP_TTL = 300000; // 5 minutes

export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check if we've seen this request before
  const existing = requestStore.get(key);
  if (existing && (Date.now() - existing.timestamp) < DEDUP_TTL) {
    return existing.result;
  }

  // Execute the function
  const result = await fn();

  // Store the result
  requestStore.set(key, {
    timestamp: Date.now(),
    result,
  });

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupExpiredEntries();
  }

  return result;
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of requestStore.entries()) {
    if (now - value.timestamp >= DEDUP_TTL) {
      requestStore.delete(key);
    }
  }
}

// Rate limiting utility
export class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 900000 // 15 minutes
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  getRemainingRequests(key: string): number {
    const requests = this.requests.get(key) || [];
    const now = Date.now();
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return Math.max(0, this.maxRequests - validRequests.length);
  }
}
