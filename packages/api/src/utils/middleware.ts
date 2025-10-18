import type { FastifyRequest, FastifyReply } from "fastify";
import { generateIdempotencyKey, withIdempotency, RateLimiter } from "./reliability";

// Global rate limiter instance
const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX || "100"),
  parseInt(process.env.RATE_LIMIT_WINDOW || "900000")
);

// Idempotency middleware for POST/PUT/PATCH requests
export async function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const method = request.method.toLowerCase();
  
  // Only apply to state-changing operations
  if (!['post', 'put', 'patch'].includes(method)) {
    return;
  }

  // Get idempotency key from header or generate from request
  let idempotencyKey = request.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    // Generate key from tenant + route + body hash
    const tenantId = (request as any).tenantId || 'default';
    const route = request.routerPath || request.url;
    const bodyKey = generateIdempotencyKey({
      tenantId,
      route,
      method,
      body: request.body,
    });
    idempotencyKey = `auto-${bodyKey}`;
  }

  // Store the key for later use
  (request as any).idempotencyKey = idempotencyKey;
}

// Rate limiting middleware
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Use tenant ID + IP as the rate limit key
  const tenantId = (request as any).tenantId || 'anonymous';
  const key = `${tenantId}:${request.ip}`;

  // Add rate limit headers to both success and error responses
  const remaining = rateLimiter.getRemainingRequests(key);
  reply.header('X-RateLimit-Limit', process.env.RATE_LIMIT_MAX || "100");
  reply.header('X-RateLimit-Remaining', remaining.toString());

  if (!rateLimiter.isAllowed(key)) {
    reply.header('Retry-After', '900'); // 15 minutes in seconds
    const error: any = new Error('Rate limit exceeded. Please try again later.');
    error.statusCode = 429;
    throw error;
  }
}

// Wrapper function for applying idempotency to route handlers
export function withIdempotentHandler<T>(
  handler: () => Promise<T>
): (request: FastifyRequest) => Promise<T> {
  return async (request: FastifyRequest) => {
    const idempotencyKey = (request as any).idempotencyKey;
    
    if (idempotencyKey) {
      return withIdempotency(idempotencyKey, handler);
    }
    
    return handler();
  };
}

// Database query wrapper with retry logic
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  context: string = 'database_operation'
): Promise<T> {
  const { retry } = await import('./reliability');
  
  return retry(operation, {
    attempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    jitter: true,
  });
}

// HTTP client wrapper with circuit breaker and retry
export class ReliableHttpClient {
  private circuitBreaker: any;

  constructor() {
    // Import circuit breaker dynamically
    import('./reliability').then(({ CircuitBreaker }) => {
      this.circuitBreaker = new CircuitBreaker(5, 60000);
    });
  }

  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { retry, CircuitBreaker } = await import('./reliability');
    
    if (!this.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(5, 60000);
    }
    
    return this.circuitBreaker.execute(async () => {
      return retry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        } finally {
          clearTimeout(timeoutId);
        }
      }, {
        attempts: 3,
        baseDelay: 500,
        maxDelay: 2000,
        jitter: true,
      });
    });
  }

  getCircuitBreakerState(): string {
    return this.circuitBreaker?.getState() || 'UNKNOWN';
  }
}