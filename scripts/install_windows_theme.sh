#!/usr/bin/env bash
# ==============================================================================
# 🪟 VirgoX Windows 11 UI Transformation for Linux Desktop (Webtop / XFCE)
# Transforms Linux desktop into an authentic Windows 11 Fluent interface:
# Centered taskbar, Fluent dark rounded themes, Windows 11 Start menu & icons.
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "[*] Setting up Windows 11 Fluent environment inside VirgoX Linux Desktop..."

# 1. Install required packages
if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        xfce4-session \
        xfce4-panel \
        xfce4-settings \
        xfwm4 \
        xfdesktop4 \
        thunar \
        xfce4-terminal \
        xfce4-whiskermenu-plugin \
        papirus-icon-theme \
        yaru-theme-icon \
        sassc \
        feh \
        wmctrl \
        scrot \
        curl \
        wget \
        git || true
fi

# 2. Deploy VirgoX Windows 11 SVGs & Desktop Icons
echo "[*] Deploying Windows 11 icons..."
mkdir -p /usr/share/icons/virgox
if [ -d "$DIR/assets/icons" ]; then
    cp -rn "$DIR/assets/icons/"* /usr/share/icons/virgox/ 2>/dev/null || true
fi

# 3. Setup Windows 11 Bloom Dark Wallpaper
echo "[*] Deploying Windows 11 Wallpaper..."
mkdir -p /usr/share/backgrounds/windows11
WALLPAPER="/usr/share/backgrounds/windows11/bloom-dark.jpg"
if [ ! -f "$WALLPAPER" ]; then
    curl -fsSL -o "$WALLPAPER" "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80" 2>/dev/null || true
fi

# 4. Install Fluent Dark GTK Theme with Rounded Windows
if [ ! -d "/usr/share/themes/Fluent-round-Dark" ]; then
    echo "[*] Building Fluent-round-Dark GTK Theme..."
    mkdir -p /usr/share/themes
    rm -rf /tmp/fluent-theme
    git clone --depth 1 https://github.com/vinceliuice/Fluent-gtk-theme.git /tmp/fluent-theme 2>/dev/null && \
    (cd /tmp/fluent-theme && ./install.sh -c dark --tweaks round -d /usr/share/themes 2>/dev/null || true) && \
    rm -rf /tmp/fluent-theme || true
fi

# 5. Deploy Windows 11 Acrylic GTK3 CSS
mkdir -p "$HOME/.config/gtk-3.0"
cat << 'EOF' > "$HOME/.config/gtk-3.0/gtk.css"
/* Windows 11 Fluent Acrylic Styling for XFCE & GTK3 */
.xfce4-panel {
    background-color: rgba(32, 32, 32, 0.88);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.35);
    color: #ffffff;
    font-family: 'Segoe UI', 'Ubuntu', 'Sans', sans-serif;
    font-size: 12px;
}

.xfce4-panel button {
    background-color: transparent;
    border-radius: 6px;
    border: 1px solid transparent;
    margin: 2px 2px;
    padding: 2px 6px;
    transition: all 150ms ease-in-out;
    color: #ffffff;
}

.xfce4-panel button:hover {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
}

.xfce4-panel button:active,
.xfce4-panel button:checked {
    background-color: rgba(255, 255, 255, 0.14);
    border-bottom: 3px solid #0078d4;
    border-radius: 6px 6px 4px 4px;
}

#applicationsmenu-button,
.xfce4-panel .applicationsmenu button,
.xfce4-panel .whiskermenu button {
    border-radius: 6px;
    padding: 4px 8px;
}

.xfce4-panel .tasklist button {
    border-radius: 6px;
    margin: 3px 2px;
    padding: 0 4px;
    min-width: 40px;
}

.xfce4-panel .tasklist button:checked {
    background-color: rgba(255, 255, 255, 0.13);
    border-bottom: 3px solid #60cdff;
}

