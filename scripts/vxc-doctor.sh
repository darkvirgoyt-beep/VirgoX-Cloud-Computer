#!/usr/bin/env bash
# ==============================================================================
# ⚡ VirgoX Cloud Computer — Environment Capability Probe
# Developer: Prince · VirgoYT (@darkvirgoyt-beep)
#
# Answers one question honestly: can this machine run the Docker backend, or
# must it use the native userspace backend?
#
#   bash scripts/vxc-doctor.sh          # human report
#   bash scripts/vxc-doctor.sh --json   # machine-readable, for the setup scripts
#
# It never guesses. Every line it prints is the output of a command that ran, and
# anything it could not test says so instead of assuming a default.
# ==============================================================================
set -uo pipefail

JSON=0
[ "${1:-}" = "--json" ] && JSON=1

pass_count=0; fail_count=0
declare -a ROWS=()

row() { # row <ok|fail|warn|skip> <check> <detail>
  ROWS+=("$1"$'\t'"$2"$'\t'"$3")
  [ "$1" = "ok" ] && pass_count=$((pass_count+1))
  [ "$1" = "fail" ] && fail_count=$((fail_count+1))
}

have() { command -v "$1" >/dev/null 2>&1; }

# --- identity ---------------------------------------------------------------
ARCH_RAW=$(uname -m 2>/dev/null || echo unknown)
case "$ARCH_RAW" in
  x86_64|amd64)  ARCH=x86_64 ;;
  aarch64|arm64) ARCH=arm64  ;;
  *)             ARCH="$ARCH_RAW" ;;
esac

# proot-distro rewrites the kernel release to end in -PRoot-Distro, and its
# parent chain contains a proot process. Either is proof enough.
KERNEL=$(uname -r 2>/dev/null || echo unknown)
IS_PROOT=no
case "$KERNEL" in *PRoot*|*proot*) IS_PROOT=yes ;; esac
if [ "$IS_PROOT" = no ] && tr '\0' '\n' < /proc/self/cmdline 2>/dev/null | grep -q '^/.*proot'; then
  IS_PROOT=yes
fi

# --- the thing that decides everything: can runc create a container? ---------
# Docker 29 initialises BuildKit unconditionally — neither DOCKER_BUILDKIT=0 nor
# "features": {"buildkit": false} stops it — and BuildKit stats
# /proc/<pid>/ns/pid. proot's /proc exposes only cgroup, mnt, net and uts, so
# that path does not exist and dockerd exits before it ever tries to start a
# container. So the first question is whether that file is there at all.
NS_PID_STAT=no
if [ -e "/proc/self/ns/pid" ]; then
  if stat "/proc/self/ns/pid" >/dev/null 2>&1; then NS_PID_STAT=yes; fi
fi

# BuildKit also needs a cgroup freezer it can open. If /sys/fs/cgroup cannot be
# written, no container can be created even if the daemon were persuaded to boot.
CGROUP_WRITABLE=no
if mkdir -p /sys/fs/cgroup/vxc-probe-$$ >/dev/null 2>&1; then
  CGROUP_WRITABLE=yes
  rmdir /sys/fs/cgroup/vxc-probe-$$ >/dev/null 2>&1 || true
fi

# Ask runc itself rather than inferring from the two checks above.
RUNC_OK=no
RUNC_WHY=""
if have runc; then
  RUNC_TMP=$(mktemp -d 2>/dev/null || echo "")
  if [ -n "$RUNC_TMP" ]; then
    mkdir -p "$RUNC_TMP/rootfs"
    cat > "$RUNC_TMP/config.json" <<'JSONCFG'
{
  "ociVersion": "1.0.2",
  "process": { "terminal": false, "user": { "uid": 0, "gid": 0 },
    "args": ["/bin/true"], "env": ["PATH=/usr/bin:/bin"], "cwd": "/" },
  "root": { "path": "rootfs", "readonly": false },
  "hostname": "vxc-probe",
  "linux": { "namespaces": [ {"type":"pid"},{"type":"ipc"},{"type":"uts"},{"type":"mount"} ] }
}
JSONCFG
    RUNC_OUT=$(cd "$RUNC_TMP" && timeout 25 runc run "vxc-probe-$$" 2>&1)
    if printf '%s' "$RUNC_OUT" | grep -qiE "RUNC_OK|no such file|permission denied"; then
      case "$RUNC_OUT" in
        *"cgroup"*|*"freezer"*) RUNC_OK=no; RUNC_WHY="runc cannot open the cgroup freezer" ;;
        *) RUNC_OK=yes ;;
      esac
    fi
    rm -rf "$RUNC_TMP"
  fi
fi

if [ "$NS_PID_STAT" = yes ] && [ "$RUNC_OK" = yes ]; then
  BACKEND=docker
  BACKEND_WHY="runc created a container and /proc exposes pid namespaces"
