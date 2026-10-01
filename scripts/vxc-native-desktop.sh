#!/usr/bin/env bash
# ==============================================================================
# ⚡ VirgoX Cloud Computer — Native Desktop Backend (no Docker)
# Developer: Prince · VirgoYT (@darkvirgoyt-beep)
#
# The Linux desktop without a container. Everything webtop would have given you,
# running directly in the Ubuntu userspace that proot-distro already provides:
#
#   Xvfb        a real X server on a virtual screen
#   openbox     a window manager, so wmctrl and xdotool have something to talk to
#   x11vnc      exports the screen as VNC  (forced to -noshm, see below)
#   websockify  bridges VNC to a browser, serving noVNC's own client
#   ttyd        the web terminal
#
# Ports match the container backend on purpose, so app.js and every tunnel keep
# working unchanged:
#
#   3000  desktop (noVNC)      7681  terminal (ttyd)      8888  bridge (server.py)
#
# Why -noshm: under proot, x11vnc's shmget(scanline) fails with EIO and the
# process exits. Without SysV shm it falls back to XGetImage, which is slower
# but works. Verified: a full 1280x800 framebuffer crosses the wire this way.
#
# Usage:  bash scripts/vxc-native-desktop.sh start|stop|status
# ==============================================================================
set -uo pipefail

DISPLAY_NUM="${VXC_DISPLAY:-:1}"
GEOMETRY="${VXC_GEOMETRY:-1280x800x24}"
VNC_PORT="${VXC_VNC_PORT:-5900}"
NOVNC_PORT="${VXC_NOVNC_PORT:-6080}"
TTYD_PORT="${VXC_TTYD_PORT:-7681}"
TITLE="${VXC_TITLE:-VirgoX Cloud PC}"
RUN_DIR="${VXC_RUN_DIR:-$HOME/.local/state/virgox}"
DESKTOP_DIR="${VXC_DESKTOP_DIR:-$HOME/VirgoX-Files}"
WM="${VXC_WM:-openbox}"

mkdir -p "$RUN_DIR"
export DISPLAY="$DISPLAY_NUM"

pidfile() { echo "$RUN_DIR/$1.pid"; }
logfile() { echo "$RUN_DIR/$1.log"; }

have() { command -v "$1" >/dev/null 2>&1; }

running() { # running <name>
  local pf; pf=$(pidfile "$1")
  [ -f "$pf" ] || return 1
  local pid; pid=$(cat "$pf" 2>/dev/null)
  [ -n "$pid" ] || return 1
  # "adopted" means the service was already serving its port when this script
  # started and was not launched here: it is running, but stop must not kill it.
  [ "$pid" = "adopted" ] && return 0
  kill -0 "$pid" 2>/dev/null
}

adopted() { # adopted <name> — true when we did not start it
  local pf; pf=$(pidfile "$1")
  [ -f "$pf" ] && [ "$(cat "$pf" 2>/dev/null)" = "adopted" ]
}

# Port liveness: does something actually answer on this TCP port?
#
# The pidfile check alone is not enough. A previous run may have used a
# different RUN_DIR, or the processes may have been started by hand, and in
# either case there is no pidfile here while the ports are genuinely taken.
# Starting a second Xvfb/x11vnc then fails with confusing errors ("Server is
# already active for display 1", "could not obtain listening port") that look
# like a broken script rather than a desktop that is already up.
port_live() { # port_live <port>
  local p="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null && exec 3>&- && return 0
  return 1
}

port_of() {
  case "$1" in
    x11vnc)     echo "$VNC_PORT" ;;
    websockify) echo "$NOVNC_PORT" ;;
    ttyd)       echo "$TTYD_PORT" ;;
    *)          echo "" ;;
  esac
}

# Xvfb and the window manager own no TCP port — Xvfb is started with
# -nolisten tcp and talks over a unix socket. Probe them the way they are
# actually reachable, not with an invented port number.
service_live() { # service_live <name>
  case "$1" in
    Xvfb)   DISPLAY="$DISPLAY_NUM" xdotool getdisplaygeometry >/dev/null 2>&1 ;;
    openbox) DISPLAY="$DISPLAY_NUM" wmctrl -m >/dev/null 2>&1 ;;
    *)      local p; p=$(port_of "$1"); [ -n "$p" ] && port_live "$p" ;;
  esac
}

start_one() { # start_one <name> <cmd...>
  local name="$1"; shift
  local log; log=$(logfile "$name")
  if running "$name"; then
    printf '  [+] %-10s already running (pid %s)\n' "$name" "$(cat "$(pidfile "$name")")"
    return 0
  fi
  # Something is already serving this port. Adopt it rather than starting a
  # duplicate that is guaranteed to fail and reports a confusing error.
  if service_live "$name"; then
    # "adopted" is a sentinel, never a real pid: kill -0 0 signals the whole
    # process group, so stop must test for this marker rather than kill it.
    echo "adopted" > "$(pidfile "$name")"
    printf '  [+] %-10s already up (adopted, not started here)\n' "$name"
    return 0
  fi
  setsid "$@" >"$log" 2>&1 &
  local pid=$!
  echo "$pid" > "$(pidfile "$name")"
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    printf '  [+] %-10s started (pid %s)\n' "$name" "$pid"
    return 0
  fi
  printf '  [!] %-10s FAILED to start — see %s\n' "$name" "$log"
  local total; total=$(sed -n '$=' "$log" 2>/dev/null || echo 0)
  if [ "${total:-0}" -gt 0 ]; then
    local from=$(( total > 5 ? total - 4 : 1 ))
    sed -n "${from},\$p" "$log" 2>/dev/null | sed 's/^/        /'
  fi
  rm -f "$(pidfile "$name")"
  return 1
}

