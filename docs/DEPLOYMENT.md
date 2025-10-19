# Deployment Guide

## Environment Setup

### Prerequisites
- Node.js 20.x or later
- pnpm 8.x or later
- Docker
- Access to GitHub Container Registry
- Supabase project
- PostgreSQL 15+

### Environment Variables
Required variables for each environment:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Security
JWT_SECRET=min-32-char-secret

# Server
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
```

## Deployment Process

### 1. Pre-deployment Checklist
- [ ] All tests passing (`pnpm -r test`)
- [ ] Database migrations ready (`pnpm -r prisma:migrate`)
- [ ] Environment variables configured
- [ ] Metrics and logging configured
- [ ] Security checks completed

### 2. Staging Deployment

```bash
# Deploy to staging
pnpm deploy:staging

# Verify deployment
pnpm check:staging
```

Monitor in staging:
- Health checks (`/health`)
- Metrics (`/metrics`)
- Error rates
- Response times
- Database performance

### 3. Production Rollout

```bash
# Deploy to production
pnpm deploy:prod

# Verify deployment
pnpm check:prod
```

#### Rollback Procedure
If issues are detected:

1. Revert to previous version:
   ```bash
   pnpm rollback:prod
   ```

2. Verify rollback:
   ```bash
   pnpm check:prod
   ```

## Monitoring

### Metrics to Watch
- Request latency (P50, P95, P99)
- Error rates
- Database connection pool
- Background sync success rate
- Memory usage
- CPU usage

### Alerting Thresholds
- Error rate > 1% in 5min
- P95 latency > 1s
- Failed background syncs > 5%
- Database connections > 80%

## Zero-downtime Updates

1. Health check configuration:
   ```json
   {
     "healthCheck": {
       "path": "/health",
       "initialDelay": 10,
       "period": 30,
       "timeout": 5,
       "successThreshold": 1,
       "failureThreshold": 3
     }
   }
   ```

2. Graceful shutdown:
   - SIGTERM handler configured
   - Connection draining
   - In-flight request completion
   - Clean database disconnect

## Security Considerations

1. Tenant Isolation:
   - RLS policies active
   - Cross-tenant tests passing
   - Audit logging enabled

2. API Security:
   - Rate limiting
   - CORS configuration
   - JWT validation
   - HMAC webhook verification

## Performance Optimization

1. Database:
   - Connection pooling
   - Query optimization
   - Index coverage
   - Vacuum scheduling

2. API:
   - Response caching
   - Compression
   - Batch processing
   - Pagination

## Troubleshooting

Common issues and solutions:

1. Database Connection Issues:
   ```bash
   # Check connection pool
   pnpm db:status
   
   # Reset connections
   pnpm db:reset-connections
   ```

2. High Latency:
   ```bash
   # Check slow queries
   pnpm db:slow-queries
   
   # Clear cache if needed
   pnpm cache:clear
   ```

3. Memory Issues:
   ```bash
   # Get memory usage
   pnpm status:memory
   
   # Force garbage collection
   pnpm mem:gc
   ```