# Deployment Runbook

## Overview
This runbook covers deployment procedures for the Codex Retail OS API service.

## Prerequisites
- Access to GitHub repository
- Container registry access (GHCR)
- Target environment credentials
- Database migration permissions

## Deployment Process

### 1. Pre-deployment Checklist
- [ ] All tests passing in CI
- [ ] Database migrations reviewed
- [ ] Environment variables updated
- [ ] Rollback plan prepared
- [ ] Monitoring dashboards ready

### 2. Database Migration
```bash
# Staging
pnpm --filter @codex/db prisma migrate deploy

# Production (with backup)
# First, create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Then apply migrations
pnpm --filter @codex/db prisma migrate deploy
```

### 3. Container Deployment

#### Automated (via GitHub Actions)
1. Merge PR to main branch
2. CI builds and pushes image to GHCR
3. CD workflow deploys to staging
4. Manual approval deploys to production

#### Manual Deployment
```bash
# Build image
docker build -t ghcr.io/rennai455/pos-integration-service:latest .

# Push to registry
docker push ghcr.io/rennai455/pos-integration-service:latest

# Deploy to platform (example: Cloud Run)
gcloud run deploy codex-api \
  --image ghcr.io/rennai455/pos-integration-service:latest \
  --platform managed \
  --region us-central1 \
  --port 4000
```

### 4. Post-deployment Verification
- [ ] Health check endpoint responding (GET /healthz)
- [ ] Metrics endpoint accessible (GET /metrics)
- [ ] Authentication working
- [ ] Database connectivity confirmed
- [ ] Background jobs processing

### 5. Smoke Tests
```bash
# Health check
curl https://api.yourdomain.com/healthz

# Authentication
curl -H "Authorization: Bearer $TOKEN" https://api.yourdomain.com/products

# Metrics
curl https://api.yourdomain.com/metrics
```

## Environment-Specific Notes

### Staging
- Automatic deployment from main branch
- Uses staging database
- Relaxed rate limits for testing

### Production
- Manual approval required
- Blue-green deployment strategy
- Strict monitoring and alerting

## Troubleshooting

### Common Issues

**Container won't start**
- Check environment variables
- Verify database connectivity
- Review container logs

**Database connection errors**
- Verify connection string
- Check network policies
- Confirm credentials

**Performance issues**
- Check metrics dashboard
- Review database query performance
- Monitor container resources

## Rollback Procedures
See rollback.md for detailed rollback instructions.