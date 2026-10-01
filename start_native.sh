#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export VIRGOX_RUNTIME=native
export VIRGOX_HOME="${VIRGOX_HOME:-$HOME}"
export DISPLAY="${DISPLAY:-:1}"
STATE="$HOME/.virgox-native"
mkdir -p "$STATE" "$HOME/VirgoX-Files" "/tmp/virgox-runtime-$(id -u)"
export XDG_RUNTIME_DIR="/tmp/virgox-runtime-$(id -u)"

start_if_missing() {
  local pidfile="$1"; shift
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then return; fi
  setsid "$@" >/dev/null 2>&1 &
  echo $! > "$pidfile"
}

echo "=== [1/5] Native X11 desktop ==="
start_if_missing "$STATE/xvfb.pid" Xvfb :1 -screen 0 1920x1080x24 -ac +extension GLX
sleep 1
if ! pgrep -f "startxfce4" >/dev/null 2>&1; then
  setsid env DISPLAY=:1 XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" dbus-launch --exit-with-session startxfce4 >"$STATE/xfce.log" 2>&1 &
fi

echo "=== [2/5] Browser desktop gateway on port 3000 ==="
if ! pgrep -f "x11vnc.*-rfbport 5900" >/dev/null 2>&1; then
  setsid x11vnc -display :1 -forever -shared -rfbport 5900 -localhost -nopw >"$STATE/x11vnc.log" 2>&1 &
fi
NOVNC_WEB="/usr/share/novnc"
[ -d "$NOVNC_WEB" ] || NOVNC_WEB="/usr/share/novnc"
if ! pgrep -f "websockify.*3000" >/dev/null 2>&1; then
  setsid websockify --web="$NOVNC_WEB" 3000 127.0.0.1:5900 >"$STATE/novnc.log" 2>&1 &
fi

echo "=== [3/5] Web terminal on port 7681 ==="
TTYD_BIN="$(command -v ttyd || true)"
[ -x "$TTYD_BIN" ] || TTYD_BIN="$STATE/ttyd"
if ! pgrep -f "ttyd.*7681" >/dev/null 2>&1; then
  setsid "$TTYD_BIN" -p 7681 -W bash >"$STATE/ttyd.log" 2>&1 &
fi

echo "=== [4/5] File manager + Bridge API ==="
if command -v filebrowser >/dev/null 2>&1 && ! pgrep -f "filebrowser.*8080" >/dev/null 2>&1; then
  setsid filebrowser -r "$HOME" -p 8080 -a 127.0.0.1 --noauth >"$STATE/filebrowser.log" 2>&1 &
fi
pkill -f "python3.*server.py" 2>/dev/null || true
nohup env VIRGOX_RUNTIME=native VIRGOX_HOME="$HOME" python3 "$DIR/server.py" >"$HOME/bridge_server.log" 2>&1 &
echo $! > "$STATE/server.pid"

echo "=== [5/5] Optional Cloudflare public tunnels ==="
if command -v cloudflared >/dev/null 2>&1; then
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  setsid cloudflared tunnel --protocol http2 --url http://127.0.0.1:3000 >"$STATE/cf_desktop.log" 2>&1 &
  setsid cloudflared tunnel --protocol http2 --url http://127.0.0.1:7681 >"$STATE/cf_terminal.log" 2>&1 &
  setsid cloudflared tunnel --protocol http2 --url http://127.0.0.1:8888 >"$STATE/cf_bridge.log" 2>&1 &
  echo "[*] cloudflared started; URLs are in $STATE/cf_*.log"
else
  echo "[i] cloudflared not installed; local services are still available."
fi

echo
echo "Desktop:  http://127.0.0.1:3000/vnc.html?autoconnect=true"
echo "Terminal: http://127.0.0.1:7681/"
echo "Bridge:   http://127.0.0.1:8888/"
