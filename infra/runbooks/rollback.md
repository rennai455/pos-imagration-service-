# Rollback Runbook

## Overview
Emergency rollback procedures for the Codex Retail OS API service when issues are detected in production.

## When to Rollback
- Critical bugs affecting user experience
- Data integrity issues
- Performance degradation > 50%
- Security vulnerabilities discovered
- Database migration failures

## Rollback Strategies

### 1. Container Rollback (Fastest - 2-5 minutes)
```bash
# Option A: Rollback to previous image tag
docker pull ghcr.io/rennai455/pos-integration-service:v1.2.3
gcloud run deploy codex-api \
  --image ghcr.io/rennai455/pos-integration-service:v1.2.3 \
  --platform managed

# Option B: Rollback via GitHub Actions
# 1. Go to Actions tab in GitHub
# 2. Find last known good deployment
# 3. Click "Re-run jobs"
```

### 2. Database Rollback (Use with caution - 10-30 minutes)
```bash
# Only if migration caused the issue
# WARNING: Data loss possible with destructive migrations

# Step 1: Stop API to prevent new writes
# Step 2: Restore from backup
psql $DATABASE_URL < backup-20241016-143022.sql

# Step 3: Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM products;"

# Step 4: Start API with previous image
```

### 3. Configuration Rollback (5-10 minutes)
```bash
# Revert environment variables
kubectl rollout undo deployment/codex-api

# Or update ConfigMap/Secret and restart
kubectl set env deployment/codex-api DATABASE_URL=$OLD_DATABASE_URL
kubectl rollout restart deployment/codex-api
```

## Rollback Decision Tree

```
Issue Detected
├── Application Code Bug
│   └── → Container Rollback
├── Database Migration Issue
│   └── → Database Rollback + Container Rollback
├── Configuration Issue
│   └── → Configuration Rollback
└── External Service Issue
    └── → Monitor and wait (no rollback needed)
```

## Step-by-Step Emergency Rollback

### 1. Assess Situation (2 minutes)
- Check monitoring dashboards
- Review error logs
- Determine scope of impact
- Identify root cause

### 2. Decision Point
**High Impact Issues (immediate rollback):**
- Authentication completely broken
- Data corruption detected
- 5xx error rate > 10%
- Security breach

**Medium Impact (consider rollback):**
- Performance degradation
- Partial feature failure
- Minor data inconsistencies

### 3. Execute Rollback (5-15 minutes)
```bash
# 1. Alert team
# Post in #alerts channel: "ROLLBACK IN PROGRESS - Issue: [description]"

# 2. Identify last known good version
git log --oneline -10
# Find commit hash before problematic deployment

# 3. Rollback container
./scripts/deploy-rollback.sh v1.2.3

# 4. Verify rollback success
curl https://api.yourdomain.com/healthz
curl https://api.yourdomain.com/metrics
```

### 4. Post-Rollback Actions (30 minutes)
- [ ] Verify all systems operational
- [ ] Update status page
- [ ] Notify stakeholders
- [ ] Create incident report
- [ ] Plan forward fix

## Communication Templates

### Slack Alert
```
🚨 ROLLBACK INITIATED 🚨
Service: Codex API
Issue: [Brief description]
Impact: [User-facing impact]
ETA: 15 minutes
Incident Commander: @renn
```

### Status Page Update
```
We are experiencing issues with our API service and have initiated a rollback to a previous stable version. 
We expect service to be fully restored within 15 minutes.
```

## Verification Checklist
After rollback completion:
- [ ] Health check returning 200
- [ ] Authentication working
- [ ] Database queries successful
- [ ] Metrics collecting properly
- [ ] Background jobs processing
- [ ] Admin dashboard accessible
- [ ] Mobile app connecting

## Prevention
- Comprehensive testing in staging
- Gradual rollout strategies
- Feature flags for risky changes
- Database migration testing
- Automated monitoring and alerting

## Contact Information
- Incident Commander: @renn
- Database Expert: @dallas
- DevOps Lead: @platform-team
- On-call escalation: +1-xxx-xxx-xxxx