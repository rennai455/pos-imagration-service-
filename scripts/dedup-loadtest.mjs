#!/usr/bin/env node
// Simple load test to exercise idempotent ingest under load.
// Sends TOTAL requests composed of UNIQUE distinct payloads to create duplicates.
// Produces JSON summary: { total, duplicates, success, other }
// Usage:
//   node scripts/dedup-loadtest.mjs \
//     --url https://staging.example.com \
//     --source demo \
//     --tenant t1 \
//     --total 100 \
//     --unique 50 \
//     --concurrency 10 \
//     --out result.json

import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { argv, exit } from 'node:process';

function parseArgs() {
  const args = Object.create(null);
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs();
const API_URL = args.url || process.env.API_URL;
const SOURCE = args.source || process.env.SOURCE || 'demo';
const TENANT = args.tenant || process.env.TENANT || 't1';
const SECRET = process.env.WEBHOOK_SECRET || args.secret;
const TOTAL = Number(args.total || process.env.TOTAL || 100);
const UNIQUE = Number(args.unique || process.env.UNIQUE || Math.ceil(TOTAL / 2));
const CONCURRENCY = Number(args.concurrency || process.env.CONCURRENCY || 10);
const OUT = args.out || process.env.OUT;

if (!API_URL) {
  console.error('[dedup-loadtest] Missing --url or API_URL');
  exit(1);
}
if (!SECRET) {
  console.error('[dedup-loadtest] Missing WEBHOOK_SECRET (env or --secret)');
  exit(1);
}
if (!Number.isFinite(TOTAL) || TOTAL <= 0) {
  console.error('[dedup-loadtest] Invalid TOTAL');
  exit(1);
}
if (!Number.isFinite(UNIQUE) || UNIQUE <= 0 || UNIQUE > TOTAL) {
  console.error('[dedup-loadtest] Invalid UNIQUE (must be 1..TOTAL)');
  exit(1);
}

function hmac(payload) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sig = createHmac('sha256', SECRET).update(raw).digest('hex');
  return `sha256=${sig}`;
}

function makePayload(key) {
  return {
    sku: `LOAD-${key}`,
    qty: 1,
    price: 123,
    ts: new Date().toISOString(),
  };
}

function makePlan() {
  const keys = Array.from({ length: UNIQUE }, (_, i) => `K${i + 1}`);
  const plan = [];
  for (let i = 0; i < TOTAL; i++) {
    plan.push(keys[i % UNIQUE]);
  }
  // Shuffle a bit for randomness
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  return plan;
}

async function worker(queue, stats) {
  while (true) {
    const next = queue.shift();
    if (!next) return;
    const key = next;
    const payload = makePayload(key);
    const body = JSON.stringify(payload);
    const res = await fetch(`${API_URL}/pos/${encodeURIComponent(SOURCE)}/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': TENANT,
        'x-signature': hmac(body),
      },
      body,
    }).catch((e) => ({ ok: false, status: 0, error: e }));

    if (res && res.ok) {
      stats.success++;
    } else {
      stats.other++;
    }
  }
}

async function main() {
  const plan = makePlan();
  const queue = plan.slice();
  const stats = { total: plan.length, success: 0, other: 0 };
  const workers = Array.from({ length: Math.min(CONCURRENCY, plan.length) }, () => worker(queue, stats));
  await Promise.all(workers);
  const duplicates = TOTAL - UNIQUE; // by construction
  const result = { total: TOTAL, duplicates, success: stats.success, other: stats.other };
  const out = JSON.stringify(result);
  if (OUT) fs.writeFileSync(OUT, out + '\n');
  console.log(out);
  if (stats.other > 0) exit(2);
}

main().catch((e) => {
  console.error('[dedup-loadtest] Error:', e);
  exit(1);
});

