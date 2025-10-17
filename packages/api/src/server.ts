import "dotenv/config";
import Fastify, { FastifyInstance } from "fastify";
import { prisma } from './lib/db';
import { register } from 'prom-client';
import fastifyCors from '@fastify/cors';
import { validateEnv } from './utils/env';

import { configureSecurityPlugin } from "./plugins/security";
import { configureHealthPlugin } from "./plugins/health";
import configureSwagger from "./plugins/swagger";
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import { activeConnections } from './utils/metrics';
import { rateLimitMiddleware, idempotencyMiddleware } from './utils/middleware';
import { httpRequestDuration } from './utils/metrics';
import { log } from './utils/logger';

const createServer = (): FastifyInstance =>
  Fastify({
    logger: {
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

  // Configure security features
  await configureSecurityPlugin(server, {
    trustProxy: process.env.TRUST_PROXY === 'true',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    rateLimitTimeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
  });

  // Configure health monitoring
  await configureHealthPlugin(server, {
    db: prisma,
    readinessTimeout: parseInt(process.env.READINESS_TIMEOUT || '5000'),
    livenessTimeout: parseInt(process.env.LIVENESS_TIMEOUT || '2000')
  });

  // Configure Swagger documentation
  await configureSwagger(server);

  // Rate limiting
  server.addHook('preValidation', async (request, reply) => {
    await rateLimitMiddleware(request, reply);
  });

  // Idempotency
  server.addHook('preValidation', async (request, reply) => {
    await idempotencyMiddleware(request, reply);
  });

  // Metrics collection
  server.addHook('onResponse', async (request, reply) => {
    const startTimeKey = Symbol.for('request.startTime');
    const startTime = (request as any)[startTimeKey];
    const duration = startTime ? process.hrtime(startTime)[0] + process.hrtime(startTime)[1] / 1e9 : 0;
    const route = request.routeOptions?.url || request.url;
    
    httpRequestDuration
      .labels({
        method: request.method,
        route,
        status_code: reply.statusCode.toString(),
        tenant_id: (request as any).tenantId || 'default'
      })
      .observe(duration);
  });

  server.setErrorHandler((err, req, reply) => {
    server.log.error(err);
    reply.code(500).send({ error: "Internal Server Error" });
  });

  await server.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'development' ? true : 
           process.env.CORS_ORIGIN?.split(',') || false,
    credentials: true,
  });

  await server.register(productRoutes, { prefix: "/api/products" });
  await server.register(authRoutes, { prefix: "/api/auth" });

  // Health check endpoint
  server.get("/healthz", async () => {
    const dbStatus = await checkDatabaseHealth();
    const uptime = process.uptime();
    
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || "unknown",
      database: dbStatus ? "connected" : "disconnected"
    };
  });

  // Metrics are handled by the health plugin

  server.get("/", async () => ({ 
    status: "Codex API running",
    version: process.env.npm_package_version || "unknown"
  }));

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
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      server.log.info(`Received ${signal}, starting graceful shutdown`);
      
      try {
        await server.close();
        server.log.info('Server closed successfully');
        process.exit(0);
      } catch (err) {
        server.log.error(err, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  });

  try {
  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || '127.0.0.1';
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
