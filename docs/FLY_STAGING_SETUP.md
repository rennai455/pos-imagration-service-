# Fly.io Staging Deployment

## Prerequisites
- Fly.io account: https://fly.io
- Fly CLI: `curl -L https://fly.io/install.sh | sh`
- Docker image in GHCR

## Quick Setup

### 1. Create App
```bash
fly apps create pos-imagration-staging --org personal
```

### 2. Create `fly.staging.toml`
```toml
app = "pos-imagration-staging"
primary_region = "sea"

[build]
  image = "ghcr.io/rennai455/pos-imagration-service:main"

[env]
  PORT = "8080"
  NODE_ENV = "staging"
  RATE_LIMIT_MAX = "100"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[http_service.checks]]
  interval = "30s"
  timeout = "10s"
  grace_period = "10s"
  method = "GET"
  path = "/health/ready"

[[services]]
  protocol = "tcp"
  internal_port = 4000

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 250
    soft_limit = 200

# CRITICAL: Single machine for in-memory rate limiter
[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512

[deploy]
  strategy = "immediate"
  max_unavailable = 0
```

### 3. Set Secrets
```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_ANON_KEY="eyJ..." \
  --app pos-imagration-staging
```

### 4. Deploy
```bash
fly deploy --config fly.staging.toml --image ghcr.io/rennai455/pos-imagration-service:main
```

### 5. Verify
```bash
# Check status
fly status --app pos-imagration-staging

# View logs
fly logs --app pos-imagration-staging

# Test health
curl https://pos-imagration-staging.fly.dev/startupz
curl https://pos-imagration-staging.fly.dev/health/ready
curl https://pos-imagration-staging.fly.dev/metrics
```

## GitHub Actions Integration

Add to repository variables:
```bash
STAGING_URL=https://pos-imagration-staging.fly.dev
```

Add to repository secrets:
```bash
FLY_API_TOKEN=<from fly auth token>
```

Update `.github/workflows/cd.yml`:
```yaml
- name: Deploy to Fly.io Staging
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
  run: |
    curl -L https://fly.io/install.sh | sh
    export FLYCTL_INSTALL="/home/runner/.fly"
    export PATH="$FLYCTL_INSTALL/bin:$PATH"
    
    flyctl deploy \
      --app pos-imagration-staging \
      --image ghcr.io/rennai455/pos-imagration-service@${{ needs.build.outputs.image-digest }} \
      --config fly.staging.toml \
      --wait-timeout 300
```

## Scaling Configuration

**IMPORTANT**: Must stay at 1 machine due to in-memory rate limiter.

```bash
# Set machine count (DO NOT EXCEED 1)
fly scale count 1 --app pos-imagration-staging

# If you need more capacity, implement Redis first
# See docs/REDIS_MIGRATION.md
```

## Monitoring

### Metrics
```bash
# Fetch Prometheus metrics
curl https://pos-imagration-staging.fly.dev/metrics

# Check dedup counter
curl -s https://pos-imagration-staging.fly.dev/metrics | grep ingest_dedup_total

# Check error rate
curl -s https://pos-imagration-staging.fly.dev/metrics | grep http_requests_total
```

### Logs
```bash
# Real-time logs
fly logs --app pos-imagration-staging

# Filter errors
fly logs --app pos-imagration-staging | grep -i error

# Export logs
fly logs --app pos-imagration-staging > staging-logs.txt
```

## Cost
- **1 shared-cpu-1x**: ~$1.94/month
- **512MB RAM**: Included
- **Bandwidth**: $0.02/GB (first 100GB free)
- **Estimated**: ~$2-5/month

## Rollback
```bash
# List releases
fly releases --app pos-imagration-staging

# Rollback to previous version
fly releases rollback <version> --app pos-imagration-staging
```

## Cleanup
```bash
# Suspend (stop charging)
fly apps suspend pos-imagration-staging

# Delete entirely
fly apps destroy pos-imagration-staging
```

