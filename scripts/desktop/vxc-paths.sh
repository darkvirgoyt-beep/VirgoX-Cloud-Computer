#!/usr/bin/env bash
# =============================================================================
# VirgoX — shared path resolution for the desktop helper scripts.
#
# The helpers were written against the webtop image, where the user's files
# always live under /config. Outside a container /config does not exist, so
# every one of those paths silently resolved to nothing. This file resolves
# them once, for whichever runtime is actually in use:
#
#   VXC_BACKEND=docker  -> keep the original /config locations
#   VXC_BACKEND=native  -> the user's real home
#
# Override anything with the environment; nothing here is a guess:
#   VXC_FILES_DIR   where "VirgoX-Files" lives
#   VXC_DESKTOP_DIR the Desktop folder
#   VXC_WINE_PREFIX the wine prefix
# =============================================================================

# shellcheck shell=sh

# The docker backend keeps /config: there the paths are correct by definition.
if [ "${VXC_BACKEND:-auto}" = "docker" ]; then
    _VXC_ROOT="${VXC_CONFIG_ROOT:-/config}"
else
    # Native: real home. Honour an existing WINEPREFIX so a user's own wine
    # setup is not silently relocated.
    _VXC_ROOT="${VXC_HOME:-$HOME}"
fi

VXC_CONFIG_ROOT="$_VXC_ROOT"
VXC_FILES_DIR="${VXC_FILES_DIR:-${_VXC_ROOT}/Desktop/VirgoX-Files}"
VXC_DESKTOP_DIR="${VXC_DESKTOP_DIR:-${_VXC_ROOT}/Desktop}"
VXC_WINE_PREFIX="${WINEPREFIX:-${_VXC_ROOT}/.wine}"

export VXC_CONFIG_ROOT VXC_FILES_DIR VXC_DESKTOP_DIR VXC_WINE_PREFIX

# Create only the directories the helpers actually need. Doing this on every
# source would litter $HOME on machines that never use them.
mkdir -p "$VXC_FILES_DIR" "$VXC_WINE_PREFIX" 2>/dev/null || true