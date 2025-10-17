import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox'

export const healthSchemas = {
  HealthResponse: Type.Object({
    status: Type.String(),
    timestamp: Type.String(),
    version: Type.String(),
    uptime: Type.Number()
  }),

  ReadinessResponse: Type.Object({
    status: Type.String(),
    database: Type.String(),
    timestamp: Type.String()
  }),

  LivenessResponse: Type.Object({
    status: Type.String(),
    timestamp: Type.String(),
    memory: Type.Object({
      usage: Type.Number(),
      unit: Type.String()
    })
  }),

  ErrorResponse: Type.Object({
    error: Type.String(),
    message: Type.String()
  })
}

export const healthRouteOptions = {
  health: {
    schema: {
      response: {
        200: healthSchemas.HealthResponse
      },
      description: 'Basic health check endpoint',
      tags: ['Health'],
      summary: 'Basic application health status'
    }
  },

  ready: {
    schema: {
      response: {
        200: healthSchemas.ReadinessResponse,
        503: healthSchemas.ErrorResponse
      },
      description: 'Readiness probe that checks database connectivity',
      tags: ['Health'],
      summary: 'Application readiness status'
    }
  },

  live: {
    schema: {
      response: {
        200: healthSchemas.LivenessResponse,
        503: healthSchemas.ErrorResponse
      },
      description: 'Liveness probe that checks application health',
      tags: ['Health'],
      summary: 'Application liveness status'
    }
  },

  metrics: {
    schema: {
      response: {
        200: Type.String()
      },
      description: 'Prometheus metrics endpoint',
      tags: ['Monitoring'],
      summary: 'Application metrics in Prometheus format'
    }
  }
}

export default async function configureSwagger(fastify: FastifyInstance) {
  await fastify.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'POS Migration Service API',
        description: 'API documentation for the POS Migration Service',
        version: '1.0.0'
      },
      host: process.env.API_HOST || 'localhost:4000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Monitoring', description: 'Monitoring and metrics endpoints' }
      ]
    }
  })

  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function (request: FastifyRequest, reply: FastifyReply, next: () => void) {
        next()
      },
      preHandler: function (request: FastifyRequest, reply: FastifyReply, next: () => void) {
        next()
      }
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header
  })
}