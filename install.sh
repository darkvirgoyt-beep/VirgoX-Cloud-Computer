#!/bin/sh
# vxc installer — Termux / any POSIX shell.
#
# Installs everything `vxc auth login` needs: a transfer tool, node to run the
# auth service, termux-api so the approval link opens on its own, and the vxc
# command itself. Then, with --login, it signs in.
#
#   curl -fsSL https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/install.sh | sh -s -- --login
#
# Without --login it stops after installing and prints the next step:
#
#   curl -fsSL https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/install.sh | sh
#
# From a clone:
#   sh install.sh --login

set -eu

BASE_URL="${VXC_BASE_URL:-https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer}"
PREFIX="${PREFIX:-$HOME/.local}"
BIN="$PREFIX/bin"
SELF_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" 2>/dev/null && pwd) || SELF_DIR=""

DO_LOGIN=0
for _arg in "$@"; do
  case "$_arg" in
    --login|-l)  DO_LOGIN=1 ;;
    --help|-h)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

C_BLD=''; C_GRN=''; C_YLW=''; C_BLU=''; C_OFF=''
if [ -t 1 ]; then
  C_BLD=$(printf '\033[1m'); C_GRN=$(printf '\033[32m')
  C_YLW=$(printf '\033[33m'); C_BLU=$(printf '\033[34m'); C_OFF=$(printf '\033[0m')
fi

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GRN" "$C_OFF" "$*"; }
info() { printf '%s›%s %s\n' "$C_BLU" "$C_OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YLW" "$C_OFF" "$*" >&2; }
die()  { printf '✖ %s\n' "$*" >&2; exit 1; }

HAVE_PKG=0
command -v pkg >/dev/null 2>&1 && HAVE_PKG=1

# pkg is interactive by default. Non-interactive is what a piped installer needs,
# or it sits on a prompt nobody can see.
pkg_quiet() {
  if [ "$HAVE_PKG" -eq 1 ]; then
    pkg install -y "$@" >/dev/null 2>&1
  else
    return 1
  fi
}

say ''
say "${C_BLD}vxc installer${C_OFF}"
say "${C_DIM:-}${BASE_URL}${C_OFF:-}"
say ''

# ---- dependencies ---------------------------------------------------------
#
# curl or wget is how vxc talks to the auth service. node is how the auth
# service runs. termux-api is what turns a printed URL into an opened tab. Each
# is skipped when it is already there, and each failure is reported rather than
# swallowed — a half-installed toolchain fails later, further from the cause.

ensure_transfer() {
  if command -v curl >/dev/null 2>&1; then
    ok "curl"
  elif command -v wget >/dev/null 2>&1; then
    ok "wget (curl absent)"
  else
    info "installing curl …"
    pkg_quiet curl || warn "could not install curl or wget — install one of them and re-run"
  fi
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    ok "node $(node --version 2>/dev/null | sed 's/^v//')"
    return 0
  fi
  if [ "$HAVE_PKG" -eq 1 ]; then
    info "installing nodejs (this takes a minute) …"
    pkg_quiet nodejs || warn "pkg install nodejs failed"
  fi
  if command -v node >/dev/null 2>&1; then
    ok "node $(node --version 2>/dev/null | sed 's/^v//')"
  elif command -v nodejs >/dev/null 2>&1; then
    ok "nodejs $(nodejs --version 2>/dev/null | sed 's/^v//')"
  else
    warn "no node — vxc auth login cannot run the auth service"
    say  "  on Termux:  ${C_BLD}pkg install nodejs${C_OFF}"
    return 1
  fi
}

ensure_termux_api() {
  command -v termux-open-url >/dev/null 2>&1 && { ok "termux-api"; return 0; }
  command -v termux-open >/dev/null 2>&1 && { ok "termux-api"; return 0; }
  [ "$HAVE_PKG" -eq 1 ] || return 0
  # termux-api needs the companion Android app. Installing the package without
  # it produces a binary that fails on every call, so it is offered, not forced.
  info "installing termux-api so the approval link opens by itself …"
  pkg_quiet termux-api || warn "pkg install termux-api failed — links will print instead"
}

ensure_transfer
ensure_node || :
ensure_termux_api

# ---- the vxc command ------------------------------------------------------

SRC=""
if [ -n "$SELF_DIR" ] && [ -f "$SELF_DIR/tools/vxc" ]; then
  SRC="$SELF_DIR/tools/vxc"
elif [ -n "$SELF_DIR" ] && [ -f "$SELF_DIR/vxc" ]; then
  SRC="$SELF_DIR/vxc"
else
  info "downloading vxc …"
  SRC=$(mktemp) || die "could not create a temp file"
  URL="$BASE_URL/tools/vxc"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$SRC" || die "download failed from $URL — check your connection"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$SRC" "$URL" || die "download failed from $URL — check your connection"
  else
    die "need curl or wget to download vxc"
  fi
