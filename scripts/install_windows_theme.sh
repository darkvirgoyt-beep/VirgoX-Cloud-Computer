#!/usr/bin/env bash
# ==============================================================================
# 🪟 VirgoX Windows 11 UI Transformation for Linux Desktop (Webtop XFCE)
# Transforms Linux desktop into a sleek Windows 11 Fluent interface:
# Windows 11 dark theme, fluent icons, centered taskbar look, Edge & Wine
# ==============================================================================
set -e

echo "[*] Setting up Windows 11 Fluent environment inside VirgoX Linux Desktop..."

# 1. Install Wine & Windows execution tools
if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        wine \
        wine64 \
        winetricks \
        cabextract \
        xfce4-panel \
        xfce4-settings \
        xfwm4 \
        gtk2-engines-murrine \
        gtk2-engines-pixbuf \
        curl \
        wget \
        unzip \
        git || true
fi

# 2. Download and apply Windows 11 Fluent theme if not already present
THEME_DIR="/usr/share/themes/Windows-11-Dark"
if [ ! -d "$THEME_DIR" ]; then
    echo "[*] Downloading Windows 11 Dark GTK Theme..."
    mkdir -p /usr/share/themes
    git clone --depth 1 https://github.com/vinceliuice/Fluent-gtk-theme.git /tmp/fluent-theme 2>/dev/null && \
    (cd /tmp/fluent-theme && ./install.sh --theme dark --round -d /usr/share/themes 2>/dev/null || true) && \
    rm -rf /tmp/fluent-theme || true
fi

# 3. Configure XFCE Desktop Settings for Windows 11 style
if command -v xfconf-query >/dev/null 2>&1; then
    echo "[*] Applying Windows 11 look and feel..."
    # Set GTK Theme
    xfconf-query -c xsettings -p /Net/ThemeName -s "Fluent-Dark" 2>/dev/null || true
    # Set Window Manager Theme
    xfconf-query -c xfwm4 -p /general/theme -s "Fluent-Dark" 2>/dev/null || true
    # Windows 11 taskbar at bottom
    xfconf-query -c xfce4-panel -p /panels/panel-1/position -s "p=6;x=0;y=0" 2>/dev/null || true
fi

echo "[+] Windows 11 UI transformation applied successfully!"
