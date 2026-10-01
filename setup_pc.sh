#!/usr/bin/env bash
# ==============================================================================
# VirgoX Cloud Computer — One-Click Automated Setup & Launch Script
# Developer: Prince · VirgoYT (@darkvirgoyt-beep)
# Supports: Linux desktop (Docker or native), Windows 11 Cloud VM
#
#   bash setup_pc.sh            # auto-detect: Docker if it works here, else native
#   bash setup_pc.sh native     # force the Docker-free userspace backend
#   bash setup_pc.sh linux      # force the Docker backend
#   bash setup_pc.sh win11      # Windows 11
#
# The backend is chosen by scripts/vxc-doctor.sh, which tests rather than
# assumes. On Android under proot-distro Docker cannot start a container at all,
# so the native backend runs the same desktop directly in your own userspace.
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_OS="${1:-auto}"
STATE_DIR="${VXC_STATE_DIR:-$HOME/.local/state/virgox}"
LOG_DIR="${VXC_LOG_DIR:-$HOME/virgox-logs}"
DESKTOP_DIR="${VXC_DESKTOP_DIR:-$HOME/VirgoX-Files}"
mkdir -p "$STATE_DIR" "$LOG_DIR" "$DESKTOP_DIR"

echo "=============================================================================="
echo "       ⚡ Starting VirgoX Cloud Computer & Multi-Device Workspace ⚡"
echo "                     Developer: Prince · VirgoYT"
echo "                     Requested: $TARGET_OS"
echo "=============================================================================="

# --- helpers ------------------------------------------------------------------
have()  { command -v "$1" >/dev/null 2>&1; }
arch_of() {
  case "$(uname -m 2>/dev/null || echo unknown)" in
    x86_64|amd64)   echo x86_64 ;;
    aarch64|arm64)  echo aarch64 ;;
    *)              uname -m ;;
  esac
}

# ttyd publishes one release binary per CPU. Downloading the x86_64 build on
# ARM64 gets you a file that dies with SIGILL the moment you run it, so the
# asset name is always derived from the machine that is actually running this.
install_ttyd() {
  if have ttyd && ttyd --version >/dev/null 2>&1; then
    echo "[+] ttyd already installed: $(ttyd --version 2>&1 | head -1)"
    return 0
  fi
  local a; a=$(arch_of)
  echo "[*] Installing ttyd for $a..."
  # Prefer the distribution package: it is built for this CPU by definition and
  # it does not fight the rest of the system over /usr/local/bin.
  if have apt-get; then
    if DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ttyd >/dev/null 2>&1; then
      echo "[+] ttyd installed from apt: $(ttyd --version 2>&1 | head -1)"
      return 0
    fi
  fi
  local url="https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.$a"
  if curl -fsSL "$url" -o /tmp/vxc-ttyd; then
    chmod +x /tmp/vxc-ttyd
    # Prove it executes here before putting it on PATH. A wrong-arch binary
    # installs cleanly and only fails later, inside the browser session.
    if /tmp/vxc-ttyd --version >/dev/null 2>&1; then
      install -m 0755 /tmp/vxc-ttyd /usr/local/bin/ttyd 2>/dev/null \
        || install -m 0755 /tmp/vxc-ttyd "$HOME/.local/bin/ttyd"
      echo "[+] ttyd installed from release asset and verified on this CPU"
      rm -f /tmp/vxc-ttyd
      return 0
    fi
    echo "[!] Downloaded ttyd.$a but it will not execute on this CPU; removing it."
    rm -f /tmp/vxc-ttyd
  fi
  echo "[!] ttyd could not be installed. The web terminal will not start."
  return 1
}

# Does a browser actually RUN here? Not merely "is on PATH".
#
# Both failures below are real and have been hit here:
#   * chromium-browser on Ubuntu is a transitional snap shim. It exists, it is
#     executable, and it exits with "requires the chromium snap to be installed".
#   * google-chrome-stable's launcher is a bash script that uses process
#     substitution, which needs /dev/fd to be a symlink to /proc/self/fd.
#     Under proot /dev/fd is a real directory, so the launcher dies on
#     "/dev/fd/63: No such file or directory" — while the real ELF underneath
#     works fine.
# So each candidate is executed and only trusted if it answers.
browser_runs() {
  timeout 60 "$1" --version >/dev/null 2>&1
}

