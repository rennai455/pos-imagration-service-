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

  // Health check endpoints
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime()
    }

    reply.send(health)
  })

  // Readiness probe (includes DB check)
  fastify.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database check timeout')), readinessTimeout)
      })

      const dbCheck = db.$queryRaw`SELECT 1`
      const [result] = await Promise.all([
        Promise.race([dbCheck, timeout]),
        new Promise(resolve => setTimeout(resolve, 100)) // Small delay to ensure connection is stable
      ])
      
      if (!result) {
        throw new Error('Database check failed')
      }
      
      dbConnectionGauge.set(1)
      
      reply.send({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      })
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
  fastify.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Quick memory check
      const used = process.memoryUsage()
      const memoryThreshold = 90 // 90% memory usage threshold
      const memoryUsagePercent = (used.heapUsed / used.heapTotal) * 100

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

  // Metrics endpoint for Prometheus
  fastify.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await register.metrics()
      reply.type(register.contentType).send(metrics)
    } catch (error) {
      reply.status(500).send(error)
    }
  })
}