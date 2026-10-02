#!/usr/bin/env bash
# ==============================================================================
# 🪟 VirgoX Cloud Computer — Windows 11 Automated Setup & Launcher
# Developer: Prince · VirgoYT (@darkvirgoyt-beep)
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=============================================================================="
echo "          ⚡ VirgoX Cloud Computer — Windows 11 Pro Cloud PC ⚡"
echo "                     Developer: Prince · VirgoYT"
echo "=============================================================================="

# 1. Ensure storage directory exists
WIN_DIR="/home/darkvirgoyt/virgox_win_storage"
mkdir -p "$WIN_DIR"

# 2. Check KVM Acceleration
if [ -e /dev/kvm ]; then
    echo "[+] KVM hardware virtualization acceleration detected: /dev/kvm is available."
    KVM_ARG="--device=/dev/kvm"
else
    echo "[!] Notice: /dev/kvm not found. Windows 11 will run in emulation mode."
    KVM_ARG=""
fi

# 3. Check and launch Windows 11 container
if ! docker ps -a --format '{{.Names}}' | grep -q "^virgox-windows11$"; then
    echo "[*] Creating and starting virgox-windows11 container..."
    docker run -d \
      --name=virgox-windows11 \
      --privileged \
      --cap-add=NET_ADMIN \
      $KVM_ARG \
      -e VERSION=win11 \
      -e RAM_SIZE=6G \
      -e CPU_CORES=4 \
      -e DISK_SIZE=64G \
      -p 8006:8006 \
      -p 3389:3389/tcp \
      -p 3389:3389/udp \
      -v "$WIN_DIR":/storage \
      --stop-timeout 120 \
      --restart unless-stopped \
      dockurr/windows:latest
else
    echo "[*] Container virgox-windows11 already exists. Starting it up..."
    docker start virgox-windows11 || true
fi

echo "=============================================================================="
echo "[+] Windows 11 Cloud Container is booting!"
echo "[+] Web Stream URL:   http://localhost:8006"
echo "[+] RDP Access Port:  3389"
echo "=============================================================================="