# repair /dev/fd first, since Chrome's launcher needs it
bash "$DIR/scripts/fix-dev-fd.sh" >/dev/null 2>&1 || true

install_browser() {
  # Already good?
  for b in google-chrome-stable google-chrome chromium chromium-browser firefox; do
    if have "$b" && browser_runs "$b"; then
      echo "[+] Browser available: $b ($("$b" --version 2>/dev/null | head -1))"
      return 0
    fi
    have "$b" && echo "    (skipping $b: installed but will not run in this environment)"
  done

  local a; a=$(arch_of)
  local debarch="$a"; [ "$a" = "aarch64" ] && debarch=arm64
  local url="https://dl.google.com/linux/direct/google-chrome-stable_current_${debarch}.deb"

  echo "[*] Trying Google Chrome for $debarch..."
  if curl -fsSL "$url" -o /tmp/vxc-chrome.deb 2>/dev/null; then
    if DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/vxc-chrome.deb >/dev/null 2>&1; then
      rm -f /tmp/vxc-chrome.deb
      if browser_runs google-chrome-stable; then
        echo "[+] Google Chrome installed and verified: $(google-chrome-stable --version 2>/dev/null | head -1)"
        return 0
      fi
      echo "[!] Chrome installed but does not run in this environment."
    fi
    echo "[!] Chrome could not be installed. The .deb is kept at $HOME for review."
    mv -f /tmp/vxc-chrome.deb "$HOME/virgox-chrome-$debarch.deb" 2>/dev/null || rm -f /tmp/vxc-chrome.deb
  fi

  # Last resort: any browser that at least answers to --version.
  for b in epiphany-browser netsurf-gtk firefox-esr; do
    if have "$b" && browser_runs "$b"; then
      echo "[+] Falling back to $b ($("$b" --version 2>/dev/null | head -1))"
      return 0
    fi
  done

  cat <<'EOF'
[!] No working desktop browser could be set up in this environment.

    This is a known limitation under proot-distro, not a broken script:
      * Google's arm64 Chrome installs correctly but traps (SIGTRAP) or hangs
        while starting its zygote — proot does not provide the kernel
        facilities Chrome needs.
      * chromium-browser on Ubuntu is a snap shim that cannot run here.
      * Termux's Firefox is an Android binary needing /system/bin/linker64,
        which does not exist inside proot.
      * Firefox publishes linux64 as x86-64 only.

    What still works: the desktop, the file manager, the terminal (ttyd) and
    the whole bridge API. Use the browser on your phone, pointed at the
    noVNC or terminal URL, and drive the desktop from there.
EOF
  return 1
}

# --- backend selection --------------------------------------------------------
BACKEND=""
if [ "$TARGET_OS" = "native" ]; then
  BACKEND=native
elif [ "$TARGET_OS" = "linux" ]; then
  BACKEND=docker
else
  echo "[*] Detecting which backend this machine can actually run..."
  if have bash && [ -f "$DIR/scripts/vxc-doctor.sh" ]; then
    DOCTOR_JSON=$(bash "$DIR/scripts/vxc-doctor.sh" --json 2>/dev/null || echo '{}')
    BACKEND=$(printf '%s' "$DOCTOR_JSON" | sed -n 's/.*"backend":"\([a-z]*\)".*/\1/p')
    BACKEND_WHY=$(printf '%s' "$DOCTOR_JSON" | sed -n 's/.*"backend_why":"\([^"]*\)".*/\1/p')
  fi
  [ -n "$BACKEND" ] || BACKEND=native
  echo "[*] Backend selected: $BACKEND"
  [ -n "${BACKEND_WHY:-}" ] && echo "    because: $BACKEND_WHY"
fi

if [ "$TARGET_OS" = "win11" ] || [ "$TARGET_OS" = "windows" ]; then
    echo "[*] Launching Windows 11 Cloud PC..."
    bash "$DIR/setup_windows11.sh"
    TARGET_OS=win11
