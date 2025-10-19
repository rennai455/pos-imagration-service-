# Monitoring Setup Guide

## Metrics Collection

### 1. Application Metrics
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'pos-integration'
    metrics_path: '/metrics'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
```

### 2. Key Metrics

#### Business Metrics
- `ingest_events_total{source="pos",tenant="*"}`
- `sync_operations_total{type="upload|download",status="success|failure"}`
- `active_users_total{tenant="*"}`
- `transactions_total{type="sale|refund",status="success|failure"}`

#### Performance Metrics
- `http_request_duration_seconds{route="*",method="*"}`
- `database_query_duration_seconds{query="*"}`
- `background_job_duration_seconds{job="*"}`
- `connection_pool_size{type="db|cache"}`

#### Resource Metrics
- `process_resident_memory_bytes`
- `process_cpu_seconds_total`
- `nodejs_eventloop_lag_seconds`
- `nodejs_gc_duration_seconds`

## Alert Rules

```yaml
groups:
- name: pos-integration
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: High error rate detected
      description: Error rate is above 1% for 5 minutes

  - alert: SlowResponses
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: Slow response times
      description: P95 latency is above 1 second

  - alert: HighDatabaseConnections
    expr: connection_pool_size{type="db"} / connection_pool_max > 0.8
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High database connection usage
      description: Database connection pool is above 80% capacity

  - alert: SyncFailures
    expr: rate(sync_operations_total{status="failure"}[15m]) > 0
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: Continuous sync failures
      description: Background sync operations are failing
```

## Grafana Dashboards

### 1. Overview Dashboard
- Request Rate
- Error Rate
- Response Time
- Active Users
- Transaction Volume
- Sync Status

### 2. Performance Dashboard
- Database Queries
- Cache Hit Rate
- Memory Usage
- CPU Usage
- Event Loop Lag
- GC Duration

### 3. Business Dashboard
- Sales by Tenant
- Active POS Systems
- Sync Success Rate
- Data Volume
- Error Distribution
- User Activity

## Log Aggregation

### 1. Log Format
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}
```

### 2. Log Levels
- DEBUG: Development debugging
- INFO: Normal operations
- WARN: Potential issues
- ERROR: Operation failures
- FATAL: System failures

### 3. Required Context
All logs must include:
- Request ID
- Tenant ID
- User ID (when available)
- Operation name
- Duration (for operations)
- Error details (when applicable)

## Health Checks

### 1. Component Checks
- Database connectivity
- Cache availability
- Queue status
- External services
- Storage access

### 2. Response Format
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T12:00:00Z",
  "version": "1.2.3",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 5
    },
    "cache": {
      "status": "healthy",
      "hitRate": 0.95
    },
    "queue": {
      "status": "healthy",
      "length": 10
    }
  }
}
```