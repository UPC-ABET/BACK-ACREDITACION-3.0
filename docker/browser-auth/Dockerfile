# syntax=docker/dockerfile:1

# ============================================================
# browser-auth — streamed remote browser for Banner Option C login.
# Backend-owned, never published publicly: reachable only from the NestJS
# backend over the private sys_acc_web network.
#   Xvfb (:99) + headful Chromium + x11vnc + websockify(:6080)
#   + a small Node control API (:7000) driven by the backend.
# Uses the same node + system-Chromium base as the main app image (no external
# Playwright registry pull), so it isn't subject to mcr.microsoft.com throttling.
# ============================================================
FROM node:24-bookworm-slim

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DISPLAY=:99
ENV CHROMIUM_PATH=/usr/bin/chromium

# DEBIAN_FRONTEND=noninteractive stops tzdata (pulled in by the X packages) from
# prompting for a timezone and hanging the build.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      libnss3 \
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
COPY controller.js start.sh ./
RUN chmod +x start.sh

# Run as uid 1000 (the node image's `node` user) so auth_state.json written to
# the shared volume is owned 1000 and readable by the backend app (also uid 1000).
USER node

EXPOSE 7000 6080
CMD ["./start.sh"]