fi

[ -s "$SRC" ] || die "the vxc script downloaded empty"

if command -v sh >/dev/null 2>&1; then
  sh -n "$SRC" || die "vxc failed its syntax check — refusing to install it"
fi

mkdir -p "$BIN"
DEST="$BIN/vxc"

# On Termux, PREFIX is already /data/data/com.termux/files/usr, so BIN lands on
# $PREFIX/bin — which is where a previous install of this same script already
# put vxc. When that is the file we downloaded, `cp` refuses with "are the same
# file" and `set -e` kills the installer with no output at all. Comparing the
# files first makes a reinstall a no-op that still reports success.
if [ -e "$DEST" ] && cmp -s "$SRC" "$DEST"; then
  ok "vxc is already up to date at $DEST"
else
  # Different file, or a path that does not exist yet: write through a temp
  # name so a failed copy cannot leave a truncated script on PATH.
  TMPDEST="$DEST.vxctmp.$$"
  if cp "$SRC" "$TMPDEST"; then
    chmod 755 "$TMPDEST"
    mv -f "$TMPDEST" "$DEST"
    ok "installed $DEST"
  else
    rm -f "$TMPDEST"
    die "could not write $DEST"
  fi
fi

# PATH is the one thing a shell will not fix for itself. It is written to the
# rc files that actually exist rather than to a guessed ~/.bashrc, and only when
# the line is not already there, so re-running this does not grow the file.
NEEDS_PATH=1
case ":$PATH:" in
  *":$BIN:"*) NEEDS_PATH=0 ;;
esac

if [ "$NEEDS_PATH" -eq 1 ]; then
  LINE="export PATH=\"\$PATH:$BIN\""
  WROTE=0
  for rc in "$HOME/.bashrc" "$HOME/.shrc" "$HOME/.zshrc" "$HOME/.profile"; do
    [ -f "$rc" ] || continue
    if grep -Fq "$BIN" "$rc" 2>/dev/null; then continue; fi
    printf '\n# vxc\n%s\n' "$LINE" >> "$rc"
    WROTE=1
  done
  # A fresh account can have none of those yet, and a PATH line written nowhere
  # is a PATH line that never loads. .profile is the one POSIX shells read on a
  # cold login, so it is the fallback when nothing else is there to append to.
  if [ "$WROTE" -eq 0 ] && ! grep -Fq "$BIN" "$HOME/.profile" 2>/dev/null; then
    printf '\n# vxc\n%s\n' "$LINE" >> "$HOME/.profile"
    WROTE=1
  fi
  # Every rc file was skipped, which on a re-run means the entry is already
  # there. Reporting that as a failure would send the user to fix something that
  # is not broken.
  if [ "$WROTE" -eq 1 ]; then
    ok "added $BIN to PATH in your shell rc"
  elif grep -RqsF "$BIN" "$HOME/.bashrc" "$HOME/.shrc" "$HOME/.zshrc" "$HOME/.profile" 2>/dev/null; then
    ok "$BIN is already on PATH via your shell rc"
  else
    warn "could not write a PATH entry — add it by hand:"
    say "    ${C_BLD}export PATH=\"\$PATH:$BIN\"${C_OFF}"
  fi
  PATH="$PATH:$BIN"
  export PATH
fi

VXC="$BIN/vxc"
[ -x "$VXC" ] || VXC=$(command -v vxc 2>/dev/null || printf '%s' "$BIN/vxc")

# ---- sign in --------------------------------------------------------------

if [ "$DO_LOGIN" -eq 1 ]; then
  say ''
  say "${C_BLD}Signing in${C_OFF}"
  say ''
  # Not exec: the rc-file PATH edit above only affects this process, and exec
  # would drop the messages printed after vxc returns.
  "$VXC" auth login
  status=$?
  say ''
  if [ "$status" -eq 0 ]; then
    ok "signed in — vxc auth status shows who you are"
  else
    warn "vxc auth login exited $status"
    say "  the code it printed is still valid; approve it and re-run:"
    say ''
    say "    ${C_BLD}${VXC} auth login${C_OFF}"
  fi
  exit "$status"
fi

# ---- next steps -----------------------------------------------------------

say ''
say "${C_BLD}Installed${C_OFF}"
say ''
say "  Sign in. It prints a code and a link; approve it in any browser:"
say ''
say "       ${C_BLD}vxc auth login${C_OFF}"
say ''
say "  Check who you are signed in as:"
say ''
say "       ${C_BLD}vxc auth status${C_OFF}"
say ''
say "  Open the PC itself:"
say ''
say "       ${C_BLD}vxc pc${C_OFF}   ${C_DIM:-}or open the URL by hand${C_OFF:-}"
say ''
say "  ${C_BLD}vxc help${C_OFF} lists everything else."
say ''