#!/usr/bin/env bash
# =============================================================================
# VirgoX — render the desktop shortcuts for the runtime actually in use.
#
#   render-shortcuts.sh <source-dir> <target-dir>
#
# A .desktop entry has no variable substitution, so the shipped entries cannot
# carry a home directory or a browser name that might not be installed. This
# renders them at install time instead:
#
#   * /config/Desktop/VirgoX-Files  ->  the real desktop directory
#   * Path=                          ->  the same, made absolute
#   * chromium / google-chrome-stable / google-chrome
#                                   ->  the first browser that EXISTS here
#   * icons                         ->  the first icon path that exists
#
# Nothing is guessed. If no browser is installed the entry is emitted with the
# fallback command and the caller is told, rather than shipping a launcher that
# silently fails when double-clicked.
# =============================================================================
set -e

SRC="${1:-}"
DST="${2:-}"
if [ -z "$SRC" ] || [ -z "$DST" ]; then
  echo "usage: $0 <source-dir> <target-dir>" >&2
  exit 2
fi

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/desktop/vxc-paths.sh"

mkdir -p "$DST"

# Pick a browser that is actually installed AND runnable. Presence is not
# enough: on Ubuntu, `chromium-browser` is a transitional shim that exists on
# PATH and then refuses to run because the snap it wants is not installed.
# Checking with `command -v` alone points every shortcut at a launcher that
# dies on click, so each candidate must also execute.
pick_browser() {
  for b in google-chrome-stable google-chrome chromium chromium-browser firefox; do
    command -v "$b" >/dev/null 2>&1 || continue
    if timeout 15 "$b" --version >/dev/null 2>&1; then
      printf '%s' "$b"
      return 0
    fi
    echo "    (skipping $b: present on PATH but will not run here)" >&2
  done
  return 1
}

BROWSER=""
if BROWSER=$(pick_browser); then
  BROWSER_ICON=""
  for ic in \
    /usr/share/icons/hicolor/48x48/apps/${BROWSER}.png \
    /usr/share/pixmaps/${BROWSER}.png \
    /usr/share/pixmaps/chromium.png \
    /usr/share/applications/${BROWSER}.desktop; do
    [ -e "$ic" ] && { BROWSER_ICON="$ic"; break; }
  done
  echo "[+] Browser for shortcuts: $BROWSER"
else
  BROWSER="xdg-open"
  BROWSER_ICON=""
  echo "[!] No Chrome/Chromium/Firefox installed. Web shortcuts will open xdg-open."
fi

# Also resolve a fallback file manager: thunar ships in the XFCE image, but the
# native backend may have something else (or nothing).
pick_fm() {
  for f in thunar nautilus dolphin pcmanfm; do
    command -v "$f" >/dev/null 2>&1 && { printf '%s' "$f"; return 0; }
  done
  return 1
}
FILEMGR="thunar"
if F=$(pick_fm); then FILEMGR="$F"; else FILEMGR="xdg-open"; fi
echo "[+] File manager for shortcuts: $FILEMGR"

count=0
for f in "$SRC"/*.desktop; do
  [ -e "$f" ] || continue
  out="$DST/$(basename "$f")"

  # Substitute container paths for real ones. Order matters: the longer,
  # more specific prefix must be replaced first or /config/Desktop would
  # clobber the beginning of /config/Desktop/VirgoX-Files.
  sed -e "s#/config/Desktop/VirgoX-Files#${VXC_FILES_DIR}#g" \
      -e "s#/config/Desktop#${VXC_DESKTOP_DIR}#g" \
      -e "s#/config#${VXC_CONFIG_ROOT}#g" \
      "$f" > "$out"

  # Browser command: only rewrite the ones that are pure web launchers, and
  # never rewrite a command that passes a URL to something specific. The Exec
  # rewrite is unconditional — gating it on finding an icon would leave the
  # command pointing at a browser that does not exist on this machine.
  sed -i -E \
    "s#^Exec=(chromium|google-chrome-stable|google-chrome|chromium-browser)( |$)#Exec=${BROWSER} \2#" \
    "$out"
  if [ -n "$BROWSER_ICON" ]; then
    sed -i -E \
      "s#^Icon=.*#Icon=${BROWSER_ICON}#" \
      "$out"
  fi

  # File manager.
  if [ "$FILEMGR" != "thunar" ]; then
    sed -i -E "s#^Exec=thunar #Exec=${FILEMGR} #" "$out"
  fi

  # The icon tree also moves outside the container.
  if ! grep -q "^Icon=/usr/share/icons/virgox/" "$out"; then
    local_icon="$HOME/.local/share/icons/virgox/$(basename "$(grep -m1 '^Icon=' "$out" | cut -d= -f2-)")"
    [ -e "$local_icon" ] && sed -i "s#^Icon=.*#Icon=${local_icon}#" "$out"
  fi

  chmod +x "$out" 2>/dev/null || true
  count=$((count + 1))
done

# desktop-file-validate exits non-zero for stylistic "hint:" lines as well as
# for real errors, so the two must be counted separately — otherwise every
# entry that merely suggests a category pairing is reported as invalid, which
# says nothing about whether the launcher works.
if command -v desktop-file-validate >/dev/null 2>&1; then
  errs=0; hints=0
  for f in "$DST"/*.desktop; do
    out=$(desktop-file-validate "$f" 2>&1 || true)
    e=$(printf '%s\n' "$out" | grep -v "hint:" | grep -v "^[[:space:]]*$" || true)
    h=$(printf '%s\n' "$out" | grep -c "hint:" || true)
    hints=$((hints + h))
    if [ -n "$e" ]; then
      echo "[!] ERROR in $(basename "$f"):"
      printf '%s\n' "$e" | sed 's/^/      /'
      errs=$((errs + 1))
    fi
  done
  if [ "$errs" -eq 0 ]; then
    echo "[+] all $count entries are structurally valid (${hints} pre-existing category hints)"
  else
    echo "[!] $errs entr$( [ "$errs" -eq 1 ] && echo y || echo ies) failed validation"
  fi
else
  echo "[*] desktop-file-validate not installed; skipping entry validation"
fi

echo "[+] rendered $count shortcuts into $DST"