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
    // Set test mode for both CORS and rate limiting
    process.env.NODE_ENV = 'test'
    mockReset(mockPrismaClient)
    mockPrismaClient.$queryRaw.mockResolvedValue([{ now: new Date() }])
    app = await buildServer()
    await app.ready() // Ensure plugins are fully loaded
  })

  afterAll(async () => {
    try {
      if (app) {
        // Allow pending operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ensure plugins are ready to close
        await app.ready();
        
        // Close server with timeout
        await Promise.race([
          app.close(),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);

        // Reset mock after server is closed
        mockReset(mockPrismaClient);
      }
    } catch (err) {
      console.error('Error during cleanup:', err);
    }
  })

  describe('Health Endpoints', () => {
    it('GET /api/health should return 200 OK', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
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

    it('GET /api/health/ready should check database connection', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/ready'
      })

      expect(response.statusCode).toBe(200)
      const payload = JSON.parse(response.payload)
      expect(payload).toEqual(expect.objectContaining({
        status: 'ready',
        database: 'connected',
        timestamp: expect.any(String)
      }))
    })

    it('GET /api/health/live should check memory usage', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/live'
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
        url: '/api/health'
      })

      expect(response.headers).toEqual(expect.objectContaining({
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block'
      }))
    })

    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: 'http://localhost:3000'
        }
      })

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(response.headers['access-control-allow-credentials']).toBe('true')
      expect(response.headers['vary']).toBe('Origin')
    })

    it('should reflect origin in test/development mode', async () => {
      const testOrigin = 'http://any-origin.com'
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: testOrigin
        }
      })

      expect(response.headers['access-control-allow-origin']).toBe(testOrigin)
      expect(response.headers['access-control-allow-credentials']).toBe('true')
      expect(response.headers['vary']).toBe('Origin')
    })

    it('should apply rate limiting', async () => {
      const testGroup = 'rate-limit-test';

      // First request in the group should succeed
      const firstResponse = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-test-group': testGroup }
      });
      expect(firstResponse.statusCode).toBe(200);

      // Second immediate request in the same group should be rate limited
      const secondResponse = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-test-group': testGroup }
      });
      expect(secondResponse.statusCode).toBe(429);
      
      // Wait for rate limit window to expire (50ms in test mode)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // After waiting, next request should succeed
      const thirdResponse = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-test-group': testGroup }
      });
      expect(thirdResponse.statusCode).toBe(200);
    }, 5000)
  })
})