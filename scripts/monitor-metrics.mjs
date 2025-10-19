#!/usr/bin/env node
/**
 * Metrics Monitor Dashboard
 * 
 * Fetches and displays key metrics from /metrics endpoint
 * 
 * Usage:
 *   node monitor-metrics.mjs
 *   API_URL=https://staging.example.com node monitor-metrics.mjs
 *   INTERVAL=10 node monitor-metrics.mjs  # Refresh every 10 seconds
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const INTERVAL = parseInt(process.env.INTERVAL || '5') * 1000;
const WATCH = process.env.WATCH !== 'false';

function fetchMetrics() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/metrics`);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/metrics',
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.end();
  });
}

function parseMetrics(text) {
  const metrics = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    
    const match = line.match(/^([a-z_]+)(?:{([^}]+)})?\s+(.+)$/);
    if (match) {
      const [, name, labels, value] = match;
      const labelObj = {};
      
      if (labels) {
        const labelPairs = labels.match(/(\w+)="([^"]*)"/g) || [];
        for (const pair of labelPairs) {
          const [key, val] = pair.split('=');
          labelObj[key] = val.replace(/"/g, '');
        }
      }
      
      if (!metrics[name]) metrics[name] = [];
      metrics[name].push({ labels: labelObj, value: parseFloat(value) });
    }
  }
  
  return metrics;
}

function calculateP95(buckets) {
  // Simple P95 calculation from histogram buckets
  // In production, use proper histogram_quantile
  let total = 0;
  for (const bucket of buckets) {
    if (bucket.labels.le !== '+Inf') {
      total += bucket.value;
    }
  }
  
  const p95Count = total * 0.95;
  let cumulative = 0;
  
  for (const bucket of buckets) {
    if (bucket.labels.le === '+Inf') continue;
    cumulative += bucket.value;
    if (cumulative >= p95Count) {
      return parseFloat(bucket.labels.le);
    }
  }
  
  return 0;
}

function displayMetrics(metrics) {
  const timestamp = new Date().toISOString();
  
  if (WATCH) {
    console.clear();
  }
  
  console.log('📊 Metrics Dashboard');
  console.log(`   Target: ${API_URL}`);
  console.log(`   Time:   ${timestamp}`);
  console.log('');
  
  // Build Info
  const buildInfo = metrics.build_info?.[0];
  if (buildInfo) {
    console.log('📦 Build Info');
    console.log(`   Version: ${buildInfo.labels.version || 'unknown'}`);
    console.log('');
  }
  
  // Request Metrics
  console.log('🌐 HTTP Requests');
  const totalRequests = metrics.http_requests_total || [];
  let total2xx = 0, total4xx = 0, total5xx = 0;
  
  for (const metric of totalRequests) {
    const code = parseInt(metric.labels.status_code || '0');
    if (code >= 200 && code < 300) total2xx += metric.value;
    else if (code >= 400 && code < 500) total4xx += metric.value;
    else if (code >= 500) total5xx += metric.value;
  }
  
  const totalReqs = total2xx + total4xx + total5xx;
  const errorRate = totalReqs > 0 ? ((total5xx / totalReqs) * 100).toFixed(2) : '0.00';
  
  console.log(`   Total:    ${totalReqs}`);
  console.log(`   2xx:      ${total2xx} (${totalReqs > 0 ? ((total2xx / totalReqs) * 100).toFixed(1) : 0}%)`);
  console.log(`   4xx:      ${total4xx} (${totalReqs > 0 ? ((total4xx / totalReqs) * 100).toFixed(1) : 0}%)`);
  console.log(`   5xx:      ${total5xx} (${totalReqs > 0 ? ((total5xx / totalReqs) * 100).toFixed(1) : 0}%)`);
  console.log(`   Error Rate: ${errorRate}% ${parseFloat(errorRate) > 2 ? '⚠️' : '✅'}`);
  console.log('');
  
  // Latency
  console.log('⏱️  Latency');
  const durationBuckets = metrics.http_request_duration_seconds_bucket || [];
  if (durationBuckets.length > 0) {
    const p95 = calculateP95(durationBuckets) * 1000; // Convert to ms
    console.log(`   P95:      ${p95.toFixed(0)}ms ${p95 > 1000 ? '⚠️' : '✅'}`);
  } else {
    console.log(`   P95:      N/A (no data)`);
  }
  console.log('');
  
  // Deduplication
  console.log('🔄 Idempotency');
  const dedupMetrics = metrics.ingest_dedup_total || [];
  let totalDedup = 0;
  
  for (const metric of dedupMetrics) {
    totalDedup += metric.value;
    if (metric.value > 0) {
      console.log(`   ${metric.labels.tenant}/${metric.labels.source}: ${metric.value}`);
    }
  }
  
  if (totalDedup === 0) {
    console.log(`   No duplicates detected`);
  }
  console.log(`   Total Deduplicated: ${totalDedup}`);
  console.log('');
  
  // Retries
  console.log('🔁 Retries');
  const retryMetrics = metrics.retry_attempts_total || [];
  let totalRetries = 0;
  
  for (const metric of retryMetrics) {
    totalRetries += metric.value;
  }
  
  console.log(`   Total Retry Attempts: ${totalRetries}`);
  console.log('');
  
  // Active Connections
  console.log('🔌 Connections');
  const activeConns = metrics.active_connections?.[0];
  if (activeConns) {
    console.log(`   Active: ${activeConns.value}`);
  }
  console.log('');
  
  // Alerts
  console.log('🚨 Alerts');
  const alerts = [];
  
  if (parseFloat(errorRate) > 2) {
    alerts.push(`Error rate ${errorRate}% exceeds 2% threshold`);
  }
  
  if (durationBuckets.length > 0) {
    const p95 = calculateP95(durationBuckets) * 1000;
    if (p95 > 1000) {
      alerts.push(`P95 latency ${p95.toFixed(0)}ms exceeds 1000ms threshold`);
    }
  }
  
  if (totalDedup === 0 && totalReqs > 100) {
    alerts.push(`No deduplication detected with ${totalReqs} requests (possible issue)`);
  }
  
  if (alerts.length === 0) {
    console.log(`   ✅ All thresholds within SLOs`);
  } else {
    alerts.forEach(alert => console.log(`   ⚠️  ${alert}`));
  }
  console.log('');
  
  if (WATCH) {
    console.log(`Refreshing in ${INTERVAL / 1000}s... (Ctrl+C to stop)`);
  }
}

async function monitor() {
  try {
    const metricsText = await fetchMetrics();
    const metrics = parseMetrics(metricsText);
    displayMetrics(metrics);
    
    if (WATCH) {
      setTimeout(monitor, INTERVAL);
    }
  } catch (error) {
    console.error(`Error fetching metrics: ${error.message}`);
    if (WATCH) {
      setTimeout(monitor, INTERVAL);
    } else {
      process.exit(1);
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Monitoring stopped');
  process.exit(0);
});

monitor();
