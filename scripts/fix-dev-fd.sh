#!/usr/bin/env bash
# =============================================================================
# VirgoX — make /dev/fd work under proot-distro.
#
# /dev/fd is normally a symlink to /proc/self/fd. Under proot it is a real but
# EMPTY directory, so anything using bash process substitution or /dev/fd/N dies
# with "No such file or directory". Google Chrome's launcher does exactly that:
#
#     exec > >(exec cat)
#
# so Chrome installs cleanly and then fails on its first run with a message
# about /dev/fd/63 that has nothing to do with Chrome.
#
# This repoints /dev/fd at /proc/self/fd where it exists and is safe to do so.
# =============================================================================
set -e

if [ -L /dev/fd ]; then
  target=$(readlink /dev/fd)
  if [ "$target" = "/proc/self/fd" ]; then
    echo "[+] /dev/fd already points at /proc/self/fd"
    exit 0
  fi
  echo "[*] /dev/fd -> $target (leaving it alone)"
  exit 0
fi

if [ ! -d /dev/fd ]; then
  echo "[*] /dev/fd does not exist and /dev is not writable; nothing to do"
  exit 0
fi

# /dev/fd may be a populated directory holding STALE symlinks into a
# long-dead pid, left behind by whatever first touched it. Those are not live
# file descriptors and nothing can be using them, so replacing the directory
# is safe — but it is still done reversibly, by moving it aside rather than
# deleting anything.
if [ -n "$(ls -A /dev/fd 2>/dev/null)" ]; then
  live=0
  for e in /dev/fd/*; do
    [ -e "$e" ] || continue
    tgt=$(readlink "$e" 2>/dev/null) || continue
    case "$tgt" in
      /proc/*/fd/*)
        pid=${tgt#/proc/}; pid=${pid%%/*}
        if [ "$pid" != "self" ] && [ -d "/proc/$pid" ]; then live=1; fi
        ;;
      *) live=1 ;;
    esac
  done

  if [ "$live" = "1" ]; then
    echo "[!] /dev/fd holds live entries; refusing to replace it"
    ls -la /dev/fd | sed 's/^/      /'
    exit 0
  fi

  echo "[*] /dev/fd holds only stale entries (dead pids); moving it aside"
  if ! mv /dev/fd /dev/.fd-stale 2>/dev/null; then
    echo "[!] /dev is not writable, so /dev/fd cannot be repaired here."
    echo "    Programs that use process substitution or /dev/fd/N will fail."
    echo "    On a rooted Android setup, run:  rm -rf /dev/fd && ln -s /proc/self/fd /dev/fd"
    exit 0
  fi
fi

if [ ! -d /proc/self/fd ]; then
  echo "[!] /proc/self/fd does not exist, so there is nothing to point /dev/fd at"
  exit 0
fi

rmdir /dev/fd && ln -s /proc/self/fd /dev/fd
echo "[+] /dev/fd is now a symlink to /proc/self/fd"

# Prove it, rather than asserting it worked.
if bash -c 'exec > >(exec cat); echo fd-works' 2>/dev/null | grep -q fd-works; then
  echo "[+] process substitution verified working"
else
  echo "[!] /dev/fd now resolves, but process substitution still fails"
  exit 1
fi