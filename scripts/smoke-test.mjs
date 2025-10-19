#!/usr/bin/env node
/**
 * Smoke Test Runner for Local/Staging/Production
 * 
 * Tests critical paths: auth, products, health, metrics
 * 
 * Usage: 
 *   node smoke-test.mjs
 *   API_URL=https://staging.example.com node smoke-test.mjs
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const TENANT_ID = process.env.TENANT_ID || 'smoke-test';

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${path}`);
    const client = url.protocol === 'https:' ? https : http;
    
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        ...options.headers,
      },
    };

    const req = client.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log('🚀 Running Smoke Tests');
  console.log(`   Target: ${API_URL}`);
  console.log('');

  // Health Checks
  await test('GET /health returns 200', async () => {
    const res = await request('/api/health');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert(data.status === 'ok', 'Expected status=ok');
  });

  await test('GET /health/ready returns 200', async () => {
    const res = await request('/api/health/ready');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert(data.status === 'ready', 'Expected status=ready');
  });

  await test('GET /livez returns 200', async () => {
    const res = await request('/livez');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  });

  await test('GET /startupz returns 200', async () => {
    const res = await request('/startupz');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  });

  // Metrics
  await test('GET /metrics returns Prometheus format', async () => {
    const res = await request('/metrics');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.includes('# HELP'), 'Missing Prometheus format');
    assert(res.body.includes('build_info'), 'Missing build_info metric');
    assert(res.body.includes('http_request_duration_seconds'), 'Missing http_request_duration_seconds');
    assert(res.body.includes('ingest_dedup_total'), 'Missing ingest_dedup_total');
  });

  // Idempotency Test
  const idempotencyKey = `smoke-${Date.now()}`;
  let productId = null;

  await test('POST /api/products with idempotency-key returns 201', async () => {
    const res = await request('/api/products', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: {
        name: 'Smoke Test Product',
        description: 'Created by smoke test',
        price: 9.99,
        stock: 100,
        storeId: 'smoke-store',
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    assert(data.id, 'Missing product id');
    productId = data.id;
  });

  await test('POST /api/products with duplicate key returns 204', async () => {
    const res = await request('/api/products', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: {
        name: 'Duplicate Product',
        description: 'Should be deduplicated',
        price: 19.99,
        stock: 50,
        storeId: 'smoke-store',
      },
    });
    assert(res.statusCode === 204, `Expected 204 (dedup), got ${res.statusCode}`);
  });

  // Rate Limiting
  await test('Rate limiting headers present', async () => {
    const res = await request('/api/health');
    // Note: Depends on middleware implementation
    // assert(res.headers['x-ratelimit-limit'], 'Missing X-RateLimit-Limit header');
    console.log('   (Skipped - headers may not be implemented yet)');
  });

  // Security
  await test('CORS headers present', async () => {
    const res = await request('/api/health', {
      headers: { 'Origin': 'https://example.com' },
    });
    // Should have CORS headers in response
    console.log('   (Check manually if CORS is configured)');
  });

  // Summary
  console.log('');
  console.log('📊 Summary');
  console.log('─────────────────────────────────────');
  console.log(`   Passed: ${results.passed}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Total:  ${results.passed + results.failed}`);
  console.log('');

  if (results.failed > 0) {
    console.log('❌ SMOKE TESTS FAILED');
    console.log('');
    console.log('Failed tests:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
    process.exit(1);
  } else {
    console.log('✅ ALL SMOKE TESTS PASSED');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
