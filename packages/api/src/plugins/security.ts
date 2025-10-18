import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { RateLimitPluginOptions } from '@fastify/rate-limit'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'

type FastifyRequestWithUrl = FastifyRequest & { url: string }

class SecurityError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
    this.name = 'SecurityError'
  }
}
interface SecurityConfig {
  trustProxy?: boolean
  rateLimitMax?: number
  rateLimitTimeWindow?: number
  corsOrigin?: string | string[]
  contentSecurityPolicy?: boolean
}

const defaultConfig: SecurityConfig = {
  trustProxy: false,
  rateLimitMax: process.env.NODE_ENV === 'test' ? 1 : 100,
  rateLimitTimeWindow: process.env.NODE_ENV === 'test' ? 50 : 60 * 1000, // Much lower values in test
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
  contentSecurityPolicy: true
}

export async function configureSecurityPlugin(
  fastify: FastifyInstance,
  config: SecurityConfig = {}
): Promise<void> {
  const finalConfig = { ...defaultConfig, ...config }


  // Trust proxy if behind reverse proxy
  if (finalConfig.trustProxy) {
    fastify.addHook('onRequest', (request, _reply, done) => {
      const realIp = request.headers['x-forwarded-for'] as string;
      if (realIp) {
        (request.raw as any).ip = realIp;
      }
      done()
    })
  }

  // Configure CORS
  await fastify.register(fastifyCors, {
    origin: ['development', 'test'].includes(process.env.NODE_ENV || '') ? true : finalConfig.corsOrigin,
    credentials: true,
  })

  // Add security headers with custom config
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: finalConfig.contentSecurityPolicy,
    crossOriginEmbedderPolicy: false, // Required for Swagger UI
    crossOriginResourcePolicy: false, // Required for Swagger UI
    frameguard: false, // We'll add this manually
    xssFilter: true,
    hidePoweredBy: true,
    hsts: false // Let this be handled by the reverse proxy
  })

  // Add custom security headers
  fastify.addHook('onSend', (request, reply, payload, done) => {
    reply.header('X-Frame-Options', 'DENY')
    reply.header('X-XSS-Protection', '1; mode=block')
    done()
  })

  // Add route-specific configuration for health endpoints
  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url.startsWith('/api/health') || routeOptions.url === '/metrics') {
      routeOptions.config = { ...routeOptions.config, rateLimit: false }
    }
  })

  // Centralized error handling is configured at the server level

  // Configure global rate limiting (single registration)
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: process.env.NODE_ENV === 'test' ? 1 : finalConfig.rateLimitMax,
    timeWindow: process.env.NODE_ENV === 'test' ? 50 : finalConfig.rateLimitTimeWindow,
    keyGenerator: function(req) {
      // In test mode, use group header for isolation between test cases
      const group = req.headers['x-test-group']
      return process.env.NODE_ENV === 'test' && typeof group === 'string'
        ? group
        : req.ip
    },
    hook: 'onRequest',
    skipOnError: false,
    errorResponseBuilder: function(_req, _res) {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
      }
    }
  })

  // Add security hooks
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Add security headers
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('X-XSS-Protection', '1; mode=block')
    
    // Validate origin for CORS
    const origin = request.headers.origin
    if (origin && finalConfig.corsOrigin && !isValidOrigin(origin, finalConfig.corsOrigin)) {
      throw new SecurityError('Invalid origin', 403)
    }
  })

  // Centralized error handling is configured at the server level
}

function isValidOrigin(origin: string, allowedOrigins: string | string[]): boolean {
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(origin)
  }
  return allowedOrigins === '*' || allowedOrigins === origin
}
