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
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

############################
# 2) build — compile Nest to dist/ then prune to prod deps
############################
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g pnpm@11
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

############################
# 3) runtime — slim image with driver-managed browsers
############################
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Each driver installs its OWN version-matched browser (Playwright 1.60 → Chromium,
# Puppeteer 25 → Chrome) into a shared, world-readable path. The unpinned Debian
# `chromium` package drifts (a rebuild pulled Chromium 150) and its CDP launch
# handshake is incompatible with the pinned drivers — that aborts with SIGTRAP /
# WS-endpoint timeouts. NOTE: PUPPETEER_EXECUTABLE_PATH must NOT be set (neither
# here nor in the server .env), so both drivers resolve their bundled browser.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PUPPETEER_CACHE_DIR=/puppeteer-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Install version-matched browsers for both drivers. `playwright install --with-deps`
# also pulls the shared OS libraries that Puppeteer's Chrome needs too.
RUN npx playwright install --with-deps chromium \
    && npx puppeteer browsers install chrome \
    && chmod -R a+rX /ms-playwright /puppeteer-cache

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
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g pnpm@11
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Default command; the workflow overrides it (migration:run, migration:revert, seed:initial, ...).
CMD ["pnpm", "migration:run"]
