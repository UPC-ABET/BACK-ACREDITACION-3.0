#!/usr/bin/env bash
set -euo pipefail

# Virtual framebuffer display that Chromium renders into.
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &
sleep 1

# Expose the display over VNC, bound to localhost only. No VNC password: access
# is gated by the private network + the backend's authenticated wss proxy + the
# one-time session token. The container is never published publicly.
x11vnc -display :99 -nopw -forever -shared -rfbport 5900 -localhost &

# Bridge VNC (5900) to a websocket on 6080 that the backend proxy connects to.
websockify 0.0.0.0:6080 localhost:5900 &

# Control API + Playwright controller in the foreground (container's main process).
exec node controller.js
