#!/data/data/com.termux/files/usr/bin/sh
# vxc installer — Termux / any POSIX shell.
#
#   curl -fsSL https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/install.sh | sh
#
# or, from a clone:
#   sh install.sh
#
# Installs the `vxc` command into $PREFIX/bin and, if termux-api is present,
# enables the link-opening that makes `vxc auth login` one tap.

set -eu

PREFIX="${PREFIX:-$HOME/.local}"
BIN="$PREFIX/bin"
SELF_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

C_BLD=''; C_GRN=''; C_YLW=''; C_OFF=''
if [ -t 1 ]; then
  C_BLD=$(printf '\033[1m'); C_GRN=$(printf '\033[32m')
  C_YLW=$(printf '\033[33m'); C_OFF=$(printf '\033[0m')
fi

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GRN" "$C_OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YLW" "$C_OFF" "$*" >&2; }
die()  { printf '✖ %s\n' "$*" >&2; exit 1; }

say ''
say "${C_BLD}vxc installer${C_OFF}"
say ''

# ---- locate the script ---------------------------------------------------

SRC=""
if [ -f "$SELF_DIR/tools/vxc" ]; then
  SRC="$SELF_DIR/tools/vxc"
elif [ -f "$SELF_DIR/vxc" ]; then
  SRC="$SELF_DIR/vxc"
else
  # Piped from curl: fetch it.
  URL="https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/tools/vxc"
  say "  downloading vxc …"
  SRC=$(mktemp) || die "could not create a temp file"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$SRC" || die "download failed — check your connection"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$SRC" "$URL" || die "download failed — check your connection"
  else
    die "need curl or wget"
  fi
fi

[ -s "$SRC" ] || die "vxc script is empty"

# ---- sanity check --------------------------------------------------------

if command -v sh >/dev/null 2>&1; then
  sh -n "$SRC" || die "vxc failed its syntax check"
fi

# ---- install -------------------------------------------------------------

mkdir -p "$BIN"
cp "$SRC" "$BIN/vxc"
chmod 755 "$BIN/vxc"
ok "installed $BIN/vxc"

case ":$PATH:" in
  *":$BIN:"*) : ;;
  *)
    warn "$BIN is not on your PATH"
    say "  add it with:"
    say ''
    say "    ${C_BLD}export PATH=\"\$PATH:$BIN\"${C_OFF}"
    say ''
    say "  and to make it permanent, put that line in ~/.bashrc"
    ;;
esac

# ---- optional: termux-api for link opening -------------------------------

if command -v termux-open-url >/dev/null 2>&1; then
  ok "termux-api present — links will open automatically"
elif command -v pkg >/dev/null 2>&1; then
  say ''
  say '  Want vxc to open the approval link for you?'
  say "    ${C_BLD}pkg install termux-api${C_OFF}   ${C_BLD}termux-open${C_OFF}"
else
  warn 'install curl (or wget) so vxc can talk to the auth service'
fi

# ---- next steps ----------------------------------------------------------

say ''
say "${C_BLD}Next${C_OFF}"
say ''
say "  1. Point vxc at your auth service (replace with your real host):"
say ''
say "       ${C_BLD}vxc config set auth https://your-auth-host${C_OFF}"
say ''
say "  2. Sign in. It prints a code and a link; approve it on any device:"
say ''
say "       ${C_BLD}vxc auth login${C_OFF}"
say ''
say '  3. Check it:'
say ''
say "       ${C_BLD}vxc auth status${C_OFF}"
say ''
say "${C_BLD}Running the auth service${C_OFF}"
say ''
say '  The workstation is a static page, so vxc auth login needs the auth'
say '  service running somewhere reachable. From the repo:'
say ''
say "       ${C_BLD}node server/auth-service.js${C_OFF}"
say ''
say "  Then set VXC_AUTH to that URL (step 1 above)."
say ''
