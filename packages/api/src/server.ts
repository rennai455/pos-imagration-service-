// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv/config');
}

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from './lib/db';
import { validateEnv } from './utils/env';
import { register } from 'prom-client';

import { configureSecurityPlugin } from "./plugins/security";
import { configureHealthPlugin } from "./plugins/health";
import configureSwagger from "./plugins/swagger";
import productRoutes from "./routes/products";
import authRoutes from "./routes/auth";
import ingestRoutes from "./routes/ingest";
import { rateLimitMiddleware, idempotencyMiddleware } from './utils/middleware';
import { httpRequestDuration, activeConnections } from './utils/metrics';

const createServer = (): FastifyInstance =>
  Fastify({
    requestTimeout: Number(process.env.REQUEST_TIMEOUT_MS || 0) || undefined,
    connectionTimeout: Number(process.env.CONNECTION_TIMEOUT_MS || 0) || undefined,
    logger: {
      // Defensive redaction for common PII-bearing headers
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
              },
            }
          : undefined,
    },
  });

export const buildServer = async (): Promise<FastifyInstance> => {
  // Validate environment variables before doing anything else
  const env = validateEnv();
  
  const server = createServer();

  // Error handling is centralized later in this file

  let isDbConnected = false

  // Only try database connection in production
  if (process.env.NODE_ENV === 'production') {
    try {
      await prisma.$connect();
      isDbConnected = true;
    } catch (error) {
      server.log.error('Failed to connect to database: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  } else {
    // In test/development, assume connection works since we're likely mocking
    isDbConnected = true;
  }

  // Handle cleanup on close
  server.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // Configure metrics first (at root level)
  await server.register(require('./plugins/metrics').default);

  // Configure security and CORS
  await configureSecurityPlugin(server, {
    trustProxy: process.env.TRUST_PROXY === 'true',
    corsOrigin: process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'],
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    rateLimitTimeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
  });

  // Configure health monitoring (with /api prefix)
  await server.register(async (instance) => {
    await configureHealthPlugin(instance, {
      db: prisma,
      readinessTimeout: parseInt(process.env.READINESS_TIMEOUT || '5000'),
      livenessTimeout: parseInt(process.env.LIVENESS_TIMEOUT || '2000')
    });
  }, { prefix: '/api/health' });

  // Configure Swagger documentation
  await configureSwagger(server);



  // Idempotency
  server.addHook('preValidation', async (request, reply) => {
    await idempotencyMiddleware(request, reply);
  });

  // Track in-flight requests to aid graceful shutdown
  // CRITICAL: These must be synchronous to avoid race conditions
  let activeRequests = 0;
  server.addHook('onRequest', (request, reply, done) => { 
    activeRequests++; 
    done();
  });
  server.addHook('onResponse', (request, reply, done) => { 
    activeRequests = Math.max(0, activeRequests - 1);
    done();
  });

  // Test route for rate limiting tests
  if (process.env.NODE_ENV === 'test') {
    server.get('/test', async (request, reply) => {
      return { status: 'ok' };
    });
  }

  // Metrics collection
  server.addHook('onResponse', async (request, reply) => {
    const startTimeKey = Symbol.for('request.startTime');
    const startTime = (request as any)[startTimeKey];
    const duration = startTime ? process.hrtime(startTime)[0] + process.hrtime(startTime)[1] / 1e9 : 0;
    const route = request.routeOptions?.url || (request as any).routerPath || 'unknown';
    
    httpRequestDuration
      .labels({
        method: request.method,
        route,
        status_code: reply.statusCode.toString(),
        tenant_id: (request as any).tenantId || 'default'
      })
      .observe(duration);

    // Structured log for quick correlation
    try {
      const latencyMs = Math.round(duration * 1000);
      server.log.info({
        rid: (request as any).id || (request as any).req?.id,
        tenantId: (request as any).tenantId || 'default',
        version: process.env.npm_package_version || 'unknown',
        path: route,
        latency_ms: latencyMs,
        status: reply.statusCode,
      });
    } catch {}
  });

  // Lightweight root health endpoint used by deployment smoke tests
  server.get('/healthz', async (_req, reply) => {
    reply.send({
      status: 'ok',
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
    });
  });

  // Liveness probe - always returns 200 if process is alive
  server.get('/livez', async (_req, reply) => {
    reply.send({ status: 'ok' });
  });

  // Startup probe - used for cold start initialization gates
  // Returns 200 once initial setup is complete (DB connected, migrations OK)
  server.get('/startupz', async (_req, reply) => {
    const result: any = { status: 'ok', checks: {}, phase: 'startup' };
    
    try {
      // Check DB connectivity - critical for startup
      await prisma.$queryRaw`SELECT 1`;
      result.checks.db = 'connected';
    } catch (e) {
      result.checks.db = 'disconnected';
      result.status = 'fail';
      reply.code(503);
    }
    
    // Check required env vars
    result.checks.supabase = process.env.SUPABASE_URL ? 'configured' : 'missing';
    result.checks.database_url = process.env.DATABASE_URL ? 'configured' : 'missing';
    
    // Add uptime to show cold start progress
    result.uptime = process.uptime();
    
    if (result.status !== 'ok') {
      reply.code(503);
    }
    
    reply.send(result);
  });

  // Readiness probe for Railway health checks
  // Returns 200 when ready to receive traffic (DB connected)
  server.get('/health/ready', async (_req, reply) => {
    try {
      // 5-second timeout for DB check
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database check timeout')), 5000);
      });
      
      const dbCheck = prisma.$queryRaw`SELECT 1`;
      await Promise.race([dbCheck, timeoutPromise]);
      
      reply.send({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      reply.status(503).send({
        status: 'not ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Keep a single, comprehensive error handler
  // Preserve 429 responses from rate limiting and fall back appropriately
  server.setErrorHandler((error, request, reply) => {
    // Log the error for observability
    server.log.error(error);

    if (
      (error as any).statusCode === 429 ||
      (error as any).name === 'TooManyRequestsError' ||
      (typeof (error as any).message === 'string' && (error as any).message.toLowerCase().includes('rate limit'))
    ) {
      reply.status(429).send({
        error: 'Too Many Requests',
        message: (error as any).message || 'Rate limit exceeded. Please try again later.',
        statusCode: 429,
      });
      return;
    }

    const statusCode = (error as any).statusCode || 500;
    reply.status(statusCode).send({
      error: (error as any).name || 'Internal Server Error',
      message: (error as any).message || 'Internal Server Error',
      statusCode,
    });
  });

  // Register routes with their prefixes
  await server.register(productRoutes, { prefix: "/api/products" });
  await server.register(authRoutes, { prefix: "/api/auth" });
  await server.register(require('./routes/index').default, { prefix: '/api' });
  await server.register(ingestRoutes, { prefix: '/pos' });

  return server;
};

// Simple database health check
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // You can replace this with an actual database ping
    // For now, just return true
    return true;
  } catch (error) {
    return false;
  }
}

const start = async () => {
  const server = await buildServer();

  // Graceful shutdown handling
  const signals = ['SIGTERM', 'SIGINT'];
  
  let shuttingDown = false;
  signals.forEach(signal => {
    process.on(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.log.info(`Received ${signal}, starting graceful shutdown`);
      
      try {
        // Emit current metrics snapshot (useful for push-based collectors)
        try { 
          const metrics = await register.metrics();
          server.log.info({ metricsSize: metrics.length }, 'Metrics snapshot captured');
        } catch {}
        
        const graceMs = Number(process.env.SHUTDOWN_GRACE_MS || '15000');
        const closePromise = server.close().then(() => 'closed');
        const timeoutPromise = new Promise<string>((resolve) => 
          setTimeout(() => resolve('timeout'), graceMs)
        );
        
        const result = await Promise.race([closePromise, timeoutPromise]);
        
        if (result === 'timeout') {
          server.log.warn({ graceMs }, 'Graceful shutdown timed out, forcing exit');
        } else {
          server.log.info('Server closed successfully');
        }
        process.exit(0);
      } catch (err) {
        server.log.error(err, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  });

  try {
  const port = Number(process.env.PORT || 4000);
  const host = '0.0.0.0'; // Railway requires binding to 0.0.0.0
  await server.listen({ port, host });
    
    // Update active connections metric
    activeConnections.set(1);
    
  server.log.info(`Codex API running on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
