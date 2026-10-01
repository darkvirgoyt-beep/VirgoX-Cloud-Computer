#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export VIRGOX_RUNTIME=native
export VIRGOX_HOME="${VIRGOX_HOME:-$HOME}"
export DISPLAY="${DISPLAY:-:1}"

echo "=== VirgoX Native ARM64 setup ==="
echo "[*] Installing native desktop/runtime dependencies..."
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  xfce4 xfce4-goodies xfce4-terminal dbus-x11 xvfb x11vnc novnc websockify \
  xdotool wmctrl scrot curl wget unzip git python3 python3-pip filebrowser ttyd \
  chromium || true

mkdir -p "$HOME/VirgoX-Files" "$HOME/.virgox-native" "$HOME/.config/vxc"
chmod 700 "$HOME/.config/vxc"

# ARM64 ttyd: use the distro package when available; otherwise use the official
# aarch64 release asset instead of the old x86_64-only binary.
if ! command -v ttyd >/dev/null 2>&1; then
  curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.aarch64" -o "$HOME/.virgox-native/ttyd"
  chmod +x "$HOME/.virgox-native/ttyd"
fi

echo "[*] Starting VirgoX native services..."
VIRGOX_RUNTIME=native VIRGOX_HOME="$HOME" bash "$DIR/start_native.sh"

echo
echo "[SUCCESS] Native ARM64 VirgoX runtime is ready."
echo "Run: vxc auth login"
