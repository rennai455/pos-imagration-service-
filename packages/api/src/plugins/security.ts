import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

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
  rateLimitMax: 100,
  rateLimitTimeWindow: 60 * 1000, // 1 minute
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

  // Add security headers
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: finalConfig.contentSecurityPolicy,
    crossOriginEmbedderPolicy: false, // Required for Swagger UI
    crossOriginResourcePolicy: false // Required for Swagger UI
  })

  // Rate limiting
  await fastify.register(fastifyRateLimit, {
    max: finalConfig.rateLimitMax,
    timeWindow: finalConfig.rateLimitTimeWindow,
    allowList: ['127.0.0.1', '::1'], // Don't rate limit localhost
    skipOnError: true, // Don't block requests if Redis is down
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

  // Add error handler
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500
    
    // Don't expose internal errors to client
    if (statusCode >= 500) {
      fastify.log.error(error)
      reply.status(statusCode).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      })
      return
    }

    reply.status(statusCode).send({
      error: error.name,
      message: error.message
    })
  })
}

function isValidOrigin(origin: string, allowedOrigins: string | string[]): boolean {
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(origin)
  }
  return allowedOrigins === '*' || allowedOrigins === origin
}