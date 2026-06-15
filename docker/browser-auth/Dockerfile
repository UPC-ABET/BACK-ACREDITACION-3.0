# syntax=docker/dockerfile:1

# ============================================================
# browser-auth — streamed remote browser for Banner Option C login.
# Backend-owned, never published publicly: reachable only from the NestJS
# backend over the private sys_acc_web network.
#   Xvfb (:99) + headful Chromium (Playwright) + x11vnc + websockify(:6080)
#   + a small Node control API (:7000) driven by the backend.
# Based on the Playwright image (Chromium + system deps + browsers preinstalled).
# ============================================================
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Reuse the image's preinstalled browsers (do not re-download).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DISPLAY=:99

RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb \
      x11vnc \
      websockify \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY controller.js start.sh ./
RUN chmod +x start.sh && chown -R pwuser:pwuser /app

# Run as uid 1000 (pwuser) so auth_state.json written to the shared volume is
# owned 1000 and readable by the backend app (also uid 1000 / node).
USER pwuser

# 7000 = private control API, 6080 = noVNC websocket. Never published to host.
EXPOSE 7000 6080
CMD ["./start.sh"]
