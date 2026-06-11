# syntax=docker/dockerfile:1

# ============================================================
# ABET Backend (NestJS) — production image
# Debian slim base because the app uses Puppeteer (needs Chromium).
# ============================================================

############################
# 1) deps — full install (incl. dev) for building
############################
FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

############################
# 2) build — compile Nest to dist/ then prune to prod deps
############################
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install -g pnpm@9
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

############################
# 3) runtime — slim image with system Chromium for Puppeteer
############################
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      libnss3 \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER node
EXPOSE 7777
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

############################
# 4) migrator — full deps + source for TypeORM migrations / seeds.
# Built & run on demand by the "Run DB Migration" workflow, never served.
############################
FROM node:24-bookworm-slim AS migrator
WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install -g pnpm@9
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Default command; the workflow overrides it (migration:run, migrate:all, ...).
CMD ["pnpm", "migration:run"]
