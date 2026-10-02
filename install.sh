#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer.git"
BRANCH="android-arm64-native-vxc"
ROOT="${HOME}/.virgox-cloud-computer"
if [ "$(id -u)" -eq 0 ]; then
  BIN_DIR="/usr/local/bin"
else
  BIN_DIR="${HOME}/.local/bin"
fi

printf '\n'
printf '╭────────────────────────────────────────────╮\n'
printf '│              ⚡ VIRGOX INSTALL              │\n'
printf '│        Native Android ARM64 Cloud PC        │\n'
printf '╰────────────────────────────────────────────╯\n\n'

mkdir -p "${BIN_DIR}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl is required."
  exit 1
fi

echo "[1/3] Downloading VirgoX runtime..."
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

curl -fL --retry 3 --retry-delay 1 \
  "https://codeload.github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer/tar.gz/refs/heads/android-arm64-native-vxc" \
  -o "${tmp}/virgox.tar.gz"

rm -rf "${ROOT}"
mkdir -p "${ROOT}"
tar -xzf "${tmp}/virgox.tar.gz" -C "${tmp}"
mv "${tmp}/VirgoX-Cloud-Computer-android-arm64-native-vxc"/* "${ROOT}/"
mv "${tmp}/VirgoX-Cloud-Computer-android-arm64-native-vxc"/.[!.]* "${ROOT}/" 2>/dev/null || true

chmod +x "${ROOT}/bin/vxc" "${ROOT}/setup_android.sh" "${ROOT}/start_native.sh"

echo "[2/3] Installing native ARM64 desktop dependencies..."
bash "${ROOT}/setup_android.sh"

echo "[3/3] Installing vxc command..."
ln -sf "${ROOT}/bin/vxc" "${BIN_DIR}/vxc"

if [ "${BIN_DIR}" = "${HOME}/.local/bin" ]; then
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *)
      echo
      echo "[NOTE] Add this to your shell profile:"
      echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
      ;;
  esac
fi

echo
echo "✓ VirgoX installed."
echo
echo "Run:"
echo "  vxc run --open"
echo
echo "Useful commands:"
echo "  vxc pc status"
echo "  vxc pc stop"
echo "  vxc pc restart --open"
echo "  vxc auth login"
