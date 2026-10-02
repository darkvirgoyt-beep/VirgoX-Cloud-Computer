#!/usr/bin/env bash
# ==============================================================================
# VirgoX Multi-Device Cloudflare Tunnel Generator
# ==============================================================================
set -e

echo "[*] Launching high-speed Cloudflare Tunnels (Desktop 3000 & Terminal 7681)..."

pkill -f "cloudflared tunnel" || true
setsid cloudflared tunnel --url http://localhost:3000 </dev/null >/tmp/cf_desktop.log 2>&1 &
setsid cloudflared tunnel --url http://localhost:7681 </dev/null >/tmp/cf_terminal.log 2>&1 &

sleep 8

DESKTOP_URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.trycloudflare\.com' /tmp/cf_desktop.log | head -n 1)
TERMINAL_URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]\+\.trycloudflare\.com' /tmp/cf_terminal.log | head -n 1)

echo "------------------------------------------------------------------------------"
echo "  🖥️  Phone 2 (DESKTOP GUI):  $DESKTOP_URL"
echo "  💻 Phone 1 (TERMINAL CLI): $TERMINAL_URL"
echo "------------------------------------------------------------------------------"
