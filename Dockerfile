# Multi-stage Dockerfile for Codex Retail OS API
FROM node:20-alpine AS deps

# Install pnpm and OpenSSL for Prisma
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY apps/admin/package.json ./apps/admin/
COPY apps/sdk/package.json ./apps/sdk/

# Install dependencies WITHOUT running postinstall scripts
# This avoids "prisma generate" running before schema files exist
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build stage
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy ALL source code (including Prisma schemas)
COPY . .

# Generate Prisma Client for @codex/db (now that schema exists)
RUN pnpm --filter @codex/db exec prisma generate

# Build @codex/db first (it imports @prisma/client types)
RUN pnpm --filter @codex/db build

# Build the API
RUN pnpm --filter @codex/api build

# Runtime stage
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/api/package.json ./packages/api/
COPY --from=build --chown=nodejs:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/db/package.json ./packages/db/
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/package.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/api/dist/server.js"]