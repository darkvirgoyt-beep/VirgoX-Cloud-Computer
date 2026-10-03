#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer.git"
BRANCH="android-arm64-native-vxc"
ROOT="${HOME}/.virgox-cloud-computer"
STATE="${HOME}/.virgox-native"
SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" 2>/dev/null && pwd || true)"

if [ -n "${PREFIX:-}" ] && [ -d "${PREFIX}/bin" ]; then
  BIN_DIR="${PREFIX}/bin"
elif [ "$(id -u)" -eq 0 ]; then
  BIN_DIR="/usr/local/bin"
else
  BIN_DIR="${HOME}/.local/bin"
fi

printf '\n'
printf '╭────────────────────────────────────────────╮\n'
printf '│              ⚡ VIRGOX INSTALL              │\n'
printf '│        Native Android ARM64 Cloud PC        │\n'
printf '╰────────────────────────────────────────────╯\n\n'

mkdir -p "${BIN_DIR}" "${ROOT}" "${STATE}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl is required. Install curl in your proot, then rerun this installer."
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "[1/4] Downloading VirgoX runtime..."
if [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/start_native.sh" ] && [ -f "${SCRIPT_DIR}/bin/vxc" ]; then
  rm -rf "${ROOT}"
  mkdir -p "${ROOT}"
  cp -a "${SCRIPT_DIR}/." "${ROOT}/"
else
  curl -fL --retry 3 --retry-delay 1 \
    "https://codeload.github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer/tar.gz/refs/heads/${BRANCH}" \
    -o "${TMP}/virgox.tar.gz"
  tar -xzf "${TMP}/virgox.tar.gz" -C "${TMP}"
  rm -rf "${ROOT}"
  mkdir -p "${ROOT}"
  cp -a "${TMP}/VirgoX-Cloud-Computer-${BRANCH}/." "${ROOT}/"
fi
chmod +x "${ROOT}/bin/vxc" "${ROOT}/start_native.sh" 2>/dev/null || true

echo "[2/4] Installing the vxc command..."
rm -f "${BIN_DIR}/vxc"
cp -f "${ROOT}/bin/vxc" "${BIN_DIR}/vxc"
chmod +x "${BIN_DIR}/vxc"

# Proot-safe ARM64 Cloudflare quick tunnel. No pkg, sudo, or root is required.
echo "[3/4] Downloading Cloudflare Tunnel for public PC links..."
CLOUDFLARED="${STATE}/cloudflared"
if [ ! -x "${CLOUDFLARED}" ]; then
  curl -fL --retry 3 --retry-delay 1 \
    "${VIRGOX_CLOUDFLARED_URL:-https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64}" \
    -o "${CLOUDFLARED}"
  chmod 755 "${CLOUDFLARED}"
fi

# Make the local bin directory available in this shell and future bash sessions.
if [ "${BIN_DIR}" = "${HOME}/.local/bin" ]; then
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *)
      export PATH="${BIN_DIR}:${PATH}"
      if [ -f "${HOME}/.bashrc" ] && ! grep -qF 'export PATH="$HOME/.local/bin:$PATH"' "${HOME}/.bashrc"; then
        printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "${HOME}/.bashrc"
      fi
      ;;
  esac
fi

echo "[4/4] Verifying installation..."
"${BIN_DIR}/vxc" --version

echo
echo "✓ VirgoX installed for proot."
echo
echo "Run:"
echo "  vxc pc restart"
echo "  vxc auth login"
echo
echo "The auth command opens the public Vercel device page; no localhost link is used."