elif [ "$BACKEND" = "docker" ]; then
    # 1. Check & Start Docker Container for Linux
    if ! docker ps -a --format '{{.Names}}' | grep -q "^virgox-desktop$"; then
        echo "[*] Launching virgox-desktop container..."
        docker run -d \
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
    else
        echo "[*] virgox-desktop container exists. Starting if stopped..."
        docker start virgox-desktop || true
    fi

    # 2. Install Tools Inside Container
    echo "[*] Ensuring tools and Google Chrome are installed inside container..."
    CARCH=$(docker exec virgox-desktop dpkg --print-architecture 2>/dev/null | tr -d '\r' || echo amd64)
    docker exec virgox-desktop bash -c "
    which google-chrome-stable >/dev/null 2>&1 || (
        apt-get update -y && \
        DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
            wget curl unzip zip jq android-tools-adb android-tools-fastboot \
            android-sdk-libsparse-utils e2fsprogs p7zip-full geany xfce4-taskmanager \
            wmctrl xdotool scrot git python3-pip wine wine64 winetricks blender rclone && \
        wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_${CARCH}.deb && \
        apt-get install -y /tmp/google-chrome.deb && \
        rm -f /tmp/google-chrome.deb
    )
    "

    # 3. Install ROM Utilities inside container
    which magiskboot >/dev/null 2>&1 && docker cp $(which magiskboot) virgox-desktop:/usr/local/bin/magiskboot 2>/dev/null || true
    which payload-dumper-go >/dev/null 2>&1 && docker cp $(which payload-dumper-go) virgox-desktop:/usr/local/bin/payload-dumper-go 2>/dev/null || true

    # 4. Deploy Desktop Shortcuts & Custom Icons
    echo "[*] Deploying desktop shortcuts, icons, and native input daemon..."
    docker exec virgox-desktop mkdir -p /usr/share/icons/virgox
    docker cp "$DIR/assets/icons/." virgox-desktop:/usr/share/icons/virgox/ 2>/dev/null || true
    docker cp "$DIR/desktop-shortcuts/." virgox-desktop:/config/Desktop/ 2>/dev/null || true
    docker cp "$DIR/desktop-shortcuts/." virgox-desktop:/usr/share/applications/ 2>/dev/null || true
    docker cp "$DIR/scripts/desktop/." virgox-desktop:/usr/local/bin/ 2>/dev/null || true
    docker exec virgox-desktop bash -c '
      chmod +x /usr/local/bin/* 2>/dev/null || true
      chmod +x /config/Desktop/*.desktop 2>/dev/null || true
      chown -R abc:abc /config/Desktop 2>/dev/null || true
    '
else
    # ============================= NATIVE BACKEND =============================
    # No container. Everything webtop would have provided, run directly here.
    echo "[*] Native backend: running the desktop in your own userspace (no Docker)."

    # 1. Dependencies. Every one of these is pure userspace — no namespaces,
    #    no cgroups, no kernel modules — so all of them work under proot.
    echo "[*] Installing native desktop dependencies..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        xvfb x11vnc xdotool wmctrl scrot openbox xterm novnc websockify \
        x11-utils xauth feh >/dev/null 2>&1 \
      || echo "[!] Some desktop packages could not be installed; continuing with what is present."

    install_ttyd || true
    install_browser || true

    # 2. Desktop files, icons and the VirgoX command scripts. In native mode
    #    these live in $HOME rather than inside /config, which only exists in
    #    the webtop image.
    echo "[*] Deploying desktop shortcuts, icons, and helper scripts..."
    mkdir -p "$HOME/.local/share/icons/virgox" "$HOME/.local/share/applications" "$HOME/Desktop" "$HOME/.local/bin"
    cp -f "$DIR/assets/icons/." "$HOME/.local/share/icons/virgox/" 2>/dev/null || true
    # Render the entries instead of copying them: a .desktop file cannot do
    # variable substitution, so /config/Desktop/VirgoX-Files and the browser
    # command have to be resolved here or the launcher points at paths that
    # only exist inside the webtop image.
    VXC_BACKEND=native VXC_HOME="$HOME" \
      bash "$DIR/scripts/render-shortcuts.sh" "$DIR/desktop-shortcuts" "$HOME/Desktop"
    cp -f "$HOME/Desktop/."*.desktop "$HOME/.local/share/applications/" 2>/dev/null || true
    cp -f "$DIR/scripts/desktop/." "$HOME/.local/bin/" 2>/dev/null || true
    chmod +x "$HOME/.local/bin/"* 2>/dev/null || true
    chmod +x "$HOME/Desktop/"*.desktop 2>/dev/null || true
    # The desktop entries point at /usr/local/bin, which is not writable in
    # proot. Publish the scripts there when possible, otherwise rewrite the
    # entries to the user's own bin directory.
    if install -m 0755 "$DIR/scripts/desktop/." /usr/local/bin/ 2>/dev/null; then
      echo "[+] Helper scripts installed to /usr/local/bin"
    else
      echo "[*] /usr/local/bin is not writable; rewriting desktop entries to $HOME/.local/bin"
      for f in "$HOME/Desktop"/*.desktop "$HOME/.local/share/applications"/*.desktop; do
        [ -f "$f" ] || continue
        sed -i "s#/usr/local/bin#$HOME/.local/bin#g" "$f" 2>/dev/null || true
      done
    fi
    # /dev/fd must be a symlink for Google Chrome's launcher, which uses
    # process substitution. Under proot it is a real directory, so the fix has
    # to be applied before any browser is started.
    bash "$DIR/scripts/fix-dev-fd.sh" || true

    # 3. Start the desktop itself.
    VXC_DESKTOP_DIR="$DESKTOP_DIR" VXC_RUN_DIR="$STATE_DIR" \
      bash "$DIR/scripts/vxc-native-desktop.sh" start
fi

# 5. Web Terminal (ttyd on 7681). The native backend already started it; this
#    only matters for the Docker path or if the native start was skipped.
if ! ss -tln 2>/dev/null | grep -q ':7681'; then
  install_ttyd >/dev/null 2>&1 || true
  have ttyd && setsid -f ttyd -p 7681 -W bash
fi

# 6. Web File Manager (filebrowser on 8080)
if ! ss -tln 2>/dev/null | grep -q ':8080'; then
  if have filebrowser; then
    setsid -f filebrowser -r "$HOME" -p 8080 -a 127.0.0.1 >/dev/null 2>&1 || true
  else
    echo "[!] filebrowser is not installed. Install it with: apt-get install -y filebrowser"
    echo "    (The old installer fetched a random script from the internet; that is not done here.)"
  fi
fi

# 7. Start Bridge API Server (Port 8888)
pkill -f "python3.*server.py" 2>/dev/null || true
sleep 1
# The log path used to be hardcoded to /home/darkvirgoyt, which does not exist
# on any other machine and silently discarded the log.
setsid nohup python3 "$DIR/server.py" > "$LOG_DIR/bridge_server.log" 2>&1 &
sleep 1
if ss -tln 2>/dev/null | grep -q ':8888'; then
  echo "[*] Bridge API Server listening on 8888. Log: $LOG_DIR/bridge_server.log"
else
  echo "[!] Bridge API Server did not bind 8888. Check $LOG_DIR/bridge_server.log"
fi

# 8. Generate Live Public Tunnels
if [ "${VXC_NO_TUNNELS:-0}" = "1" ]; then
  echo "[*] Skipping tunnels (VXC_NO_TUNNELS=1)."
else
  echo "[*] Establishing live public tunnels for multi-device access..."
  bash "$DIR/scripts/start_tunnels.sh" || echo "[!] Tunnels could not be created (cloudflared may be missing)."
fi

echo "=============================================================================="
echo "[SUCCESS] VirgoX Cloud Computer ($TARGET_OS / backend=$BACKEND) is online."
if [ "$BACKEND" = "native" ]; then
  echo "  Desktop  : http://localhost:6080/vnc.html?autoconnect=1&resize=scale"
  echo "  Terminal : http://localhost:7681"
  echo "  Bridge   : http://localhost:8888"
  echo "  Sign in with: vxc auth login"
fi
echo "=============================================================================="
