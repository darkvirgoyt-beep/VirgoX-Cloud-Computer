# ⚡ VirgoX Cloud Computer — Web Control Interface & Linux Developer Suite

<div align="center">

[![Web Client](https://img.shields.io/badge/Web%20Client-GitHub%20Pages-00e5ff?style=for-the-badge&logo=githubpages&logoColor=white)](https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/)
[![Multi-Device](https://img.shields.io/badge/Architecture-Dual%20Phone%20%2B%20AI-ff007f?style=for-the-badge&logo=android)](https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer)
[![Developer](https://img.shields.io/badge/Developer-Prince%20%C2%B7%20VirgoYT-b026ff?style=for-the-badge&logo=github)](https://github.com/darkvirgoyt-beep)

**A unified, all-in-one repository featuring both the Cyber Web Control Interface (hosted on GitHub Pages) and the Cloud Linux Computer Environment.**

[🌐 Open Web Control Interface](https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/) • [📱 GitHub Repository](https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer)

</div>

---

## 🚀 What Is In Here

Two separate things, often confused:

**The web page** (`gh-pages`, static, no backend). A Windows 11 Fluent desktop in a
browser tab, plus a terminal that reports what the browser can actually observe,
an app drawer, and a wall to sign in through. It runs entirely in the tab.

**The real machine** (`setup_pc.sh`). An actual Linux desktop you can see over
noVNC, with a real terminal next to it. Two backends, chosen automatically:

- **native** — the desktop runs as ordinary processes in your own userspace.
  No Docker, no root, works on **Android under proot-distro (ARM64)**.
- **docker** — the original XFCE webtop container, still used wherever Docker
  actually works.

`setup_pc.sh auto` probes the machine and picks one. `setup_pc.sh native` or
`setup_pc.sh linux` forces it. Nothing is removed: the Docker path is intact
and still the default on a machine where the daemon starts.

```
  THE WEB PAGE (GitHub Pages, static)        THE COMPUTER (your machine)
  ────────────────────────────────           ─────────────────────────
  pc.html   Fluent desktop in a tab          setup_pc.sh auto
  app.js    terminal, apps, wallpaper        scripts/vxc-native-desktop.sh
  pc.html   session gate, no backend         docker-compose.yml (webtop XFCE)
  server/auth-service.js  accounts           setup_windows11.sh (dockurr/windows)

  no server, no container, no VM             native needs nothing but apt
```

### Why the native backend exists

Docker cannot run under proot-distro, and the reason is specific rather than
"it's slow" or "unsupported":

| Requirement | proot-distro on Android |
| --- | --- |
| `/proc/self/ns/pid` | **missing** — `stat` returns ENOENT |
| `/sys/fs/cgroup` writable | **no** — `mkdir` returns EPERM |
| Namespaces (`pid`, `mount`, `net`, `uts`, `user`) | available |
| `runc run` (a real container) | fails: no cgroup freezer |

Docker 29 initialises BuildKit unconditionally — `features.buildkit=false` and
`DOCKER_BUILDKIT=0` are both ignored — and the builder dies on the missing pid
namespace. Even with BuildKit out of the way, `runc` cannot create a container
without a writable cgroup tree. So on this class of machine the answer is not a
newer Docker; it is no Docker.

Everything else in the project is unchanged. `server.py` keeps all of its
`docker exec` call sites; one function dispatches to `docker exec` or to a local
`bash -c` depending on what the probe found. Ports are chosen to match, so the
web page and the tunnel scripts needed no changes.

### What the native backend actually runs

```
Xvfb :1        virtual display, 1280x800x24
openbox        window manager
x11vnc -noshm  RFB server on 5900  (-noshm is mandatory; proot shmget fails)
websockify     serves /usr/share/novnc on 6080
ttyd           web terminal on 7681
server.py      bridge API on 8888 (defaults, all overridable)
```

Check the machine yourself before trusting any of the above:

```bash
bash scripts/vxc-doctor.sh          # human-readable capability report
bash scripts/vxc-doctor.sh --json   # machine-readable, for scripting
```

### Known limits on Android/proot, verified rather than assumed

- **No desktop browser.** Google's arm64 Chrome installs and reports
  `Google 154.0.8037.92`, then traps with SIGTRAP or hangs starting its
  zygote. `chromium-browser` on Ubuntu is a snap shim that refuses to run.
  Termux's Firefox needs `/system/bin/linker64`, absent inside proot, and
  Mozilla's `linux64` download is x86-64. `setup_pc.sh` verifies a browser by
  executing it and tells you plainly if none works, rather than leaving you a
  launcher that dies on click.
- **No containers**, for the reasons in the table above.
- **Everything else works**: the desktop, the file manager, the terminal, the
  bridge API, the whole cloud-PC flow including `vxc auth login`.

### Environment overrides

Every path and port is configurable, so the same scripts work in a container, in
a native userspace, or somewhere else entirely:

| Variable | Meaning | Default |
| --- | --- | --- |
| `VXC_BACKEND` | `auto`, `native`, `docker` | `auto` |
| `VXC_HOME` | where user files live | `$HOME` |
| `VXC_DESKTOP_DIR` | Desktop folder | `$VXC_HOME/Desktop` |
| `VXC_DISPLAY` | X display | `:1` |
| `VXC_PORT` | bridge API port | `8888` |
| `VXC_RUN_DIR` | pidfiles and logs | `$HOME/.local/state/virgox` |

Under the Docker backend `VXC_HOME` resolves to `/config`, which is where those
paths genuinely are inside the webtop image — the container layout is preserved,
not translated away.

---

## 🌐 The Pages

| Page | URL |
| --- | --- |
| Landing page | <https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/> |
| The PC | <https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/pc.html> |
| Sign-in | <https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/auth.html> |

`pc.html` asks for a session before it renders anything. See
[Setup](#-setup-install-the-cli-and-sign-in) below.

To reach a real desktop on your own machine, run the container or VM yourself and
use the address it prints — see [What The PC Is](#-what-the-pc-is). The tunnel and
Cloud Shell preview addresses that used to be listed here were temporary and are
all dead.

---

## 🎯 Virtual Touchpad & Mouse Crosshair

On the landing page (`index.html`), for driving a desktop you are streaming from
your own machine:

1. **Crosshair overlay:** turn on **🎯 Crosshair** in the toolbar to get a
   crosshair with a live `(X, Y)` readout.
2. **Gestures:** one finger drags, two fingers pinch to zoom the desktop view,
   and there are left/right/double-click buttons plus a drag lock for holding the
   button down.

None of this exists on `pc.html` — that page is the desktop itself, not a
controller for one.

---

## 🔒 Security Gateway: Master Passcode & Email OTP Recovery

The web control suite includes a dedicated cybersecurity lock screen and authentication gateway:
1. **Initial Setup:** On first launch, user configures their registered recovery email and sets a Master Passcode / PIN (minimum 4 characters).
2. **Tab / Session Protection:** Closing the web browser automatically locks the session. Re-opening the website immediately presents the Master Passcode prompt.
3. **Email OTP Reset Flow:** If the passcode is forgotten, tapping the **"Reset Password"** button dispatches a 6-digit one-time password (OTP) to the registered email and desktop notification. Once verified, the user creates a new passcode and resumes work.
4. **AI Exemption:** Connected AI services, terminal commands, background pipelines, and the Bridge API (`port 8888`) remain completely operational without requiring passcode entry.

---

## 🔑 Persistent Web Logins & Google Chrome

* Official **Google Chrome** (`google-chrome-stable` v152) is pre-configured and runs on the desktop.
* User profile and login sessions are permanently mounted to `/config/.config/google-chrome/Default`.
* When you log into GitHub, Google, or developer portals on Phone 2:
  * Credentials, cookies, passkeys, and sessions **stay logged in permanently**.
  * The AI agent can view and assist with GitHub settings, repos, and issues directly through the browser.

---

## ☁️ Cloud Storage & Cloud RAM Architecture (Zero Local Device Usage)

Where files and compute actually live depends on the backend, and this matters
more than any marketing line:

| | **docker backend** | **native backend** |
| --- | --- | --- |
| Files | `/config/Desktop/VirgoX-Files` inside the container | `$VXC_HOME/Desktop/VirgoX-Files` on the host |
| RAM & CPU | the VM's, separate from your device | **your device's own**, measured via `/health` |
| Phone storage used | ~0 MB (plus the container image) | whatever the desktop actually writes |
| Phone battery | display controller only | also doing the work — it will heat up |

* **💾 File storage:**
  * All downloads, Git repositories, ROM files, payload extractions and caches go to the VirgoX-Files directory of whichever backend is active — `/config/Desktop/VirgoX-Files` under Docker, `$VXC_HOME/Desktop/VirgoX-Files` natively.
  * On the docker backend the VM's disk is genuinely separate from the phone, so usage there does not consume phone storage.
  * **On the native backend the desktop is running on your phone.** Builds, caches and installed apps all consume real phone storage and real battery. `curl -s localhost:8888/health` reports the actual `disk_free_bytes` and `mem_total_bytes` so you can see what you have rather than trust a figure.
* **🧠 RAM & CPU:**
  * Under Docker, apps and containers run on the VM's memory and cores, and the phone is only a display controller.
  * Natively, apps run on your device's own memory and cores. The reported numbers are read from the machine; they are not a product specification.
* **🤖 AI Agent Vision & File Execution:**
  * Because all files are stored in the shared cloud workspace, the AI assistant (Antigravity) can instantly view, edit, inspect, and execute any file:
    * ROM zips, payloads, scripts, and APKs can be inspected and run directly via CLI or Desktop.
    * The AI agent can compile code, run fastboot commands, and manage builds on the cloud PC on your behalf.

---

## 🤖 Instructions for AI Assistants (How to Connect & Control in Future Sessions)

When resuming or starting a new session with this repository, the AI assistant can immediately take full control using the following steps:

### 1. Verify the desktop and bridge are up

Do not assume a backend. Ask the machine which one it is using:

```bash
curl -s http://localhost:8888/health
```

`/health` reports the real backend, architecture, kernel, display, pid, memory
and disk. `"backend": "native"` means the commands below run directly; `"docker"`
means they need the `docker exec` prefix.

Set the prefix once and it works either way:

```bash
# native:  VXC="env DISPLAY=:1"
# docker:  VXC="docker exec -u abc -e DISPLAY=:1 virgox-desktop"
if [ "$(curl -s http://localhost:8888/health | grep -o '"backend":"[a-z]*"' | cut -d'"' -f4)" = docker ]; then
  VXC="docker exec -u abc -e DISPLAY=:1 virgox-desktop"
else
  VXC="env DISPLAY=:1"
fi

bash setup_pc.sh auto    # start whichever backend this machine supports
```

### 2. Live Screen Vision (see what the user sees)

```bash
SHOT="$HOME/current_screen.png"
$VXC scrot -o "$SHOT"
```

### 3. Window management

```bash
$VXC wmctrl -l                                    # list windows
$VXC wmctrl -r "Google Chrome" -b remove,shaded    # unmaximise
$VXC wmctrl -r "Google Chrome" -t 0               # move to workspace 1
```

### 4. Mouse & keyboard automation

```bash
$VXC xdotool mousemove 500 300 click 1   # move and click
$VXC xdotool type "Hello VirgoX"        # type text
$VXC xdotool key Return                 # Enter
$VXC xdotool key ctrl+t                 # Ctrl+T
```

### 5. Facts, not product copy

`/api/status` and the assistant's spoken replies read the machine. They report
measured RAM, CPU count, disk totals and display resolution, and `null` for
anything they cannot observe. Do not quote a specification that no tool has
actually observed — the earlier "64 GB ZRAM / 5.0 TB / 1000+ FPS" block was a
hardcoded string that described nothing, and it has been removed.

---

## ⚠️ Mandatory Safety Commitment for AI Agents

> [!IMPORTANT]
> **SAFETY PROTOCOL**:
> The AI agent has full pair-programming access to inspect code, build ROMs, test scripts, and launch tools.
> **HOWEVER, THE AI AGENT MUST ALWAYS ASK THE USER FOR CONFIRMATION BEFORE MAKING ANY MAJOR OR DESTRUCTIVE CHANGES** (e.g., deleting branches/repos, force pushing, altering security/account settings, or wiping system data).

---

## ⚡ Setup: Install the CLI and Sign In

### One command installs everything

This installs the `vxc` command, `node` (needed to run the auth service),
`curl`, and `termux-api` so approval links open by themselves. Then it signs in:

```bash
curl -fsSL https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/install.sh | sh -s -- --login
```

Drop `--login` to install without signing in:

```bash
curl -fsSL https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/install.sh | sh
```

The installer installs into `$HOME/.local/bin` and adds it to your shell's rc
file, so start a new terminal or run `export PATH="$PATH:$HOME/.local/bin"` once
before `vxc` is found.

### What signing in actually does

```bash
vxc auth login
```

1. The CLI starts the auth service on `127.0.0.1:8787` if nothing is listening,
   and prints a one-time code and a link.
2. Open the link, sign in with an account, and type the code. The code is
   prefilled.
3. Press **Authorise**. The CLI polls until the grant lands.
4. On success it prints a URL ending in `?vxc_claim=…`. Open it. That page
   redeems the claim, writes the session, and loads the PC.

The claim is one-shot and expires in five minutes. A link that was already used,
or copied out of a chat log, does not work a second time.

### Commands

```bash
vxc auth login            # sign in with a one-time code
vxc auth status           # who this machine is signed in as
vxc auth token            # print the session token
vxc auth logout           # drop the session
vxc auth serve [port]     # run the auth service yourself (default 8787)
vxc pc                    # print and open the PC page
vxc app <name>            # open the PC with one window already open
vxc apps                  # list the app ids the PC accepts
vxc config set auth <url> # point at a different auth service
vxc config get auth       # show the service address in use
vxc config unset auth     # forget it and go back to the local default
vxc version
vxc help
```

### Driving the PC from the terminal

With the PC open and signed in as the same account, the terminal can drive it:

```bash
vxc pc status             # what the PC reports about itself, read in the browser
vxc pc windows            # the windows it has open
vxc pc open terminal      # open an app   (vxc apps lists the ids)
vxc pc close terminal     # close a window
vxc pc focus terminal     # bring a window to the front
vxc pc run ver            # run a command in the PC's in-page shell
```

Nothing here is typed into a remote machine. The browser is the computer, and
the command is carried to the open page over your auth service, which is the only
party both sides already talk to. The page has to be open the whole time — close
the tab and the commands have nowhere to go, and the terminal says so instead of
printing something it made up.

`vxc pc run` talks to the page's own in-page shell: live readings of the browser
it is actually running in, plus a working `vxc`. It is not a shell on your phone
and cannot reach your phone's filesystem.

For a **real** shell, see [Three shells, and which one you are looking
at](#three-shells-and-which-one-you-are-looking-at) below.

```bash
# add the PC to this terminal, then open it
vxc auth login
vxc pc

# open a specific app inside the PC
vxc apps
vxc app terminal

# then drive it
vxc pc status
vxc pc run ver
```

### Three shells, and which one you are looking at

The terminal window has three modes on a strip above the prompt. It never shows
one while claiming to be another.

| Mode | What it actually is | Needs |
|---|---|---|
| **Page shell** | This browser. Live readings, a working `vxc`, honest "not available here" for anything needing a kernel. | nothing |
| **Host shell** | A real shell on the machine running `server/auth-service.js`, over a PTY. Real `ls`, `cd`, `apt`, `python3`, and the host's whole filesystem as that user. | a signed-in session and a reachable service |
| **In-browser Linux** | A full Linux booting inside the tab — x86 emulated on WebAssembly (v86). Real kernel, real shell, real filesystem. | ~8 MB downloaded, once |

The strip picks for you: if a service is configured and you are signed in, you get
the host shell; otherwise the tab boots Linux for itself.

**Host shell** is remote code execution by design. It is gated on a session token
a human approved through the device flow, and the service sweeps shells idle for
15 minutes, but if you run the service on a network you do not control, anyone who
can sign in gets a shell as the service's user. Turn it off entirely with:

```bash
VXC_SHELL=off node server/auth-service.js
```

`/health` reports `shell: true|false` and `shell_pty: true|false` — the second is
whether a real PTY was available (`script(1)`), which is what decides whether
`apt` and `python` behave.

**In-browser Linux** is genuinely a Linux, and genuinely confined: its filesystem
is the machine's sandbox and it cannot see your host. That is the whole trade —
it needs no server at all, which is why it is the fallback on GitHub Pages.

### Pointing at your own auth service

By default the service runs on this machine and `vxc auth login` starts it for
you. To use one that is already running somewhere else:

```bash
vxc config set auth http://auth.example.com:8787

# or per-invocation
VXC_AUTH=http://auth.example.com:8787 vxc auth login
```

`vxc config set auth` does not take the address on trust. It rejects
`your-host`-style placeholders, insists on `http://` or `https://`, and calls
`/health` on the address before writing it. A wrong address fails at the point
you set it, not later at the point you need it.

If an earlier install left a placeholder address behind, clear it:

```bash
vxc config get auth
vxc config unset auth
vxc auth login
```

### Running the auth service by hand

Useful when you want it on another host, or to keep it alive across sessions:

```bash
git clone https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer.git
cd VirgoX-Cloud-Computer

PORT=8787 node server/auth-service.js
```

Accounts live in `data/accounts.json` (`0600`), hashed with scrypt and a
per-user salt. Passwords are never stored. The service also accepts
`VXC_DATA_FILE`, `VXC_POLL_INTERVAL` and `VXC_VERIFY_URL`.

### Full example

```bash
curl -fsSL https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/install.sh | sh -s -- --login
export PATH="$PATH:$HOME/.local/bin"

# add the PC to this terminal
vxc auth login

# open the PC
vxc pc

# see what it reports, and drive it
vxc pc status
vxc pc windows
vxc pc run ver
```

---

## 🪟 What The PC Is

`pc.html` is a Windows 11 Fluent desktop that runs in a browser tab. It has no
server behind it, so it is worth being exact about what that means:

* **Real, read live from your browser:** core count, GPU string, device memory
  quota, page age, frame rate, JS heap, network type, storage usage and file
  sizes (via `HEAD` requests). Anything the browser withholds is reported as not
  exposed rather than replaced with a plausible number.
* **Real apps:** Photopea, VS Code, ffmpeg.wasm for video conversion, and a media
  player that plays a file you pick locally. Nothing is uploaded.
* **Links out:** Chrome, Edge, Blender, Steam, Unreal, Microsoft Store. These open
  the real site in a new tab; this page does not bundle them, so it names no
  version numbers for them.
* **Not real:** there is no Windows 11, no container, and no VM. The terminal
  reports what this page can observe and says so when it cannot run something.

### Booting a real Linux desktop alongside it

The repository also ships a real Linux desktop, which is a different thing from
the web page. Which backend you get depends on the machine, so ask first:

```bash
git clone https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer.git
cd VirgoX-Cloud-Computer

bash scripts/vxc-doctor.sh      # what does this machine support?
```

```
docker ps >/dev/null 2>&1 && echo "docker works" || echo "docker cannot run here"
```

**If Docker works** (most desktops and servers):

```bash
bash setup_pc.sh linux          # XFCE webtop in Docker, ports 3000/3001
bash setup_pc.sh win11          # Windows 11 VM via dockurr/windows, needs KVM, port 8006
```

**If Docker cannot run** — which is the case under proot-distro on Android, and
also on many rootless/containerless environments:

```bash
bash setup_pc.sh native         # desktop in your own userspace, no Docker
```

NoVNC is then on 6080 and the terminal on 7681. `setup_pc.sh auto` picks the
right one without you deciding. The Windows 11 path stays on Docker regardless,
because a KVM VM genuinely requires it.

## 🛠️ Repository File Structure

```
VirgoX-Cloud-Computer/
├── index.html                  # 🌐 Cyberpunk Web Control Center (GitHub Pages)
├── style.css                   # 🎨 Neon Cyber UI styles & responsive mobile design
├── app.js                      # ⚙️ Touchpad, crosshair, pinch-zoom, and multi-device logic
├── manifest.json               # 📱 PWA manifest for Home Screen installation
├── sw.js                       # ⚡ Service Worker for offline performance
├── docker-compose.yml          # 🐳 Webtop XFCE Desktop Container configuration (docker backend)
├── setup_pc.sh                 # 🚀 One-click setup (auto | native | linux | win11)
├── server.py                   # 🔗 Bridge API server (Port 8888) for remote web control
├── scripts/
│   ├── vxc-doctor.sh           # 🩺 Capability probe: namespaces, cgroups, runc, arch
│   ├── vxc-native-desktop.sh   # 🖥️ Native backend: Xvfb + openbox + x11vnc + ttyd
│   ├── render-shortcuts.sh     # 🖱️ Resolves .desktop entries for the real runtime
│   ├── fix-dev-fd.sh           # 🔧 Repairs /dev/fd under proot (Chrome's launcher needs it)
│   ├── install_cloudflared.sh  # ☁️ Arch-aware cloudflared installer
│   ├── desktop/                # 🧰 Desktop helper scripts (CMD, Wine, APK, engines)
│   └── start_tunnels.sh        # 🌐 Live SSH tunnel generator for multi-device URLs
├── pc.html                     # 🪟 The Windows 11 Fluent desktop (real session gate)
├── auth.html                   # 🔑 Sign-in and one-time code approval
├── install.sh                  # ⚡ One-curl installer for the vxc CLI
├── tools/
│   └── vxc                     # 💻 The vxc command (POSIX sh, no dependencies)
├── server/
│   └── auth-service.js         # 🔐 Accounts, device flow, session handoff, host shell (node)
├── assets/
│   ├── workstation.core.js     # 🖥️ Injects the desktop, then loads app.js
│   ├── v86/                    # 🐧 In-browser Linux: emulator, BIOS, bootable image
│   │   ├── libv86.js           #    x86 emulator (WASM)
│   │   ├── v86.wasm            #    the emulator's compiled core
│   │   ├── seabios.bin         #    firmware
│   │   ├── vgabios.bin         #    display firmware
│   │   └── linux.iso           #    bootable Linux image (~5.4 MB)
│   ├── xterm/                  # ⌨️ Terminal renderer for the real shells
│   │   ├── xterm.js
│   │   ├── xterm.css
│   │   └── addon-fit.js
│   ├── win11_flow.jpg          # 🖼️ Wallpapers
│   ├── win11_bloom_light.jpg
│   ├── win11_bloom_dark.jpg
│   └── win11_sunrise.jpg
└── README.md                   # 📖 Documentation & setup
```

---

## 👨‍💻 Developer & Credits

* **Developer & Architect:** Prince · VirgoYT ([@darkvirgoyt-beep](https://github.com/darkvirgoyt-beep))
* **Ecosystem:** VirgoX Elite Gaming OS for Motorola Moto G45 5G & Moto G34 5G (`fogos`)
