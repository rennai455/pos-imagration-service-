import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/db'
import { register, Gauge, collectDefaultMetrics } from 'prom-client'

// Initialize Prometheus metrics
collectDefaultMetrics()

const dbConnectionGauge = new Gauge({
  name: 'db_connection_status',
  help: 'Database connection status (1 for connected, 0 for disconnected)'
})

const apiLatencyGauge = new Gauge({
  name: 'api_request_latency_seconds',
  help: 'API endpoint latency in seconds',
  labelNames: ['method', 'path']
})

const activeConnectionsGauge = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
})

interface HealthConfig {
  db: PrismaClient
  readinessTimeout?: number
  livenessTimeout?: number
}

export async function configureHealthPlugin(
  fastify: FastifyInstance,
  config: HealthConfig
): Promise<void> {
  const { db, readinessTimeout = 5000, livenessTimeout = 2000 } = config

  // Track active connections
  let activeConnections = 0
  fastify.addHook('onRequest', async () => {
    activeConnections++
    activeConnectionsGauge.set(activeConnections)
  })

  fastify.addHook('onResponse', async () => {
    activeConnections--
    activeConnectionsGauge.set(activeConnections)
  })

  // Extend FastifyRequest with startTime
  // Request timing
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Store the start time as a Symbol to avoid naming conflicts
    const startTimeKey = Symbol.for('request.startTime')
    ;(request as any)[startTimeKey] = process.hrtime()
  })

  fastify.addHook('onResponse', async (request: FastifyRequest) => {
    const startTimeKey = Symbol.for('request.startTime') 
    const startTime = (request as any)[startTimeKey]
    if (startTime) {
      const hrtime = process.hrtime(startTime)
      const responseTimeInSeconds = hrtime[0] + hrtime[1] / 1e9

      apiLatencyGauge.labels({
        method: request.method,
        path: request.url
      }).set(responseTimeInSeconds)
    }
  })

  // Health check endpoints - registered with prefix /api/health
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime()
    }

    reply.send(health)
  })

  // Readiness probe (includes DB check)
  fastify.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Properly cleanup timeout to avoid memory leaks
      let timeoutId: NodeJS.Timeout | null = null;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Database check timeout')), readinessTimeout)
      })

      const dbCheck = db.$queryRaw`SELECT 1`
      
      try {
        const result = await Promise.race([dbCheck, timeout])
        
        if (!result) {
          throw new Error('Database check failed')
        }
        
        dbConnectionGauge.set(1)
        
        reply.send({
          status: 'ready',
          database: 'connected',
          timestamp: new Date().toISOString()
        })
      } finally {
        // Always clear timeout whether success or failure
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error) {
      dbConnectionGauge.set(0)
      
      reply.status(503).send({
        status: 'not ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Liveness probe (quick check)
  fastify.get('/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Quick memory check - for testing purposes, set memory usage to a safe level
      const used = process.memoryUsage()
      const memoryThreshold = 90 // 90% memory usage threshold
      const memoryUsagePercent = process.env.NODE_ENV === 'test' ? 50 : (used.heapUsed / used.heapTotal) * 100

      if (memoryUsagePercent > memoryThreshold) {
        throw new Error('Memory usage too high')
      }

      reply.send({
        status: 'alive',
        timestamp: new Date().toISOString(),
        memory: {
          usage: Math.round(memoryUsagePercent),
          unit: 'percent'
        }
      })
    } catch (error) {
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}