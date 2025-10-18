#!/usr/bin/env node
// Validate JSON output from scripts/dedup-loadtest.mjs
// Usage: node scripts/check-loadtest-result.mjs <result.json> <expectedTotal>
// - Fails if:
//   * other > 0
//   * total !== expectedTotal
//   * dedup ratio (duplicates / total) < 0.2

import fs from 'node:fs';

function fail(msg) {
  console.error(`[check-loadtest-result] ${msg}`);
  process.exit(1);
}

const [, , fileArg, expectedArg] = process.argv;

if (!fileArg) {
  fail('Missing result file path argument');
}

let expected = Number(expectedArg ?? process.env.EXPECTED_TOTAL ?? '0');
if (!Number.isFinite(expected) || expected <= 0) {
  fail('Missing or invalid expected total (provide as second arg or EXPECTED_TOTAL env)');
}

let raw;
try {
  raw = fs.readFileSync(fileArg, 'utf8');
} catch (e) {
  fail(`Unable to read file: ${fileArg}`);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  fail('Invalid JSON in result file');
}

const total = Number(data.total);
const duplicates = Number(data.duplicates ?? 0);
const other = Number(data.other ?? 0);

if (!Number.isFinite(total) || total <= 0) fail('Missing or invalid "total" in result');
if (!Number.isFinite(duplicates) || duplicates < 0) fail('Missing or invalid "duplicates" in result');
if (!Number.isFinite(other) || other < 0) fail('Missing or invalid "other" in result');

const ratio = total > 0 ? duplicates / total : 0;

console.log(`[check-loadtest-result] total=${total} duplicates=${duplicates} ratio=${ratio.toFixed(3)} other=${other}`);

if (other > 0) fail('Found non-success responses (other > 0)');
if (total !== expected) fail(`Total (${total}) did not match expected (${expected})`);
if (ratio < 0.2) fail(`Dedup ratio too low (${ratio.toFixed(3)} < 0.2)`);

console.log('[check-loadtest-result] OK');
process.exit(0);

