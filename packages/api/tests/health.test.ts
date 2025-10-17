import { FastifyInstance } from 'fastify'
import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals'
import { mockDeep, mockReset } from 'jest-mock-extended'
import { PrismaClient } from '@prisma/client'

const mockPrismaClient = mockDeep<PrismaClient>()
jest.mock('../src/lib/db', () => ({
  prisma: mockPrismaClient
}))

import { buildServer } from '../src/server'
import { prisma } from '../src/lib/db'

describe('API Health & Security', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    mockReset(mockPrismaClient)
    mockPrismaClient.$queryRaw.mockResolvedValue([{ now: new Date() }])
    app = await buildServer()
  })

  afterAll(async () => {
    await app.close()
    mockReset(mockPrismaClient)
  })

  describe('Health Endpoints', () => {
    it('GET /health should return 200 OK', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      })

      expect(response.statusCode).toBe(200)
      const payload = JSON.parse(response.payload)
      expect(payload).toEqual(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number)
      }))
    })

    it('GET /health/ready should check database connection', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready'
      })

      expect(response.statusCode).toBe(200)
      const payload = JSON.parse(response.payload)
      expect(payload).toEqual(expect.objectContaining({
        status: 'ready',
        database: 'connected',
        timestamp: expect.any(String)
      }))
    })

    it('GET /health/live should check memory usage', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live'
      })

      expect(response.statusCode).toBe(200)
      const payload = JSON.parse(response.payload)
      expect(payload).toEqual(expect.objectContaining({
        status: 'alive',
        timestamp: expect.any(String),
        memory: expect.objectContaining({
          usage: expect.any(Number),
          unit: 'percent'
        })
      }))
    })

    it('GET /metrics should return Prometheus metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toMatch(/^text\/plain/)
      expect(response.payload).toContain('# HELP')
      expect(response.payload).toContain('# TYPE')
    })
  })

  describe('Security Features', () => {
    it('should have security headers set', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      })

      expect(response.headers).toEqual(expect.objectContaining({
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block'
      }))
    })

    it('should respect CORS configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000'
        }
      })

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    })

    it('should block invalid origins', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://evil.com'
        }
      })

      expect(response.statusCode).toBe(403)
    })

    it('should apply rate limiting', async () => {
      const requests = Array(150).fill(null).map(() => 
        app.inject({
          method: 'GET',
          url: '/health'
        })
      )

      const responses = await Promise.all(requests)
      const tooManyRequests = responses.filter(r => r.statusCode === 429)
      
      expect(tooManyRequests.length).toBeGreaterThan(0)
    })
  })
})