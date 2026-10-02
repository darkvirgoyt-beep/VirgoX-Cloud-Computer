#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd || echo "")"
ROOT="${HOME}/.virgox-cloud-computer"

# Detect binary directory
if [ -n "${PREFIX:-}" ] && [ -d "${PREFIX}/bin" ]; then
  BIN_DIR="${PREFIX}/bin"
elif [ "$(id -u)" -eq 0 ]; then
  BIN_DIR="/usr/local/bin"
else
  BIN_DIR="${HOME}/.local/bin"
fi

mkdir -p "${BIN_DIR}"
mkdir -p "${ROOT}/bin"

printf '\n'
printf '╭────────────────────────────────────────────╮\n'
printf '│              ⚡ VIRGOX CLOUD PC            │\n'
printf '│         Instant Terminal CLI Installer     │\n'
printf '╰────────────────────────────────────────────╯\n\n'

if ! command -v curl >/dev/null 2>&1; then
  if command -v pkg >/dev/null 2>&1; then
    pkg install -y curl
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y curl
  else
    echo "[ERROR] curl is required."
    exit 1
  fi
fi

# Ensure python3 is available
if ! command -v python3 >/dev/null 2>&1; then
  echo "[i] Installing python3..."
  if command -v pkg >/dev/null 2>&1; then
    pkg install -y python
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y python3
  fi
fi

echo "[1/2] Fetching vxc CLI client..."

# Prefer local file if running from cloned repository
if [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/bin/vxc" ]; then
  cp -f "${SCRIPT_DIR}/bin/vxc" "${ROOT}/bin/vxc"
else
  set +e
  curl -fsSL "https://virgoxcloud.vercel.app/bin/vxc" -o "${ROOT}/bin/vxc" 2>/dev/null
  CURL_STATUS=$?
  if [ $CURL_STATUS -ne 0 ]; then
    curl -fsSL "https://raw.githubusercontent.com/darkvirgoyt-beep/VirgoX-Cloud-Computer/android-arm64-native-vxc/bin/vxc" -o "${ROOT}/bin/vxc" 2>/dev/null
    CURL_STATUS=$?
  fi
  if [ $CURL_STATUS -ne 0 ]; then
    curl -fsSL "https://raw.githubusercontent.com/darkvirgoyt-beep/VirgoX-Cloud-Computer/main/bin/vxc" -o "${ROOT}/bin/vxc" 2>/dev/null
  fi
  set -e
fi

chmod +x "${ROOT}/bin/vxc"

echo "[2/2] Installing vxc to ${BIN_DIR}/vxc..."
rm -f "${BIN_DIR}/vxc"
cp -f "${ROOT}/bin/vxc" "${BIN_DIR}/vxc" 2>/dev/null || ln -sf "${ROOT}/bin/vxc" "${BIN_DIR}/vxc"
chmod +x "${BIN_DIR}/vxc"

# Ensure PATH has BIN_DIR if user local bin
if [ "${BIN_DIR}" = "${HOME}/.local/bin" ]; then
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *)
      if [ -f "${HOME}/.bashrc" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "${HOME}/.bashrc"
      fi
      export PATH="$HOME/.local/bin:$PATH"
      ;;
  esac
fi

echo
echo "✓ VirgoX CLI (vxc) installed successfully!"
echo
echo "Quick Start:"
echo "  vxc auth login      # Sign in via GitHub on your browser/PC"
echo "  vxc auth status     # Check active session"
echo "  vxc run --open      # Launch native Cloud PC desktop"
echo
