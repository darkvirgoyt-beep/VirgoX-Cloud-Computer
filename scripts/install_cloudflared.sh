#!/usr/bin/env bash
# ==============================================================================
# VirgoX Cloud Computer — cloudflared installer
# ==============================================================================
set -e

# cloudflared publishes one binary per CPU/arch. Fetching the amd64 build on
# ARM64 produces a file that cannot execute, so the asset is chosen from the
# machine actually running this script and then executed once to prove it works.
case "$(uname -m 2>/dev/null || echo unknown)" in
  x86_64|amd64)  ASSET=amd64 ;;
  aarch64|arm64) ASSET=arm64 ;;
  *) echo "[!] Unsupported architecture: $(uname -m). Nothing was installed."; exit 1 ;;
esac

if command -v cloudflared >/dev/null 2>&1 && cloudflared --version >/dev/null 2>&1; then
  echo "[+] cloudflared already installed: $(cloudflared --version 2>&1 | head -1)"
  exit 0
fi

URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ASSET}"
echo "[*] Downloading cloudflared for ${ASSET}..."
curl -fsSL "$URL" -o /tmp/vxc-cloudflared
chmod +x /tmp/vxc-cloudflared

if ! /tmp/vxc-cloudflared --version >/dev/null 2>&1; then
  echo "[!] The downloaded cloudflared will not execute on this CPU. Removing it."
  rm -f /tmp/vxc-cloudflared
  exit 1
fi

if install -m 0755 /tmp/vxc-cloudflared /usr/local/bin/cloudflared 2>/dev/null; then
  :
else
  mkdir -p "$HOME/.local/bin"
  install -m 0755 /tmp/vxc-cloudflared "$HOME/.local/bin/cloudflared"
fi
rm -f /tmp/vxc-cloudflared
echo "[+] cloudflared installed: $(command -v cloudflared) — $(cloudflared --version 2>&1 | head -1)"
