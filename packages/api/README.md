# API Package

The API package houses shared client libraries and server interaction helpers for working with the POS immigration platform services. Includes typed SDKs, data contracts, and utilities for authentication and error handling.

## Local Development Setup

### Environment Variables

Copy the `.env.example` file to `.env` and fill in the required variables:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `JWT_SECRET`: Secret for JWT token signing (min 32 chars)

### Health Checks

Run these commands to verify your setup:

```bash
# Check environment variables
pnpm check:env

# Test database connection
pnpm check:db

# Run all checks
pnpm check:all
```

### Local Database Setup

The project includes a Docker Compose configuration for running a local PostgreSQL database:

1. Start the database:
```bash
cd dev
docker-compose up -d
```

The database will be available at:
- Host: localhost
- Port: 5433 (mapped from container port 5432)
- User: postgres
- Password: postgres
- Database: pos_dev

Default DATABASE_URL: `postgresql://postgres:postgres@localhost:5433/pos_dev?schema=public`

### Running Locally

1. Install dependencies:
```bash
pnpm install
```

2. Generate Prisma client:
```bash
pnpm prisma:generate
```

3. Run migrations:
```bash
pnpm prisma:migrate
```

4. Start development server:
```bash
pnpm dev
```

The server will start on `http://127.0.0.1:3000` by default.

### Network Configuration

The server is configured to bind to IPv4 (127.0.0.1) by default for consistent behavior on Windows systems.

Required ports:
- 3000: API server
- 5432: PostgreSQL database

Firewall rules:
1. Ensure inbound access is allowed for ports 3000 and 5432 on localhost
2. For development, both ports should only accept connections from 127.0.0.1
3. Docker containers communicate on their own network; no additional rules needed

To verify network connectivity:
```bash
# Check API server
curl http://127.0.0.1:3000/health

# Check database connection
pnpm check:db
```

### Testing

Run tests:
```bash
pnpm test
```

Watch mode:
```bash
pnpm test:watch
```

Coverage report:
```bash
pnpm test:coverage
```
