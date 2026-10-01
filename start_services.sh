#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ "${VIRGOX_RUNTIME:-}" = "native" ] || [ "${VIRGOX_RUNTIME:-}" = "android" ]; then
    exec bash "$DIR/start_native.sh"
fi

echo "=== [1/5] Checking Desktop Container ==="
if ! docker ps --filter "name=virgox-desktop" --format "{{.Names}}" | grep -q "virgox-desktop"; then
    echo "[*] Starting virgox-desktop container..."
    docker start virgox-desktop 2>/dev/null || docker run -d \
      --name=virgox-desktop \
      --privileged \
      -e PUID=1000 \
      -e PGID=1000 \
      -e TZ=Etc/UTC \
      -e TITLE="VirgoX Cyber Linux Desktop" \
      -e MAX_RES=1920x1080 \
      -p 3000:3000 \
      -p 3001:3001 \
      -v "$HOME":/config/Desktop/VirgoX-Files \
      --shm-size="2gb" \
      --restart unless-stopped \
      lscr.io/linuxserver/webtop:ubuntu-xfce
fi

echo "=== [2/5] Starting ttyd & Bridge API ==="
pgrep -f "ttyd -p 7681" >/dev/null || setsid ttyd -p 7681 -W bash >/dev/null 2>&1 &

pkill -f "python3.*server.py" 2>/dev/null || true
tmux kill-session -t virgox-bridge 2>/dev/null || true
tmux new-session -d -s virgox-bridge "python3 $DIR/server.py"

echo "=== [3/5] Starting Cloudflare Tunnels (HTTP/2) ==="
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

rm -f /tmp/cf_desktop.log /tmp/cf_terminal.log /tmp/cf_bridge.log

setsid cloudflared tunnel --protocol http2 --url http://localhost:3000 </dev/null >/tmp/cf_desktop.log 2>&1 &
setsid cloudflared tunnel --protocol http2 --url http://localhost:7681 </dev/null >/tmp/cf_terminal.log 2>&1 &
setsid cloudflared tunnel --protocol http2 --url http://localhost:8888 </dev/null >/tmp/cf_bridge.log 2>&1 &

echo "[*] Waiting for tunnel URLs..."
for i in $(seq 1 30); do
    DESKTOP_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf_desktop.log 2>/dev/null | grep -v 'api.trycloudflare.com' | head -1 || true)
    TERMINAL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf_terminal.log 2>/dev/null | grep -v 'api.trycloudflare.com' | head -1 || true)
    BRIDGE_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf_bridge.log 2>/dev/null | grep -v 'api.trycloudflare.com' | head -1 || true)

    if [ -n "$DESKTOP_URL" ] && [ -n "$TERMINAL_URL" ] && [ -n "$BRIDGE_URL" ]; then
        break
    fi
    sleep 1
done

echo "Desktop URL:  $DESKTOP_URL"
echo "Terminal URL: $TERMINAL_URL"
echo "Bridge URL:   $BRIDGE_URL"

if [ -z "$DESKTOP_URL" ] || [ -z "$TERMINAL_URL" ] || [ -z "$BRIDGE_URL" ]; then
    echo "[-] Error: Failed to acquire all 3 tunnel URLs"
    exit 1
fi

echo "=== [4/5] Updating app.js ==="
node -e "
const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');
code = code.replace(/desktopUrl:\s*'[^']*'/, \"desktopUrl: '$DESKTOP_URL'\");
code = code.replace(/terminalUrl:\s*'[^']*'/, \"terminalUrl: '$TERMINAL_URL'\");
code = code.replace(/bridgeUrl:\s*'[^']*'/, \"bridgeUrl: '$BRIDGE_URL'\");
fs.writeFileSync('app.js', code);
console.log('[+] app.js updated successfully');
"

echo "=== [5/5] Pushing to GitHub ==="
git add app.js index.html server.py style.css start_services.sh
git commit -m "⚡ Update live tunnel URLs, AI Copilot, and Trackpad/Touch mode switcher" || echo "Nothing to commit"
git push origin main
git push origin main:gh-pages --force

echo "=== SUCCESS! ALL SERVICES ARE LIVE ==="
