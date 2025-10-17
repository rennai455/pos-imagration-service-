import client from "prom-client";

// Create a registry for metrics
export const register = new client.Registry();

// Clear all existing metrics before registering new ones
register.clear();

// Collect default metrics (memory, CPU, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for API
export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code", "tenant_id"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

export const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code", "tenant_id"],
  registers: [register]
});

export const databaseQueryDuration = new client.Histogram({
  name: "database_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

export const activeConnections = new client.Gauge({
  name: "active_connections",
  help: "Number of active connections",
  registers: [register]
});

export const backgroundJobsTotal = new client.Counter({
  name: "background_jobs_total",
  help: "Total number of background jobs processed",
  labelNames: ["job_type", "status"],
});

export const syncOperationsTotal = new client.Counter({
  name: "sync_operations_total",
  help: "Total number of sync operations",
  labelNames: ["operation", "source", "status"],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(databaseQueryDuration);
register.registerMetric(activeConnections);
register.registerMetric(backgroundJobsTotal);
register.registerMetric(syncOperationsTotal);

// Helper functions for recording metrics
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  tenantId?: string
) {
  const labels = { method, route, status_code: statusCode.toString(), tenant_id: tenantId || "unknown" };
  httpRequestDuration.observe(labels, duration);
  httpRequestTotal.inc(labels);
}

export function recordDatabaseQuery(operation: string, table: string, duration: number) {
  databaseQueryDuration.observe({ operation, table }, duration);
}

export function recordSyncOperation(operation: string, source: string, status: "success" | "error") {
  syncOperationsTotal.inc({ operation, source, status });
}

export function recordBackgroundJob(jobType: string, status: "success" | "error" | "retry") {
  backgroundJobsTotal.inc({ job_type: jobType, status });
}