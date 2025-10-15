# Codex Retail OS – POS Imagration Service

[![Lint Script](https://img.shields.io/badge/lint-npm%20run%20lint-blue?style=flat-square)](#lint)
[![Test Script](https://img.shields.io/badge/test-npm%20run%20test-green?style=flat-square)](#test)
[![Deploy Script](https://img.shields.io/badge/deploy-npm%20run%20deploy-purple?style=flat-square)](#deploy)

## Project Overview
The POS Imagration Service is part of the Codex Retail OS initiative—a unified, cloud-native platform that modernizes retail operations. This service will handle point-of-sale data ingestion, synchronization, and downstream processing so that stores, mobile associates, and digital channels all share a consistent, real-time view of inventory and transactions. The roadmap centers on:

- Consolidating legacy POS feeds into a single ingestion pipeline with strong observability.
- Powering omnichannel customer experiences through real-time APIs and event streams.
- Providing developers with a shared toolkit, documentation, and standards for building on top of the Codex Retail OS.

As new functional specs and architecture decisions are finalized, they will be published in the `/docs` directory, with supporting research, diagrams, and reference assets collected under `/resources`.

## Monorepo Structure
This repository is planned as a monorepo so each domain team can iterate independently while sharing tooling. The high-level layout will evolve, but is expected to include:

- `apps/api` – Fastify-based services for POS ingestion, transformation, and public APIs.
- `apps/web` – Next.js dashboards for operations, observability, and configuration.
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
