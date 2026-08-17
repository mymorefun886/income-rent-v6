# Backend API Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN corepack enable pnpm

# Install dependencies (no frozen lockfile to allow updates)
RUN pnpm install --no-frozen-lockfile

# Copy source
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Create storage directory
RUN mkdir -p /app/apps/api/storage/backups /app/apps/api/uploads

# Expose port
EXPOSE 8788

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8788/api/health || exit 1

# Start server with tsx (no build needed)
CMD ["pnpm", "--filter", "api", "exec", "tsx", "src/index.ts"]