menu,
.popup,
.xfce4-panel menu {
    background-color: rgba(36, 36, 36, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    color: #ffffff;
}

menu menuitem {
    border-radius: 6px;
    padding: 6px 12px;
    margin: 1px 0;
    color: #e4e4e4;
}

menu menuitem:hover {
    background-color: rgba(255, 255, 255, 0.09);
    color: #ffffff;
}
EOF

# 6. Setup Taskbar Launcher Items
mkdir -p "$HOME/.config/xfce4/panel/launcher-12" \
         "$HOME/.config/xfce4/panel/launcher-13" \
         "$HOME/.config/xfce4/panel/launcher-14" \
         "$HOME/.config/xfce4/panel/launcher-15" \
         "$HOME/.config/xfce4/panel/launcher-16"

[ -f "$HOME/Desktop/Microsoft Edge.desktop" ] && cp "$HOME/Desktop/Microsoft Edge.desktop" "$HOME/.config/xfce4/panel/launcher-12/" 2>/dev/null || true
[ -f "$HOME/Desktop/Files.desktop" ] && cp "$HOME/Desktop/Files.desktop" "$HOME/.config/xfce4/panel/launcher-13/" 2>/dev/null || true
[ -f "$HOME/Desktop/Terminal.desktop" ] && cp "$HOME/Desktop/Terminal.desktop" "$HOME/.config/xfce4/panel/launcher-14/" 2>/dev/null || true
[ -f "$HOME/Desktop/VS Code & Codespace.desktop" ] && cp "$HOME/Desktop/VS Code & Codespace.desktop" "$HOME/.config/xfce4/panel/launcher-15/" 2>/dev/null || true
[ -f "$HOME/Desktop/Microsoft Store.desktop" ] && cp "$HOME/Desktop/Microsoft Store.desktop" "$HOME/.config/xfce4/panel/launcher-16/" 2>/dev/null || true

# 7. Apply XFCE Settings
if command -v xfconf-query >/dev/null 2>&1; then
    echo "[*] Applying Windows 11 theme and centered taskbar..."
    TARGET_DISPLAY="${DISPLAY:-:1}"

    # GTK & WM Theme
    xfconf-query -c xsettings -p /Net/ThemeName -s "Fluent-round-Dark" 2>/dev/null || true
    xfconf-query -c xsettings -p /Net/IconThemeName -s "Papirus-Dark" 2>/dev/null || true
    xfconf-query -c xfwm4 -p /general/theme -s "Fluent-round-Dark" 2>/dev/null || true

    # Wallpaper
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/workspace0/last-image -s "$WALLPAPER" 2>/dev/null || true
    xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitorscreen/workspace0/last-image -s "$WALLPAPER" 2>/dev/null || true
    xfconf-query -c xfce4-desktop -p /desktop-icons/style -s 2 2>/dev/null || true

    # Panel geometry & dark mode
    xfconf-query -c xfce4-panel -p /panels/panel-1/position -s "p=10;x=0;y=0" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /panels/panel-1/size -s 48 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /panels/dark-mode -s true 2>/dev/null || true

    # Start button & Centered Layout
    xfconf-query -c xfce4-panel -p /plugins/plugin-7 -n -t string -s "separator" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-7/expand -n -t bool -s true 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-7/style -n -t uint -s 0 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-1 -s "whiskermenu" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-1/button-icon -s "/usr/share/icons/virgox/win11.svg" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-1/show-button-title -s false 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-1/button-title -s "" 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-12 -n -t string -s "launcher" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-12/items -n -t string -s "Microsoft Edge.desktop" -a 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-13 -n -t string -s "launcher" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-13/items -n -t string -s "Files.desktop" -a 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-14 -n -t string -s "launcher" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-14/items -n -t string -s "Terminal.desktop" -a 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-15 -n -t string -s "launcher" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-15/items -n -t string -s "VS Code & Codespace.desktop" -a 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-16 -n -t string -s "launcher" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-16/items -n -t string -s "Microsoft Store.desktop" -a 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-2/show-labels -s false 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-2/grouping -s 1 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-2/flat-buttons -s true 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-3/expand -s true 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-3/style -s 0 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-8 -n -t string -s "systray" 2>/dev/null || true
    xfconf-query -c xfce4-panel -p /plugins/plugin-8/square-icons -n -t bool -s true 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /plugins/plugin-9 -n -t string -s "showdesktop" 2>/dev/null || true

    xfconf-query -c xfce4-panel -p /panels/panel-1/plugin-ids -n -t int -s 7 -t int -s 1 -t int -s 12 -t int -s 13 -t int -s 14 -t int -s 15 -t int -s 16 -t int -s 2 -t int -s 3 -t int -s 8 -t int -s 5 -t int -s 9 -a 2>/dev/null || true

    # Reload desktop & panel if running
    if [ -n "$TARGET_DISPLAY" ]; then
        DISPLAY="$TARGET_DISPLAY" feh --bg-fill "$WALLPAPER" 2>/dev/null || true
        DISPLAY="$TARGET_DISPLAY" xfdesktop --reload 2>/dev/null || true
        DISPLAY="$TARGET_DISPLAY" xfce4-panel -r 2>/dev/null || true
    fi
fi

echo "[+] Windows 11 Fluent environment successfully configured!"
