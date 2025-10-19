# On-Call Runbook

## Overview
This runbook provides guidance for on-call engineers responding to incidents in the Codex Retail OS platform.

## Alerting & Escalation

### Alert Severity Levels

**P0 - Critical (15 min response)**
- Complete service outage
- Data corruption/loss
- Security breach
- Payment processing down

**P1 - High (1 hour response)**
- Significant performance degradation
- Feature completely broken
- Database connection issues
- Authentication problems

**P2 - Medium (4 hours response)**
- Minor performance issues
- Partial feature degradation
- Non-critical errors increasing

**P3 - Low (Next business day)**
- Documentation updates
- Minor bugs
- Monitoring improvements

### Escalation Chain
1. Primary On-call: @renn
2. Secondary On-call: @dallas
3. Engineering Manager: @platform-team
4. CTO: @executive-team

## Common Incidents & Responses

### 1. API Service Down (P0)

**Symptoms:**
- Health check failing
- 5xx error rate > 50%
- Complete unresponsiveness

**Immediate Actions:**
```bash
# Check service status
curl https://api.yourdomain.com/healthz

# Check container logs
kubectl logs -f deployment/codex-api --tail=100

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"
```

**Resolution Steps:**
1. Identify root cause (logs, metrics)
2. If code issue: rollback (see rollback.md)
3. If infra issue: restart service
4. If database issue: check connection pool

### 2. Database Performance Issues (P1)

**Symptoms:**
- Slow query times (>1s)
- Connection pool exhaustion
- Timeout errors

**Immediate Actions:**
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, query_start FROM pg_stat_activity WHERE query_start < now() - interval '30 seconds';"

# Check database size
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"
```

**Resolution Steps:**
1. Kill long-running queries if safe
2. Check for missing indexes
3. Consider read replica for heavy queries
4. Scale database if needed

### 3. Authentication Failures (P1)

**Symptoms:**
- JWT validation errors
- Supabase auth service errors
- Users unable to login

**Immediate Actions:**
```bash
# Check Supabase service status
curl https://[project-ref].supabase.co/rest/v1/

# Verify JWT configuration
echo $JWT_SECRET | wc -c  # Should be >32 chars

# Check auth endpoint
curl -X POST https://api.yourdomain.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### 4. Background Job Failures (P2)

**Symptoms:**
- Sync jobs not processing
- Dead letter queue growing
- Stale inventory data

**Immediate Actions:**
```bash
# Check job queue status
psql $DATABASE_URL -c "SELECT COUNT(*) FROM job_queue WHERE status = 'failed';"

# Check recent job failures
psql $DATABASE_URL -c "SELECT * FROM job_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;"
```

## Monitoring Dashboards

### Key Metrics to Monitor
- **API Response Time**: p95 < 500ms
- **Error Rate**: < 1%
- **Database Connections**: < 80% of pool
- **Memory Usage**: < 80%
- **CPU Usage**: < 70%

### Dashboard URLs
- Supabase Dashboard: https://supabase.com/dashboard/project/[project-ref]
- Prometheus Metrics: http://prometheus.yourdomain.com
- Grafana: http://grafana.yourdomain.com
- Logs: Supabase Logs or configured log aggregator

## Incident Response Process

### 1. Acknowledge (5 minutes)
- Respond to alert in #alerts channel
- Create incident in issue tracker
- Begin investigation

### 2. Investigate (15 minutes)
- Check monitoring dashboards
- Review recent deployments
- Examine error logs
- Identify scope of impact

### 3. Mitigate (30 minutes)
- Apply immediate fix or rollback
- Communicate status to stakeholders
- Monitor for resolution

### 4. Resolve (60 minutes)
- Verify fix is working
- Update status communications
- Document incident response

### 5. Post-Mortem (24-48 hours)
- Conduct blameless post-mortem
- Identify root cause
- Create action items to prevent recurrence

## Communication

### Internal Channels
- #alerts - Real-time incident updates
- #engineering - Technical discussion
- #general - Broader team updates

### External Communication
- Status page: status.yourdomain.com
- Customer support: support@yourdomain.com
- Social media: @yourdomain

### Status Update Template
```
[TIME] - We are investigating reports of [ISSUE DESCRIPTION]. 
We will provide updates every 30 minutes.

[TIME] - We have identified the issue as [ROOT CAUSE] and are 
implementing a fix. Expected resolution: [ETA].

[TIME] - The issue has been resolved. All services are operational.
We will conduct a post-mortem and share findings.
```

## Tools & Access

### Required Access
- GitHub repository (admin)
- Container registry (GHCR)
- Database (admin)
- Cloud platform (deploy permissions)
- Monitoring systems (read/write)

### Emergency Contacts
- Cloud provider support: [Support ticket system]
- Database provider (Supabase): support@supabase.io
- CDN/DNS provider: [Support contact]

## Runbook Maintenance
- Review monthly with team
- Update after major incidents
- Keep contact information current
- Test procedures quarterly