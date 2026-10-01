#!/usr/bin/env bash
# ==============================================================================
# VirgoX Multi-Device Cloudflare Tunnel Generator
# ==============================================================================
set -e

# The desktop port depends on the backend. The Docker backend publishes
# webtop/KasmVNC on 3000; the native backend publishes noVNC on 6080. Tunnelling
# 3000 in native mode gives a dead URL, so ask the native script which one it
# actually opened instead of assuming.
DESKTOP_PORT="${VXC_DESKTOP_PORT:-3000}"
if [ "${VXC_BACKEND:-}" = "native" ] || [ -f "$HOME/.local/state/virgox/websockify.pid" ]; then
  DESKTOP_PORT="${VXC_NOVNC_PORT:-6080}"
fi
TERMINAL_PORT="${VXC_TTYD_PORT:-7681}"

echo "[*] Launching high-speed Cloudflare Tunnels (Desktop $DESKTOP_PORT & Terminal $TERMINAL_PORT)..."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[!] cloudflared is not installed, so no public tunnels can be created."
  echo "    Install it with:  bash scripts/install_cloudflared.sh"
  echo "    The desktop, terminal and bridge are still reachable on localhost."
  exit 0
fi

pkill -f "cloudflared tunnel" 2>/dev/null || true
setsid cloudflared tunnel --url "http://localhost:$DESKTOP_PORT" </dev/null >/tmp/cf_desktop.log 2>&1 &
setsid cloudflared tunnel --url "http://localhost:$TERMINAL_PORT" </dev/null >/tmp/cf_terminal.log 2>&1 &

sleep 8

DESKTOP_URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.trycloudflare\.com' /tmp/cf_desktop.log 2>/dev/null | head -n 1)
TERMINAL_URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.trycloudflare\.com' /tmp/cf_terminal.log 2>/dev/null | head -n 1)

echo "------------------------------------------------------------------------------"
echo "  🖥️  Phone 2 (DESKTOP GUI):  ${DESKTOP_URL:-<tunnel not established — see /tmp/cf_desktop.log>}"
echo "  💻 Phone 1 (TERMINAL CLI): ${TERMINAL_URL:-<tunnel not established — see /tmp/cf_terminal.log>}"
echo "------------------------------------------------------------------------------"
