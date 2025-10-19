import { buildServer } from '../src/server';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/lib/db';

describe('Idempotency Enforcement', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up idempotency keys before each test
    await prisma.idempotency.deleteMany({});
  });

  describe('POST /api/products', () => {
    it('should accept first request with unique idempotency key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'test-key-001',
        },
        payload: {
          name: 'Test Product',
          description: 'Test Description',
          price: 99.99,
          stock: 10,
          storeId: 'test-store-id',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 204 for duplicate idempotency key', async () => {
      const payload = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        storeId: 'test-store-id',
      };

      // First request
      const response1 = await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'test-key-002',
        },
        payload,
      });

      expect(response1.statusCode).toBe(201);

      // Duplicate request with same key
      const response2 = await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'test-key-002',
        },
        payload,
      });

      expect(response2.statusCode).toBe(204);
    });

    it('should handle 5 parallel requests with same key (only one succeeds)', async () => {
      const payload = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        storeId: 'test-store-id',
      };

      const promises = Array.from({ length: 5 }, () =>
        server.inject({
          method: 'POST',
          url: '/api/products',
          headers: {
            'idempotency-key': 'test-key-parallel',
          },
          payload,
        })
      );

      const responses = await Promise.all(promises);

      // Count status codes
      const statusCounts = responses.reduce((acc, r) => {
        acc[r.statusCode] = (acc[r.statusCode] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // Expect: one 201 Created, four 204 No Content
      expect(statusCounts[201]).toBe(1);
      expect(statusCounts[204]).toBe(4);
    });

    it('should allow different tenants to use same key', async () => {
      const payload = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        storeId: 'test-store-id',
      };

      // Tenant 1
      const response1 = await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'shared-key',
          'x-tenant-id': 'tenant-1',
        },
        payload,
      });

      // Tenant 2
      const response2 = await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'shared-key',
          'x-tenant-id': 'tenant-2',
        },
        payload,
      });

      // Both should succeed (different tenants)
      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(201);
    });

    it('should auto-generate key when header not provided', async () => {
      const payload = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        storeId: 'test-store-id',
      };

      // First request without key
      const response1 = await server.inject({
        method: 'POST',
        url: '/api/products',
        payload,
      });

      // Same request should be treated as duplicate (auto-generated key based on body)
      const response2 = await server.inject({
        method: 'POST',
        url: '/api/products',
        payload,
      });

      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(204); // Duplicate detected by auto-key
    });
  });

  describe('Metrics', () => {
    it('should increment ingest_dedup_total on duplicate', async () => {
      const payload = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        storeId: 'test-store-id',
      };

      // First request
      await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'metrics-test-key',
        },
        payload,
      });

      // Get metrics before duplicate
      const metricsBefore = await server.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Duplicate request
      await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: {
          'idempotency-key': 'metrics-test-key',
        },
        payload,
      });

      // Get metrics after duplicate
      const metricsAfter = await server.inject({
        method: 'GET',
        url: '/metrics',
      });

      // Check that ingest_dedup_total increased
      expect(metricsAfter.body).toContain('ingest_dedup_total');
      expect(metricsAfter.body.includes('ingest_dedup_total{tenant="default",source="api"} 1')).toBe(true);
    });
  });
});
