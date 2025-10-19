# Supabase Database Management

This directory contains database migrations, seeds, and configuration for the Codex Retail OS.

## Structure

- `migrations/` - Database schema migrations (managed by Prisma in packages/db)
- `seeds/` - Initial data and test fixtures
- `config/` - Supabase project configuration

## Usage

### Local Development
```bash
# Apply migrations
pnpm --filter @codex/db prisma migrate dev

# Reset database with seeds
pnpm --filter @codex/db prisma migrate reset --force
```

### Production Deployment
```bash
# Deploy migrations
pnpm --filter @codex/db prisma migrate deploy

# Apply seeds (one-time setup)
pnpm --filter @codex/db run seed:prod
```

## Environment Setup

1. Create Supabase project at https://supabase.com
2. Copy project URL and service role key to environment files
3. Set `DATABASE_URL` to connection string
4. Run initial migration: `prisma migrate deploy`

## Migration Strategy

- Use Prisma for schema management
- Keep SQL migrations in packages/db/prisma/migrations/
- This folder maintains Supabase-specific configs and seeds
- Always test migrations on staging before production

## RLS Policies

Row Level Security policies are defined in migrations and enforce:
- Tenant isolation (all tables include tenant_id)
- User access controls based on JWT claims
- Service role bypass for API operations

## Backup & Recovery

- Supabase automatic backups (7 days retention)
- Point-in-time recovery available
- Export scripts in ../runbooks/backup.md