start_x() {
  printf '\n[*] Starting the native desktop on %s (%s)\n' "$DISPLAY_NUM" "$GEOMETRY"
  # The binary is named Xvfb, but its pidfile label must not be passed to it:
  # Xvfb rejects any argument it does not recognise and exits with
  # "Unrecognized option: Xvfb". The label only names the pidfile.
  start_one Xvfb "$(command -v Xvfb)" "$DISPLAY_NUM" -screen 0 "$GEOMETRY" -nolisten tcp -ac
  # Give the X server a moment; openbox and x11vnc both fail if it is not up.
  local i=0
  while [ $i -lt 20 ]; do
    if xdotool getdisplaygeometry >/dev/null 2>&1; then break; fi
    i=$((i+1)); sleep 0.5
  done
  if xdotool getdisplaygeometry >/dev/null 2>&1; then
    printf '  [+] X server is up (%s)\n' "$(xdotool getdisplaygeometry 2>/dev/null | tr '\n' 'x')"
  else
    printf '  [!] X server did not come up. Native desktop cannot continue.\n'
    return 1
  fi

  if have "$WM"; then
    start_one "$WM" "$(command -v "$WM")" --sm-disable
  else
    printf '  [!] %s not installed — windows will have no decorations and wmctrl will list nothing\n' "$WM"
  fi

  # -noshm is mandatory under proot; without it x11vnc exits on shmget EIO.
  start_one x11vnc x11vnc \
    -display "$DISPLAY_NUM" -rfbport "$VNC_PORT" -localhost \
    -forever -shared -nopw -noshm -noxdamage

  start_one websockify websockify \
    --web=/usr/share/novnc "$NOVNC_PORT" "localhost:$VNC_PORT"

  # Confirm the chain actually serves, rather than trusting that the processes
  # started. A running process that answers nothing is not a working desktop.
  local i2=0 code=000
  while [ $i2 -lt 15 ]; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NOVNC_PORT/vnc.html" 2>/dev/null || echo 000)
    [ "$code" = "200" ] && break
    i2=$((i2+1)); sleep 1
  done
  if [ "$code" = "200" ]; then
    printf '  [+] noVNC is serving vnc.html (HTTP 200) on %s\n' "$NOVNC_PORT"
  else
    printf '  [!] noVNC did not answer (last HTTP %s) — see %s\n' "$code" "$(logfile websockify)"
  fi
}

start_terminal() {
  printf '\n[*] Starting the web terminal on %s\n' "$TTYD_PORT"
  if command -v ttyd >/dev/null 2>&1; then
    start_one ttyd ttyd -p "$TTYD_PORT" -W -t titleFixed="$TITLE" bash
  else
    printf '  [!] ttyd is not installed. On Ubuntu: apt-get install -y ttyd\n'
    printf '      Do not fetch a release binary — the x86_64 build SIGILLs on ARM64.\n'
  fi
}

do_start() {
  printf '==============================================================================\n'
  printf '  ⚡ VirgoX Cloud Computer — Native Backend (no Docker)\n'
  printf '  Architecture: %s | Display %s | noVNC %s | ttyd %s\n' "$(uname -m)" "$DISPLAY_NUM" "$NOVNC_PORT" "$TTYD_PORT"
  printf '==============================================================================\n'
  mkdir -p "$DESKTOP_DIR"
  start_x || return 1
  start_terminal
  printf '\n  Desktop: http://localhost:%s/vnc.html?autoconnect=1&resize=scale\n' "$NOVNC_PORT"
  printf '  Terminal: http://localhost:%s\n' "$TTYD_PORT"
  printf '  Bridge:  http://localhost:8888  (start server.py separately)\n'
  printf '\n'
}

do_stop() {
  printf '  Stopping native desktop...\n'
  for n in $(ls "$RUN_DIR"/*.pid 2>/dev/null | sed 's|.*/||; s|\.pid$||'); do
    pf=$(pidfile "$n")
    pid=$(cat "$pf" 2>/dev/null || true)
    if [ "${pid:-}" = "adopted" ]; then
      # Adopted: something else owns this port and this script did not start
      # it, so killing it here would stop a desktop the user may be using.
      printf '  [~] %s left running (adopted, not started here)\n' "$n"
      rm -f "$pf"
      continue
    fi
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      printf '  [-] %s (pid %s)\n' "$n" "$pid"
    fi
    rm -f "$pf"
  done
  # x11vnc and Xvfb sometimes outlive their parent under setsid.
  pkill -f "Xvfb $DISPLAY_NUM" 2>/dev/null || true
  printf '\n'
}

do_status() {
  printf '\n  Native backend status:\n'
  for n in Xvfb openbox x11vnc websockify ttyd; do
    if running "$n"; then printf '  [+] %-10s running (pid %s)\n' "$n" "$(cat "$(pidfile "$n")")"
    else printf '  [-] %-10s not running\n' "$n"; fi
  done
  printf '  noVNC HTTP: %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NOVNC_PORT/vnc.html" 2>/dev/null || echo 000)"
  printf '\n'
}

case "${1:-start}" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
  *) echo "usage: $0 start|stop|status"; exit 2 ;;
esac
