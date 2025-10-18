import { FastifyInstance } from "fastify";
import authRoutes from "../routes/auth";
import productRoutes from "../routes/products";
import { configureHealthPlugin } from "./health";
import configureMetricsPlugin from "./metrics";
import { configureSecurityPlugin } from "./security";
import configureSwaggerPlugin from "./swagger";
import { prisma } from "@codex/db";

interface ConfigureRouterOptions {
  trustProxy?: boolean;
  corsOrigin?: string[];
  rateLimitMax?: number;
  rateLimitTimeWindow?: number;
  readinessTimeout?: number;
  livenessTimeout?: number;
}

export async function configureRouter(server: FastifyInstance, options: ConfigureRouterOptions = {}): Promise<void> {
  // Register plugins first
  await server.register(configureMetricsPlugin); // Metrics at root level
  await server.register(configureSecurityPlugin, {
    trustProxy: options.trustProxy ?? false,
    corsOrigin: options.corsOrigin ?? ['http://localhost:3000'],
    rateLimitMax: options.rateLimitMax ?? 100,
    rateLimitTimeWindow: options.rateLimitTimeWindow ?? 60000
  });

  await server.register(async (healthServer) => {
    await configureHealthPlugin(healthServer, {
      db: prisma,
      readinessTimeout: options.readinessTimeout ?? 5000,
      livenessTimeout: options.livenessTimeout ?? 2000
    });
  }, { prefix: '/api/health' });

  await server.register(configureSwaggerPlugin);

  // Then register all routes
  await server.register(productRoutes, { prefix: '/api/products' });
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(async (app) => {
    app.get('/', async () => ({
      status: 'Codex API running',
      version: process.env.npm_package_version || 'unknown'
    }));
  }, { prefix: '/api' });
}