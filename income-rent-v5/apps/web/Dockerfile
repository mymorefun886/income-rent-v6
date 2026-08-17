# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN corepack enable pnpm

# Install dependencies (no frozen lockfile to allow updates)
RUN pnpm install --no-frozen-lockfile

# Copy source
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Build web (use pnpm build from root to resolve dependencies correctly)
RUN pnpm --filter web exec npx vite build

# Production with nginx
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
