# POS Migration Service

[![CI/CD](https://github.com/rennai455/pos-imagration-service/actions/workflows/cd.yml/badge.svg)](https://github.com/rennai455/pos-imagration-service/actions/workflows/cd.yml)

A modern point-of-sale system with offline-first capabilities and seamless data synchronization.

## Features

- 🔄 Offline-first architecture with data sync
- 🚀 High-performance API with Fastify
- 📱 Mobile SDK for device integration
- 🎯 Real-time inventory management
- 🔒 Secure authentication with Supabase
- 📊 Admin dashboard for monitoring

## Quick Start

1. **Prerequisites**
   ```bash
   # Install required tools
   npm install -g pnpm
   ```

2. **Setup Environment**
   ```bash
   # Install dependencies
   pnpm install

   # Set up environment files
   pnpm setup

   # Start PostgreSQL database
   docker compose up -d
   ```

3. **Start Development Servers**
   ```bash
   # API Server
   pnpm dev:api

   # Admin Dashboard
   pnpm dev:admin

   # Mobile SDK
   pnpm dev:sdk
   ```

## Development

### Diagnostics

```bash
# Run all diagnostics
pnpm validate

# Individual checks
pnpm diag:net   # Network diagnostics
pnpm diag:env   # Environment validation
pnpm diag:db    # Database connection test
```

### Database Management

```bash
# Run migrations
pnpm -F @codex/db prisma migrate dev

# Reset database
pnpm -F @codex/db prisma migrate reset

# View data
pnpm -F @codex/db prisma studio
```
- `apps/mobile` – Expo applications for in-store associates and field teams.
- `packages/core` – Shared TypeScript utilities, schema definitions, and API clients.
- `packages/ui` – Cross-platform component libraries for web and mobile experiences.
- `infra` – Deployment manifests, Supabase migrations, and infrastructure automation.

Refer back to this section as the monorepo grows; we will keep it updated as folders are added or renamed.

## Getting Started
Follow the steps below to set up your local development environment. Command examples assume Node.js 18+, pnpm or npm, and a working Git environment. Replace tooling commands with your team's preferred equivalents if needed.

### Install
1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd pos-imagration-service-
   npm install
   ```
2. Configure environment variables. Sample `.env` files will be committed alongside each app or package. For Supabase-powered services, create a project in Supabase and populate the credentials as directed in the upcoming `/docs` setup guides.

### Develop
- **API services (Fastify + Supabase):**
  ```bash
  npm run dev:api
  ```
- **Web dashboards (Next.js):**
  ```bash
  npm run dev:web
  ```
- **Mobile apps (Expo):**
  ```bash
  npm run dev:mobile
  ```
Each script will provide hot reloading and leverage shared packages for consistent data access.

### Test
- **Unit & integration tests:**
  ```bash
  npm run test
  ```
- **API contract checks & linting:** See the [Lint](#lint) section for static analysis commands and standards.

### Lint
- **Static analysis & formatting:**
  ```bash
  npm run lint
  ```
  ```bash
  npm run format
  ```
These commands enforce project-wide TypeScript, ESLint, and Prettier rules so contributions stay consistent.

### Deploy
Deployment automation will live under the `infra` directory. To trigger the current deployment workflow, run:
```bash
npm run deploy
```
As platform automation evolves, more details (including CI/CD pipeline diagrams and rollout checklists) will be documented in `/docs/deployment` and `/resources/runbooks`.

## Contribution Guidelines
We welcome contributions from every Codex Retail OS team. To keep development smooth:

1. **Open an issue** describing the problem or feature before submitting a pull request.
2. **Discuss architecture** changes early—use the `/docs/adr` folder for Architecture Decision Records once available.
3. **Write tests and update docs**. Ensure new features include unit/integration coverage and refresh any relevant setup guides in `/docs` or supporting assets in `/resources`.
4. **Follow the coding standards** defined by the shared ESLint/Prettier configs and TypeScript guidelines.
5. **Submit focused pull requests** with clear descriptions, screenshots (for UI changes), and notes about Supabase migrations or infrastructure impacts.

For questions, jump into the Codex Retail OS channel or mention the platform team. We will keep this README and the `/docs` directory updated as the project matures so newcomers can onboard quickly.

## Local Postgres for Development
To run a local Postgres for development quickly, use the provided `docker-compose.yml`:

```bash
docker-compose up -d
```

Example `DATABASE_URL` for local Postgres:

```properties
DATABASE_URL=postgresql://postgres:password@localhost:5432/codex_pos_dev
```

After starting Postgres and populating `.env`, run the Prisma generate and test connection:

```bash
pnpm --filter @codex/db run generate
pnpm --filter @codex/db run test-connection
```