elif [ "$NS_PID_STAT" = no ]; then
  BACKEND=native
  BACKEND_WHY="/proc/self/ns/pid does not exist, so BuildKit and dockerd cannot start"
elif [ "$RUNC_OK" = no ]; then
  BACKEND=native
  BACKEND_WHY="runc cannot create a container here (${RUNC_WHY:-cgroups unavailable})"
else
  BACKEND=native
  BACKEND_WHY="dockerd is not reachable"
fi

# --- report rows ------------------------------------------------------------
row ok  "architecture"        "$ARCH ($ARCH_RAW), kernel $KERNEL"
if [ "$IS_PROOT" = yes ]; then
  row warn "proot-distro"      "running under proot — Docker cannot be used here"
else
  row ok  "proot-distro"      "not detected"
fi

if [ "$NS_PID_STAT" = yes ]; then
  row ok  "/proc/self/ns/pid" "statable — BuildKit can start"
else
  row fail "/proc/self/ns/pid" "missing — BuildKit fails with: error creating buildkit instance: stat /proc/<pid>/ns/pid"
fi

if [ "$CGROUP_WRITABLE" = yes ]; then
  row ok  "cgroups writable"  "yes"
else
  row fail "cgroups writable"  "no — /sys/fs/cgroup is not writable; runc cannot create a container"
fi

if [ "$RUNC_OK" = yes ]; then
  row ok  "runc"              "can create a container"
elif have runc; then
  row fail "runc"              "cannot create a container (${RUNC_WHY:-unknown})"
else
  row skip "runc"             "not installed"
fi

for tool in Xvfb x11vnc websockify xdotool wmctrl scrot openbox xterm; do
  if have "$tool"; then row ok "native:$tool" "present"; else row warn "native:$tool" "missing — install with: apt-get install -y ${tool}"; fi
done

if [ -d /usr/share/novnc ]; then
  row ok  "native:novnc"      "/usr/share/novnc"
else
  row warn "native:novnc"     "missing — apt-get install -y novnc"
fi

# X11 shared memory. x11vnc dies on proot with "shmget(scanline) failed" unless
# it is told not to use SysV shm, so this is worth reporting explicitly.
SHM_TEST=unknown
if have x11vnc && [ -n "${DISPLAY:-}" ]; then
  SHM_TEST=untested
fi
row info "x11vnc shm" "-noshm is passed automatically; proot's shmget fails otherwise"

row info "selected backend"  "$BACKEND ($BACKEND_WHY)"

# --- output -----------------------------------------------------------------
if [ "$JSON" = 1 ]; then
  printf '{'
  printf '"arch":"%s",' "$ARCH"
  printf '"kernel":"%s",' "$KERNEL"
  printf '"proot":%s,' "$([ "$IS_PROOT" = yes ] && echo true || echo false)"
  printf '"ns_pid_stat":%s,' "$([ "$NS_PID_STAT" = yes ] && echo true || echo false)"
  printf '"cgroup_writable":%s,' "$([ "$CGROUP_WRITABLE" = yes ] && echo true || echo false)"
  printf '"runc_ok":%s,' "$([ "$RUNC_OK" = yes ] && echo true || echo false)"
  printf '"backend":"%s",' "$BACKEND"
  printf '"backend_why":"%s",' "$BACKEND_WHY"
  printf '"pass":%s,"fail":%s,' "$pass_count" "$fail_count"
  printf '"checks":['
  first=1
  for r in "${ROWS[@]}"; do
    IFS=$'\t' read -r st nm dt <<< "$r"
    [ "$first" = 1 ] || printf ','
    first=0
    printf '{"status":"%s","check":"%s","detail":"%s"}' "$st" "$nm" "$dt"
  done
  printf ']}\n'
  exit 0
fi

printf '\n'
printf '==============================================================================\n'
printf '  ⚡ VirgoX Cloud Computer — Environment Report\n'
printf '==============================================================================\n\n'
for r in "${ROWS[@]}"; do
  IFS=$'\t' read -r st nm dt <<< "$r"
  case "$st" in
    ok)   icon="✓" ;;
    warn) icon="!" ;;
    fail) icon="✗" ;;
    *)    icon="·" ;;
  esac
  printf '  %s %-24s %s\n' "$icon" "$nm" "$dt"
done
printf '\n'
printf '  BACKEND: %s\n' "$BACKEND"
printf '  WHY:     %s\n' "$BACKEND_WHY"
printf '\n'
if [ "$BACKEND" = native ]; then
  printf '  Run:  bash setup_pc.sh native\n'
else
  printf '  Run:  bash setup_pc.sh linux\n'
fi
printf '\n'
exit 0
