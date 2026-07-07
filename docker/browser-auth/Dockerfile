# syntax=docker/dockerfile:1

# ============================================================
# browser-auth — streamed remote browser for Banner Option C login.
# Backend-owned, never published publicly: reachable only from the NestJS
# backend over the private sys_acc_web network.
#   Xvfb (:99) + headful Chromium + x11vnc + websockify(:6080)
#   + a small Node control API (:7000) driven by the backend.
# Chromium is installed by `playwright install` so its build is version-matched
# to the pinned playwright package. (The unpinned Debian `chromium` package drifts
# — a rebuild pulled Chromium 150, whose CDP launch handshake is incompatible with
# playwright 1.60 and aborts with SIGTRAP. The browser binary is fetched from
# cdn.playwright.dev, not the throttled mcr.microsoft.com image registry.)
# ============================================================
FROM node:24-bookworm-slim

ENV DISPLAY=:99
# Shared, world-readable browser location so the non-root `node` user can launch it.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# X stack + fonts/certs. Chromium's own OS deps come from `playwright install --with-deps`.
# DEBIAN_FRONTEND=noninteractive stops tzdata (pulled in by the X packages) from
# prompting for a timezone and hanging the build.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      fonts-liberation \
      ca-certificates \
      xvfb \
      x11vnc \
      websockify \
    && rm -rf /var/lib/apt/lists/*

# Sticky-bit dir so Xvfb (running as non-root) can create its display socket.
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Install the exact Chromium build that the pinned playwright expects, plus its OS
# deps, into the shared path — then make it readable/traversable by the node user.
RUN npx playwright install --with-deps chromium \
    && chmod -R a+rX /ms-playwright

COPY controller.js start.sh ./
RUN chmod +x start.sh

# Run as uid 1000 (the node image's `node` user) so auth_state.json written to
# the shared volume is owned 1000 and readable by the backend app (also uid 1000).
USER node

EXPOSE 7000 6080
CMD ["./start.sh"]
