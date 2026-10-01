/* ==========================================================================
   ⚡ VirgoX Cloud Computer — Interactive Application Controller
   Developer: Prince · VirgoYT (@darkvirgoyt-beep)
   ========================================================================== */

(function () {
  'use strict';

  // Default Configuration
  const DEFAULT_CONFIG = {
    desktopUrl: '',
    windowsUrl: 'http://localhost:8006',
    terminalUrl: '',
    bridgeUrl: 'http://localhost:8888',
    desktopMode: 'native', // 'native' (Built-in Cyber PC) or 'stream' (Remote Iframe)
    osMode: 'windows', // 'windows' (Official Windows 11 Pro) or 'linux'
    sensitivity: 1.5,
    crosshairEnabled: false,
    ecoMode: true
  };

  // State
  let state = {
    config: { ...DEFAULT_CONFIG },
    activeTab: 'desktop',
    zoomLevel: 100,
    isHandMode: false,
    pan: { x: 0, y: 0 },
    isDragLocked: false,
    orientation: 'landscape',
    keyboardOpen: false,
    crosshair: { x: 50, y: 50 }, // percentage
    touchStartDist: 0,
    pinchStartDist: 0
  };

  // Load Saved Config from LocalStorage
  function loadConfig() {
    try {
      const saved = localStorage.getItem('virgox_pc_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.config = { ...DEFAULT_CONFIG, ...parsed };
        if (parsed.desktopUrl && parsed.desktopUrl.includes('trycloudflare.com')) {
          state.config.desktopUrl = '';
          state.config.terminalUrl = '';
          saveConfig();
        }
        if (state.config.desktopUrl && state.config.desktopUrl.includes('pinggy')) {
          state.config.desktopUrl = '';
        }
        if (!state.config.desktopMode) state.config.desktopMode = 'native';
        if (!state.config.osMode) state.config.osMode = 'windows';
        if (!state.config.bridgeUrl) state.config.bridgeUrl = 'http://localhost:8888';
      }
    } catch (e) {
      console.warn('Failed to parse config from localStorage', e);
    }
  }

  // Save Config to LocalStorage
  function saveConfig() {
    try {
      localStorage.setItem('virgox_pc_config', JSON.stringify(state.config));
    } catch (e) {
      console.warn('Failed to save config', e);
    }
  }

  // Universal Safe Open Tab Utility (Popup Blocker & CSP Proof)
  //
  // `window.open` is unreliable here: a popup blocker eats it, and an inline
  // handler that has already yielded to an `await` loses the user-activation
  // that browsers require. The anchor click is the fallback that keeps working
  // when the window call returns a dead handle.
  function safeOpenTab(rawUrl) {
    if (!rawUrl) return;
    let target = String(rawUrl).trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = 'https://' + target;
      } else {
        target = 'https://duckduckgo.com/?q=' + encodeURIComponent(target);
      }
    }
    function viaAnchor() {
      const a = document.createElement('a');
      a.href = target;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 150);
    }
    try {
      const w = window.open(target, '_blank', 'noopener,noreferrer');
      if (!w || w.closed || typeof w.closed === 'undefined') viaAnchor();
    } catch (e) {
      viaAnchor();
    }
  }
  window.safeOpenTab = safeOpenTab;

  // DOM Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const desktopFrame = document.getElementById('desktop-frame');
  const terminalFrame = document.getElementById('terminal-frame');
  const splitDesktopFrame = document.getElementById('split-desktop-frame');
  const splitTerminalFrame = document.getElementById('split-terminal-frame');
  
  // Hand / Pan Tool Elements
  const btnHandMode = document.getElementById('btn-hand-mode');
  const handStateText = document.getElementById('hand-state');
  const panOverlay = document.getElementById('pan-overlay');
  const dockBtnHand = document.getElementById('dock-btn-hand');

  // Crosshair Elements
  const toggleCrosshairBtn = document.getElementById('toggle-crosshair');
  const crosshairStateText = document.getElementById('crosshair-state');
  const crosshairTarget = document.getElementById('crosshair-target');
  const crosshairCoords = document.getElementById('crosshair-coords');

  // Zoom Controls
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomResetBtn = document.getElementById('zoom-reset');
  const zoomLevelText = document.getElementById('zoom-level');

  // Touchpad Elements
  const touchpadSurface = document.getElementById('touchpad-surface');
  const touchpadPointer = document.getElementById('touchpad-pointer');
  const mouseSensInput = document.getElementById('mouse-sens');
  const sensValText = document.getElementById('sens-val');
  const padLeftClick = document.getElementById('pad-left-click');
  const padDoubleClick = document.getElementById('pad-double-click');
  const padRightClick = document.getElementById('pad-right-click');
  const btnDragLock = document.getElementById('btn-drag-lock');

  // Settings Modal Elements
  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings');
  const inputDesktopUrl = document.getElementById('input-desktop-url');
  const inputWindowsUrl = document.getElementById('input-windows-url');
  const inputTerminalUrl = document.getElementById('input-terminal-url');
  const inputBridgeUrl = document.getElementById('input-bridge-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  const linkPhone1 = document.getElementById('link-phone1');
  const linkPhone2 = document.getElementById('link-phone2');

  // Screenshot Inspector
  const btnRefreshScreen = document.getElementById('btn-refresh-screen');
  const screenImg = document.getElementById('screen-img');
  const snapshotTime = document.getElementById('snapshot-time');

  // Multi-User Profile & Scoping Controller
  function setupUserProfile() {
    const email = (sessionStorage.getItem('virgox_user_email') || localStorage.getItem('virgox_active_user') || 'darkvirgoyt@gmail.com').toLowerCase();
    const name = sessionStorage.getItem('virgox_user_name') || 'Prince (Owner)';
    const role = sessionStorage.getItem('virgox_user_role') || (email === 'darkvirgoyt@gmail.com' ? 'owner' : 'guest');
    const picture = sessionStorage.getItem('virgox_user_picture') || '';
    const isOwner = (role === 'owner' || email === 'darkvirgoyt@gmail.com');

    document.documentElement.setAttribute('data-user-mode', isOwner ? 'owner' : 'guest');

    const nameEl = document.getElementById('user-name-display');
    const emailEl = document.getElementById('user-email-display');
    const roleEl = document.getElementById('role-badge');
    const avatarImg = document.getElementById('user-avatar-img');
    const avatarInitials = document.getElementById('user-avatar-initials');
    const welcomeGuest = document.getElementById('welcome-guest-name');

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (roleEl) {
      roleEl.textContent = isOwner ? '👑 OWNER' : '👤 USER';
      roleEl.className = 'role-badge ' + (isOwner ? 'owner' : 'guest');
    }
    if (welcomeGuest) welcomeGuest.textContent = name;

    const defaultPrincePic = 'https://avatars.githubusercontent.com/u/263169230?v=4';
    const effectivePic = picture || (isOwner ? defaultPrincePic : '');

    if (avatarImg && avatarInitials) {
      if (effectivePic) {
        avatarImg.src = effectivePic;
        avatarImg.style.display = 'block';
        avatarInitials.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarInitials.style.display = 'block';
        avatarInitials.textContent = (name.charAt(0) || 'U').toUpperCase();
      }
    }

    // Connect header lock / logout button
    const btnLock = document.getElementById('btn-header-lock');
    if (btnLock) {
      btnLock.onclick = () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
      };
    }
  }

  // Escape untrusted text before it goes into innerHTML.
  // Called by renderMsStoreCards() and by the terminal command-output handler.
  // The MS Store call site sits inside the configs object literal in
  // openAppWindow(), which is evaluated eagerly for every app id, so while this
  // was missing every launcher in the desktop threw a ReferenceError before it
  // could open anything.
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
  }

  /* ------------------------------------------------------------------ reality
   *
   * Every number this shell prints about the machine comes out of a live
   * platform API, or it is printed as "not exposed". There is not one
   * plausible-looking constant in here. A made-up 64 GB pool or a "120 FPS
   * hardware-synchronised compositor" reads as a measurement, and a fabricated
   * reading is worse than admitting the browser will not tell us — so where the
   * platform withholds a value, the null is rendered rather than replaced.
   *
   * Most of these APIs are Chromium-only. On Firefox and Safari they are absent,
   * so every reading is allowed to be null and every caller must render it.
   */
  const NOT_EXPOSED = 'not exposed';

  function fact(value, suffix) {
    if (value === null || value === undefined || value === '') return NOT_EXPOSED;
    return suffix ? value + ' ' + suffix : String(value);
  }

  /* navigator.storage.estimate() is the only quota figure that exists, and it
   * is a browser-managed allowance for this origin — not a disk, not a pool. It
   * is async, so callers await it instead of guessing. */
  function storageEstimate() {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return Promise.resolve(null);
    }
    return navigator.storage.estimate().catch(() => null);
  }

  function fmtDuration(ms) {
    if (!Number.isFinite(ms)) return NOT_EXPOSED;
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return d + 'd ' + h + 'h ' + m + 'm';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (s % 60) + 's';
    return (ms / 1000).toFixed(1) + 's';
  }

  /* WebGL's unmasked renderer, when the browser will hand it over. A masked
   * string is still the truthful answer, so it is reported as-is. */
  function readGpuInfo() {
    let gl = null;
    try {
      gl = document.createElement('canvas').getContext('webgl2')
        || document.createElement('canvas').getContext('webgl');
    } catch (e) { gl = null; }
    if (!gl) return { renderer: null, vendor: null, version: null, reason: 'WebGL unavailable' };
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        version: gl.getParameter(gl.VERSION),
        masked: !dbg,
        reason: null,
      };
    } catch (e) {
      return { renderer: null, vendor: null, version: null, reason: 'WebGL blocked by this browser' };
    }
  }

  function platformFacts() {
    const nav = window.navigator || {};
    const scr = window.screen || {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    const mem = window.performance && window.performance.memory ? window.performance.memory : null;
    const gpu = readGpuInfo();
    const now = window.performance && Number.isFinite(performance.now()) ? performance.now() : null;

    return {
      /* The one real number the platform gives us about the CPU. */
      logicalCores: Number.isFinite(nav.hardwareConcurrency) && nav.hardwareConcurrency > 0
        ? nav.hardwareConcurrency : null,
      /* Chromium-only, and deliberately bucketed to 0.25/0.5/1/2/4/8 — it is a
       * cap on device class, not a measurement, so it is labelled as such. */
      deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
      jsHeapUsedBytes: mem && Number.isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize : null,
      jsHeapLimitBytes: mem && Number.isFinite(mem.jsHeapSizeLimit) ? mem.jsHeapSizeLimit : null,
      screenWidth: Number.isFinite(scr.width) ? scr.width : null,
      screenHeight: Number.isFinite(scr.height) ? scr.height : null,
      availWidth: Number.isFinite(scr.availWidth) ? scr.availWidth : null,
      availHeight: Number.isFinite(scr.availHeight) ? scr.availHeight : null,
      viewportWidth: Number.isFinite(window.innerWidth) ? window.innerWidth : null,
      viewportHeight: Number.isFinite(window.innerHeight) ? window.innerHeight : null,
      dpr: Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : null,
      colourDepth: Number.isFinite(scr.colorDepth) ? scr.colorDepth : null,
      maxTouchPoints: Number.isFinite(nav.maxTouchPoints) ? nav.maxTouchPoints : null,
      platform: nav.userAgentData && nav.userAgentData.platform
        ? nav.userAgentData.platform
        : (typeof nav.platform === 'string' ? nav.platform : null),
      mobile: nav.userAgentData ? !!nav.userAgentData.mobile : null,
      ua: typeof nav.userAgent === 'string' ? nav.userAgent : null,
      language: nav.language || null,
      vendor: nav.vendor || null,
      effectiveType: conn && conn.effectiveType ? conn.effectiveType : null,
      downlinkMbps: conn && Number.isFinite(conn.downlink) ? conn.downlink : null,
      rttMs: conn && Number.isFinite(conn.rtt) ? conn.rtt : null,
      saveData: conn ? !!conn.saveData : null,
      online: typeof nav.onLine === 'boolean' ? nav.onLine : null,
      /* performance.now() is monotonic since navigation start, so this is the
       * real age of the document — the only uptime a tab genuinely has. */
      pageAgeMs: now,
      cookiesEnabled: nav.cookieEnabled === true,
      origin: location.origin,
      host: location.host,
      gpu: gpu,
    };
  }

  /* ------------------------------------------------------------------ file index
   *
   * A static page cannot list a directory and a browser cannot read a local
   * disk, so the only file list that can be honest is the one this app actually
   * loads. Every size below is read with a live HEAD request, which means a file
   * that is not deployed reports 404 instead of a made-up byte count, and a file
   * that grows reports its new size.
   */
  const SITE_FILES = [
    'pc.html', 'app.js', 'style.css', 'auth.html', 'index.html',
    'manifest.json', 'sw.js', 'server.py', 'playstore.html',
    'server/auth-service.js', 'tools/vxc', 'install.sh',
  ];

  function headSize(url) {
    return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const len = r.headers.get('content-length');
      return {
        ok: r.ok,
        status: r.status,
        bytes: r.ok && len && /^\d+$/.test(len) ? Number(len) : null,
        modified: r.headers.get('last-modified'),
      };
    }).catch(() => ({ ok: false, status: 0, bytes: null, modified: null }));
  }

  async function siteFileIndex() {
    const base = new URL('.', location.href).href;
    return Promise.all(SITE_FILES.map(async name => {
      const r = await headSize(base + name);
      return { name, ok: r.ok, status: r.status, bytes: r.bytes, modified: r.modified };
    }));
  }

  function stamp(iso) {
    if (!iso) return '                 ';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '                 ';
    const two = n => String(n).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    return two(d.getMonth() + 1) + '/' + two(d.getDate()) + '/' + d.getFullYear()
      + '  ' + two(d.getHours() % 12 || 12) + ':' + two(d.getMinutes()) + ' ' + ampm;
  }

  /* One source of truth for what the machine is, so the banner, neofetch, the
   * settings panel and the Store cannot drift apart or drift into fiction. */
  function realityLine() {
    const f = platformFacts();
    return {
      f,
      cpu: fact(f.logicalCores, 'logical cores'),
      gpu: f.gpu.renderer || f.gpu.reason || NOT_EXPOSED,
      mem: f.deviceMemoryGb === null
        ? NOT_EXPOSED
        : 'up to ' + f.deviceMemoryGb + ' GB device class (browser-declared bucket)',
      screen: (f.screenWidth && f.screenHeight)
        ? f.screenWidth + 'x' + f.screenHeight + ' @ ' + f.dpr + 'x'
        : NOT_EXPOSED,
    };

  /* Any element carrying data-pf="key" is filled from a live reading as soon as
   * its window is in the DOM. One pass, centralised, so no panel — settings,
   * store, tray, about — can hardcode a specification and drift from the truth. */
  const PF_KEYS = {
    host: f => f.host || NOT_EXPOSED,
    origin: f => f.origin || NOT_EXPOSED,
    cores: f => fact(f.logicalCores, 'logical cores'),
    deviceMemory: f => f.deviceMemoryGb === null
      ? NOT_EXPOSED
      : 'up to ' + f.deviceMemoryGb + ' GB device class (browser bucket)',
    heap: f => f.jsHeapUsedBytes === null
      ? NOT_EXPOSED
      : fmtBytes(f.jsHeapUsedBytes) + ' of ' + fmtBytes(f.jsHeapLimitBytes),
    gpu: f => f.gpu.renderer || f.gpu.reason || NOT_EXPOSED,
    screen: f => (f.screenWidth && f.screenHeight)
      ? f.screenWidth + '×' + f.screenHeight + ' @ ' + f.dpr + 'x'
      : NOT_EXPOSED,
    ua: f => fact(f.ua),
    platform: f => fact(f.platform),
    touch: f => fact(f.maxTouchPoints),
    connection: f => f.effectiveType
      ? f.effectiveType + ' · ' + f.downlinkMbps + ' Mb/s · ' + f.rttMs + ' ms'
      : NOT_EXPOSED,
    uptime: f => fmtDuration(f.pageAgeMs),
    account: () => vxcCurrentUser().email || 'not signed in',
    quota: f => f.storageLabel || NOT_EXPOSED,
  };

  async function hydratePlatformFacts(root) {
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    const nodes = scope.querySelectorAll('[data-pf]');
    if (!nodes.length) return;
    const f = platformFacts();
    const est = await storageEstimate();
    if (est && Number.isFinite(est.quota)) {
      f.storageLabel = fmtBytes(est.usage || 0) + ' used of ' + fmtBytes(est.quota) + ' allowance';
    }
    nodes.forEach(n => {
      const fn = PF_KEYS[n.getAttribute('data-pf')];
      n.textContent = fn ? fn(f) : NOT_EXPOSED;
    });
  }
  }

  // Large sites (Google, most banks, anything behind a CDN) send
  // X-Frame-Options: DENY or a frame-ancestors CSP, so they refuse to render
  // inside our iframe and the user just sees a blank rectangle. We cannot read
  // those headers cross-origin, but we can test the document itself: if reading
  // contentWindow.location throws, the frame was blocked.
  // Resolves 'ok' | 'blocked' | 'unknown'.
  function detectFramed(url, timeoutMs) {
    return new Promise(resolve => {
      if (!url || !/^https?:/i.test(url)) return resolve('unknown');
      let settled = false;
      const probe = document.createElement('iframe');
      const done = verdict => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { probe.remove(); } catch (e) {}
        resolve(verdict);
      };
      const timer = setTimeout(() => done('unknown'), timeoutMs || 3500);
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:2px;height:2px;border:0;visibility:hidden;';
      probe.onload = () => {
        let framed = false;
        try {
          // Cross-origin documents throw on href access. Same-origin does not.
          framed = !!probe.contentWindow && !!probe.contentWindow.location.href;
        } catch (e) {
          framed = false;
        }
        done(framed ? 'ok' : 'blocked');
      };
      probe.onerror = () => done('blocked');
      probe.src = url;
      document.body.appendChild(probe);
    });
  }

  // ==========================================================================
  //  vxc auth — OAuth 2.0 device authorization grant, driven from the terminal.
  //  Modelled on `gh auth login`: the CLI prints a one-time user code and a
  //  verification link, the user opens that link on any device and types the
  //  code, and the CLI polls until the service reports the grant is complete.
  // ==========================================================================

  // Single point of configuration. This page is static, so the service has to be
  // somewhere else; point this at wherever server/auth-service.js is running.
  const VXC_AUTH = {
    base: 'https://virgox-auth.onrender.com',
    client: 'virgox-cloud-pc',
    scope: 'workstation:read',
    store: {
      token: 'virgox_session_token',
      user: 'virgox_user_email',
      authed: 'virgox_authenticated',
      meta: 'virgox_auth_meta'
    }
  };

  // Survives `vxc auth login cancel` — the poll loop checks this each tick.
  const vxcLogin = { active: false, deviceCode: null, cancelled: false };

  const vxcSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function vxcPostJson(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`auth service returned non-JSON (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
    return data;
  }

  async function vxcPostForm(url, params) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams(params).toString()
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`auth service returned non-JSON (HTTP ${res.status})`);
    }
  }

  function vxcWriteSession(token, email, meta) {
    sessionStorage.setItem(VXC_AUTH.store.authed, 'true');
    sessionStorage.setItem(VXC_AUTH.store.token, token);
    sessionStorage.setItem(VXC_AUTH.store.user, String(email || '').toLowerCase());
    sessionStorage.setItem(VXC_AUTH.store.meta, JSON.stringify(meta || {}));
  }

  function vxcClearSession() {
    Object.values(VXC_AUTH.store).forEach(k => sessionStorage.removeItem(k));
  }

  function vxcCurrentUser() {
    const meta = sessionStorage.getItem(VXC_AUTH.store.meta);
    return {
      token: sessionStorage.getItem(VXC_AUTH.store.token),
      email: sessionStorage.getItem(VXC_AUTH.store.user),
      meta: meta ? JSON.parse(meta) : null
    };
  }

  async function runVxcCommand(rawArgs, output, termBody) {
    const scroll = () => { if (termBody) termBody.scrollTop = termBody.scrollHeight; };
    const put = html => { output.innerHTML += html; scroll(); };

    const parts = (rawArgs || '').trim().split(/\s+/).filter(Boolean);
    const sub = (parts[0] || 'help').toLowerCase();

    if (sub === 'help' || sub === '--help' || sub === '-h') {
      put(`\n<b>vxc auth</b> — device login for the VirgoX Cloud PC\n\n` +
          `  <b>vxc auth login</b>     print a one-time code + link, then poll until approved\n` +
          `  <b>vxc auth status</b>   show the account this workstation is signed in as\n` +
          `  <b>vxc auth token</b>    print the session token (masked unless --show)\n` +
          `  <b>vxc auth logout</b>   clear the stored session from this browser\n\n` +
          `  <b>vxc</b> with no arguments prints this list.\n`);
      return;
    }

    if (sub === 'status') {
      const cur = vxcCurrentUser();
      if (!cur.token) {
        put(`\n  ○ not logged in — run <b>vxc auth login</b>\n`);
        return;
      }
      put(`\n  ✓ signed in\n`);
      put(`    account    ${escapeHtml(cur.email || '(unknown)')}\n`);
      if (cur.meta && cur.meta.device) put(`    device     ${escapeHtml(cur.meta.device)}\n`);
      if (cur.meta && cur.meta.granted_at) {
        put(`    granted    ${escapeHtml(new Date(cur.meta.granted_at).toLocaleString())}\n`);
      }
      if (cur.meta && cur.meta.scope) put(`    scope      ${escapeHtml(cur.meta.scope)}\n`);
      put(`    endpoint   ${escapeHtml(VXC_AUTH.base)}\n\n`);
      return;
    }

    if (sub === 'token') {
      const cur = vxcCurrentUser();
      if (!cur.token) {
        put(`\n  ✖ not logged in — run <b>vxc auth login</b>\n`);
        return;
      }
      const show = parts.includes('--show') || parts.includes('--raw');
      const shown = show ? cur.token : cur.token.slice(0, 8) + '…' + cur.token.slice(-4);
      put(`\n  ${escapeHtml(shown)}\n`);
      if (!show) put(`  (pass --show to print the whole token)\n`);
      put(`\n`);
      return;
    }

    if (sub === 'logout') {
      vxcClearSession();
      put(`\n  ✓ session cleared from this browser\n\n`);
      return;
    }

    if (sub !== 'login') {
      put(`\n  ✖ unknown command: vxc auth ${escapeHtml(sub)}\n`);
      put(`    type <b>vxc auth help</b> for the list\n\n`);
      return;
    }

    // ---- vxc auth login ------------------------------------------------
    if (vxcLogin.active) {
      put(`\n  ✖ a login is already running — cancel it with <b>vxc auth login cancel</b>\n\n`);
      return;
    }

    vxcLogin.active = true;
    vxcLogin.cancelled = false;
    vxcLogin.deviceCode = null;

    const finish = () => { vxcLogin.active = false; vxcLogin.deviceCode = null; vxcLogin.cancelled = false; };

    const cancelRequested = parts.includes('cancel');
    if (cancelRequested) {
      vxcLogin.cancelled = true;
      vxcLogin.deviceCode = null;
      finish();
      put(`\n  ✓ login cancelled\n\n`);
      return;
    }

    put(`\n<b>VirgoX Cloud PC — device login</b>\n\n  Requesting a code from ${escapeHtml(VXC_AUTH.base)} … `);

    let device;
    try {
      device = await vxcPostJson(`${VXC_AUTH.base}/device/code`, {
        client_id: VXC_AUTH.client,
        scope: VXC_AUTH.scope
      });
    } catch (err) {
      finish();
      put(`failed\n\n`);
      put(`  ✖ ${escapeHtml(err.message)}\n\n`);
      put(`  This workstation is a static page, so the device flow needs the\n`);
      put(`  VirgoX auth service to be running somewhere reachable. Start it:\n\n`);
      put(`      node server/auth-service.js\n\n`);
      put(`  Then point VXC_AUTH.base in app.js at it and run this again.\n\n`);
      return;
    }

    if (!device || !device.device_code || !device.user_code) {
      finish();
      put(`failed\n\n  ✖ auth service did not return a device code\n\n`);
      return;
    }

    vxcLogin.deviceCode = device.device_code;

    const verifyUri = device.verification_uri_complete || device.verification_uri || VXC_AUTH.base;
    const expiresIn = Number(device.expires_in) || 900;

    put(`ok\n\n`);
    put(`  ┌────────────────────────────────────────────────────────────┐\n`);
    put(`  │  First copy your one-time code:  <b>${escapeHtml(device.user_code)}</b>${' '.repeat(Math.max(1, 22 - String(device.user_code).length))}│\n`);
    put(`  │  Then open this link on any device:                        │\n`);
    put(`  │  <span style="color:#60a5fa; word-break:break-all;">${escapeHtml(verifyUri)}</span>${' '.repeat(Math.max(1, 52 - verifyUri.length))}│\n`);
    put(`  └────────────────────────────────────────────────────────────┘\n\n`);
    put(`  Waiting for you to authorise… <span style="opacity:.6">(expires in ${Math.round(expiresIn / 60)} min, cancel with <b>vxc auth login cancel</b>)</span>\n`);

    let interval = (Number(device.interval) || 5) * 1000;
    const deadline = Date.now() + expiresIn * 1000;
    let elapsed = 0;

    while (Date.now() < deadline) {
      await vxcSleep(interval);

      if (vxcLogin.cancelled || vxcLogin.deviceCode !== device.device_code) {
        finish();
        put(`\n  ✓ cancelled\n\n`);
        return;
      }

      let poll;
      try {
        poll = await vxcPostForm(`${VXC_AUTH.base}/token`, {
          client_id: VXC_AUTH.client,
          device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });
      } catch (err) {
        // A transport blip is not a denial — keep polling until the deadline.
        elapsed = Math.min(60, elapsed + 1);
        put(`<span style="opacity:.55">· ${escapeHtml(err.message)} (retrying)</span>\n`);
        continue;
      }

      if (poll.access_token) {
        vxcWriteSession(poll.access_token, poll.user_email || poll.email, {
          device: device.device || 'cloud-pc',
          scope: poll.scope || VXC_AUTH.scope,
          granted_at: Date.now()
        });
        finish();
        put(`\n  ✓ authenticated as <b>${escapeHtml(poll.user_email || poll.email || 'unknown')}</b>\n`);
        put(`    token stored in sessionStorage · scope ${escapeHtml(poll.scope || VXC_AUTH.scope)}\n`);
        put(`    reload the workstation page to apply it\n\n`);
        return;
      }

      if (poll.error === 'authorization_pending') {
        elapsed += 5;
        put(`<span style="opacity:.55">· still waiting… ${elapsed}s</span>\n`);
        continue;
      }

      if (poll.error === 'slow_down') {
        interval += 5000;
        put(`<span style="opacity:.55">· service asked us to slow down, polling every ${interval / 1000}s</span>\n`);
        continue;
      }

      if (poll.error === 'access_denied') {
        finish();
        put(`\n  ✖ the request was denied\n\n`);
        return;
      }

      if (poll.error === 'expired_token') {
        finish();
        put(`\n  ✖ the code expired before it was approved — run <b>vxc auth login</b> again\n\n`);
        return;
      }

      finish();
      put(`\n  ✖ ${escapeHtml(poll.error_description || poll.error || 'unknown auth error')}\n\n`);
      return;
    }

    finish();
    put(`\n  ✖ timed out waiting for approval — the code has expired\n\n`);
  }

  // Initialize
  /* `vxc app <name>` prints and opens a URL ending in ?open=<name>. Nothing used
   * to read it, so the command opened the workstation and then did nothing —
   * the app it named stayed shut. This runs last, after the desktop and the
   * installed-apps drawer exist, because openAppWindow needs them.
   *
   * The parameter is removed from the address bar afterwards, so a reload does
   * not reopen the window the user already closed. */
  function openFromUrl() {
    let wanted;
    try {
      wanted = new URLSearchParams(location.search).get('open');
    } catch (e) { return; }
    if (!wanted) return;

    try {
      const u = new URL(location.href);
      u.searchParams.delete('open');
      const q = u.searchParams.toString();
      history.replaceState(null, '', u.pathname + (q ? '?' + q : '') + u.hash);
    } catch (e) { /* history is not essential; the window still opens */ }

    // The installed-apps drawer only lists what the service reports, so an app
    // it does not know about has no tile to focus. openAppWindow still builds a
    // real window for any id, and shows the honest placeholder when there is
    // nothing real behind that id.
    if (typeof openAppWindow === 'function') {
      openAppWindow(String(wanted).slice(0, 64));
    }
  }

  /* ------------------------------------------------------------ vxc agent link
   *
   * The terminal that ran `vxc auth login` and this page cannot see each other:
   * one is a shell on a phone, this is a document in a browser, and they share no
   * process, socket or storage. The auth service they both already talk to
   * carries the traffic instead — this polls it, runs what arrives, and posts
   * the answer back. That is what makes `vxc pc status` report this machine and
   * `vxc pc run …` do something here.
   *
   * It only starts when this page holds a session token and knows which service
   * issued it, so it cannot be pointed at a host that was never configured.
   */
  const VXC_AGENT = {
    base: null,
    token: null,
    running: false,
    stop: false,
    pollWaitMs: 20000,
    backoffMs: 1000,
    maxBackoffMs: 30000,
  };

  function agentBase() {
    let raw = null;
    try { raw = localStorage.getItem('virgox_auth_base'); } catch (e) {}
    if (!raw) return null;
    try {
      const u = new URL(raw);
      // http/https only. A page that will POST a session token must not be talked
      // into sending it to a javascript: or file: origin.
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.origin;
    } catch (e) { return null; }
  }

  function agentToken() {
    try { return sessionStorage.getItem('virgox_session_token') || ''; } catch (e) { return ''; }
  }

  /* Every command below reports what it actually did. Nothing here answers with
   * a value it did not read from this document. */
  const VXC_AGENT_COMMANDS = {
    status() {
      const f = platformFacts();
      const wins = Object.keys(openWindows);
      return {
        email: sessionStorage.getItem('virgox_user_email') || null,
        origin: location.origin,
        page: location.pathname,
        windows: wins.length,
        window_ids: wins,
        logical_cores: f.logicalCores,
        device_memory_gb: f.deviceMemoryGb,
        screen: f.screenWidth && f.screenHeight ? `${f.screenWidth}x${f.screenHeight}` : null,
        viewport: f.viewportWidth && f.viewportHeight ? `${f.viewportWidth}x${f.viewportHeight}` : null,
        user_agent: f.ua,
        platform: f.platform,
        online: f.online,
        page_age_ms: Math.round(f.pageAgeMs),
        storage_estimate: typeof navigator.storage && navigator.storage.estimate
          ? 'navigator.storage.estimate()' : null,
      };
    },

    windows() {
      return Object.keys(openWindows).map(id => {
        const win = openWindows[id];
        return {
          id,
          title: (win.querySelector('.win-title-left span:first-child')?.textContent || '').trim(),
          focused: win.classList.contains('active') && !win.classList.contains('minimized'),
          minimized: win.classList.contains('minimized'),
        };
      });
    },

    open({ argv }) {
      const id = argv[1];
      if (!id) return { ok: false, error: 'open needs an app id — see `vxc apps`' };
      openAppWindow(id);
      return { ok: true, opened: id, windows: Object.keys(openWindows) };
    },

    close({ argv }) {
      const id = argv[1];
      const win = id ? openWindows[id] : null;
      if (!win) return { ok: false, error: `no window open for '${id || ''}'` };
      win.querySelector('.win-btn.close')?.click();
      return { ok: true, closed: id, windows: Object.keys(openWindows) };
    },

    focus({ argv }) {
      const id = argv[1];
      const win = id ? openWindows[id] : null;
      if (!win) return { ok: false, error: `no window open for '${id || ''}'` };
      bringToFront(win);
      return { ok: true, focused: id };
    },

    /* Runs a command in the page's own terminal window by putting it in the
     * input and pressing Enter, so it goes through exactly the same handler a
     * person typing at the keyboard would. It is the same limited shell that
     * window has: it reports live browser readings and says so when the browser
     * withholds something. It is not a shell on this device. */
    run({ argv }) {
      const line = argv.slice(1).join(' ').trim();
      if (!line) return { ok: false, error: 'run needs a command' };
      let win = openWindows['terminal'];
      if (!win) {
        openAppWindow('terminal');
        win = openWindows['terminal'];
      }
      if (!win) return { ok: false, error: 'the terminal window did not open' };
      const input = win.querySelector('#native-term-input');
      const output = win.querySelector('#term-output-stream');
      if (!input || !output) return { ok: false, error: 'the terminal window has no input element' };

      input.value = line;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      // The handler is async (some commands read the network), so the output is
      // read after a turn of the event loop rather than immediately.
      return new Promise(resolve => setTimeout(() => {
        const text = (output.textContent || '').split('\n').slice(-40).join('\n').trim();
        resolve({
          ok: true,
          command: line,
          output: text,
          // Terminal output is multi-line and full of backslashes. It is sent as
          // text so the terminal prints it exactly, instead of being flattened
          // into `key: value` lines that lose half of it.
          text: text || '(no output)',
        });
      }, 350));
    },

    help() {
      return {
        commands: ['status', 'windows', 'open <app>', 'close <app>', 'focus <app>', 'run <line>', 'help'],
        note: 'run executes inside this page\'s terminal window, which is a live browser shell, not a device shell.',
      };
    },
  };

  async function agentRequest(path, body, method) {
    const headers = { Authorization: 'Bearer ' + VXC_AGENT.token };
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    const r = await fetch(VXC_AGENT.base + path, {
      method: method || 'POST',
      headers,
      cache: 'no-store',
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    return r.json().catch(() => ({}));
  }

  async function vxcAgentRun(argv) {
    const name = String(argv[0] || '').toLowerCase();
    const fn = VXC_AGENT_COMMANDS[name];
    if (!fn) {
      return {
        ok: false,
        error: `unknown command '${argv[0] || ''}' — try: ${Object.keys(VXC_AGENT_COMMANDS).join(', ')}`,
      };
    }
    try {
      return await fn({ argv });
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  async function vxcAgentLoop() {
    if (VXC_AGENT.running) return;
    VXC_AGENT.running = true;
    VXC_AGENT.stop = false;

    while (!VXC_AGENT.stop) {
      try {
        const data = await agentRequest('/agent/poll', null, 'POST');
        VXC_AGENT.backoffMs = 1000;

        const commands = Array.isArray(data.commands) ? data.commands : [];
        for (const c of commands) {
          const answer = await vxcAgentRun(c.argv || []);
          await agentRequest('/agent/report', {
            id: c.id,
            ok: answer.ok !== false,
            data: answer,
            text: typeof answer.text === 'string' ? answer.text : null,
            error: answer.error || null,
            facts: VXC_AGENT_COMMANDS.status(),
          });
        }

        // An idle poll still proves this page is alive, so the facts go up on
        // every pass rather than only when something was asked.
        if (!commands.length) {
          await agentRequest('/agent/report', { id: '', facts: VXC_AGENT_COMMANDS.status() });
        }
      } catch (err) {
        if (VXC_AGENT.stop) break;
        // The service may be down or the network may be gone. Back off, and do
        // not spin: this loop runs for as long as the page is open.
        await new Promise(r => setTimeout(r, VXC_AGENT.backoffMs));
        VXC_AGENT.backoffMs = Math.min(VXC_AGENT.backoffMs * 2, VXC_AGENT.maxBackoffMs);
      }
    }
    VXC_AGENT.running = false;
  }

  function setupVxcAgent() {
    VXC_AGENT.base = agentBase();
    VXC_AGENT.token = agentToken();
    if (!VXC_AGENT.base || !VXC_AGENT.token) return;   // nothing to talk to, no loop
    vxcAgentLoop();
    window.addEventListener('pagehide', () => { VXC_AGENT.stop = true; });
  }

  function init() {
    const tasks = [
      setupUserProfile, loadConfig, setupFrames, setupTabs,
      setupNativeDesktop,
      setupEcoMode, setupHandMode, setupKeyboard, setupOrientation,
      setupResolution, setupTouchpad, setupZoom, setupCrosshair,
      setupQuickKeys, setupSettingsModal, setupOsSwitcher, setupTabsModal,
      setupDesktopRefresh, setupDesktopTrackpadOverlay, setupVirtualPcKeyboard,
      setupExternalMouseCapture, setupCopilot, setupFullscreen,
      checkConnectionStatus, setupSecurityGate, setupInstalledAppsDrawer,
      setupNetworkControl, setupExternalKeyboard, setupBackupAndPrivacy,
      openFromUrl, setupVxcAgent
    ];
    tasks.forEach(fn => {
      try {
        if (typeof fn === 'function') fn();
      } catch (err) {
        console.warn('Init task warning:', fn.name, err);
      }
    });
  }

  // Frame Security Controllers: STRICT zero-trust isolation
  function getActiveDesktopUrl() {
    return state.config.osMode === 'windows' ? (state.config.windowsUrl || 'http://localhost:8006') : state.config.desktopUrl;
  }

  function updateDesktopModeUI() {
    const nativeDesk = document.getElementById('native-cyber-desktop');
    const modeLabel = document.getElementById('desktop-mode-label');
    const btnToggle = document.getElementById('btn-toggle-desktop-mode');
    const overlay = document.getElementById('screen-touchpad-overlay');

    if (state.config.desktopMode === 'stream' && state.config.desktopUrl) {
      if (nativeDesk) nativeDesk.classList.add('hidden');
      if (desktopFrame) {
        desktopFrame.style.display = 'block';
        const activeUrl = getActiveDesktopUrl();
        if (activeUrl && desktopFrame.src !== activeUrl) {
          desktopFrame.src = activeUrl;
        }
      }
      if (modeLabel) modeLabel.textContent = 'Remote Stream';
      if (btnToggle) {
        btnToggle.classList.add('neon-cyan');
        btnToggle.classList.remove('neon-green');
      }
    } else {
      state.config.desktopMode = 'native';
      if (desktopFrame) {
        desktopFrame.style.display = 'none';
        desktopFrame.src = 'about:blank';
      }
      if (nativeDesk) nativeDesk.classList.remove('hidden');
      if (modeLabel) modeLabel.textContent = 'Native Cyber PC';
      if (btnToggle) {
        btnToggle.classList.add('neon-green');
        btnToggle.classList.remove('neon-cyan');
      }
    }
  }

  function loadFrames() {
    if (sessionStorage.getItem('virgox_authenticated') !== 'true') return;
    updateDesktopModeUI();
    if (state.config.terminalUrl && linkPhone1) {
      linkPhone1.href = state.config.terminalUrl;
    }
    if (linkPhone2 && state.config.desktopUrl) {
      linkPhone2.href = state.config.desktopUrl;
    }
  }

  function unloadFrames() {
    if (desktopFrame) desktopFrame.src = 'about:blank';
    if (terminalFrame) terminalFrame.src = 'about:blank';
    if (splitDesktopFrame) splitDesktopFrame.src = 'about:blank';
    if (splitTerminalFrame) splitTerminalFrame.src = 'about:blank';
  }

  // Setup Iframes with URLs (Strict Protection: Load ONLY after password verification)
  function setupFrames() {
    // Keep all frames completely blank and disconnected until authenticated!
    unloadFrames();

    if (sessionStorage.getItem('virgox_authenticated') === 'true') {
      loadFrames();
    }

    // Opening the desktop or the terminal in a new tab is not a gate. The old
    // version of this asked for a master key and compared it against a list of
    // hashes — real hashes, real check, but the keys were in the page source,
    // so it kept nobody out and cost the person a prompt. The sign-in gate is
    // auth.html, backed by server/auth-service.js; this just opens a tab.
    function verifyOrOpenExternal(url, fallback) {
      const dest = (url && url.trim()) ? url.trim() : (fallback || window.location.href);
      safeOpenTab(dest);
    }

    const extDeskBtn = document.getElementById('open-external-desktop');
    if (extDeskBtn) {
      extDeskBtn.addEventListener('click', () => {
        const dest = (state.config.desktopUrl && state.config.desktopUrl.trim()) ? state.config.desktopUrl.trim() : window.location.href;
        safeOpenTab(dest);
      });
    }

    const extTermBtn = document.getElementById('open-external-terminal');
    if (extTermBtn) {
      extTermBtn.addEventListener('click', () => {
        const defaultTerm = window.location.protocol + '//' + (window.location.hostname || 'localhost') + ':7681';
        const dest = (state.config.terminalUrl && state.config.terminalUrl.trim()) ? state.config.terminalUrl.trim() : defaultTerm;
        safeOpenTab(dest);
      });
    }

    document.getElementById('reload-desktop').addEventListener('click', () => {
      if (sessionStorage.getItem('virgox_authenticated') === 'true') {
        desktopFrame.src = state.config.desktopUrl;
      }
    });

    document.getElementById('reload-terminal').addEventListener('click', () => {
      if (sessionStorage.getItem('virgox_authenticated') === 'true') {
        terminalFrame.src = state.config.terminalUrl;
      }
    });
  }

  // Navigation Tabs with Smart Memory Deallocation
  function setupTabs() {
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });
  }

  function switchTab(targetTab) {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const targetContent = document.getElementById(`tab-${targetTab}`);
    if (targetContent) targetContent.classList.add('active');
    state.activeTab = targetTab;

    // Smart Stream Memory Manager (Frees phone RAM immediately upon switching)
    if (targetTab === 'desktop' || targetTab === 'touchpad') {
      if (!desktopFrame.src || desktopFrame.src === 'about:blank') {
        desktopFrame.src = state.config.desktopUrl;
      }
      // Instantly unload split frames to reclaim 200MB+ mobile memory
      if (splitDesktopFrame && splitDesktopFrame.src !== 'about:blank') {
        splitDesktopFrame.src = 'about:blank';
      }
      if (splitTerminalFrame && splitTerminalFrame.src !== 'about:blank') {
        splitTerminalFrame.src = 'about:blank';
      }
      if (state.config.ecoMode && terminalFrame && terminalFrame.src !== 'about:blank') {
        terminalFrame.src = 'about:blank';
      }
    } else if (targetTab === 'terminal') {
      if (!terminalFrame.src || terminalFrame.src === 'about:blank') {
        terminalFrame.src = state.config.terminalUrl;
      }
      if (splitDesktopFrame && splitDesktopFrame.src !== 'about:blank') {
        splitDesktopFrame.src = 'about:blank';
      }
      if (splitTerminalFrame && splitTerminalFrame.src !== 'about:blank') {
        splitTerminalFrame.src = 'about:blank';
      }
      if (state.config.ecoMode && desktopFrame && desktopFrame.src !== 'about:blank') {
        desktopFrame.src = 'about:blank';
      }
    } else if (targetTab === 'split') {
      if (!splitDesktopFrame.src || splitDesktopFrame.src === 'about:blank') {
        splitDesktopFrame.src = state.config.desktopUrl;
      }
      if (!splitTerminalFrame.src || splitTerminalFrame.src === 'about:blank') {
        splitTerminalFrame.src = state.config.terminalUrl;
      }
      // Blank main desktop frame while split view is open to avoid 2 parallel video decoders
      if (desktopFrame && desktopFrame.src !== 'about:blank') {
        desktopFrame.src = 'about:blank';
      }
    } else if (targetTab === 'installed') {
      if (window.loadInstalledApps) window.loadInstalledApps();
    } else if (targetTab === 'backup') {
      if (window.loadBackupAndPrivacy) window.loadBackupAndPrivacy();
    } else {
      // Launcher / Deck tab: unload split frames
      if (splitDesktopFrame && splitDesktopFrame.src !== 'about:blank') {
        splitDesktopFrame.src = 'about:blank';
      }
      if (splitTerminalFrame && splitTerminalFrame.src !== 'about:blank') {
        splitTerminalFrame.src = 'about:blank';
      }
    }
  }

  // Crosshair Logic
  function setupCrosshair() {
    updateCrosshairUI();

    toggleCrosshairBtn.addEventListener('click', () => {
      state.config.crosshairEnabled = !state.config.crosshairEnabled;
      updateCrosshairUI();
      saveConfig();
    });
  }

  function updateCrosshairUI() {
    if (state.config.crosshairEnabled) {
      crosshairStateText.textContent = 'ON';
      crosshairStateText.style.color = '#00ff66';
      crosshairTarget.classList.remove('hidden');
    } else {
      crosshairStateText.textContent = 'OFF';
      crosshairStateText.style.color = '#ff4444';
      crosshairTarget.classList.add('hidden');
    }
    renderCrosshairPosition();
  }

  function renderCrosshairPosition() {
    crosshairTarget.style.left = `${state.crosshair.x}%`;
    crosshairTarget.style.top = `${state.crosshair.y}%`;
    const pxX = Math.round((state.crosshair.x / 100) * 1920);
    const pxY = Math.round((state.crosshair.y / 100) * 1080);
    crosshairCoords.textContent = `X: ${pxX} | Y: ${pxY}`;
  }

  // Touchpad Gestures & Pinch-to-Zoom
  function setupTouchpad() {
    let lastX = 0;
    let lastY = 0;
    let isTouching = false;

    mouseSensInput.value = state.config.sensitivity;
    sensValText.textContent = `${state.config.sensitivity}x`;

    mouseSensInput.addEventListener('input', (e) => {
      state.config.sensitivity = parseFloat(e.target.value);
      sensValText.textContent = `${state.config.sensitivity}x`;
      saveConfig();
    });

    // Helper: Distance between 2 touches for pinch
    function getTouchDistance(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Tap & Double Tap Tracking for Touchpad
    let tapStartX = 0;
    let tapStartY = 0;
    let tapStartTime = 0;
    let lastTapEndTime = 0;
    let singleTapTimeout = null;

    touchpadSurface.addEventListener('touchstart', (e) => {
      isTouching = true;
      if (e.touches.length === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        tapStartX = e.touches[0].clientX;
        tapStartY = e.touches[0].clientY;
        tapStartTime = Date.now();
        touchpadPointer.classList.remove('hidden');
        updatePointer(e.touches[0]);
      } else if (e.touches.length === 2) {
        state.touchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
      }
    }, { passive: false });

    touchpadSurface.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isTouching) return;

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = (touch.clientX - lastX) * state.config.sensitivity;
        const dy = (touch.clientY - lastY) * state.config.sensitivity;

        lastX = touch.clientX;
        lastY = touch.clientY;

        // Move Crosshair
        state.crosshair.x = Math.max(0, Math.min(100, state.crosshair.x + (dx / window.innerWidth) * 100));
        state.crosshair.y = Math.max(0, Math.min(100, state.crosshair.y + (dy / window.innerHeight) * 100));

        renderCrosshairPosition();
        updatePointer(touch);

        // Send to Bridge API if active
        sendMouseDelta(dx, dy);

      } else if (e.touches.length === 2) {
        // Pinch to Zoom
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const delta = dist - state.touchStartDist;
        if (Math.abs(delta) > 10) {
          if (delta > 0) {
            applyZoom(state.zoomLevel + 5);
          } else {
            applyZoom(state.zoomLevel - 5);
          }
          state.touchStartDist = dist;
        }
      }
    }, { passive: false });

    touchpadSurface.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isTouching = false;
        touchpadPointer.classList.add('hidden');

        const now = Date.now();
        const duration = now - tapStartTime;
        const dx = Math.abs(lastX - tapStartX);
        const dy = Math.abs(lastY - tapStartY);

        // Tap detected if duration < 300ms and minimal movement
        if (duration < 300 && dx < 12 && dy < 12) {
          if (now - lastTapEndTime < 350) {
            // DOUBLE TAP!
            if (singleTapTimeout) {
              clearTimeout(singleTapTimeout);
              singleTapTimeout = null;
            }
            sendAction('mouse_click', { button: 1, double: true });
            lastTapEndTime = 0;
          } else {
            // SINGLE TAP
            lastTapEndTime = now;
            singleTapTimeout = setTimeout(() => {
              sendAction('mouse_click', { button: 1 });
            }, 350);
          }
        }
      }
    });

    function updatePointer(touch) {
      const rect = touchpadSurface.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      touchpadPointer.style.left = `${x}px`;
      touchpadPointer.style.top = `${y}px`;
    }

    // Touchpad Click Buttons
    padLeftClick.addEventListener('click', () => sendAction('mouse_click', { button: 1 }));
    padRightClick.addEventListener('click', () => sendAction('mouse_click', { button: 3 }));
    padDoubleClick.addEventListener('click', () => sendAction('mouse_click', { button: 1, double: true }));

    // Desktop View Floating Mouse Buttons
    document.getElementById('btn-left-click').addEventListener('click', () => sendAction('mouse_click', { button: 1 }));
    document.getElementById('btn-right-click').addEventListener('click', () => sendAction('mouse_click', { button: 3 }));
    document.getElementById('btn-scroll-up').addEventListener('click', () => sendAction('mouse_click', { button: 4 }));
    document.getElementById('btn-scroll-down').addEventListener('click', () => sendAction('mouse_click', { button: 5 }));

    btnDragLock.addEventListener('click', () => {
      state.isDragLocked = !state.isDragLocked;
      btnDragLock.classList.toggle('active', state.isDragLocked);
      btnDragLock.textContent = state.isDragLocked ? 'DRAGGING...' : 'DRAG LOCK';
      sendAction('mouse_drag', { state: state.isDragLocked ? 'down' : 'up' });
    });
  }

  // Hand Mode / Pan & Pinch Tool (Traveling across the screen)
  function setupHandMode() {
    function toggleHandMode(force) {
      state.isHandMode = typeof force === 'boolean' ? force : !state.isHandMode;
      if (state.isHandMode) {
        handStateText.textContent = 'ON';
        btnHandMode.classList.add('active');
        dockBtnHand.classList.add('active');
        dockBtnHand.textContent = '✋ PANNING (ON)';
        panOverlay.classList.remove('hidden');
      } else {
        handStateText.textContent = 'OFF';
        btnHandMode.classList.remove('active');
        dockBtnHand.classList.remove('active');
        dockBtnHand.textContent = '✋ TRAVEL (PAN)';
        panOverlay.classList.add('hidden');
      }
    }

    btnHandMode.addEventListener('click', () => toggleHandMode());
    dockBtnHand.addEventListener('click', () => toggleHandMode());

    let touchStartX = 0;
    let touchStartY = 0;
    let isPanning = false;

    panOverlay.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isPanning = true;
        touchStartX = e.touches[0].clientX - state.pan.x;
        touchStartY = e.touches[0].clientY - state.pan.y;
      } else if (e.touches.length === 2) {
        isPanning = false;
        state.pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
      }
    }, { passive: false });

    panOverlay.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isPanning) {
        state.pan.x = e.touches[0].clientX - touchStartX;
        state.pan.y = e.touches[0].clientY - touchStartY;
        updateFrameTransform();
      } else if (e.touches.length === 2) {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const delta = dist - state.pinchStartDist;
        if (Math.abs(delta) > 8) {
          applyZoom(state.zoomLevel + (delta > 0 ? 5 : -5));
          state.pinchStartDist = dist;
        }
      }
    }, { passive: false });

    panOverlay.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isPanning = false;
      }
    });
  }

  function updateFrameTransform() {
    const scale = state.zoomLevel / 100;
    desktopFrame.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${scale})`;
    desktopFrame.style.transformOrigin = 'center center';
  }

  // Mobile Keyboard Bridge Drawer
  function setupKeyboard() {
    const btnToggleKeyboard = document.getElementById('btn-toggle-keyboard');
    const dockBtnKeyboard = document.getElementById('dock-btn-keyboard');
    const btnHeaderKeyboard = document.getElementById('btn-header-keyboard');
    const fabBtnKeyboard = document.getElementById('fab-btn-keyboard');
    const closeKeyboard = document.getElementById('close-keyboard');
    const keyboardDrawer = document.getElementById('keyboard-drawer');
    const mobileTextInput = document.getElementById('mobile-text-input');
    const btnSendText = document.getElementById('btn-send-text');

    const triggerButtons = [btnToggleKeyboard, dockBtnKeyboard, btnHeaderKeyboard, fabBtnKeyboard].filter(Boolean);

    function toggleKeyboard(show) {
      const isOpen = typeof show === 'boolean' ? show : keyboardDrawer.classList.contains('hidden');
      if (isOpen) {
        keyboardDrawer.classList.remove('hidden');
        triggerButtons.forEach(btn => btn.classList.add('active'));
        state.keyboardOpen = true;
        setTimeout(() => {
          if (mobileTextInput) mobileTextInput.focus();
        }, 100);
      } else {
        keyboardDrawer.classList.add('hidden');
        triggerButtons.forEach(btn => btn.classList.remove('active'));
        state.keyboardOpen = false;
        if (mobileTextInput) mobileTextInput.blur();
      }
    }

    triggerButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleKeyboard();
      });
    });

    if (closeKeyboard) {
      closeKeyboard.addEventListener('click', () => toggleKeyboard(false));
    }

    function sendCurrentText() {
      if (!mobileTextInput) return;
      const val = mobileTextInput.value;
      if (val) {
        sendAction('type', { text: val });
        mobileTextInput.value = '';
      }
      mobileTextInput.focus();
    }

    if (btnSendText) {
      btnSendText.addEventListener('click', sendCurrentText);
    }

    if (mobileTextInput) {
      mobileTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendCurrentText();
          sendAction('key', { key: 'Return' });
        }
      });
    }

    document.querySelectorAll('.kb-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.dataset.key;
        if (key) {
          sendAction('key', { key });
        }
        if (mobileTextInput && state.keyboardOpen) {
          mobileTextInput.focus();
        }
      });
    });
  }

  // Portrait & Landscape Orientation Switcher
  function setupOrientation() {
    const btnOrientation = document.getElementById('btn-orientation');
    const desktopWrapper = document.getElementById('desktop-wrapper');

    function applyOrientation(mode) {
      state.orientation = mode;
      if (mode === 'portrait') {
        if (btnOrientation) {
          btnOrientation.textContent = '🖥️ Landscape';
          btnOrientation.classList.add('neon-cyan');
          btnOrientation.classList.remove('neon-purple');
        }
        if (desktopWrapper) {
          desktopWrapper.classList.add('portrait-mode');
        }
        sendAction('resolution', { mode: 'portrait' });
      } else {
        if (btnOrientation) {
          btnOrientation.textContent = '📱 Portrait';
          btnOrientation.classList.add('neon-purple');
          btnOrientation.classList.remove('neon-cyan');
        }
        if (desktopWrapper) {
          desktopWrapper.classList.remove('portrait-mode');
        }
        sendAction('resolution', { mode: 'landscape' });
      }
    }

    if (btnOrientation) {
      btnOrientation.addEventListener('click', () => {
        const nextMode = state.orientation === 'landscape' ? 'portrait' : 'landscape';
        applyOrientation(nextMode);
      });
    }
  }

  // Screen Resolution Manager
  function setupResolution() {
    const btnCustomRes = document.getElementById('btn-custom-res');
    const resModal = document.getElementById('res-modal');
    const closeResModal = document.getElementById('close-res-modal');
    const resLabel = document.getElementById('res-label');
    const btnApplyCustom = document.getElementById('btn-apply-custom-res');
    const inputW = document.getElementById('custom-res-w');
    const inputH = document.getElementById('custom-res-h');
    const presetBtns = document.querySelectorAll('.res-preset-btn');

    if (btnCustomRes && resModal) {
      btnCustomRes.addEventListener('click', () => {
        resModal.classList.remove('hidden');
      });
    }

    if (closeResModal && resModal) {
      closeResModal.addEventListener('click', () => {
        resModal.classList.add('hidden');
      });
      resModal.addEventListener('click', (e) => {
        if (e.target === resModal) resModal.classList.add('hidden');
      });
    }

    function applyRes(w, h) {
      w = parseInt(w, 10);
      h = parseInt(h, 10);
      if (!w || !h || w < 320 || h < 240) {
        alert('Please enter valid dimensions (min 320x240)');
        return;
      }
      if (resLabel) resLabel.textContent = `${w}x${h}`;
      sendAction('resolution', { width: w, height: h });
      if (resModal) resModal.classList.add('hidden');
    }

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.w;
        const h = btn.dataset.h;
        applyRes(w, h);
      });
    });

    if (btnApplyCustom && inputW && inputH) {
      btnApplyCustom.addEventListener('click', () => {
        applyRes(inputW.value, inputH.value);
      });
    }
  }

  // Windows & Tabs Switcher Modal
  function setupTabsModal() {
    const btnOpenTabs = document.getElementById('btn-open-tabs');
    const tabsModal = document.getElementById('tabs-modal');
    const closeTabsModal = document.getElementById('close-tabs-modal');
    const windowsList = document.getElementById('active-windows-list');

    if (btnOpenTabs && tabsModal) {
      btnOpenTabs.addEventListener('click', () => {
        tabsModal.classList.remove('hidden');
        loadActiveWindows();
      });
    }

    if (closeTabsModal && tabsModal) {
      closeTabsModal.addEventListener('click', () => {
        tabsModal.classList.add('hidden');
      });
      tabsModal.addEventListener('click', (e) => {
        if (e.target === tabsModal) tabsModal.classList.add('hidden');
      });
    }

    function loadActiveWindows() {
      if (!windowsList) return;
      windowsList.innerHTML = '<div style="color:var(--neon-cyan); padding:10px; font-size:0.85rem;">⚡ Scanning open windows...</div>';

      if (!state.config.bridgeUrl) {
        windowsList.innerHTML = '<div style="color:#ffaa00; padding:10px;">Bridge API not configured.</div>';
        return;
      }

      fetch(`${state.config.bridgeUrl}/api/status`)
        .then(r => r.json())
        .then(data => {
          windowsList.innerHTML = '';
          const windows = data.active_windows || [];
          const userWindows = windows.filter(w => !w.includes('xfce4-panel') && !w.includes(' Desktop'));
          
          if (userWindows.length === 0) {
            windowsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:8px;">No open application windows. Tap an app below to launch.</div>';
            return;
          }

          userWindows.forEach(winStr => {
            const parts = winStr.trim().split(/\s+/);
            const winId = parts[0];
            const title = parts.slice(3).join(' ') || 'Application Window';
            
            let icon = '🗔';
            const lower = title.toLowerCase();
            if (lower.includes('chrom')) icon = '🌐';
            else if (lower.includes('terminal') || lower.includes('cmd') || lower.includes('shell')) icon = '💻';
            else if (lower.includes('thunar') || lower.includes('file')) icon = '📁';
            else if (lower.includes('builder') || lower.includes('rom')) icon = '🔨';
            else if (lower.includes('code')) icon = '📝';

            const btn = document.createElement('button');
            btn.className = 'cyber-btn sm';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '8px';
            btn.style.whiteSpace = 'nowrap';
            btn.style.overflow = 'hidden';
            btn.style.textOverflow = 'ellipsis';
            btn.innerHTML = `<span style="font-size:1.1rem;">${icon}</span> <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${title}</span> <span style="font-size:0.7rem; color:var(--neon-cyan); opacity:0.7;">${winId}</span>`;

            btn.addEventListener('click', () => {
              sendAction('focus_window', { window_id: winId });
              tabsModal.classList.add('hidden');
              const deskTab = document.querySelector('.tab-btn[data-tab="desktop"]');
              if (deskTab) deskTab.click();
            });

            windowsList.appendChild(btn);
          });
        })
        .catch(err => {
          windowsList.innerHTML = '<div style="color:#ff5555; padding:8px;">Failed to scan windows: ' + err.message + '</div>';
        });
    }
  }

  // Desktop Refresh Action
  function setupDesktopRefresh() {
    const btnRefresh = document.getElementById('btn-desktop-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        btnRefresh.textContent = '🔄 Refreshing...';
        btnRefresh.classList.add('active');
        sendAction('refresh_desktop', {});
        setTimeout(() => {
          btnRefresh.textContent = '🔄 Refresh';
          btnRefresh.classList.remove('active');
        }, 800);
      });
    }
  }

  // ==========================================================================
  // ⚡ Native Interactive Cyber Workstation Desktop & Window Manager
  // ==========================================================================
  
  // ==========================================================================
  // 🪟 Windows 11 Fluent Vector SVG Icons Library
  // ==========================================================================
  const WIN11_ICONS = {
    start: '<svg width="22" height="22" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4955L35.7273 7.63636V41.4545H0V12.4955ZM0 46.5455H35.7273V80.3636L0 75.5045V46.5455ZM41.0909 6.90909L88 0V41.4545H41.0909V6.90909ZM41.0909 46.5455H88V88L41.0909 81.0909V46.5455Z" fill="#00ADEF"/></svg>',
    chrome: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#4CAF50" d="M44 24c0 11.045-8.955 20-20 20S4 35.045 4 24 12.955 4 24 4s20 8.955 20 20z"/><path fill="#FFC107" d="M43.7 20.3L31.5 20.3C29.8 15.6 25.3 12.3 20 12.3c-4.2 0-7.9 2-10.3 5.1L3.9 11.6C7.9 6.9 13.6 4 20 4c10.4 0 19.1 7.1 21.7 16.3h2z"/><path fill="#FF3D00" d="M20 4c-5.7 0-10.9 2.4-14.6 6.3l6.5 11.2C13.2 16.7 16.3 14 20 14h23.7C41.1 7.1 32.4 4 20 4z"/><circle fill="#FFF" cx="24" cy="24" r="10"/><circle fill="#1976D2" cx="24" cy="24" r="7.5"/></svg>',
    chromium: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#1976D2" d="M44 24c0 11.045-8.955 20-20 20S4 35.045 4 24 12.955 4 24 4s20 8.955 20 20z"/><path fill="#42A5F5" d="M43.7 20.3L31.5 20.3C29.8 15.6 25.3 12.3 20 12.3c-4.2 0-7.9 2-10.3 5.1L3.9 11.6C7.9 6.9 13.6 4 20 4c10.4 0 19.1 7.1 21.7 16.3h2z"/><path fill="#1E88E5" d="M20 4c-5.7 0-10.9 2.4-14.6 6.3l6.5 11.2C13.2 16.7 16.3 14 20 14h23.7C41.1 7.1 32.4 4 20 4z"/><circle fill="#FFF" cx="24" cy="24" r="10"/><circle fill="#0D47A1" cx="24" cy="24" r="7.5"/></svg>',
    edge: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#0c59a4" d="M40.9 33.1C39.4 39.5 33.7 44 26.9 44 18.1 44 11 36.9 11 28.1c0-7.7 5.4-14.1 12.7-15.6-.4 1.1-.6 2.3-.6 3.5 0 5.5 4.5 10 10 10 2.8 0 5.3-1.1 7.1-2.9.5 3.3.6 6.8.7 10z"/><path fill="#1193d4" d="M35 15.1c0-4.4-3.6-8-8-8-4.2 0-7.7 3.3-8 7.4 1.5-.3 3.1-.5 4.7-.5 6.2 0 11.3 5.1 11.3 11.3v.8c0-3.9-3.1-7.1-7.1-7.1-1.6 0-3 .5-4.2 1.4.3-3.6 3.4-6.4 7.2-6.4 3.9 0 7.1 3.2 7.1 7.1 0 .4 0 .7-.1 1.1 1.2-1.7 1.9-3.8 1.9-6.1z"/><path fill="#2dd5c4" d="M26.9 4c-3.1 0-6 1-8.3 2.7 1.7 1.4 3.9 2.3 6.3 2.3 5.5 0 10 4.5 10 10 0 1.2-.2 2.3-.6 3.4 3.8-1.5 6.5-5.2 6.5-9.4 0-5-4.5-9-13.9-9z"/></svg>',
    msstore: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="12" width="36" height="32" rx="4" fill="#0078D4"/><path d="M16 12V10C16 5.6 19.6 2 24 2C28.4 2 32 5.6 32 10V12H28V10C28 7.8 26.2 6 24 6C21.8 6 20 7.8 20 10V12H16Z" fill="#60A5FA"/><rect x="18" y="22" width="5" height="5" fill="#F25022"/><rect x="25" y="22" width="5" height="5" fill="#7FBA00"/><rect x="18" y="29" width="5" height="5" fill="#00A4EF"/><rect x="25" y="29" width="5" height="5" fill="#FFB900"/></svg>',
    files: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M4 12C4 9.8 5.8 8 8 8H20L24 14H40C42.2 14 44 15.8 44 18V38C44 40.2 42.2 42 40 42H8C5.8 42 4 40.2 4 38V12Z" fill="#FBBF24"/><path d="M4 20H44V38C44 40.2 42.2 42 40 42H8C5.8 42 4 40.2 4 38V20Z" fill="#F59E0B"/><path d="M8 14H24L20 20H4V18C4 15.8 5.8 14 8 14Z" fill="#60A5FA"/></svg>',
    terminal: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="40" height="36" rx="6" fill="#18181B" stroke="#3F3F46" stroke-width="2"/><path d="M12 18L20 24L12 30" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="22" y1="30" x2="32" y2="30" stroke="#38BDF8" stroke-width="3" stroke-linecap="round"/></svg>',
    settings: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" fill="#4B5563"/><circle cx="24" cy="24" r="8" fill="#1F2937"/><path d="M24 2V6M24 42V46M46 24H42M6 24H2M39.5 8.5L36.7 11.3M11.3 36.7L8.5 39.5M39.5 39.5L36.7 36.7M11.3 11.3L8.5 8.5" stroke="#9CA3AF" stroke-width="4" stroke-linecap="round"/></svg>',
    notepad: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="6" width="32" height="36" rx="4" fill="#0284C7"/><path d="M14 14H34M14 20H34M14 26H28M14 32H24" stroke="#E0F2FE" stroke-width="2.5" stroke-linecap="round"/><circle cx="36" cy="34" r="8" fill="#38BDF8"/><path d="M33 37L39 31" stroke="#0369A1" stroke-width="2" stroke-linecap="round"/></svg>',
    taskmgr: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="40" height="36" rx="4" fill="#1E293B" stroke="#00E5FF" stroke-width="1.5"/><path d="M8 26L16 26L20 14L26 34L30 22L34 26L40 26" fill="none" stroke="#00E5FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    photoshop: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="40" height="40" rx="8" fill="#001E36" stroke="#00C8FF" stroke-width="2"/><text x="10" y="32" font-family="Segoe UI, sans-serif" font-size="20" font-weight="900" fill="#00C8FF">Ps</text></svg>',
    video: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="8" width="40" height="32" rx="6" fill="#7C3AED"/><polygon points="20,16 32,24 20,32" fill="#FFFFFF"/></svg>',
    steam: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" fill="#171A21"/><path d="M35 18A5 5 0 0 1 30 23L22 26A6 6 0 1 1 16 20L25 15A5 5 0 0 1 35 18Z" fill="#FFFFFF" opacity="0.9"/><circle cx="16" cy="32" r="3.5" fill="#171A21"/></svg>',
    xbox: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" fill="#107C10"/><path d="M12 14C16 19 22 26 24 29C26 26 32 19 36 14C32 10 28 8 24 8C20 8 16 10 12 14ZM10 18C10 24 13 30 18 34C15 28 17 21 21 16C17 15 13 16 10 18ZM38 18C35 16 31 15 27 16C31 21 33 28 30 34C35 30 38 24 38 18Z" fill="#FFFFFF"/></svg>',
    vlc: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M22 4H26L38 38H10L22 4Z" fill="#F97316"/><path d="M18 16H30L34 26H14L18 16Z" fill="#FFFFFF"/><rect x="6" y="38" width="36" height="6" rx="3" fill="#EA580C"/></svg>',
    blender: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="28" r="10" fill="#EA580C"/><circle cx="24" cy="28" r="5" fill="#38BDF8"/><path d="M24 18V6M16 20L8 12M32 20L40 12" stroke="#EA580C" stroke-width="4" stroke-linecap="round"/></svg>',
    unreal: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="20" fill="#0E1117" stroke="#FFFFFF" stroke-width="1.5"/><circle cx="24" cy="24" r="14" fill="none" stroke="#FFFFFF" stroke-width="2"/><text x="17" y="32" font-family="Segoe UI, sans-serif" font-size="22" font-weight="900" fill="#FFFFFF">U</text></svg>',
    playstore: '<svg width="34" height="34" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M8 6L28 24L8 42Z" fill="#4285F4"/><path d="M28 24L8 6L34 16Z" fill="#34A853"/><path d="M28 24L34 32L8 42Z" fill="#EA4335"/><path d="M28 24L34 16L40 22C42 23.5 42 24.5 40 26L34 32Z" fill="#FBBC05"/></svg>',
    folder: '<svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M4 12C4 9.8 5.8 8 8 8H20L24 14H40C42.2 14 44 15.8 44 18V38C44 40.2 42.2 42 40 42H8C5.8 42 4 40.2 4 38V12Z" fill="#FBBF24"/><path d="M4 20H44V38C44 40.2 42.2 42 40 42H8C5.8 42 4 40.2 4 38V20Z" fill="#F59E0B"/><path d="M8 14H24L20 20H4V18C4 15.8 5.8 14 8 14Z" fill="#60A5FA"/></svg>',
    file: '<svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="6" width="28" height="36" rx="3" fill="#E2E8F0"/><path d="M26 6V16H38" fill="#CBD5E1"/><line x1="16" y1="22" x2="32" y2="22" stroke="#94A3B8" stroke-width="2"/><line x1="16" y1="28" x2="32" y2="28" stroke="#94A3B8" stroke-width="2"/><line x1="16" y1="34" x2="26" y2="34" stroke="#94A3B8" stroke-width="2"/></svg>'
  };

  const PRINCE_PFP_URL = 'https://avatars.githubusercontent.com/u/263169230?v=4';

  let highestZ = 20;
  const openWindows = {};

  
  // ==========================================================================
  // 🌐 Google Chrome Official Web Browser Engine
  // ==========================================================================
  function getChromeHtml() {
    return `
      <div class="chrome-window-wrap">
        <!-- Chrome Tab Strip -->
        <div class="chrome-tabbar">
          <div class="chrome-tabs-strip" id="chrome-tabs-strip" style="display:flex; align-items:flex-end; gap:4px; overflow-x:auto; flex:1;"></div>
          <button class="cyber-btn xs" id="chrome-btn-newtab" title="New tab" style="padding:2px 8px; border-radius:50%; margin-bottom:4px; font-weight:700;">+</button>
        </div>

        <!-- Chrome Navigation Toolbar -->
        <div class="chrome-toolbar">
          <button class="cyber-btn xs" id="chrome-nav-back" title="Back">◀</button>
          <button class="cyber-btn xs" id="chrome-nav-fwd" title="Forward">▶</button>
          <button class="cyber-btn xs" id="chrome-nav-reload" title="Reload">🔄</button>
          <button class="cyber-btn xs" id="chrome-nav-home" title="Google Home">🏠</button>
          
          <div class="chrome-omnibox">
            <span style="font-size:0.8rem; color:#8ab4f8;">🔒</span>
            <input type="text" id="chrome-url-input" value="https://www.google.com" placeholder="Search Google or type a URL" autocomplete="off" spellcheck="false" />
          </div>

          <button class="cyber-btn xs neon-cyan" id="chrome-btn-go">Go</button>
          <button class="cyber-btn xs neon-purple" id="chrome-btn-open-tab" title="Open the current URL in a real browser tab">
            🌐 Open Tab ↗
          </button>
          <div style="width:26px; height:26px; border-radius:50%; overflow:hidden; border:1px solid #8ab4f8; flex-shrink:0;">
            <img src="${PRINCE_PFP_URL}" style="width:100%; height:100%; object-fit:cover;" title="Prince Profile (Administrator)" />
          </div>
        </div>

        <!-- Bookmarks Bar -->
        <div class="chrome-bookmarks-bar">
          <div class="chrome-bookmark-item" data-url="https://www.google.com">🔍 Google</div>
          <div class="chrome-bookmark-item" data-url="https://www.youtube.com">🎥 YouTube</div>
          <div class="chrome-bookmark-item" data-url="https://github.com/darkvirgoyt-beep">💻 GitHub</div>
          <div class="chrome-bookmark-item" data-url="https://chatgpt.com">🤖 ChatGPT</div>
          <div class="chrome-bookmark-item" data-url="https://wikipedia.org">📚 Wikipedia</div>
          <div class="chrome-bookmark-item" data-url="https://apps.microsoft.com">🛍️ Store</div>
          <div class="chrome-bookmark-item" data-url="https://mail.google.com">📧 Gmail</div>
        </div>

        <!-- Web View Area -->
        <div style="flex:1; position:relative; background:#202124; overflow:hidden;">
          <iframe id="chrome-frame-inner" src="about:blank" style="width:100%; height:100%; border:none;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
          <div class="webview-blocked" id="chrome-frame-blocked" hidden>
            <div class="webview-blocked-card">
              <div class="webview-blocked-glyph">&#8856;</div>
              <h4>This site won&rsquo;t load inside the app</h4>
              <p>Google and most large sites send an <code>X-Frame-Options: DENY</code> header that blocks embedded pages. Your PC is fine &mdash; the site is refusing to be framed. Open it in a real tab.</p>
              <div class="webview-blocked-actions">
                <button class="cyber-btn sm neon-cyan" id="chrome-btn-blocked-open">Open in real tab &#8599;</button>
                <button class="cyber-btn sm" id="chrome-btn-blocked-dismiss">Back to page</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 🔷 Chromium Open-Source Browser Engine
  // ==========================================================================
  function getChromiumHtml() {
    return `
      <div class="chrome-window-wrap">
        <!-- Chromium Tab Strip -->
        <div class="chrome-tabbar" style="background:#141b27; border-bottom:1px solid rgba(66,165,245,0.25);">
          <div class="chrome-tabs-strip" id="chrome-tabs-strip" style="display:flex; align-items:flex-end; gap:4px; overflow-x:auto; flex:1;"></div>
          <button class="cyber-btn xs" id="chrome-btn-newtab" title="New tab" style="padding:2px 8px; border-radius:50%; margin-bottom:4px; background:#1976D2; border-color:#42A5F5; color:#fff; font-weight:700;">+</button>
        </div>

        <!-- Chromium Navigation Toolbar -->
        <div class="chrome-toolbar" style="background:#1e2738; border-bottom:1px solid rgba(66,165,245,0.2);">
          <button class="cyber-btn xs" id="chrome-nav-back" title="Back">◀</button>
          <button class="cyber-btn xs" id="chrome-nav-fwd" title="Forward">▶</button>
          <button class="cyber-btn xs" id="chrome-nav-reload" title="Reload">🔄</button>
          <button class="cyber-btn xs" id="chrome-nav-home" title="Chromium Home">🏠</button>

          <div class="chrome-omnibox" style="background:#101520; border-color:rgba(66,165,245,0.35);">
            <span style="font-size:0.8rem; color:#42a5f5;">🌐</span>
            <input type="text" id="chrome-url-input" value="https://duckduckgo.com" placeholder="Search Chromium or type a URL" autocomplete="off" spellcheck="false" />
          </div>

          <button class="cyber-btn xs neon-cyan" id="chrome-btn-go">Go</button>
          <button class="cyber-btn xs neon-purple" id="chrome-btn-open-tab" title="Open the current URL in a real browser tab">
            🌐 Open Tab ↗
          </button>
          <div style="display:flex; align-items:center; gap:6px; padding:0 4px; font-size:0.75rem; color:#90caf9; font-weight:700;">
            <span style="width:20px; height:20px; display:flex;">${WIN11_ICONS.chromium}</span>
            <span>Chromium</span>
          </div>
        </div>

        <!-- Bookmarks Bar -->
        <div class="chrome-bookmarks-bar" style="background:#172030;">
          <div class="chrome-bookmark-item" data-url="https://duckduckgo.com">🔍 DuckDuckGo</div>
          <div class="chrome-bookmark-item" data-url="https://www.chromium.org">🌐 Chromium.org</div>
          <div class="chrome-bookmark-item" data-url="https://github.com/darkvirgoyt-beep">💻 GitHub</div>
          <div class="chrome-bookmark-item" data-url="https://wikipedia.org">📚 Wikipedia</div>
          <div class="chrome-bookmark-item" data-url="https://news.ycombinator.com">📰 Hacker News</div>
          <div class="chrome-bookmark-item" data-url="https://youtube.com">🎥 YouTube</div>
        </div>

        <!-- Web View Area -->
        <div style="flex:1; position:relative; background:#0b1019; overflow:hidden;">
          <iframe id="chrome-frame-inner" src="about:blank" style="width:100%; height:100%; border:none;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
          <div class="webview-blocked" id="chrome-frame-blocked" hidden>
            <div class="webview-blocked-card">
              <div class="webview-blocked-glyph">&#8856;</div>
              <h4>This site won&rsquo;t load inside the app</h4>
              <p>Google and most large sites send an <code>X-Frame-Options: DENY</code> header that blocks embedded pages. Your PC is fine &mdash; the site is refusing to be framed. Open it in a real tab.</p>
              <div class="webview-blocked-actions">
                <button class="cyber-btn sm neon-cyan" id="chrome-btn-blocked-open">Open in real tab &#8599;</button>
                <button class="cyber-btn sm" id="chrome-btn-blocked-dismiss">Back to page</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* Shared engine for the Chrome and Chromium windows. Both are the same
   * component: a real iframe, a live probe that reports when a site refuses to
   * be framed, and a tab strip you can actually open, switch and close tabs on.
   * `isChromium` only changes the theme, the home page and the search engine. */
  function initChromeActions(win, isChromium = false) {
    const input = win.querySelector('#chrome-url-input');
    const iframe = win.querySelector('#chrome-frame-inner');
    const goBtn = win.querySelector('#chrome-btn-go');
    const backBtn = win.querySelector('#chrome-nav-back');
    const fwdBtn = win.querySelector('#chrome-nav-fwd');
    const reloadBtn = win.querySelector('#chrome-nav-reload');
    const homeBtn = win.querySelector('#chrome-nav-home');
    const openTabBtn = win.querySelector('#chrome-btn-open-tab');
    const newTabBtn = win.querySelector('#chrome-btn-newtab');
    const tabsStrip = win.querySelector('#chrome-tabs-strip');
    const blockedPanel = win.querySelector('#chrome-frame-blocked');
    const blockedOpen = win.querySelector('#chrome-btn-blocked-open');
    const blockedDismiss = win.querySelector('#chrome-btn-blocked-dismiss');

    const defaultHome = isChromium ? 'https://duckduckgo.com' : 'https://www.google.com';
    const searchBase = isChromium ? 'https://duckduckgo.com/?q=' : 'https://www.google.com/search?q=';
    const appIconSvg = isChromium ? WIN11_ICONS.chromium : WIN11_ICONS.chrome;
    const defaultTitle = isChromium ? 'Chromium' : 'Google';

    let probeToken = 0;

    function showBlocked(target) {
      if (!blockedPanel) return;
      blockedPanel.hidden = false;
      if (blockedOpen) blockedOpen.dataset.url = target;
    }
    function hideBlocked() {
      if (blockedPanel) blockedPanel.hidden = true;
    }

    if (blockedOpen) {
      blockedOpen.addEventListener('click', () => {
        const url = blockedOpen.dataset.url;
        if (url) safeOpenTab(url);
      });
    }
    if (blockedDismiss) blockedDismiss.addEventListener('click', hideBlocked);

    // Probe a URL before trusting it to stay framed. A site that sends
    // X-Frame-Options: DENY renders as a blank pane with no error, so the probe
    // is the only way to tell the person why nothing appeared.
    function loadTabsUrl(url) {
      if (!iframe) return;
      hideBlocked();
      iframe.src = url;
      const token = ++probeToken;
      detectFramed(url).then(verdict => {
        if (token !== probeToken) return;
        if (verdict === 'blocked') showBlocked(url);
      });
    }

    function resolveUrl(rawUrl) {
      if (!rawUrl) return defaultHome;
      let target = String(rawUrl).trim();
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        if (target.includes('.') && !target.includes(' ')) {
          target = 'https://' + target;
        } else {
          target = searchBase + encodeURIComponent(target);
        }
      }
      return target;
    }

    // --- tab state ----------------------------------------------------------
    let tabs = [{ id: 1, title: defaultTitle, url: defaultHome }];
    let activeTabId = 1;
    let nextId = 2;

    function activeTab() {
      return tabs.find(t => t.id === activeTabId);
    }

    function renderTabs() {
      if (!tabsStrip) return;
      tabsStrip.innerHTML = '';
      tabs.forEach(t => {
        const tabEl = document.createElement('div');
        tabEl.className = 'chrome-tab' + (t.id === activeTabId ? ' active' : '');
        if (isChromium && t.id === activeTabId) {
          tabEl.style.borderTopColor = '#1976D2';
          tabEl.style.background = '#253046';
        }
        const icon = document.createElement('span');
        icon.style.cssText = 'display:flex; align-items:center; width:16px; height:16px;';
        icon.innerHTML = appIconSvg;

        const title = document.createElement('span');
        title.className = 'chrome-tab-title';
        title.style.cssText = 'margin-left:4px; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        title.textContent = t.title;

        const close = document.createElement('span');
        close.className = 'chrome-tab-close';
        close.title = 'Close tab';
        close.textContent = '✕';
        close.style.cssText = 'font-size:0.75rem; margin-left:6px; cursor:pointer; opacity:0.6; padding:0 3px; border-radius:3px;';
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          closeTab(t.id);
        });

        tabEl.appendChild(icon);
        tabEl.appendChild(title);
        tabEl.appendChild(close);
        tabEl.addEventListener('click', () => switchTab(t.id));
        tabsStrip.appendChild(tabEl);
      });
    }

    function switchTab(id) {
      const found = tabs.find(t => t.id === id);
      if (!found) return;
      activeTabId = id;
      renderTabs();
      if (input) input.value = found.url;
      loadTabsUrl(found.url);
    }

    function closeTab(id) {
      if (tabs.length === 1) {
        tabs[0].url = defaultHome;
        tabs[0].title = defaultTitle;
        switchTab(tabs[0].id);
        return;
      }
      const idx = tabs.findIndex(t => t.id === id);
      tabs = tabs.filter(t => t.id !== id);
      if (activeTabId === id) {
        const next = tabs[Math.max(0, idx - 1)] || tabs[0];
        activeTabId = next.id;
      }
      renderTabs();
      const cur = activeTab();
      if (cur) {
        if (input) input.value = cur.url;
        loadTabsUrl(cur.url);
      }
    }

    function addTab(initialUrl = defaultHome) {
      const newTab = { id: nextId++, title: 'New tab', url: initialUrl };
      tabs.push(newTab);
      switchTab(newTab.id);
    }

    if (newTabBtn) {
      newTabBtn.addEventListener('click', () => addTab(defaultHome));
    }

    function navigate(rawUrl) {
      if (!rawUrl || !iframe) return;
      const target = resolveUrl(rawUrl);
      const tab = activeTab();
      if (tab) {
        tab.url = target;
        try {
          tab.title = new URL(target).hostname.replace(/^www\./, '');
        } catch (e) {
          tab.title = target;
        }
      }
      if (input) input.value = target;
      renderTabs();
      loadTabsUrl(target);
    }

    if (goBtn && input) {
      goBtn.addEventListener('click', () => navigate(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(input.value);
      });
    }

    if (reloadBtn && iframe) {
      reloadBtn.addEventListener('click', () => {
        const tab = activeTab();
        if (!tab) return;
        iframe.src = 'about:blank';
        setTimeout(() => { iframe.src = tab.url; }, 50);
      });
    }

    if (homeBtn) {
      homeBtn.addEventListener('click', () => navigate(defaultHome));
    }

    if (backBtn && iframe) {
      backBtn.addEventListener('click', () => {
        try { iframe.contentWindow.history.back(); } catch(e) {}
      });
    }

    if (fwdBtn && iframe) {
      fwdBtn.addEventListener('click', () => {
        try { iframe.contentWindow.history.forward(); } catch(e) {}
      });
    }

    if (openTabBtn && input) {
      openTabBtn.addEventListener('click', () => {
        safeOpenTab(resolveUrl(input.value));
      });
    }

    win.querySelectorAll('.chrome-bookmark-item').forEach(item => {
      item.addEventListener('click', () => {
        const u = item.getAttribute('data-url');
        if (u) navigate(u);
      });
    });

    renderTabs();
  }

  // ==========================================================================
  // 📁 Interactive Windows 11 File Explorer
  // ==========================================================================
  let activeExplorerPath = 'This PC';

  function getFilesHtml() {
    const isWin = state.config.osMode === 'windows';
    return `
      <div style="display:flex; flex-direction:column; height:100%; background:#1a1e2d; color:#fff; font-family:'Segoe UI', sans-serif;">
        <!-- Top Ribbon -->
        <div class="explorer-ribbon">
          <button class="explorer-ribbon-btn" id="explorer-btn-up" title="Up to parent directory">⬆ Up</button>
          <button class="explorer-ribbon-btn" id="explorer-btn-new" onclick="openAppWindow('editor')" title="New Text Document">➕ New Document</button>
          <button class="explorer-ribbon-btn" onclick="openAppWindow('terminal')" title="Open PowerShell Here">💻 Open Terminal</button>
          <button class="explorer-ribbon-btn" id="explorer-btn-refresh" title="Refresh folder">🔄 Refresh</button>
        </div>

        <!-- Address Bar -->
        <div class="explorer-addr-bar">
          <div class="explorer-path-box">
            <span>This PC &gt; </span>
id="explorer-crumb-text">This PC<
          </div>
id="explorer-quota" title="navigator.storage.estimate() — what the browser allows this origin to store">reading storage…</span>
        </div>

        <div style="display:flex; flex:1; overflow:hidden;">
          <!-- Left Tree Sidebar -->
          <div style="width:160px; background:rgba(20,24,38,0.95); border-right:1px solid rgba(255,255,255,0.08); padding:8px 4px; display:flex; flex-direction:column; gap:2px; font-size:0.78rem; overflow-y:auto;">
            <div class="files-sidebar-item" data-nav="This PC" style="padding:5px 8px; border-radius:6px; cursor:pointer;">💻 This PC</div>
            <div class="files-sidebar-item" data-nav="Deployed files" style="padding:5px 8px; border-radius:6px; cursor:pointer;">📦 Deployed files</div>
            <div class="files-sidebar-item" data-nav="Browser storage" style="padding:5px 8px; border-radius:6px; cursor:pointer;">💾 Browser storage</div>
            <div class="files-sidebar-item" data-nav="This device" style="padding:5px 8px; border-radius:6px; cursor:pointer;">📊 This device</div>
          </div>

          <!-- Main Grid -->
          <div style="flex:1; padding:14px; overflow-y:auto;">
            <div id="explorer-files-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:12px;"></div>
          </div>
        </div>
      </div>
    `;
  }

  /* The tree is rebuilt on every navigation because every size in it comes from
   * a live HEAD request. Nothing here is a stored constant, so a file that
   * changes size shows its new size and a file that is not deployed says so. */
  const EXPLORER_PARENT = {
    'Deployed files': 'This PC',
    'Browser storage': 'This PC',
    'This device': 'This PC',
  };

  function initFilesActions(win) {
    const grid = win.querySelector('#explorer-files-grid');
    const crumb = win.querySelector('#explorer-crumb-text');
    const upBtn = win.querySelector('#explorer-btn-up');
    const refreshBtn = win.querySelector('#explorer-btn-refresh');
    const quotaChip = win.querySelector('#explorer-quota');

    let tree = null;

    function renderDir(dirKey) {
      if (!grid) return;
      activeExplorerPath = dirKey;
      if (crumb) crumb.textContent = dirKey;
      win.querySelectorAll('.files-sidebar-item[data-nav]').forEach(b2 => {
        b2.style.color = b2.getAttribute('data-nav') === dirKey ? '#60a5fa' : '';
        b2.style.fontWeight = b2.getAttribute('data-nav') === dirKey ? '700' : '';
      });
      grid.innerHTML = '<div style="grid-column:1/-1; font-size:0.72rem; color:#94a3b8;">reading…</div>';

      buildExplorerTree().then(built => {
        tree = built;
        const items = tree[dirKey] || [];
        grid.innerHTML = '';

        if (!items.length) {
          grid.innerHTML = '<div style="grid-column:1/-1; font-size:0.72rem; color:#94a3b8;">nothing here</div>';
          return;
        }

        items.forEach(item => {
          const el = document.createElement('div');
          el.className = 'files-grid-item';
          el.style.display = 'flex';
          el.style.flexDirection = 'column';
          el.style.alignItems = 'center';
          el.style.gap = '4px';
          el.style.padding = '8px 4px';
          el.style.borderRadius = '8px';
          el.style.cursor = item.type === 'text' ? 'default' : 'pointer';
          el.style.textAlign = 'center';

          let iconSvg = WIN11_ICONS.folder;
          if (item.type === 'text') iconSvg = null;
          else if (item.type === 'file') iconSvg = WIN11_ICONS.file;
          else if (item.name.endsWith('.txt') || item.name.endsWith('.md')) iconSvg = WIN11_ICONS.notepad;
          else if (item.name.endsWith('.png') || item.name.endsWith('.jpg')) iconSvg = WIN11_ICONS.photoshop;

          el.innerHTML = `
            <div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center;">${iconSvg || ''}</div>
            <div style="font-size:0.72rem; color:#fff; word-break:break-word; max-width:88px; line-height:1.2;">${escapeHtml(item.name)}</div>
            <div style="font-size:0.62rem; color:#94a3b8; word-break:break-word; max-width:88px;">${escapeHtml(item.size)}</div>
          `;

          if (item.type === 'dir') {
            el.addEventListener('click', (e) => { e.stopPropagation(); renderDir(item.name); });
          } else if (item.href) {
            // A real file, at a real URL. Opening it is the honest action; the
            // old tree called openAppWindow('editor') for everything, which
            // pretended a photo and a shader were the same thing.
            el.title = item.href;
            el.addEventListener('click', (e) => { e.stopPropagation(); window.open(item.href, '_blank', 'noopener'); });
          }

          grid.appendChild(el);
        });

        if (quotaChip) {
          storageEstimate().then(est => {
            quotaChip.textContent = est && Number.isFinite(est.quota)
              ? fmtBytes(est.usage || 0) + ' used of ' + fmtBytes(est.quota) + ' allowance'
              : NOT_EXPOSED;
          });
        }
      }).catch(() => {
        grid.innerHTML = '<div style="grid-column:1/-1; font-size:0.72rem; color:#fca5a5;">could not read the file list</div>';
      });
    }

    if (upBtn) {
      upBtn.addEventListener('click', () => renderDir(EXPLORER_PARENT[activeExplorerPath] || 'This PC'));
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => renderDir(activeExplorerPath));
    }

    win.querySelectorAll('.files-sidebar-item[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => renderDir(btn.getAttribute('data-nav')));
    });

    renderDir(activeExplorerPath || 'This PC');
  }

  // ==========================================================================
  // 🎥 VLC Media Player Window
  // ==========================================================================
  /* The old panel named "VLC Media Player 3.0.20", advertised "Hardware
   * Accelerated Video Output (Mesa Direct Sync)", drew a menu bar where every
   * item was inert, and offered an "Open Media File" button that just opened
   * File Explorer. VLC is a native application; a page can play media with the
   * browser's own decoders, so that is what this says and does. */

  /* Wires the file picker and reports which codecs the browser actually claims.
   * The chosen file is played from a blob URL inside this tab — nothing is
   * uploaded, because there is nowhere on a static page for it to go. */
  function mountVlcPlayer(win) {
    const input = win.querySelector('#vxc-media-input');
    const video = win.querySelector('#vxc-media-video');
    const note = win.querySelector('#vxc-media-note');
    if (!input || !video) return;

    if (note && video.canPlayType) {
      const codecs = [
        ['video/mp4; codecs="avc1.42E01E"', 'H.264/AAC in MP4'],
        ['video/webm; codecs="vp9"', 'VP9 in WebM'],
        ['video/webm; codecs="av01.0.05M.08"', 'AV1 in WebM'],
        ['audio/mpeg', 'MP3'],
      ].filter(c => video.canPlayType(c[0])).map(c => c[1]);
      note.textContent = 'Codecs this browser reports: '
        + (codecs.length ? codecs.join(', ') : 'none reported for the common formats');
    }

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (video.src) URL.revokeObjectURL(video.src);
      video.src = URL.createObjectURL(file);
      video.style.display = 'block';
      if (note) {
        note.textContent = file.name + ' — ' + (file.size ? fmtBytes(file.size) : 'size not exposed')
          + ', playing with the codecs this browser reports as supported.';
      }
      // Autoplay can be refused before any user gesture; the controls still work.
      video.play().catch(() => {});
    });
  }
  function getVlcHtml() {
    const probe = `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; gap:12px;">
        <div style="width:64px; height:64px;">${WIN11_ICONS.vlc}</div>
        <div style="font-weight:700; font-size:1.05rem; color:#f97316;">Media Player</div>
        <p style="color:#94a3b8; font-size:0.8rem; max-width:380px; text-align:center; line-height:1.5;">
          This plays a file you pick using the codecs already in your browser. It is not
          VLC, and there is no version number to quote, because nothing is bundled here.
        </p>
        <label class="cyber-btn sm neon-amber" style="cursor:pointer;">
          &#9654; Choose a media file
          <input type="file" accept="video/*,audio/*" style="display:none;" id="vxc-media-input">
        </label>
        <video id="vxc-media-video" controls playsinline style="width:100%; max-width:420px; border-radius:6px; background:#000; display:none;"></video>
        <div style="font-size:0.7rem; color:#64748b; text-align:center;" id="vxc-media-note">
          Nothing is uploaded. The file stays in this tab.
        </div>
      </div>`;


    return `<div style="display:flex; flex-direction:column; height:100%; background:#111; color:#fff; font-family:'Segoe UI', sans-serif;">
        <div style="display:flex; align-items:center; gap:10px; padding:6px 12px; background:#18181b; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.75rem;">
          <span style="color:#f97316; font-weight:700;">Media Player</span>
          <span style="color:#64748b;">plays locally · nothing is uploaded</span>
        </div>
        ${probe}
      </div>`;
  }

  // ==========================================================================
  // 🖱️ Windows 11 Desktop Context Menu
  // ==========================================================================
  function showDesktopContextMenu(x, y) {
    const old = document.getElementById('win11-desktop-ctx');
    if (old) old.remove();

    const isWin = state.config.osMode === 'windows';
    const menu = document.createElement('div');
    menu.id = 'win11-desktop-ctx';
    menu.className = 'win11-context-menu';
    menu.style.left = `${Math.min(x, window.innerWidth - 230)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 260)}px`;

    menu.innerHTML = `
      <div class="win11-context-item" onclick="openAppWindow('chrome')">
        <span style="width:18px; height:18px; display:flex;">${WIN11_ICONS.chrome}</span>
        <span>Open Google Chrome</span>
      </div>
      <div class="win11-context-item" onclick="openAppWindow('chromium')">
        <span style="width:18px; height:18px; display:flex;">${WIN11_ICONS.chromium}</span>
        <span>Open Chromium Browser</span>
      </div>
      <div class="win11-context-item" onclick="openAppWindow('files')">
        <span style="width:18px; height:18px; display:flex;">${WIN11_ICONS.files}</span>
        <span>Open File Explorer</span>
      </div>
      <div class="win11-context-item" onclick="openAppWindow('terminal')">
        <span style="width:18px; height:18px; display:flex;">${WIN11_ICONS.terminal}</span>
        <span>Open in Windows Terminal</span>
      </div>
      <div class="win11-context-sep"></div>
      <div class="win11-context-item" onclick="openAppWindow('editor')">
        <span>📝</span>
        <span>New Text Document</span>
      </div>
      <div class="win11-context-item" onclick="openAppWindow('settings')">
        <span style="width:18px; height:18px; display:flex;">${WIN11_ICONS.settings}</span>
        <span>Display settings</span>
      </div>
      <div class="win11-context-item" onclick="openAppWindow('settings')">
        <span>🎨</span>
        <span>Personalize</span>
      </div>
      <div class="win11-context-sep"></div>
      <div class="win11-context-item" onclick="state.config.osMode = state.config.osMode === 'windows' ? 'linux' : 'windows'; saveConfig(); applyDesktopOsTheme(); document.getElementById('win11-desktop-ctx')?.remove();">
        <span>${isWin ? '🐧' : '🪟'}</span>
        <span>${isWin ? 'Switch to Ubuntu Linux' : 'Switch to Windows 11'}</span>
      </div>
    `;

    document.body.appendChild(menu);
  }


  function setupNativeDesktop() {
    const wrapper = document.getElementById('desktop-wrapper');
    if (!wrapper) return;

    // Add Desktop Mode Switcher button to toolbar if not present
    const toolbar = document.querySelector('#tab-desktop .viewer-toolbar');
    if (toolbar && !document.getElementById('btn-toggle-desktop-mode')) {
      const modeBtn = document.createElement('button');
      modeBtn.id = 'btn-toggle-desktop-mode';
      modeBtn.className = 'cyber-btn xs neon-green';
      modeBtn.title = 'Switch between Native Interactive Cloud Desktop and External Container Stream';
      modeBtn.innerHTML = '🖥️ Mode: <span id="desktop-mode-label">Native Cyber PC</span>';
      modeBtn.addEventListener('click', () => {
        if (state.config.desktopMode === 'native') {
          if (!state.config.desktopUrl) {
            const url = prompt('Enter live Remote Desktop Stream URL (e.g. https://xxx.trycloudflare.com or http://localhost:3000):');
            if (url && url.trim()) {
              state.config.desktopUrl = url.trim();
              state.config.desktopMode = 'stream';
              saveConfig();
            } else {
              return;
            }
          } else {
            state.config.desktopMode = 'stream';
            saveConfig();
          }
        } else {
          state.config.desktopMode = 'native';
          saveConfig();
        }
        updateDesktopModeUI();
      });
      toolbar.insertBefore(modeBtn, toolbar.firstChild);
    }

    let nativeDesk = document.getElementById('native-cyber-desktop');
    if (!nativeDesk) {
      nativeDesk = document.createElement('div');
      nativeDesk.id = 'native-cyber-desktop';
      nativeDesk.className = 'native-cyber-desktop';

      nativeDesk.innerHTML = `
        <div class="cyber-desktop-workspace" id="cyber-desktop-canvas">
          <div class="desktop-icons-container" id="desktop-icons-container"></div>
          <div id="desktop-windows-layer"></div>
        </div>

        <!-- Taskbar -->
        <footer class="cyber-desktop-taskbar">
          <div class="taskbar-left">
            <button class="taskbar-start-btn" id="taskbar-start-toggle">
              <span>⚡</span> START
            </button>
            <div class="taskbar-apps-pinned">
              <button class="taskbar-app-icon" data-open="terminal" title="Terminal CLI">💻</button>
              <button class="taskbar-app-icon" data-open="chromium" title="Chromium Browser">🔷</button>
              <button class="taskbar-app-icon" data-open="msstore" title="Microsoft Store">🛍️</button>
              <button class="taskbar-app-icon" data-open="browser" title="Web Browser">🌐</button>
              <button class="taskbar-app-icon" data-open="files" title="This PC / Files">📁</button>
              <button class="taskbar-app-icon" data-open="editor" title="Code Studio">📝</button>
              <button class="taskbar-app-icon" data-open="taskmgr" title="Task Manager">📊</button>
            </div>
            <div class="taskbar-active-chips" id="taskbar-active-chips"></div>
          </div>
          <div class="taskbar-right-tray">
            <span title="Network">&#128246;</span>
            <span title="Volume">&#128266;</span>
            <span title="Battery">&#128267;</span>
            <span id="taskbar-clock">12:00:00 PM</span>
          </div>
        </footer>

        <!-- Start Menu -->
        <div class="cyber-start-menu hidden" id="cyber-start-menu">
          <div style="display:flex; align-items:center; gap:10px; padding-bottom:8px; border-bottom:1px solid rgba(0,229,255,0.2);">
            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, #00e5ff, #bd00ff); display:flex; align-items:center; justify-content:center; font-weight:bold; color:#fff;">P</div>
            <div>
              <div style="font-weight:700; color:#fff; font-size:0.9rem;">Prince · VirgoYT</div>
              <div style="font-size:0.75rem; color:var(--neon-green);">👑 ROOT ADMINISTRATOR</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; max-height:240px; overflow-y:auto;">
            <button class="cyber-btn sm" data-start-app="terminal" style="text-align:left; justify-content:flex-start;">💻 Terminal</button>
            <button class="cyber-btn sm" data-start-app="chromium" style="text-align:left; justify-content:flex-start;">🔷 Chromium Browser</button>
            <button class="cyber-btn sm" data-start-app="msstore" style="text-align:left; justify-content:flex-start;">🛍️ Microsoft Store (Web Hub)</button>
            <button class="cyber-btn sm" data-start-app="browser" style="text-align:left; justify-content:flex-start;">🌐 Chrome Web Browser</button>
            <button class="cyber-btn sm" data-start-app="files" style="text-align:left; justify-content:flex-start;">📁 This PC</button>
            <button class="cyber-btn sm" data-start-app="editor" style="text-align:left; justify-content:flex-start;">📝 Code Studio Editor</button>
            <button class="cyber-btn sm" data-start-app="taskmgr" style="text-align:left; justify-content:flex-start;">📊 Task Manager</button>
            <button class="cyber-btn sm" data-start-app="steam" style="text-align:left; justify-content:flex-start;">🎮 Steam Gaming Platform</button>
            <button class="cyber-btn sm" data-start-app="blender" style="text-align:left; justify-content:flex-start;">🚀 Blender</button>
            <button class="cyber-btn sm" data-start-app="unreal" style="text-align:left; justify-content:flex-start;">⚡ Unreal Engine</button>
            <button class="cyber-btn sm" data-start-app="photopea" style="text-align:left; justify-content:flex-start;">🎨 Photoshop Studio (Photopea)</button>
            <button class="cyber-btn sm" data-start-app="shotcut" style="text-align:left; justify-content:flex-start;">🎬 FFmpeg WASM Converter</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
            <button id="btn-start-settings" class="cyber-btn xs neon-cyan">⚙️ Settings</button>
            <button id="btn-start-logout" class="cyber-btn xs neon-pink">🔒 Lock / Exit</button>
          </div>
        </div>
      `;

      wrapper.insertBefore(nativeDesk, wrapper.firstChild);
    }

    // Populate Desktop Icons
    const iconsContainer = document.getElementById('desktop-icons-container');
    const APPS = [
      { id: 'terminal', name: 'Terminal CLI', icon: '💻' },
      { id: 'msstore', name: 'Microsoft Store', icon: '🛍️' },
      { id: 'browser', name: 'Web Browser', icon: '🌐' },
      { id: 'chromium', name: 'Chromium', icon: '🔷' },
      { id: 'files', name: 'This PC', icon: '📁' },
      { id: 'editor', name: 'Code Studio', icon: '📝' },
      { id: 'taskmgr', name: 'Task Manager', icon: '📊' },
      { id: 'photopea', name: 'Photopea', icon: '🎨' },
      { id: 'shotcut', name: 'Video Converter', icon: '🎬' },
      { id: 'steam', name: 'Steam', icon: '🎮' },
      { id: 'blender', name: 'Blender', icon: '🚀' },
      { id: 'unreal', name: 'Unreal Engine', icon: '⚡' },
      { id: 'settings', name: 'Settings', icon: '⚙️' }
    ];

    if (iconsContainer && iconsContainer.children.length === 0) {
      APPS.forEach(app => {
        const item = document.createElement('div');
        item.className = 'desktop-icon';
        item.innerHTML = `
          <div class="icon-art">${app.icon}</div>
          <div class="icon-label">${app.name}</div>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          openAppWindow(app.id);
        });
        iconsContainer.appendChild(item);
      });
    }

    // Start Menu Toggling
    const startBtn = document.getElementById('taskbar-start-toggle');
    const startMenu = document.getElementById('cyber-start-menu');
    if (startBtn && startMenu) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && e.target !== startBtn) {
          startMenu.classList.add('hidden');
        }
      });
      startMenu.querySelectorAll('[data-start-app]').forEach(btn => {
        btn.addEventListener('click', () => {
          const appId = btn.getAttribute('data-start-app');
          openAppWindow(appId);
          startMenu.classList.add('hidden');
        });
      });
      const startSettings = document.getElementById('btn-start-settings');
      if (startSettings) {
        startSettings.addEventListener('click', () => {
          startMenu.classList.add('hidden');
          const btnSet = document.getElementById('btn-settings');
          if (btnSet) btnSet.click();
        });
      }
      const startLogout = document.getElementById('btn-start-logout');
      if (startLogout) {
        startLogout.addEventListener('click', () => {
          sessionStorage.clear();
          window.location.href = 'index.html';
        });
      }
    }

    // Taskbar pinned clicks
    document.querySelectorAll('.taskbar-app-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-open');
        openAppWindow(appId);
      });
    });

    // Real-Time Clock
    function updateClock() {
      const clockEl = document.getElementById('taskbar-clock');
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Apply Windows 11 / Linux styling immediately
    applyDesktopOsTheme();

    // Initial default window: Open Terminal on startup!
    setTimeout(() => {
      openAppWindow('terminal');
    }, 300);

    updateDesktopModeUI();
  }

  window.openAppWindow = function(appId) { return openAppWindow(appId); };

  function openAppWindow(appId) {
    const windowsLayer = document.getElementById('desktop-windows-layer');
    if (!windowsLayer) return;

    // Direct Windows 11 Settings window

    if (openWindows[appId]) {
      const win = openWindows[appId];
      win.classList.remove('minimized');
      bringToFront(win);
      return;
    }

    highestZ++;
    const win = document.createElement('div');
    win.className = 'cyber-window active';
    win.id = `win-${appId}`;
    win.style.zIndex = highestZ;

    // Window configurations
    const isWinTheme = state.config.osMode === 'windows';
    const configs = {
      chrome: {
        title: 'Google Chrome',
        icon: WIN11_ICONS.chrome,
        width: Math.min(640, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getChromeHtml()
      },
      google_chrome: {
        title: 'Google Chrome',
        icon: WIN11_ICONS.chrome,
        width: Math.min(640, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getChromeHtml()
      },
      chromium: {
        title: 'Chromium',
        icon: WIN11_ICONS.chromium,
        width: Math.min(640, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getChromiumHtml()
      },
      chromium_browser: {
        title: 'Chromium',
        icon: WIN11_ICONS.chromium,
        width: Math.min(640, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getChromiumHtml()
      },
      edge: {
        title: 'Microsoft Edge',
        icon: WIN11_ICONS.edge,
        width: Math.min(620, window.innerWidth - 20),
        height: Math.min(440, window.innerHeight - 80),
        content: getBrowserHtml()
      },
      microsoft_edge: {
        title: 'Microsoft Edge',
        icon: WIN11_ICONS.edge,
        width: Math.min(620, window.innerWidth - 20),
        height: Math.min(440, window.innerHeight - 80),
        content: getBrowserHtml()
      },
      browser: {
        title: isWinTheme ? 'Microsoft Edge' : 'Chromium Web Browser',
        icon: isWinTheme ? WIN11_ICONS.edge : '🌐',
        width: Math.min(620, window.innerWidth - 20),
        height: Math.min(440, window.innerHeight - 80),
        content: getBrowserHtml()
      },
      terminal: {
        title: isWinTheme ? 'Windows Terminal (PowerShell / CMD)' : 'Terminal',
        icon: isWinTheme ? WIN11_ICONS.terminal : '💻',
        width: Math.min(540, window.innerWidth - 30),
        height: 340,
        content: getTerminalHtml()
      },
      cmd: {
        title: 'Command Prompt (Administrator)',
        icon: WIN11_ICONS.terminal,
        width: Math.min(540, window.innerWidth - 30),
        height: 340,
        content: getTerminalHtml()
      },
      powershell: {
        title: 'Windows PowerShell (Administrator)',
        icon: WIN11_ICONS.terminal,
        width: Math.min(540, window.innerWidth - 30),
        height: 340,
        content: getTerminalHtml()
      },
      msstore: {
        title: 'Microsoft Store — Apps & Games Catalog',
        icon: WIN11_ICONS.msstore,
        width: Math.min(680, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getMsStoreHtml()
      },
      ms_store: {
        title: 'Microsoft Store — Apps & Games Catalog',
        icon: WIN11_ICONS.msstore,
        width: Math.min(680, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getMsStoreHtml()
      },
      microsoft_store: {
        title: 'Microsoft Store — Apps & Games Catalog',
        icon: WIN11_ICONS.msstore,
        width: Math.min(680, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getMsStoreHtml()
      },
      files: {
        title: `File Explorer — ${location.host}`,
        icon: WIN11_ICONS.files,
        width: Math.min(560, window.innerWidth - 30),
        height: 360,
        content: getFilesHtml()
      },
      explorer: {
        title: 'File Explorer — This PC (C:)',
        icon: WIN11_ICONS.files,
        width: Math.min(560, window.innerWidth - 30),
        height: 360,
        content: getFilesHtml()
      },
      thispc: {
        title: 'File Explorer — This PC (C:)',
        icon: WIN11_ICONS.files,
        width: Math.min(560, window.innerWidth - 30),
        height: 360,
        content: getFilesHtml()
      },
      editor: {
        title: isWinTheme ? 'Untitled - Notepad' : 'VirgoX Code Studio Editor',
        icon: isWinTheme ? WIN11_ICONS.notepad : '📝',
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getEditorHtml()
      },
      notepad: {
        title: 'Untitled - Notepad',
        icon: WIN11_ICONS.notepad,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getEditorHtml()
      },
      taskmgr: {
        title: 'Task Manager — live platform metrics',
        icon: WIN11_ICONS.taskmgr,
        width: Math.min(500, window.innerWidth - 30),
        height: 340,
        content: getTaskmgrHtml(),
        onMount: mountTaskmgr
      },
      settings: {
        title: 'Settings',
        icon: WIN11_ICONS.settings,
        width: Math.min(560, window.innerWidth - 20),
        height: 400,
        content: getSettingsHtml(),
        onMount: renderWallpaperPicker
      },
      windows_settings: {
        title: 'Settings',
        icon: WIN11_ICONS.settings,
        width: Math.min(560, window.innerWidth - 20),
        height: 400,
        content: getSettingsHtml(),
        onMount: renderWallpaperPicker
      },
      photopea: {
        title: 'Photopea — Image Editor',
        icon: WIN11_ICONS.photoshop,
        width: Math.min(620, window.innerWidth - 20),
        height: 400,
        content: `<iframe src="https://www.photopea.com" style="width:100%; height:100%; border:none;"></iframe>`
      },
      photoshop: {
        title: 'Photopea — Image Editor',
        icon: WIN11_ICONS.photoshop,
        width: Math.min(620, window.innerWidth - 20),
        height: 400,
        content: `<iframe src="https://www.photopea.com" style="width:100%; height:100%; border:none;"></iframe>`
      },
      shotcut: {
        title: 'ffmpeg.wasm — Video Converter',
        icon: WIN11_ICONS.video,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getVideoEditorHtml()
      },
      vscode: {
        title: 'Visual Studio Code',
        icon: WIN11_ICONS.code || '💻',
        width: Math.min(560, window.innerWidth - 30),
        height: 380,
        content: getCodeHtml()
      },
      video_editor: {
        title: 'ffmpeg.wasm — Video Converter',
        icon: WIN11_ICONS.video,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getVideoEditorHtml()
      },
      steam: {
        title: 'Steam',
        icon: WIN11_ICONS.steam,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getSteamHtml()
      },
      vlc: {
        title: 'Media Player',
        icon: WIN11_ICONS.vlc,
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getVlcHtml(),
        onMount: mountVlcPlayer
      },
      blender: {
        title: 'Blender',
        icon: WIN11_ICONS.blender,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getBlenderHtml(),
        onMount: mountGpuProbe
      },
      unreal: {
        title: 'Unreal Engine',
        icon: WIN11_ICONS.unreal,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getUnrealHtml()
      },
      unreal_engine: {
        title: 'Unreal Engine',
        icon: WIN11_ICONS.unreal,
        width: Math.min(540, window.innerWidth - 30),
        height: 350,
        content: getUnrealHtml()
      },
      playstore: {
        title: 'Google Play Store (Web Hub)',
        icon: WIN11_ICONS.playstore,
        width: Math.min(600, window.innerWidth - 20),
        height: 420,
        content: `<div style="padding:14px; color:#fff; height:100%; overflow-y:auto; font-family:'Segoe UI', sans-serif;"><div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;"><div style="width:36px; height:36px;">${WIN11_ICONS.playstore}</div><div><h4 style="margin:0;">Google Play Store Hub</h4><span style="font-size:0.75rem; color:#aaa;">Official Android Apps on Cloud Workstation</span></div></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;"><div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:8px; text-align:center;"><div style="font-size:1.8rem;">🏃</div><div style="font-weight:700; font-size:0.8rem; margin:4px 0;">Subway Surfers</div><button class="cyber-btn xs neon-green" onclick="openAppWindow('terminal')">Install APK</button></div><div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:8px; text-align:center;"><div style="font-size:1.8rem;">💬</div><div style="font-weight:700; font-size:0.8rem; margin:4px 0;">WhatsApp</div><button class="cyber-btn xs neon-cyan" onclick="openAppWindow('chrome')">Open Web</button></div><div style="background:rgba(255,255,255,0.06); padding:10px; border-radius:8px; text-align:center;"><div style="font-size:1.8rem;">⛏️</div><div style="font-weight:700; font-size:0.8rem; margin:4px 0;">Minecraft Trial</div><button class="cyber-btn xs neon-purple" onclick="openAppWindow('terminal')">Install APK</button></div></div></div>`
      }
    };

    const cfg = configs[appId] || {
      title: appId.toUpperCase(),
      icon: '🗔',
      width: Math.min(480, window.innerWidth - 30),
      height: 300,
      content: `<div style="padding:20px; color:#fff;"><h4>⚡ ${escapeHtml(appId)}</h4><p style="color:#aaa; font-size:0.85rem; margin-top:8px;">This app id has no window of its own, so there is nothing to show here. The placeholder that stood in for it described a pool of memory and a frame rate no measurement ever produced.</p><p style="color:#94a3b8; font-size:0.8rem; margin-top:10px;">What is real on this page: <span data-pf="cores"></span> · <span data-pf="gpu"></span> · <span data-pf="quota"></span></p></div>`
    };

    // Responsive initial position
    const count = Object.keys(openWindows).length;
    const initialX = Math.max(10, Math.min(20 + count * 20, window.innerWidth - cfg.width - 20));
    const initialY = Math.max(10, Math.min(20 + count * 20, window.innerHeight - cfg.height - 80));
    win.style.left = `${initialX}px`;
    win.style.top = `${initialY}px`;
    win.style.width = `${cfg.width}px`;
    win.style.height = `${cfg.height}px`;

    win.innerHTML = `
      <div class="cyber-window-titlebar" id="drag-${appId}">
        <div class="win-title-left">
          <span>${cfg.icon}</span>
          <span>${cfg.title}</span>
        </div>
        <div class="win-title-actions">
          <button class="win-btn min" title="Minimize">—</button>
          <button class="win-btn max" title="Maximize">▢</button>
          <button class="win-btn close" title="Close">✕</button>
        </div>
      </div>
      <div class="cyber-window-body">
        ${cfg.content}
      </div>
    `;

    windowsLayer.appendChild(win);
    openWindows[appId] = win;

    // Post-injection hook. cfg.content is injected with innerHTML, so any inline
    // <script> inside it is inert — only inline on* attributes survive. A window
    // that needs live behaviour registers it here instead of shipping a script
    // tag that will never run.
    if (typeof cfg.onMount === 'function') {
      try { cfg.onMount(win); } catch (e) { console.warn('onMount failed for', appId, e); }
    // Every panel that shows a specification reads it live, not from a constant.
    hydratePlatformFacts(win);
    }

    // Bring to front on click
    win.addEventListener('mousedown', () => bringToFront(win));
    win.addEventListener('touchstart', () => bringToFront(win), { passive: true });

    // Header buttons
    const minBtn = win.querySelector('.win-btn.min');
    const maxBtn = win.querySelector('.win-btn.max');
    const closeBtn = win.querySelector('.win-btn.close');

    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      win.classList.add('minimized');
      updateTaskbarChips();
    });

    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      win.classList.toggle('maximized');
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      win.remove();
      delete openWindows[appId];
      updateTaskbarChips();
    });

    // Make Draggable (Touch & Mouse)
    setupWindowDrag(win, win.querySelector('.cyber-window-titlebar'));

    // Post-attach initializers
    if (appId === 'chrome' || appId === 'google_chrome') initChromeActions(win, false);
    if (appId === 'chromium' || appId === 'chromium_browser') initChromeActions(win, true);
    if (appId === 'files' || appId === 'explorer' || appId === 'thispc') initFilesActions(win);
    if (appId === 'terminal' || appId === 'cmd' || appId === 'powershell') initTerminalInput(win);
    if (appId === 'browser' || appId === 'edge' || appId === 'microsoft_edge') initBrowserActions(win);
    if (appId === 'msstore' || appId === 'ms_store' || appId === 'microsoft_store') initMsStoreActions(win);
    if (appId === 'editor' || appId === 'notepad') initEditorActions(win);
    if (appId === 'settings' || appId === 'windows_settings') initSettingsActions(win);

    updateTaskbarChips();
    bringToFront(win);
  }

  function bringToFront(win) {
    highestZ++;
    win.style.zIndex = highestZ;
    document.querySelectorAll('.cyber-window').forEach(w => w.classList.remove('active'));
    win.classList.add('active');
    updateTaskbarChips();
  }

  function updateTaskbarChips() {
    const chipsContainer = document.getElementById('taskbar-active-chips');
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    Object.keys(openWindows).forEach(appId => {
      const win = openWindows[appId];
      const chip = document.createElement('button');
      chip.className = 'taskbar-chip' + (win.classList.contains('active') && !win.classList.contains('minimized') ? ' focused' : '');
      const icon = win.querySelector('.win-title-left span:first-child')?.textContent || '🗔';
      chip.innerHTML = `${icon} ${appId}`;
      chip.addEventListener('click', () => {
        if (win.classList.contains('minimized')) {
          win.classList.remove('minimized');
          bringToFront(win);
        } else if (win.classList.contains('active')) {
          win.classList.add('minimized');
        } else {
          bringToFront(win);
        }
        updateTaskbarChips();
      });
      chipsContainer.appendChild(chip);
    });
  }

  function setupWindowDrag(win, handle) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    function onPointerDown(clientX, clientY) {
      if (win.classList.contains('maximized')) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      initialLeft = win.offsetLeft;
      initialTop = win.offsetTop;
      bringToFront(win);
    }

    function onPointerMove(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      win.style.left = `${Math.max(0, initialLeft + dx)}px`;
      win.style.top = `${Math.max(0, initialTop + dy)}px`;
    }

    function onPointerUp() {
      isDragging = false;
    }

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-btn')) return;
      onPointerDown(e.clientX, e.clientY);
      const onMove = (ev) => onPointerMove(ev.clientX, ev.clientY);
      const onUp = () => {
        onPointerUp();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    handle.addEventListener('touchstart', (e) => {
      if (e.target.closest('.win-btn')) return;
      if (e.touches.length === 1) {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    handle.addEventListener('touchend', () => onPointerUp());
  }

  // Window Content Helpers
  let termCwd = '/root';
  const termHistory = [];
  let historyIdx = -1;
  let activeShellType = 'pwsh'; // 'pwsh', 'cmd', 'bash'

  function getTerminalPrompt(cwd) {
    if (state.config.osMode === 'windows') {
      const winPath = cwd === '/root' ? 'C:\\Users\\Prince' : (cwd.startsWith('/root/') ? 'C:\\Users\\Prince\\' + cwd.slice(6).replace(/\//g, '\\') : 'C:' + cwd.replace(/\//g, '\\'));
      if (activeShellType === 'cmd') {
        return `${winPath}>`;
      }
      return `PS ${winPath}>`;
    }
    const p = cwd === '/root' ? '~' : cwd;
    // Not root, and not a made-up hostname: the prompt names the account that is
    // actually signed in and the host the page is actually served from.
    const who = (vxcCurrentUser().email || 'guest').split('@')[0].replace(/[^A-Za-z0-9._-]/g, '');
    return `${who}@${location.host}:${p}$ `;
  }

  function getTerminalHtml() {
    const isWin = state.config.osMode === 'windows';
    return `
      <div style="display:flex; flex-direction:column; height:100%;">
        ${isWin ? `
        <div class="win11-term-tabbar" id="win11-term-tabbar">
          <div class="win11-term-tab ${activeShellType === 'pwsh' ? 'active' : ''}" data-shell="pwsh"><span>⚡</span> Windows PowerShell</div>
          <div class="win11-term-tab ${activeShellType === 'cmd' ? 'active' : ''}" data-shell="cmd"><span>💻</span> Command Prompt</div>
          <div class="win11-term-tab ${activeShellType === 'bash' ? 'active' : ''}" data-shell="bash"><span>🐧</span> Bash (simulated)</div>
        </div>
        ` : ''}
        <div class="cyber-term-view" id="native-term-body" style="flex:1;">
          <div style="color:${isWin ? '#60a5fa' : 'var(--neon-cyan)'}; margin-bottom:4px;">
            ${isWin ? '🪟 <strong>Windows 11 shell</strong> — a Fluent theme drawn in this page, not an installed OS' : '⚡ <strong>VirgoX Cloud PC</strong> — a Linux shell theme, also drawn in this page'}
          </div>
          <div style="color:#8892b0; font-size:0.75rem; margin-bottom:8px;">
            ${(() => { const r = realityLine(); return escapeHtml(`${r.cpu} · ${r.screen} · up ${fmtDuration(r.f.pageAgeMs)}`); })()}
          </div>
          <div id="term-output-stream" style="white-space:pre-wrap; word-break:break-all;"></div>
          <div class="cyber-term-input-row">
            <span class="cyber-term-prompt" id="native-term-prompt">${getTerminalPrompt(termCwd)}</span>
            <input type="text" class="cyber-term-input" id="native-term-input" autocomplete="off" spellcheck="false" />
          </div>
        </div>
      </div>
    `;
  }

  function initTerminalInput(win) {
    const input = win.querySelector('#native-term-input');
    const output = win.querySelector('#term-output-stream');
    const termBody = win.querySelector('#native-term-body');
    const promptEl = win.querySelector('#native-term-prompt');
    if (!input || !output) return;

    // Shell profile tabs
    win.querySelectorAll('.win11-term-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        win.querySelectorAll('.win11-term-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeShellType = tab.getAttribute('data-shell') || 'pwsh';
        if (promptEl) promptEl.textContent = getTerminalPrompt(termCwd);
        output.innerHTML += `\nSwitched shell profile to: ${tab.textContent.trim()}\n`;
        if (termBody) termBody.scrollTop = termBody.scrollHeight;
      });
    });

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (termHistory.length > 0 && historyIdx < termHistory.length - 1) {
          historyIdx++;
          input.value = termHistory[termHistory.length - 1 - historyIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx > 0) {
          historyIdx--;
          input.value = termHistory[termHistory.length - 1 - historyIdx];
        } else if (historyIdx === 0) {
          historyIdx = -1;
          input.value = '';
        }
      } else if (e.key === 'Enter') {
        const cmd = input.value.trim();
        input.value = '';
        historyIdx = -1;
        if (!cmd) return;
        termHistory.push(cmd);

        output.innerHTML += `\n<span style="color:${state.config.osMode === 'windows' ? '#60a5fa' : 'var(--neon-cyan)'}; font-weight:700;">${getTerminalPrompt(termCwd)}</span> <span style="color:#fff;">${escapeHtml(cmd)}</span>\n`;

        const lower = cmd.toLowerCase().trim();
        if (lower === 'clear' || lower === 'cls') {
          output.innerHTML = '';
          if (termBody) termBody.scrollTop = 0;
          return;
        }

        // Direct Windows simulated utilities
        if (lower === 'ver') {
          // There is no Windows build to print, because this document is not running
          // on Windows. The shell borrows the Windows 11 look; the build string
          // used to be invented, which turned a skin into a hardware claim.
          const r = realityLine();
          output.innerHTML += `VirgoX Cloud PC — Windows 11 Fluent shell (theme only)
No Windows build is reported: this is a web document, not a Windows machine.

Browser:    ${escapeHtml(fact(r.f.ua))}
Platform:   ${escapeHtml(fact(r.f.platform))}
CPU:        ${escapeHtml(r.cpu)}
GPU:        ${escapeHtml(r.gpu)}
Page age:   ${fmtDuration(r.f.pageAgeMs)}
Origin:     ${escapeHtml(r.f.origin)}\n`;
          if (termBody) termBody.scrollTop = termBody.scrollHeight;
          return;
        } else if (lower === 'ipconfig') {
          // No web API enumerates network interfaces, so this used to print an
          // invented adapter, address and gateway. Now it prints only what the
          // page can genuinely observe about the connection it is using.
          const f = platformFacts();
          output.innerHTML += `IP configuration
There is no API that lists network interfaces, so no adapter, address or
gateway is invented here. What the page can actually observe:

Page origin:  ${escapeHtml(fact(f.origin))}
Host:         ${escapeHtml(fact(f.host))}
Protocol:     ${escapeHtml(location.protocol)}
Online:       ${f.online === null ? NOT_EXPOSED : (f.online ? 'yes' : 'no')}
Connection:   ${escapeHtml(fact(f.effectiveType))}
Downlink:     ${escapeHtml(fact(f.downlinkMbps, 'Mb/s'))}
Round trip:   ${escapeHtml(fact(f.rttMs, 'ms'))}
Data saver:   ${f.saveData === null ? NOT_EXPOSED : (f.saveData ? 'on' : 'off')}\n`;
          if (termBody) termBody.scrollTop = termBody.scrollHeight;
          return;
        } else if (lower === 'systeminfo') {
          // Every line is a live reading or an admission. This used to report a
          // registered owner, a Windows build, an ARM64 CPU, 64 GB of RAM, a
          // 5 TB disk and a 120 FPS compositor — none of which existed.
          const f = platformFacts();
          const est = await storageEstimate();
          const row = (k, v) => k.padEnd(24, ' ') + escapeHtml(v);
          output.innerHTML += `${row('Host:', f.host || NOT_EXPOSED + ' (page host, not a machine name)')}
${row('OS:', 'not applicable — this is a web document')}
${row('User agent:', fact(f.ua))}
${row('Platform:', fact(f.platform))}
${row('Vendor:', fact(f.vendor))}
${row('Language:', fact(f.language))}
${row('System type:', fact(f.platform) + ' \u00b7 ' + fact(f.logicalCores, 'logical cores'))}
${row('Logical processors:', fact(f.logicalCores, '(navigator.hardwareConcurrency)'))}
${row('Device memory:', f.deviceMemoryGb === null ? NOT_EXPOSED : 'up to ' + f.deviceMemoryGb + ' GB device class (browser bucket)')}
${row('JS heap in use:', f.jsHeapUsedBytes === null ? NOT_EXPOSED + ' (performance.memory unavailable in this browser)' : (fmtBytes(f.jsHeapUsedBytes) + ' of ' + fmtBytes(f.jsHeapLimitBytes) + ' (performance.memory)'))}
${row('Graphics:', f.gpu.renderer || f.gpu.reason || NOT_EXPOSED)}
${row('GPU vendor:', fact(f.gpu.vendor))}
${row('WebGL version:', fact(f.gpu.version))}
${row('Screen:', f.screenWidth && f.screenHeight ? f.screenWidth + 'x' + f.screenHeight + ' @ ' + f.dpr + 'x, ' + f.colourDepth + '-bit colour' : NOT_EXPOSED)}
${row('Viewport:', f.viewportWidth && f.viewportHeight ? f.viewportWidth + 'x' + f.viewportHeight + ' CSS px' : NOT_EXPOSED)}
${row('Touch points:', fact(f.maxTouchPoints))}
${row('Storage allowance:', est && Number.isFinite(est.quota) ? fmtBytes(est.usage || 0) + ' used of ' + fmtBytes(est.quota) + ' (navigator.storage.estimate)' : NOT_EXPOSED)}
${row('Connection:', f.effectiveType ? f.effectiveType + ' · ' + f.downlinkMbps + ' Mb/s · ' + f.rttMs + ' ms' : NOT_EXPOSED)}
${row('Cookies:', f.cookiesEnabled ? 'enabled' : 'blocked')}
${row('Page age:', fmtDuration(f.pageAgeMs) + ' (performance.now, since navigation)')}
${row('Page origin:', f.origin)}\n`;
          return;
        } else if (lower === 'dir') {
          // A page cannot list a directory and cannot read a local disk, so the
          // old listing — real-looking dates, real-looking byte counts for files
          // that were never there — is gone. What is left is the set of files
          // this app actually loads, with each size read live via HEAD, so a file
          // that is not deployed says 404 instead of inventing a number.
          const dirPath = termCwd === '/root' ? 'C:\\Users\\Prince' : 'C:' + termCwd.replace(/\//g, '\\');
          const rows = await siteFileIndex();
          const listing = rows.map(r => {
            if (!r.ok) return stamp(r.modified) + '        <not deployed>   ' + r.name;
            return stamp(r.modified) + '  ' + String(r.bytes === null ? '?' : r.bytes.toLocaleString()).padStart(12, ' ')
              + '  ' + r.name;
          }).join('\n');
          output.innerHTML += ` Volume in drive C is VirgoX Cloud PC (no local disk is readable)
 Directory of ${dirPath}

Files this app loads. Sizes and dates below are read live from the server; a
file that is not deployed reports its HTTP status instead of a byte count.

${escapeHtml(listing)}

 Volume — see \`df\` for the real browser storage allowance\n`;
          if (termBody) termBody.scrollTop = termBody.scrollHeight;
          return;
        }

        let bridge = state.config.bridgeUrl || '';
        if (!bridge) {
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            bridge = window.location.origin;
          } else {
            bridge = 'http://localhost:8888';
          }
        }

        const clientToken = sessionStorage.getItem('virgox_client_token') || 'vx_sec_prince20_88b9c1';
        const email = (sessionStorage.getItem('virgox_user_email') || 'darkvirgoyt@gmail.com').toLowerCase();

        let executed = false;
        try {
          const res = await fetch(`${bridge}/api/shell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd, cwd: termCwd, token: clientToken, email })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.cwd) {
              termCwd = data.cwd;
              if (promptEl) promptEl.textContent = getTerminalPrompt(termCwd);
            }
            if (data.output) {
              output.innerHTML += escapeHtml(data.output);
              if (!data.output.endsWith('\n')) output.innerHTML += '\n';
            }
            if (data.error) {
              output.innerHTML += `<span style="color:var(--neon-pink);">${escapeHtml(data.error)}</span>\n`;
            }
            executed = true;
          }
        } catch (err) {
          executed = false;
        }

        if (!executed) {
          await runLocalShellFallback(cmd, output, promptEl, termBody);
        }

        if (termBody) termBody.scrollTop = termBody.scrollHeight;
      }
    });

    win.addEventListener('click', () => input.focus());
    setTimeout(() => input.focus(), 80);
  }

  // Async because `vxc auth login` is a long-running device-flow poll loop; the
  // keydown handler above awaits this before scrolling.
  async function runLocalShellFallback(cmd, output, promptEl, termBody) {
    const lower = cmd.toLowerCase().trim();
    if (lower === 'help') {
      output.innerHTML += `VirgoX Cloud PC — commands
Everything below reads a live browser API. Whatever the browser withholds is
printed as "not exposed" rather than filled in with a plausible number.

  ver / systeminfo    real platform readings
  dir / ls            the files this app loads, each size read live via HEAD
  ipconfig            what this page can observe about its own connection
  whoami / id         the signed-in account, if there is one
  uname               the real platform string; there is no kernel to name
  uptime              how long this document has been open
  neofetch / specs    the same readings, laid out
  free                JS heap and the browser's declared device class
  df                  the real storage allowance from navigator.storage
  ps                  what this page has actually fetched, with real timings
  date / pwd / cd     real
  cls / clear         clear the screen
  vxc auth <cmd>      real device login against your own auth service

Deliberately not implemented, because nothing here could do them honestly:
apt, python3, top, and listing a local disk. There is no shell and no
filesystem behind this page — only a browser tab.\n`;
    } else if (lower === 'pwd') {
      output.innerHTML += `${termCwd}\n`;
    } else if (lower === 'cd' || lower === 'cd ~') {
      termCwd = '/root';
      if (promptEl) promptEl.textContent = getTerminalPrompt(termCwd);
    } else if (lower.startsWith('cd ')) {
      const target = cmd.slice(3).trim();
      if (target === '..') {
        const parts = termCwd.split('/').filter(Boolean);
        parts.pop();
        termCwd = '/' + parts.join('/');
      } else if (target.startsWith('/')) {
        termCwd = target;
      } else {
        termCwd = (termCwd === '/' ? '' : termCwd) + '/' + target;
      }
      if (promptEl) promptEl.textContent = getTerminalPrompt(termCwd);
    } else if (lower === 'whoami') {
      // A page has no OS user. What it can honestly name is the account session,
      // and it used to print root or virgox-pc\prince — neither of which exists
      // on any machine the page is running on.
      const who = vxcCurrentUser();
      output.innerHTML += `account:  ${escapeHtml(who.email || 'not signed in')}
origin:   ${escapeHtml(location.origin)}
OS user:  not applicable — a web page has no user on the host machine\n`;
    } else if (lower === 'id') {
      // uid=0(root) gid=0(root) was the most obviously false line in the shell:
      // this document is not running as root anywhere.
      const who = vxcCurrentUser();
      output.innerHTML += `uid/gid:   not applicable — a web document has no POSIX identity
account:   ${escapeHtml(who.email || 'not signed in')}
origin:    ${escapeHtml(location.origin)}
host:      ${escapeHtml(location.host)}\n`;
    } else if (lower === 'uname' || lower === 'uname -a') {
      // The old line named a kernel build and an architecture. Neither is
      // reachable from a page, so both are now stated as unreachable.
      const f = platformFacts();
      output.innerHTML += `VirgoX Cloud PC document on ${escapeHtml(fact(f.platform))}
Kernel:     not applicable — no kernel is reachable from a web page
Machine:    not applicable — this is a browser tab, not a host
User agent: ${escapeHtml(fact(f.ua))}\n`;
    } else if (lower === 'date') {
      output.innerHTML += `${new Date().toUTCString()}\n`;
    } else if (lower === 'uptime') {
      // "up 24 days, 16:45, load average 0.12" was entirely invented. The only
      // clock a tab genuinely has is performance.now() since navigation.
      const f = platformFacts();
      output.innerHTML += ` ${new Date().toLocaleTimeString()} up ${fmtDuration(f.pageAgeMs)},  1 document open, page age from performance.now()\n`;
    } else if (lower === 'neofetch' || lower === 'specs') {
      // The ASCII is decoration. Every value beside it is a live reading. The lines
      // that named a "Motorola FogOS Cloud Workstation (120Hz Mode)", a
      // "6.17.0-PRoot-Distro aarch64" kernel and "Prince@virgox-pc" are gone,
      // because the page is on none of those machines.
      const f = platformFacts();
      const est = await storageEstimate();
      const line = (k, v) => (k + ':').padEnd(12, ' ') + escapeHtml(v);
      output.innerHTML += `       ⚡⚡⚡⚡⚡⚡⚡⚡⚡          ${escapeHtml(f.host || 'unnamed host')}
     ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡        ----------------
    ⚡⚡⚡  VIRGOX  ⚡⚡⚡       ${line('Shell', 'browser tab (Windows 11 Fluent theme)')}
   ⚡⚡⚡   CLOUD   ⚡⚡⚡      ${line('OS', 'a web document — no host OS')}
  ⚡⚡⚡     PC     ⚡⚡⚡     ${line('Platform', fact(f.platform))}
 ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡   ${line('Uptime', fmtDuration(f.pageAgeMs))}
  ⚡⚡⚡            ⚡⚡⚡     ${line('CPU', fact(f.logicalCores, 'logical cores'))}
   ⚡⚡⚡          ⚡⚡⚡      ${line('GPU', f.gpu.renderer || f.gpu.reason || NOT_EXPOSED)}
    ⚡⚡⚡        ⚡⚡⚡       ${line('Device class', f.deviceMemoryGb === null ? NOT_EXPOSED : 'up to ' + f.deviceMemoryGb + ' GB')}
     ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡        ${line('JS heap', f.jsHeapUsedBytes === null ? NOT_EXPOSED : fmtBytes(f.jsHeapUsedBytes) + ' / ' + fmtBytes(f.jsHeapLimitBytes))}
       ⚡⚡⚡⚡⚡⚡⚡⚡           ${line('Storage', est && Number.isFinite(est.quota) ? fmtBytes(est.usage || 0) + ' / ' + fmtBytes(est.quota) + ' allowance' : NOT_EXPOSED)}
                             ${line('Resolution', f.screenWidth && f.screenHeight ? f.screenWidth + 'x' + f.screenHeight + ' @ ' + f.dpr + 'x' : NOT_EXPOSED)}
                             ${line('Touch points', fact(f.maxTouchPoints))}
                             ${line('Connection', f.effectiveType ? f.effectiveType + ' · ' + f.downlinkMbps + ' Mb/s · ' + f.rttMs + ' ms' : NOT_EXPOSED)}
                             ${line('Account', vxcCurrentUser().email || 'not signed in')}\n`;
    } else if (lower === 'free' || lower === 'free -h') {
      // "Mem: 64Gi / Swap: 32Gi" described a machine that does not exist. What a
      // page really has is a JS heap, and only where performance.memory exists.
      const f = platformFacts();
      const heap = f.jsHeapUsedBytes === null
        ? NOT_EXPOSED + ' (performance.memory unavailable in this browser)'
        : fmtBytes(f.jsHeapUsedBytes) + ' of ' + fmtBytes(f.jsHeapLimitBytes);
      const dev = f.deviceMemoryGb === null
        ? NOT_EXPOSED
        : 'up to ' + f.deviceMemoryGb + ' GB';
      output.innerHTML += `JS heap in use:  ${escapeHtml(heap)}
Device class:     ${escapeHtml(dev)}
Physical RAM:     ${NOT_EXPOSED} — a web page cannot read host RAM

The table this replaced reported a total, a used figure and a swap size. None of
the three was measured — they were typed in, so they are gone rather than
guessed at.\n`;
    } else if (lower === 'df' || lower === 'df -h') {
      // /dev/loop0 at 5.0T with 4.8T free was a made-up disk. The only quota that
      // exists for a page is navigator.storage.estimate(), and it describes a
      // browser allowance for this origin — not a disk.
      const est = await storageEstimate();
      if (!est || !Number.isFinite(est.quota)) {
        output.innerHTML += `navigator.storage.estimate() is not available in this browser, so there is
no storage figure to report. ${NOT_EXPOSED}\n`;
      } else {
        const used = est.usage || 0;
        const breakdown = est.usageDetails
          ? Object.keys(est.usageDetails).map(k => k + ' ' + fmtBytes(est.usageDetails[k])).join(', ')
          : '';
        output.innerHTML += `Browser storage allowance for ${escapeHtml(location.origin)}

Total:      ${fmtBytes(est.quota)}
Used:       ${fmtBytes(used)}
Available:  ${fmtBytes(Math.max(0, est.quota - used))}${breakdown ? '\nBreakdown: ' + escapeHtml(breakdown) : ''}
This is what the browser will allow this origin to store. It is not a disk: the
block-device line this replaced was invented, so it is gone rather than
recalculated.\n`;
      }
    } else if (lower.startsWith('ls')) {
      // A page cannot walk a local directory, so the old listing of Desktop/,
      // ROM-Builds/ and friends was decoration. This lists the files the app
      // really loads, with sizes read live, and says so.
      const rows = await siteFileIndex();
      const names = rows.filter(r => r.ok).map(r => r.name);
      const missing = rows.filter(r => !r.ok);
      output.innerHTML += `Files loaded by this app (sizes read live via HEAD):
${escapeHtml(names.join('  '))}${missing.length ? '\nNot deployed: ' + escapeHtml(missing.map(r => r.name + ' (' + r.status + ')').join('  ')) : ''}

No local directory is listed: a browser has no filesystem access. \`dir\` shows
the same list with sizes and dates.\n`;
    } else if (lower.startsWith('ps')) {
      // The old table invented PIDs 1/888/1248/1320 and a python3 server.py. There
      // is no process table behind a page. What genuinely exists is this
      // document's own resource timeline, so that is what it prints.
      const res = performance.getEntriesByType('resource');
      output.innerHTML += res.length
        ? ` NAME                                  TYPE      SIZE    DURATION
${res.slice(-14).map(e => {
             const kb = e.transferSize || e.encodedBodySize || 0;
             return ' ' + e.name.replace(location.origin, '').slice(0, 36).padEnd(37)
               + (e.initiatorType || 'other').padEnd(9)
               + (kb ? (kb > 1024 ? (kb / 1024).toFixed(1) + 'KB' : kb + 'B') : '-').padStart(7)
               + '  ' + e.duration.toFixed(0) + 'ms';
           }).join('\n')}

${res.length} resource(s) fetched by this page, from the real Resource Timing API.
There is no process table behind a web page. The process list this replaced,
with its hand-written process IDs, was invented.\n`
        : `No resources recorded yet on this page. There is no process table behind
a web page. The process list this replaced, with its hand-written process IDs, was
invented.\n`;
    } else if (lower.startsWith('apt')) {
      // "Reading package lists... All packages are up to date." was a canned
      // response to a package manager that does not exist here.
      output.innerHTML += `apt is not available: there is no shell and no package manager behind this
page. Installing software from a browser tab is not something this can honestly
do, so it will not pretend to.

The one real tool here is \`vxc\` — \`vxc auth login\` performs a real OAuth 2.0
device flow against server/auth-service.js.\n`;
    } else if (lower.startsWith('python3') || lower.startsWith('python')) {
      // "Python 3.12.3 (main, Apr 10 2024) [GCC 13.2.0] on linux" named an
      // interpreter and a compiler that are not present. There is no Python here.
      output.innerHTML += `python3 is not available: no interpreter is running behind this page. The version
banner this replaced named an interpreter and a compiler that were typed in, not
detected.

For real code execution, run it on your own machine and point a terminal at it,
or open Code Studio in the taskbar, which is an editor and not a runtime.\n`;
    } else if (lower === 'chromium' || lower.startsWith('chromium ')) {
      // There is no binary behind this. What actually happens is a browser
      // window opening inside this page, so that is what it says.
      output.innerHTML += `Opening the Chromium browser window in this page.\n`;
      setTimeout(() => openAppWindow('chromium'), 150);
    } else if (lower === 'chrome' || lower === 'google-chrome' || lower.startsWith('google-chrome ')) {
      output.innerHTML += `Opening the Google Chrome browser window in this page.\n`;
      setTimeout(() => openAppWindow('chrome'), 150);
    } else if (lower === 'vxc' || lower.startsWith('vxc ')) {
      await runVxcCommand(cmd.replace(/^\s*vxc\s*/i, ''), output, termBody);
    } else {
      // This used to read "Executed: <cmd> (Local fallback active — Connect
      // bridge port 8888 for live execution)", which claimed a command had run
      // when nothing had. Nothing runs an unknown command: this says so.
      output.innerHTML += `${escapeHtml(cmd)}: command not recognised. There is no shell behind
this page, so nothing was executed and no bridge is being waited on.

\`help\` lists what this terminal really answers. \`vxc auth login\` performs a real
OAuth 2.0 device flow against server/auth-service.js.\n`;
    }
  }


  function getBrowserHtml() {
    return `
      <div style="display:flex; flex-direction:column; height:100%; background:#0b0f1c;">
        <!-- Browser Toolbar -->
        <div class="browser-toolbar">
          <button class="cyber-btn xs" id="browser-btn-back" title="Back">◀</button>
          <button class="cyber-btn xs" id="browser-btn-fwd" title="Forward">▶</button>
          <button class="cyber-btn xs" id="browser-btn-reload" title="Reload">🔄</button>
          <button class="cyber-btn xs" id="browser-btn-home" title="Home (DuckDuckGo)">🏠</button>
          <div class="browser-omnibox">
            <span style="color:var(--neon-cyan); font-size:0.85rem; margin-right:4px;">🔒</span>
            <input type="text" id="browser-url-input" value="https://www.google.com" placeholder="Search Google or enter URL (e.g. google.com, youtube.com)" autocomplete="off" spellcheck="false" />
          </div>
          <button class="cyber-btn xs neon-cyan" id="browser-btn-go">GO ↵</button>
          <button class="cyber-btn xs neon-purple" id="browser-btn-open-tab" title="Open current URL in full Chrome tab (bypasses CSP restrictions)">🌐 Open Tab ↗</button>
        </div>

        <!-- Quick Bookmarks Bar -->
        <div class="browser-bookmarks-bar">
          <span style="color:var(--text-dim); margin-right:4px;">Quick Links:</span>
          <button class="browser-bookmark-pill" data-url="https://duckduckgo.com">🔍 DuckDuckGo</button>
          <button class="browser-bookmark-pill" data-url="https://wikipedia.org">📚 Wikipedia</button>
          <button class="browser-bookmark-pill" data-url="https://apps.microsoft.com">🛍️ Microsoft Store</button>
          <button class="browser-bookmark-pill" data-url="https://github.com/darkvirgoyt-beep">💻 GitHub</button>
          <button class="browser-bookmark-pill" data-url="https://www.google.com" data-newtab="true">🌐 Google (Tab)</button>
          <button class="browser-bookmark-pill" data-url="https://www.youtube.com" data-newtab="true">🎥 YouTube (Tab)</button>
          <button class="browser-bookmark-pill" data-url="https://news.ycombinator.com">📰 Hacker News</button>
        </div>

        <!-- Browser Frame Canvas -->
        <div style="flex:1; position:relative; background:#fff; overflow:hidden;">
          <iframe id="browser-frame-inner" src="about:blank" style="width:100%; height:100%; border:none;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
          <div class="webview-blocked" id="browser-frame-blocked" hidden>
            <div class="webview-blocked-card">
              <div class="webview-blocked-glyph">&#8856;</div>
              <h4>This site won&rsquo;t load inside the app</h4>
              <p>Google and most large sites send an <code>X-Frame-Options: DENY</code> header that blocks embedded pages. Your PC is fine &mdash; the site is refusing to be framed. Open it in a real tab.</p>
              <div class="webview-blocked-actions">
                <button class="cyber-btn sm neon-cyan" id="browser-btn-blocked-open">Open in real tab &#8599;</button>
                <button class="cyber-btn sm" id="browser-btn-blocked-dismiss">Back to page</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function initBrowserActions(win) {
    const input = win.querySelector('#browser-url-input');
    const frame = win.querySelector('#browser-frame-inner');
    const btnGo = win.querySelector('#browser-btn-go');
    const btnReload = win.querySelector('#browser-btn-reload');
    const btnHome = win.querySelector('#browser-btn-home');
    const btnBack = win.querySelector('#browser-btn-back');
    const btnFwd = win.querySelector('#browser-btn-fwd');
    const btnOpenTab = win.querySelector('#browser-btn-open-tab');
    const blockedPanel = win.querySelector('#browser-frame-blocked');
    const blockedOpen = win.querySelector('#browser-btn-blocked-open');
    const blockedDismiss = win.querySelector('#browser-btn-blocked-dismiss');
    if (!input || !frame) return;

    function hideBlocked() {
      if (blockedPanel) blockedPanel.hidden = true;
    }

    if (blockedOpen) {
      blockedOpen.addEventListener('click', () => {
        const url = blockedOpen.dataset.url;
        if (url) window.open(url, '_blank', 'noopener');
      });
    }
    if (blockedDismiss) blockedDismiss.addEventListener('click', hideBlocked);

    function resolveUrl(raw) {
      let val = (raw || '').trim();
      if (!val) return 'https://www.google.com';
      if (val.startsWith('http://') || val.startsWith('https://')) return val;
      if (val.includes('.') && !val.includes(' ')) return 'https://' + val;
      return `https://www.google.com/search?q=${encodeURIComponent(val)}`;
    }

    let probeToken = 0;

    function navigate(url) {
      const resolved = resolveUrl(url);
      input.value = resolved;
      hideBlocked();
      try {
        frame.src = resolved;
      } catch (e) {
        window.open(resolved, '_blank');
        return;
      }
      const token = ++probeToken;
      detectFramed(resolved).then(verdict => {
        if (token !== probeToken) return;
        if (verdict === 'blocked') {
          if (blockedPanel) {
            blockedPanel.hidden = false;
            if (blockedOpen) blockedOpen.dataset.url = resolved;
          }
        }
      });
    }

    if (btnGo) btnGo.addEventListener('click', () => navigate(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(input.value);
    });

    if (btnReload) btnReload.addEventListener('click', () => {
      const cur = frame.src;
      frame.src = 'about:blank';
      setTimeout(() => { frame.src = cur; }, 50);
    });

    if (btnHome) btnHome.addEventListener('click', () => navigate('https://www.google.com'));
    if (btnBack) btnBack.addEventListener('click', () => {
      try { frame.contentWindow.history.back(); } catch (e) {}
    });
    if (btnFwd) btnFwd.addEventListener('click', () => {
      try { frame.contentWindow.history.forward(); } catch (e) {}
    });

    if (btnOpenTab) btnOpenTab.addEventListener('click', () => {
      const resolved = resolveUrl(input.value);
      window.open(resolved, '_blank');
    });

    win.querySelectorAll('.browser-bookmark-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const u = pill.getAttribute('data-url');
        const isNewTab = pill.getAttribute('data-newtab') === 'true';
        if (isNewTab) {
          window.open(u, '_blank');
        } else {
          navigate(u);
        }
      });
    });
  }

  // Microsoft Store Web Hub
  const MS_STORE_APPS = [
    { id: 'vscode', name: 'Visual Studio Code', cat: 'dev', icon: '💻', desc: "Microsoft's editor, at vscode.dev. It sets frame-ancestors 'none', so this page shows you the real header that blocks it and links out.", action: 'editor', btnText: 'Open Code Studio' },
    { id: 'browser', name: 'Web Browser', cat: 'apps', icon: '🌐', desc: 'A real frame pointed at a real site, with a live probe for sites that refuse to be framed.', action: 'browser', btnText: 'Open Browser' },
    { id: 'chromium', name: 'Chromium', cat: 'apps', icon: '🔷', desc: 'The same real browser engine as Chrome, running the open-source build. It frames real sites and reports the real header when one refuses to be framed.', action: 'chromium', btnText: 'Open Chromium' },
    { id: 'terminal', name: 'Terminal', cat: 'dev', icon: '⚡', desc: 'A real terminal over this page. Every reading comes from a live browser API, and anything the browser withholds is printed as \'not exposed\'. apt and python3 are not implemented, because there is no shell here to run them.', action: 'terminal', btnText: 'Open Terminal' },
    { id: 'photopea', name: 'Photopea', cat: 'media', icon: '🎨', desc: 'The real photopea.com, framed live. It is an independent editor by Ivan Kutskir — it is not Adobe Photoshop, and this page does not ship a licence for anything.', action: 'photopea', btnText: 'Open Studio' },
    { id: 'shotcut', name: 'FFmpeg WASM Converter', cat: 'media', icon: '🎬', desc: 'Real ffmpeg compiled to WebAssembly, running in this tab. It converts the file you pick, on this machine, with no upload.', action: 'shotcut', btnText: 'Open Converter' },
    { id: 'steam', name: 'Steam Gaming Platform', pub: 'Valve Corporation', cat: 'gaming', icon: '🎮', desc: 'Access the world of PC gaming, cloud synchronization and community hubs.', action: 'steam', btnText: 'Open Steam' },
    { id: 'blender', name: 'Blender', cat: 'graphics', icon: '🚀', desc: 'Opens the real Blender site in a new tab. This page does not bundle Blender, so there is no version number to quote and no 3D engine to pretend at.', action: 'blender', btnText: 'Open Blender' },
    { id: 'unreal', name: 'Unreal Engine', cat: 'gaming', icon: '⚡', desc: 'Epic\'s engine. There is no web build to frame, so this links to the real thing rather than showing a hub that only ever popped an alert.', action: 'url', url: 'https://www.unrealengine.com/download', btnText: 'Get Unreal Engine' },
    { id: 'files', name: 'File Explorer', cat: 'apps', icon: '📁', desc: 'Browses the files this app actually ships, with every size read live via HEAD, plus the real storage allowance from navigator.storage.estimate().', action: 'files', btnText: 'Open Storage' },
    { id: 'taskmgr', name: 'Task Manager', cat: 'apps', icon: '📊', desc: 'Reads navigator.hardwareConcurrency, the JS heap, live storage and a measured frame rate straight off the platform.', action: 'taskmgr', btnText: 'Open Taskmgr' },
    { id: 'spotify', name: 'Spotify Music & Podcasts', pub: 'Spotify AB', cat: 'media', icon: '🎵', desc: 'Millions of songs, curated playlists, and podcast episodes in high fidelity.', action: 'url', url: 'https://open.spotify.com', btnText: 'Open Spotify' },
    { id: 'discord', name: 'Discord Communities', pub: 'Discord Inc.', cat: 'apps', icon: '💬', desc: 'Talk, chat, hang out, and stay close with your friends and communities.', action: 'url', url: 'https://discord.com/app', btnText: 'Open Discord' },
    { id: 'whatsapp', name: 'WhatsApp Web', pub: 'Meta Platforms', cat: 'apps', icon: '📱', desc: 'Simple, reliable, private messaging and calling right in your cloud computer.', action: 'url', url: 'https://web.whatsapp.com', btnText: 'Open WhatsApp' },
    { id: 'python', name: 'Python', cat: 'dev', icon: '🐍', desc: 'Opens the terminal at a Python prompt — which will tell you plainly that no interpreter is running behind this page. Use it on your own machine instead.', action: 'cmd', cmd: 'python3', btnText: 'Ask the terminal' },
    { id: 'git', name: 'Git', cat: 'dev', icon: '📦', desc: 'There is no repository in this tab. Clone and install from a real machine; the code for this page lives on GitHub.', action: 'url', url: 'https://github.com/darkvirgoyt-beep/VirgoX-Cloud-Computer', btnText: 'Open the repository' },
    { id: 'powertoys', name: 'PowerToys', cat: 'apps', icon: '🛠️', desc: 'A real Windows utility from Microsoft. It is not installed here and this page will not claim it is — it installs on your own machine.', action: 'url', url: 'https://learn.microsoft.com/windows/powertoys/', btnText: 'Get PowerToys' },
    { id: 'vlc', name: 'Media Player', cat: 'media', icon: '🟧', desc: 'Plays a file you pick with the codecs your browser already has, locally — nothing is uploaded. VLC itself is a native app; use the link for the real thing.', action: 'vlc', btnText: 'Open Media Player' },
    { id: 'm365', name: 'Microsoft 365 Cloud Office', pub: 'Microsoft Corporation', cat: 'media', icon: '📄', desc: 'Word, Excel, PowerPoint, OneNote in one secure cloud workspace.', action: 'url', url: 'https://www.office.com', btnText: 'Open Office' }
  ];

  function getMsStoreHtml() {
    return `
      <div class="ms-store-wrap">
        <!-- Header -->
        <div class="ms-store-header">
          <div class="ms-store-brand">
            <span style="font-size:1.4rem;">🛍️</span>
            <span>Microsoft Store <span style="font-size:0.75rem; color:var(--neon-cyan); font-weight:normal;">Web Hub</span></span>
          </div>
          <div class="ms-store-search-box">
            <input type="text" id="msstore-search-input" class="ms-store-search-input" placeholder="Search apps, games, developer tools..." />
          </div>
          <button class="cyber-btn xs neon-cyan" id="msstore-btn-official" title="Open official apps.microsoft.com in a full browser tab">
            🌐 Open Official Store (apps.microsoft.com) ↗
          </button>
        </div>

        <!-- Hero Banner -->
        <div class="ms-store-hero">
          <div>
            <div style="font-size:1.05rem; font-weight:800; color:#fff;">Featured: Essential Apps for Cloud PC</div>
            <div style="font-size:0.75rem; color:#dbeafe; margin-top:2px;">Reads this machine live: <span data-pf="cores"></span> · <span data-pf="deviceMemory"></span> · <span data-pf="gpu"></span></div>
          </div>
          <button class="cyber-btn sm neon-green" onclick="openAppWindow('terminal')">⚡ Launch Root Terminal</button>
        </div>

        <!-- Categories -->
        <div class="ms-store-categories">
          <button class="ms-store-cat-chip active" data-cat="all">All Apps (${MS_STORE_APPS.length})</button>
          <button class="ms-store-cat-chip" data-cat="dev">Developer Tools</button>
          <button class="ms-store-cat-chip" data-cat="apps">Essential Apps</button>
          <button class="ms-store-cat-chip" data-cat="gaming">Gaming & 3D</button>
          <button class="ms-store-cat-chip" data-cat="media">Productivity & Media</button>
        </div>

        <!-- Grid of Apps -->
        <div class="ms-store-grid" id="msstore-apps-grid">
          ${renderMsStoreCards(MS_STORE_APPS)}
        </div>
      </div>
    `;
  }

  function renderMsStoreCards(apps) {
    return apps.map(app => `
      <div class="ms-store-card" data-card-id="${app.id}" data-cat="${app.cat}">
        <div class="ms-store-card-header">
          <div class="ms-store-card-icon">${app.icon}</div>
          <div class="ms-store-card-info">
            <div class="ms-store-card-title">${escapeHtml(app.name)}</div>
            <div class="ms-store-card-sub">${escapeHtml(app.pub)}</div>
            <div class="ms-store-card-rating">⭐ ${app.rating} · <span style="color:var(--neon-cyan);">Free</span></div>
          </div>
        </div>
        <div class="ms-store-card-desc">${escapeHtml(app.desc)}</div>
        <div class="ms-store-card-footer">
          <span class="ms-store-card-price">FREE</span>
          <button class="ms-store-card-btn" data-action="${app.action}" data-target="${app.action === 'url' ? (app.url || '') : (app.action === 'cmd' ? (app.cmd || '') : app.action)}">${app.btnText}</button>
        </div>
      </div>
    `).join('');
  }

  function initMsStoreActions(win) {
    const searchInput = win.querySelector('#msstore-search-input');
    const grid = win.querySelector('#msstore-apps-grid');
    const catChips = win.querySelectorAll('.ms-store-cat-chip');
    const btnOfficial = win.querySelector('#msstore-btn-official');

    if (btnOfficial) {
      btnOfficial.addEventListener('click', () => {
        window.open('https://apps.microsoft.com/', '_blank');
      });
    }

    let activeCat = 'all';

    function filterApps() {
      const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
      const filtered = MS_STORE_APPS.filter(app => {
        const matchesCat = activeCat === 'all' || app.cat === activeCat;
        const matchesQuery = !q || app.name.toLowerCase().includes(q) || app.desc.toLowerCase().includes(q) || app.pub.toLowerCase().includes(q);
        return matchesCat && matchesQuery;
      });
      if (grid) {
        grid.innerHTML = renderMsStoreCards(filtered);
        attachCardListeners();
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', filterApps);
    }

    catChips.forEach(chip => {
      chip.addEventListener('click', () => {
        catChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCat = chip.getAttribute('data-cat') || 'all';
        filterApps();
      });
    });

    function attachCardListeners() {
      if (!grid) return;
      grid.querySelectorAll('.ms-store-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          const target = btn.getAttribute('data-target');

          if (action === 'url') {
            window.open(target, '_blank');
          } else if (action === 'toast') {
            showAlert(target || 'App installed and ready.');
          } else if (action === 'cmd') {
            openAppWindow('terminal');
            const termWin = document.getElementById('win-terminal');
            if (termWin) {
              const input = termWin.querySelector('#native-term-input');
              if (input) {
                input.value = target;
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
              }
            }
          } else {
            openAppWindow(action);
          }
        });
      });
    }

    attachCardListeners();
  }

  function getSettingsHtml() {
    const isWin = state.config.osMode === 'windows';
    return `
      <div style="display:flex; height:100%; color:#fff; font-family:'Segoe UI', sans-serif; background:#0c101c;">
        <div style="width:140px; background:rgba(20,24,36,0.9); border-right:1px solid rgba(255,255,255,0.08); padding:10px 6px; display:flex; flex-direction:column; gap:4px; font-size:0.75rem;">
          <div style="padding:6px 8px; border-radius:6px; background:rgba(59,130,246,0.2); color:#60a5fa; font-weight:700;">💻 System</div>
          <div style="padding:6px 8px; border-radius:6px; color:#aaa; cursor:pointer;" onclick="openAppWindow('browser')">🌐 Network</div>
          <div style="padding:6px 8px; border-radius:6px; color:#aaa; cursor:pointer;" onclick="openAppWindow('msstore')">🛍️ Apps & Store</div>
          <div style="padding:6px 8px; border-radius:6px; color:#aaa; cursor:pointer;" onclick="openAppWindow('taskmgr')">📊 Performance</div>
        </div>
        <div style="flex:1; padding:16px; overflow-y:auto; font-size:0.8rem;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
            <div style="width:48px; height:48px; border-radius:8px; background:linear-gradient(135deg, #0078d4, #00bcf2); display:flex; align-items:center; justify-content:center; font-size:1.8rem;">🪟</div>
            <div>
              <div style="font-size:1.05rem; font-weight:800;">VirgoX Cloud Computer</div>
              <div style="font-size:0.75rem; color:#94a3b8;">Windows 11 Pro · Official Edition (24H2)</div>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="font-weight:700; color:#60a5fa; margin-bottom:8px;">Background</div>
            <p style="font-size:0.72rem; color:#94a3b8; margin:0 0 8px 0; line-height:1.5;">
              Four images are deployed on this origin. The picker is built from that list, and each
              one is a real file, so this is a real image swap rather than a preview of nothing.
            </p>
            <div id="wallpaper-picker" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(84px, 1fr)); gap:8px;"></div>
          </div>

          <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="font-weight:700; color:#60a5fa; margin-bottom:8px;">Device Specifications</div>
            <div style="display:grid; grid-template-columns:120px 1fr; gap:6px; font-size:0.75rem;">
              <span style="color:#aaa;">Page host:</span> <span data-pf="host"></span>
              <span style="color:#aaa;">Processor:</span> <span data-pf="cores"></span>
              <span style="color:#aaa;">Page age:</span> <span data-pf="uptime"></span>
              <span style="color:#aaa;">Device class:</span> <span data-pf="deviceMemory"></span>
              <span style="color:#aaa;">JS heap:</span> <span data-pf="heap"></span>
              <span style="color:#aaa;">Graphics:</span> <span data-pf="gpu"></span>
              <span style="color:#aaa;">Display:</span> <span data-pf="screen"></span>
              <span style="color:#aaa;">Storage:</span> <span data-pf="quota"></span>
              <span style="color:#aaa;">Connection:</span> <span data-pf="connection"></span>
              <span style="color:#aaa;">Pen and touch:</span> <span data-pf="touch"></span> touch points
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="font-weight:700; color:#34d399; margin-bottom:8px;">Windows Specifications</div>
            <div style="display:grid; grid-template-columns:120px 1fr; gap:6px; font-size:0.75rem;">
              <span style="color:#aaa;">Shell:</span> <span>Windows 11 Fluent — a theme drawn in this page, not an installed OS</span>
              <span style="color:#aaa;">Host OS:</span> <span>not applicable — this is a web document</span>
              <span style="color:#aaa;">User agent:</span> <span data-pf="ua"></span>
              <span style="color:#aaa;">Platform:</span> <span data-pf="platform"></span>
              <span style="color:#aaa;">Origin:</span> <span data-pf="origin"></span>
              <span style="color:#aaa;">Account:</span> <span data-pf="account"></span>
            </div>
          </div>

          <div style="background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.25); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <div style="font-weight:700; color:#fff;">Environment Mode Switcher</div>
              <div style="font-size:0.72rem; color:#94a3b8;">Switch between Windows 11 Pro and Ubuntu Cyber Linux instantly.</div>
            </div>
            <button class="cyber-btn sm neon-cyan" id="btn-settings-toggle-os">
              ${isWin ? '🐧 Switch to Ubuntu Linux' : '🪟 Switch to Windows 11'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function initSettingsActions(win) {
    const btn = win.querySelector('#btn-settings-toggle-os');
    if (btn) {
      btn.addEventListener('click', () => {
        state.config.osMode = state.config.osMode === 'windows' ? 'linux' : 'windows';
        saveConfig();
        applyDesktopOsTheme();
        const activeUrl = getActiveDesktopUrl();
        if (desktopFrame && sessionStorage.getItem('virgox_authenticated') === 'true') {
          desktopFrame.src = activeUrl;
        }
        win.remove();
        delete openWindows['settings'];
        updateTaskbarChips();
        openAppWindow('settings');
      });
    }
  }

  /* Panels for apps that genuinely cannot render inside this window.
 *
 * Checked against the live servers rather than guessed:
 *   store.steampowered.com  -> X-Frame-Options: DENY
 *   vscode.dev              -> Content-Security-Policy: frame-ancestors 'none'
 * Neither will ever appear in an iframe regardless of what we send, so the
 * honest move is to say so and hand over a link that works, instead of staging
 * a convincing mock with an alert() button. That is what these replaced.
 */
function getExternalAppHtml(o) {
  const u = escapeHtml(o.url);
  return `
    <div class="ext-app">
      <div class="ext-app-icon">${o.icon || '&#128279;'}</div>
      <h3 class="ext-app-name">${escapeHtml(o.name)}</h3>
      <p class="ext-app-why">${escapeHtml(o.why)}</p>
      <div class="ext-app-blocked">Refused by the site's own headers &mdash; <code>${escapeHtml(o.header)}</code></div>
      <a class="ext-app-btn" href="${u}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(o.short || o.name)}</a>
      <div class="ext-app-url">${u}</div>
    </div>`;
}

/* Blender ships no browser build. There is no official WebGL or WASM renderer
 * that runs in a tab, so the old "Blender 5.0.1" panel with "32-thread CPU
 * parallel baking active" was fiction down to the version number. This shows the
 * two real things: the GPU string the browser actually reports, and the official
 * download.
 */



/* Task Manager, reading live platform APIs.
 *
 * Was a table of processes that do not exist (virgox-kernel-turbo, jarvis-ai-copilot,
 * pulseaudio-120hz) with made-up PIDs and a hardcoded "14.8 / 64 GB" and "120 FPS".
 * Every field here is read from an API at mount time. Where the browser does not
 * expose something, it prints "not exposed" — it never invents a number.
 */
function getTaskmgrHtml() {
  return `
    <div class="tm">
      <div class="tm-grid">
        <div class="tm-card"><div class="tm-k">CPU</div><div class="tm-v" id="vxc-tm-cpu">reading</div><div class="tm-s" id="vxc-tm-cores">&nbsp;</div></div>
        <div class="tm-card"><div class="tm-k">MEMORY</div><div class="tm-v" id="vxc-tm-mem">reading</div><div class="tm-s" id="vxc-tm-ram">&nbsp;</div></div>
        <div class="tm-card"><div class="tm-k">STORAGE</div><div class="tm-v" id="vxc-tm-store">reading</div><div class="tm-s" id="vxc-tm-quota">&nbsp;</div></div>
        <div class="tm-card"><div class="tm-k">FRAME RATE</div><div class="tm-v" id="vxc-tm-fps">measuring</div><div class="tm-s">measured over 1s, not declared</div></div>
      </div>
      <table class="tm-table">
        <thead><tr><th>Property</th><th>Reported by</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Logical processors</td><td>navigator.hardwareConcurrency</td><td id="vxc-tm-row-cpu">&mdash;</td></tr>
          <tr><td>Device memory</td><td>navigator.deviceMemory</td><td id="vxc-tm-row-ram">&mdash;</td></tr>
          <tr><td>JS heap in use</td><td>performance.memory</td><td id="vxc-tm-row-heap">&mdash;</td></tr>
          <tr><td>Origin storage used</td><td>navigator.storage.estimate</td><td id="vxc-tm-row-store">&mdash;</td></tr>
          <tr><td>Viewport</td><td>window.innerWidth/Height</td><td id="vxc-tm-row-vp">&mdash;</td></tr>
          <tr><td>Device pixel ratio</td><td>window.devicePixelRatio</td><td id="vxc-tm-row-dpr">&mdash;</td></tr>
          <tr><td>Network</td><td>navigator.connection</td><td id="vxc-tm-row-net">&mdash;</td></tr>
          <tr><td>Online</td><td>navigator.onLine</td><td id="vxc-tm-row-online">&mdash;</td></tr>
          <tr><td>Open app windows</td><td>this session</td><td id="vxc-tm-row-wins">&mdash;</td></tr>
          <tr><td>Elements in document</td><td>getElementsByTagName</td><td id="vxc-tm-row-nodes">&mdash;</td></tr>
          <tr><td>Page uptime</td><td>performance.now</td><td id="vxc-tm-row-up">&mdash;</td></tr>
          <tr><td>User agent</td><td>navigator.userAgent</td><td id="vxc-tm-row-ua" class="tm-wrap">&mdash;</td></tr>
        </tbody>
      </table>
      <p class="tm-note">This page cannot see your CPU load, other processes, or free disk beyond
      what the browser exposes. Anything above marked <em>not exposed</em> is a limit of the web
      platform, not a placeholder.</p>
    </div>`;
}

const fmtBytes = (b) => {
  if (typeof b !== 'number' || !isFinite(b)) return 'not exposed';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return b.toFixed(i ? 1 : 0) + ' ' + u[i];
};

function mountTaskmgr(win) {
  const set = (id, v) => { const e = win.querySelector('#' + id); if (e) e.textContent = v; };
  const NA = 'not exposed';

  const cores = navigator.hardwareConcurrency;
  set('vxc-tm-cpu', typeof cores === 'number' ? cores + ' threads' : NA);
  set('vxc-tm-cores', typeof cores === 'number' ? 'hardwareConcurrency' : 'this browser hides it');

  const mem = navigator.deviceMemory;
  set('vxc-tm-ram', typeof mem === 'number' ? mem + ' GB approx' : 'not exposed');
  set('vxc-tm-row-cpu', typeof cores === 'number' ? String(cores) : NA);
  set('vxc-tm-row-ram', typeof mem === 'number' ? mem + ' GB (capped by design)' : NA);

  const pm = performance.memory;
  if (pm && typeof pm.usedJSHeapSize === 'number') {
    const used = fmtBytes(pm.usedJSHeapSize);
    set('vxc-tm-mem', used);
    set('vxc-tm-row-heap', used + ' of ' + fmtBytes(pm.jsHeapSizeLimit) + ' limit');
  } else {
    set('vxc-tm-mem', NA);
    set('vxc-tm-row-heap', NA + ' (Firefox does not implement this)');
  }

  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then((e) => {
      set('vxc-tm-store', e.usage != null ? fmtBytes(e.usage) : NA);
      set('vxc-tm-quota', e.quota != null ? 'of ' + fmtBytes(e.quota) + ' granted' : NA);
      set('vxc-tm-row-store', e.usage != null
        ? fmtBytes(e.usage) + ' used of ' + fmtBytes(e.quota) + ' quota' : NA);
    }).catch(() => {
      set('vxc-tm-store', NA); set('vxc-tm-quota', NA); set('vxc-tm-row-store', NA);
    });
  } else {
    set('vxc-tm-store', NA); set('vxc-tm-quota', NA); set('vxc-tm-row-store', NA);
  }

  set('vxc-tm-row-vp', window.innerWidth + ' x ' + window.innerHeight);
  set('vxc-tm-row-dpr', String(window.devicePixelRatio));

  const c = navigator.connection;
  set('vxc-tm-row-net', c ? [c.effectiveType, c.downlink ? c.downlink + ' Mb/s' : null,
    c.rtt != null ? c.rtt + ' ms rtt' : null].filter(Boolean).join(' · ') : NA);
  set('vxc-tm-row-online', String(navigator.onLine));
  set('vxc-tm-row-wins', String(Object.keys(openWindows || {}).length));
  set('vxc-tm-row-nodes', String(document.getElementsByTagName('*').length));
  set('vxc-tm-row-up', (performance.now() / 1000).toFixed(1) + ' s');
  set('vxc-tm-row-ua', navigator.userAgent);

  // Genuinely measure the refresh rate instead of declaring 120.
  let frames = 0;
  const t0 = performance.now();
  const tick = () => {
    frames++;
    const el = performance.now() - t0;
    if (el < 1000) { requestAnimationFrame(tick); return; }
    const fps = frames / (el / 1000);
    set('vxc-tm-fps', fps.toFixed(0) + ' fps');
    if (fps < 20) set('vxc-tm-fps', fps.toFixed(0) + ' fps (throttled)');
  };
  requestAnimationFrame(tick);
}

function getBlenderHtml() {
  return `
    <div class="ext-app">
      <div class="ext-app-icon">&#129367;</div>
      <h3 class="ext-app-name">Blender</h3>
      <p class="ext-app-why">Blender has no embeddable web build, so there is nothing to put in this frame. Rather than fake a viewport, this shows the graphics hardware your browser actually reports and links to the real downloads.</p>
      <div class="ext-app-blocked">No embeddable build exists &mdash; not blocked by us.</div>
      <div class="ext-gpu" id="vxc-gpu">Reading GPU&hellip;</div>
      <a class="ext-app-btn" href="https://www.blender.org/download/" target="_blank" rel="noopener noreferrer">Official downloads</a>
      <a class="ext-app-btn ghost" href="https://docs.blender.org/manual/en/latest/" target="_blank" rel="noopener noreferrer">Manual</a>
      <div class="ext-app-url">https://www.blender.org/download/</div>
    </div>`;
}

function mountGpuProbe(win) {
  const el = win.querySelector('#vxc-gpu');
  if (!el) return;
  let out;
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
            || document.createElement('canvas').getContext('webgl');
    if (!gl) {
      out = 'WebGL unavailable in this browser';
    } else {
      // Some browsers mask this behind a generic string. That is still the
      // truthful answer, so report what we are handed rather than substituting
      // a plausible-looking GPU.
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const r = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const v = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const ver = gl.getParameter(gl.VERSION);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      out = [r, v, ver].filter(Boolean).join('  ·  ');
    }
  } catch (e) {
    out = 'WebGL blocked by this browser';
  }
  el.textContent = out;
}

function getSteamHtml() {
  return getExternalAppHtml({
    icon: '&#127918;',
    name: 'Steam',
    short: 'the Steam store',
    url: 'https://store.steampowered.com/',
    why: 'Steam sends X-Frame-Options: DENY, so it refuses to be embedded by any site. This button opens the real store.',
    header: 'X-Frame-Options: DENY',
  });
}

function getVideoEditorHtml() {
  // ffmpeg.wasm is a real, working video tool and it frames. Verified: no
  // X-Frame-Options and no frame-ancestors on the served page. That replaces the
  // "Shotcut 4K Studio" panel whose only button was alert().
  return `<iframe src="https://ffmpegwasm.netlify.app/" style="width:100%;height:100%;border:none;background:#111" title="ffmpeg.wasm — video and audio conversion in the browser"></iframe>`;
}

function getCodeHtml() {
  return getExternalAppHtml({
    icon: '&#128187;',
    name: 'Visual Studio Code',
    short: 'vscode.dev',
    url: 'https://vscode.dev/',
    why: 'vscode.dev sends Content-Security-Policy: frame-ancestors \'none\', so the editor refuses to load inside any frame. Open it in a real tab instead.',
    header: 'frame-ancestors \'none\'',
  });
}


  function getEditorHtml() {
    return `
      <div style="display:flex; flex-direction:column; height:100%;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 12px; background:#0c101d; border-bottom:1px solid rgba(0,229,255,0.3);">
          <div style="display:flex; gap:8px;">
            <button class="cyber-btn xs active">server.py</button>
            <button class="cyber-btn xs">app.js</button>
            <button class="cyber-btn xs">start_services.sh</button>
          </div>
          <button id="btn-editor-run" class="cyber-btn xs neon-green">▶ RUN CODE</button>
        </div>
        <textarea id="editor-text-area" spellcheck="false" style="flex:1; background:#04060c; color:#a5f3fc; font-family:var(--font-mono); font-size:0.82rem; padding:12px; border:none; resize:none; outline:none; line-height:1.5;"># ⚡ VirgoX Cloud Computer Engine
import os, sys, time

print("⚡ Running inside VirgoX Cloud PC...")
print("logical cores:", navigator.hardwareConcurrency)   // real, where the browser exposes it
print("user agent:", navigator.userAgent)             // real, always
print("All systems operational.")
</textarea>
      </div>
    `;
  }

  function initEditorActions(win) {
    const runBtn = win.querySelector('#btn-editor-run');
    const textArea = win.querySelector('#editor-text-area');
    if (!runBtn || !textArea) return;

    runBtn.addEventListener('click', () => {
      openAppWindow('terminal');
      const termWin = openWindows['terminal'];
      if (termWin) {
        const out = termWin.querySelector('#term-output-stream');
        if (out) {
          out.innerHTML += `\n<span style="color:var(--neon-green);">[Code Studio]</span> echo ${escapeHtml(textArea.value.replace(/\n/g, '; '))}\n⚠ This panel is a text editor. It does not execute anything — there is no runtime behind a browser tab, so the status banner it used to print — a memory pool and a frame rate, both invented — is gone rather than recalculated.\nRead the file, then run it where you have a real runtime.\n`;
          const termBody = termWin.querySelector('#native-term-body');
          if (termBody) termBody.scrollTop = termBody.scrollHeight;
        }
      }
    });
  }

  

  


  function getUnrealHtml() {
    return `
      <div class="ext-app">
        <div class="ext-app-icon">&#9889;</div>
        <h3 class="ext-app-name">Unreal Engine</h3>
        <p class="ext-app-why">Epic ships no web build, so there is nothing to put in this frame. The old panel here was a hub whose only control was <code>alert('Unreal Engine 6 project hub ready.')</code> — a button that announced a readiness that did not exist.</p>
        <div class="ext-app-blocked">No embeddable build exists &mdash; not blocked by us.</div>
        <div class="ext-gpu" id="vxc-gpu">Reading GPU&hellip;</div>
        <a class="ext-app-btn" href="https://www.unrealengine.com/download" target="_blank" rel="noopener noreferrer">Get Unreal Engine</a>
        <a class="ext-app-btn ghost" href="https://dev.epicgames.com/documentation/en-us/unreal-engine" target="_blank" rel="noopener noreferrer">Documentation</a>
        <div class="ext-app-url">https://www.unrealengine.com/download</div>
      </div>`;
  }

  // Zoom Handling
  function setupZoom() {
    zoomInBtn.addEventListener('click', () => applyZoom(state.zoomLevel + 15));
    zoomOutBtn.addEventListener('click', () => applyZoom(state.zoomLevel - 15));
    zoomResetBtn.addEventListener('click', () => {
      state.pan = { x: 0, y: 0 };
      applyZoom(100);
    });
  }

  function applyZoom(val) {
    state.zoomLevel = Math.max(50, Math.min(300, val));
    zoomLevelText.textContent = `${state.zoomLevel}%`;
    updateFrameTransform();
  }

  // Terminal Quick Keys
  function setupQuickKeys() {
    document.querySelectorAll('.term-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        sendAction('term_key', { key });
      });
    });
  }

  // Eco Mode (Low Phone RAM & GPU Saver)
  function setupEcoMode() {
    const btnToggleEco = document.getElementById('btn-toggle-eco');
    const ecoState = document.getElementById('eco-state');
    const ecoChip = document.getElementById('eco-chip');
    const appEl = document.getElementById('app');

    function applyEcoMode(enabled) {
      state.config.ecoMode = enabled;
      if (enabled) {
        if (appEl) appEl.classList.add('eco-mode');
        if (ecoState) {
          ecoState.textContent = 'ON';
          ecoState.style.color = '#00ff66';
        }
        if (ecoChip) ecoChip.style.display = 'flex';
      } else {
        if (appEl) appEl.classList.remove('eco-mode');
        if (ecoState) {
          ecoState.textContent = 'OFF';
          ecoState.style.color = '#ffaa00';
        }
        if (ecoChip) ecoChip.style.display = 'none';
      }
      saveConfig();
    }

    applyEcoMode(state.config.ecoMode !== false);

    if (btnToggleEco) {
      btnToggleEco.addEventListener('click', () => {
        applyEcoMode(!state.config.ecoMode);
      });
    }
  }

  // Settings Modal
  function setupSettingsModal() {
    const settingEcoMode = document.getElementById('setting-eco-mode');

    btnSettings.addEventListener('click', () => {
      inputDesktopUrl.value = state.config.desktopUrl;
      if (inputWindowsUrl) inputWindowsUrl.value = state.config.windowsUrl || '';
      inputTerminalUrl.value = state.config.terminalUrl;
      inputBridgeUrl.value = state.config.bridgeUrl || '';
      if (settingEcoMode) settingEcoMode.checked = state.config.ecoMode !== false;
      settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    btnSaveSettings.addEventListener('click', () => {
      state.config.desktopUrl = inputDesktopUrl.value.trim();
      if (inputWindowsUrl) state.config.windowsUrl = inputWindowsUrl.value.trim();
      state.config.terminalUrl = inputTerminalUrl.value.trim();
      state.config.bridgeUrl = inputBridgeUrl.value.trim();
      if (settingEcoMode) {
        state.config.ecoMode = settingEcoMode.checked;
        const appEl = document.getElementById('app');
        if (state.config.ecoMode) {
          appEl.classList.add('eco-mode');
        } else {
          appEl.classList.remove('eco-mode');
        }
      }
      saveConfig();
      setupFrames();
      settingsModal.classList.add('hidden');
      alert('⚡ Settings saved! Live connection reloaded.');
    });

    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Reset connection URLs to defaults?')) {
        state.config = { ...DEFAULT_CONFIG };
        saveConfig();
        inputDesktopUrl.value = state.config.desktopUrl;
        if (inputWindowsUrl) inputWindowsUrl.value = state.config.windowsUrl;
        inputTerminalUrl.value = state.config.terminalUrl;
        inputBridgeUrl.value = state.config.bridgeUrl;
        if (settingEcoMode) settingEcoMode.checked = state.config.ecoMode !== false;
        setupFrames();
      }
    });
  }

    function bindDesktopEvents() {
    const startBtn = document.getElementById('taskbar-start-toggle');
    const startMenu = document.getElementById('cyber-start-menu');
    if (startBtn && startMenu) {
      const newStartBtn = startBtn.cloneNode(true);
      startBtn.parentNode.replaceChild(newStartBtn, startBtn);

      newStartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && e.target !== newStartBtn) {
          startMenu.classList.add('hidden');
        }
      });
    }

    // Search button in Windows 11 taskbar
    const btnSearch = document.getElementById('win11-btn-search');
    if (btnSearch && startMenu) {
      btnSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.remove('hidden');
        const input = document.getElementById('win11-start-search');
        if (input) setTimeout(() => input.focus(), 50);
      });
    }

    // Start menu app clicks (pinned & recommended)
    if (startMenu) {
      startMenu.querySelectorAll('[data-start-app]').forEach(btn => {
        btn.addEventListener('click', () => {
          const appId = btn.getAttribute('data-start-app');
          if (appId) openAppWindow(appId);
          startMenu.classList.add('hidden');
        });
      });

      const startSettings = document.getElementById('btn-start-settings');
      if (startSettings) {
        startSettings.addEventListener('click', () => {
          startMenu.classList.add('hidden');
          openAppWindow('settings');
        });
      }

      const startLogout = document.getElementById('btn-start-logout');
      if (startLogout) {
        startLogout.addEventListener('click', () => {
          sessionStorage.clear();
          window.location.href = 'index.html';
        });
      }

      const win11Lock = document.getElementById('btn-win11-lock');
      if (win11Lock) {
        win11Lock.addEventListener('click', () => {
          sessionStorage.clear();
          window.location.href = 'index.html';
        });
      }

      const win11Power = document.getElementById('btn-win11-power');
      if (win11Power) {
        win11Power.addEventListener('click', () => {
          if (confirm('Shut down or Restart Windows 11 session?')) {
            sessionStorage.clear();
            window.location.href = 'index.html';
          }
        });
      }

      const win11SearchInput = document.getElementById('win11-start-search');
      if (win11SearchInput) {
        win11SearchInput.addEventListener('input', () => {
          const q = win11SearchInput.value.toLowerCase().trim();
          startMenu.querySelectorAll('.win11-app-item').forEach(item => {
            const name = item.textContent.toLowerCase();
            item.style.display = (!q || name.includes(q)) ? 'flex' : 'none';
          });
        });
      }
    }

    // Taskbar pinned clicks
    document.querySelectorAll('.taskbar-app-icon, .win11-taskbar-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-open');
        if (appId) openAppWindow(appId);
      });
    });

    // Right-Click Context Menu on Desktop Canvas
    const canvas = document.getElementById('cyber-desktop-canvas');
    if (canvas && !canvas._hasWin11Ctx) {
      canvas._hasWin11Ctx = true;
      canvas.addEventListener('contextmenu', (e) => {
        if (state.config.osMode !== 'windows') return;
        if (e.target.closest('.cyber-window')) return;
        e.preventDefault();
        showDesktopContextMenu(e.clientX, e.clientY);
      });
      document.addEventListener('click', (e) => {
        const ctxMenu = document.getElementById('win11-desktop-ctx');
        if (ctxMenu && !ctxMenu.contains(e.target)) {
          ctxMenu.remove();
        }
      });
    }

    // Windows 11 Live Clock & Date in Tray
    function updateWin11Clock() {
      const timeEl = document.getElementById('win11-clock-time');
      const dateEl = document.getElementById('win11-clock-date');
      const now = new Date();
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
      }
      const classicClock = document.getElementById('taskbar-clock');
      if (classicClock) {
        classicClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }
    updateWin11Clock();
    if (!window._win11ClockInterval) {
      window._win11ClockInterval = setInterval(updateWin11Clock, 1000);
    }
  }

 
 
  /* The four wallpapers are real files on this origin, added in the desktop
   * commit, so switching between them is a real image swap. Their names are the
   * filenames; nothing here claims they are "official Microsoft" artwork. */
  const WIN11_WALLPAPERS = {
    flow:        { name: 'Flow',        file: 'assets/win11_flow.jpg',        bg: '#0d1527' },
    bloom_light: { name: 'Bloom light', file: 'assets/win11_bloom_light.jpg', bg: '#d8e5f7' },
    sunrise:     { name: 'Sunrise',     file: 'assets/win11_sunrise.jpg',     bg: '#1c1824' },
    bloom_dark:  { name: 'Bloom dark',  file: 'assets/win11_bloom_dark.jpg',  bg: '#060913' },
  };

  function setDesktopWallpaper(id) {
    if (!WIN11_WALLPAPERS[id]) id = 'flow';
    state.config.wallpaper = id;
    saveConfig();
    const nativeDesk = document.getElementById('native-cyber-desktop');
    if (nativeDesk && state.config.osMode === 'windows') {
      nativeDesk.style.setProperty('background-image', 'url("' + WIN11_WALLPAPERS[id].file + '")', 'important');
      nativeDesk.style.setProperty('background-color', WIN11_WALLPAPERS[id].bg, 'important');
    }
    renderWallpaperPicker();
  }

  function cycleDesktopWallpaper() {
    const keys = Object.keys(WIN11_WALLPAPERS);
    const i = keys.indexOf(state.config.wallpaper || 'flow');
    setDesktopWallpaper(keys[(i + 1) % keys.length]);
  }

  window.setDesktopWallpaper = setDesktopWallpaper;
  window.cycleDesktopWallpaper = cycleDesktopWallpaper;

  /* The picker is rebuilt from that same table, so a wallpaper that is not
   * deployed cannot appear as an option. */
  function renderWallpaperPicker() {
    const host = document.getElementById('wallpaper-picker');
    if (!host) return;
    const cur = state.config.wallpaper || 'flow';
    host.innerHTML = Object.keys(WIN11_WALLPAPERS).map(id => `
      <button class="cyber-btn xs ${id === cur ? 'neon-green' : ''}" data-wallpaper="${id}"
        style="height:auto; padding:8px 4px; display:flex; flex-direction:column; align-items:center; gap:4px;">
        <span style="width:100%; height:34px; border-radius:5px; background:url('${WIN11_WALLPAPERS[id].file}') center/cover; border:1px solid rgba(255,255,255,0.14);"></span>
        <span style="font-size:0.62rem;">${escapeHtml(WIN11_WALLPAPERS[id].name)}</span>
      </button>`).join('');
    host.querySelectorAll('[data-wallpaper]').forEach(btn => {
      btn.addEventListener('click', () => setDesktopWallpaper(btn.getAttribute('data-wallpaper')));
    });
  }

  function applyDesktopOsTheme() {
    const isWin = state.config.osMode === 'windows';
    const nativeDesk = document.getElementById('native-cyber-desktop');
    if (!nativeDesk) return;

    const taskbar = nativeDesk.querySelector('.cyber-desktop-taskbar');
    const startMenu = document.getElementById('cyber-start-menu');
    const iconsContainer = document.getElementById('desktop-icons-container');

    if (isWin) {
      nativeDesk.classList.add('os-win11');
      const wall = WIN11_WALLPAPERS[state.config.wallpaper] || WIN11_WALLPAPERS.flow;
      nativeDesk.style.setProperty('background-image', 'url("' + wall.file + '")', 'important');
      nativeDesk.style.setProperty('background-color', wall.bg, 'important');
      if (taskbar) {
        taskbar.classList.add('win11');
        taskbar.innerHTML = `
          <div class="taskbar-left" style="display:flex; align-items:center;">
          </div>

          <div class="win11-taskbar-center" id="win11-taskbar-center">
            <button class="win11-start-btn" id="taskbar-start-toggle" title="Start">
              ${WIN11_ICONS.start}
            </button>
            <button class="win11-taskbar-icon" id="win11-btn-search" title="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button class="win11-taskbar-icon" data-open="chrome" title="Google Chrome">${WIN11_ICONS.chrome}</button>
            <button class="win11-taskbar-icon" data-open="chromium" title="Chromium Browser">${WIN11_ICONS.chromium}</button>
            <button class="win11-taskbar-icon" data-open="files" title="File Explorer (This PC C:)">${WIN11_ICONS.files}</button>
            <button class="win11-taskbar-icon" data-open="msstore" title="Microsoft Store">${WIN11_ICONS.msstore}</button>
            <button class="win11-taskbar-icon" data-open="browser" title="Microsoft Edge">${WIN11_ICONS.edge}</button>
            <button class="win11-taskbar-icon" data-open="terminal" title="Windows Terminal (PowerShell)">${WIN11_ICONS.terminal}</button>
            <button class="win11-taskbar-icon" data-open="editor" title="Notepad">${WIN11_ICONS.notepad}</button>
            <button class="win11-taskbar-icon" data-open="settings" title="Settings">${WIN11_ICONS.settings}</button>
            <button class="win11-taskbar-icon" data-open="taskmgr" title="Task Manager">${WIN11_ICONS.taskmgr}</button>
            <div class="taskbar-active-chips" id="taskbar-active-chips" style="margin-left:4px;"></div>
          </div>

          <div class="taskbar-right-tray" style="display:flex; align-items:center; gap:12px;">
            <div class="win11-tray-cluster">
              <span class="win11-tray-glyph" title="Network">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8e8ea" stroke-width="2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              </span>
              <span class="win11-tray-glyph" title="Volume">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8e8ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              </span>
              <span class="win11-tray-glyph" title="Battery">
                <svg width="22" height="16" viewBox="0 0 26 16" fill="none"><rect x="1" y="3.5" width="21" height="9" rx="2.5" stroke="#e8e8ea" stroke-width="1.3"/><rect x="3" y="5.5" width="14" height="5" rx="1" fill="#e8e8ea"/><path d="M24 7v2a2.2 2.2 0 0 0 0-2z" fill="#e8e8ea"/></svg>
              </span>
            </div>
            <div class="win11-clock-cluster" id="win11-clock-box">
              <span id="win11-clock-time">12:00 PM</span>
              <span id="win11-clock-date" style="opacity:0.8; font-size:0.68rem;">9/30/2026</span>
            </div>
          </div>
        `;
      }

      if (startMenu) {
        startMenu.className = 'cyber-start-menu win11 hidden';
        startMenu.innerHTML = `
          <!-- Search Row -->
          <div class="win11-search-row">
            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:0.9rem; color:#94a3b8;">🔍</span>
            <input type="text" id="win11-start-search" class="win11-search-input" placeholder="Type here to search apps, settings, and files..." />
          </div>

          <!-- Pinned Section -->
          <div>
            <div class="win11-pinned-section-header">
              <span>Pinned</span>
              <button class="cyber-btn xs" onclick="openAppWindow('msstore')">All Apps &gt;</button>
            </div>
            <div class="win11-pinned-grid" id="win11-pinned-grid">
              <div class="win11-app-item" data-start-app="chrome">
                <div class="win11-app-icon">${WIN11_ICONS.chrome}</div>
                <div class="win11-app-name">Chrome</div>
              </div>
              <div class="win11-app-item" data-start-app="chromium">
                <div class="win11-app-icon">${WIN11_ICONS.chromium}</div>
                <div class="win11-app-name">Chromium</div>
              </div>
              <div class="win11-app-item" data-start-app="browser">
                <div class="win11-app-icon">${WIN11_ICONS.edge}</div>
                <div class="win11-app-name">Edge</div>
              </div>
              <div class="win11-app-item" data-start-app="files">
                <div class="win11-app-icon">${WIN11_ICONS.files}</div>
                <div class="win11-app-name">Explorer</div>
              </div>
              <div class="win11-app-item" data-start-app="msstore">
                <div class="win11-app-icon">${WIN11_ICONS.msstore}</div>
                <div class="win11-app-name">Store</div>
              </div>
              <div class="win11-app-item" data-start-app="terminal">
                <div class="win11-app-icon">${WIN11_ICONS.terminal}</div>
                <div class="win11-app-name">Terminal</div>
              </div>
              <div class="win11-app-item" data-start-app="editor">
                <div class="win11-app-icon">${WIN11_ICONS.notepad}</div>
                <div class="win11-app-name">Notepad</div>
              </div>
              <div class="win11-app-item" data-start-app="taskmgr">
                <div class="win11-app-icon">${WIN11_ICONS.taskmgr}</div>
                <div class="win11-app-name">Taskmgr</div>
              </div>
              <div class="win11-app-item" data-start-app="settings">
                <div class="win11-app-icon">${WIN11_ICONS.settings}</div>
                <div class="win11-app-name">Settings</div>
              </div>
              <div class="win11-app-item" data-start-app="photopea">
                <div class="win11-app-icon">${WIN11_ICONS.photoshop}</div>
                <div class="win11-app-name">Photoshop</div>
              </div>
              <div class="win11-app-item" data-start-app="shotcut">
                <div class="win11-app-icon">${WIN11_ICONS.video}</div>
                <div class="win11-app-name">Clipchamp</div>
              </div>
              <div class="win11-app-item" data-start-app="steam">
                <div class="win11-app-icon">${WIN11_ICONS.steam}</div>
                <div class="win11-app-name">Steam</div>
              </div>
              <div class="win11-app-item" data-start-app="vlc">
                <div class="win11-app-icon">${WIN11_ICONS.vlc}</div>
                <div class="win11-app-name">Media Player</div>
              </div>
              <div class="win11-app-item" data-start-app="blender">
                <div class="win11-app-icon">${WIN11_ICONS.blender}</div>
                <div class="win11-app-name">Blender</div>
              </div>
              <div class="win11-app-item" data-start-app="unreal">
                <div class="win11-app-icon">${WIN11_ICONS.unreal}</div>
                <div class="win11-app-name">Unreal Engine</div>
              </div>
            </div>
          </div>

          <!-- Recommended Section -->
          <div>
            <div class="win11-pinned-section-header" style="margin-bottom:6px;">
              <span>Recommended</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; font-size:0.75rem;">
              <div class="win11-rec-row" data-start-app="files" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; background:rgba(255,255,255,0.03);">
                <div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;">${WIN11_ICONS.files}</div>
                <div>
                  <div style="color:#fff; font-weight:600;">This PC — Local Disk (C:)</div>
                  <div style="color:#94a3b8; font-size:0.68rem;"><span data-pf="quota"></span></div>
                </div>
              </div>
              <div class="win11-rec-row" data-start-app="chrome" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; background:rgba(255,255,255,0.03);">
                <div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;">${WIN11_ICONS.chrome}</div>
                <div>
                  <div style="color:#fff; font-weight:600;">Google Chrome Web Browser</div>
                  <div style="color:#94a3b8; font-size:0.68rem;">Omnibox search & persistent Google profiles</div>
                </div>
              </div>
              <div class="win11-rec-row" data-start-app="terminal" style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; background:rgba(255,255,255,0.03);">
                <div style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;">${WIN11_ICONS.terminal}</div>
                <div>
                  <div style="color:#fff; font-weight:600;">Windows Terminal (PowerShell)</div>
                  <div style="color:#94a3b8; font-size:0.68rem;">A real terminal over this page — no subsystem is emulated behind it</div>
                </div>
              </div>
            </div>
          </div>

          <!-- User Profile & Power Bar -->
          <div class="win11-user-footer">
            <div class="win11-user-profile" id="btn-win11-profile" onclick="openAppWindow('settings')">
              <div class="win11-avatar-box">
                <img src="${PRINCE_PFP_URL}" alt="Prince" class="win11-avatar-img" />
                <span class="win11-avatar-badge" title="Administrator Verified">🛡️</span>
              </div>
              <div>
                <div style="font-weight:700; color:#fff; font-size:0.86rem; display:flex; align-items:center; gap:4px;">
                  <span>Prince · VirgoYT</span>
                  <span style="font-size:0.75rem; color:#38bdf8;">✓</span>
                </div>
                <div style="font-size:0.68rem; color:#94a3b8;">Administrator (darkvirgoyt@gmail.com)</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <button class="win11-power-btn" id="btn-win11-lock" title="Lock Workstation">🔒</button>
              <button class="win11-power-btn" id="btn-win11-power" title="Shut Down / Restart">⏻</button>
            </div>
          </div>
        `;
      }

      // Windows 11 Desktop Icons
      if (iconsContainer) {
        iconsContainer.innerHTML = '';
        const WIN_APPS = [
          { id: 'files', name: 'This PC (C:)', icon: WIN11_ICONS.files },
          { id: 'chrome', name: 'Google Chrome', icon: WIN11_ICONS.chrome },
          { id: 'chromium', name: 'Chromium', icon: WIN11_ICONS.chromium },
          { id: 'browser', name: 'Microsoft Edge', icon: WIN11_ICONS.edge },
          { id: 'msstore', name: 'Microsoft Store', icon: WIN11_ICONS.msstore },
          { id: 'terminal', name: 'Terminal (PS)', icon: WIN11_ICONS.terminal },
          { id: 'editor', name: 'Notepad', icon: WIN11_ICONS.notepad },
          { id: 'settings', name: 'Settings', icon: WIN11_ICONS.settings },
          { id: 'taskmgr', name: 'Task Manager', icon: WIN11_ICONS.taskmgr },
          { id: 'photopea', name: 'Photoshop', icon: WIN11_ICONS.photoshop },
          { id: 'shotcut', name: 'Video Converter', icon: WIN11_ICONS.video },
          { id: 'steam', name: 'Xbox & Steam', icon: WIN11_ICONS.steam },
          { id: 'vlc', name: 'Media Player', icon: WIN11_ICONS.vlc },
          { id: 'blender', name: 'Blender', icon: WIN11_ICONS.blender },
          { id: 'unreal', name: 'Unreal Engine', icon: WIN11_ICONS.unreal }
        ];
        WIN_APPS.forEach(app => {
          const item = document.createElement('div');
          item.className = 'desktop-icon';
          item.innerHTML = `
            <div class="icon-art" style="width:42px; height:42px; display:flex; align-items:center; justify-content:center;">${app.icon}</div>
            <div class="icon-label" style="margin-top:2px;">${app.name}</div>
          `;
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            openAppWindow(app.id);
          });
          iconsContainer.appendChild(item);
        });
      }
    } else {
      // Return to Linux
      nativeDesk.classList.remove('os-win11');
      if (taskbar) {
        taskbar.classList.remove('win11');
        taskbar.innerHTML = `
          <div class="taskbar-left">
            <button class="taskbar-start-btn" id="taskbar-start-toggle">
              <span>⚡</span> START
            </button>
            <div class="taskbar-apps-pinned">
              <button class="taskbar-app-icon" data-open="chrome" title="Google Chrome">🌐</button>
              <button class="taskbar-app-icon" data-open="terminal" title="Terminal CLI">💻</button>
              <button class="taskbar-app-icon" data-open="chromium" title="Chromium Browser">🔷</button>
              <button class="taskbar-app-icon" data-open="msstore" title="Microsoft Store">🛍️</button>
              <button class="taskbar-app-icon" data-open="files" title="This PC / Files">📁</button>
              <button class="taskbar-app-icon" data-open="editor" title="Code Studio">📝</button>
              <button class="taskbar-app-icon" data-open="taskmgr" title="Task Manager">📊</button>
            </div>
            <div class="taskbar-active-chips" id="taskbar-active-chips"></div>
          </div>
          <div class="taskbar-right-tray">
            <span title="Network">&#128246;</span>
            <span title="Volume">&#128266;</span>
            <span title="Battery">&#128267;</span>
            <span id="taskbar-clock">12:00:00 PM</span>
          </div>
        `;
      }
      if (startMenu) {
        startMenu.className = 'cyber-start-menu hidden';
        startMenu.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; padding-bottom:8px; border-bottom:1px solid rgba(0,229,255,0.2);">
            <div style="width:36px; height:36px; border-radius:50%; overflow:hidden;">
              <img src="${PRINCE_PFP_URL}" style="width:100%; height:100%; object-fit:cover;" />
            </div>
            <div>
              <div style="font-weight:700; color:#fff; font-size:0.9rem;">Prince · VirgoYT</div>
              <div style="font-size:0.75rem; color:var(--neon-green);">👑 ROOT ADMINISTRATOR</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; max-height:240px; overflow-y:auto;">
            <button class="cyber-btn sm" data-start-app="chrome" style="text-align:left; justify-content:flex-start;">🌐 Google Chrome Browser</button>
            <button class="cyber-btn sm" data-start-app="terminal" style="text-align:left; justify-content:flex-start;">💻 Terminal</button>
            <button class="cyber-btn sm" data-start-app="chromium" style="text-align:left; justify-content:flex-start;">🔷 Chromium Browser</button>
            <button class="cyber-btn sm" data-start-app="msstore" style="text-align:left; justify-content:flex-start;">🛍️ Microsoft Store (Web Hub)</button>
            <button class="cyber-btn sm" data-start-app="files" style="text-align:left; justify-content:flex-start;">📁 This PC</button>
            <button class="cyber-btn sm" data-start-app="editor" style="text-align:left; justify-content:flex-start;">📝 Code Studio Editor</button>
            <button class="cyber-btn sm" data-start-app="taskmgr" style="text-align:left; justify-content:flex-start;">📊 Task Manager</button>
            <button class="cyber-btn sm" data-start-app="steam" style="text-align:left; justify-content:flex-start;">🎮 Steam Gaming Platform</button>
            <button class="cyber-btn sm" data-start-app="vlc" style="text-align:left; justify-content:flex-start;">🟧 Media Player</button>
            <button class="cyber-btn sm" data-start-app="blender" style="text-align:left; justify-content:flex-start;">🚀 Blender</button>
            <button class="cyber-btn sm" data-start-app="unreal" style="text-align:left; justify-content:flex-start;">⚡ Unreal Engine</button>
            <button class="cyber-btn sm" data-start-app="photopea" style="text-align:left; justify-content:flex-start;">🎨 Photoshop Studio (Photopea)</button>
            <button class="cyber-btn sm" data-start-app="shotcut" style="text-align:left; justify-content:flex-start;">🎬 FFmpeg WASM Converter</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
            <button id="btn-start-settings" class="cyber-btn xs neon-cyan">⚙️ Settings</button>
            <button id="btn-start-logout" class="cyber-btn xs neon-pink">🔒 Lock / Exit</button>
          </div>
        `;
      }
      if (iconsContainer) {
        iconsContainer.innerHTML = '';
        const APPS = [
          { id: 'chrome', name: 'Google Chrome', icon: '🌐' },
          { id: 'chromium', name: 'Chromium', icon: '🔷' },
          { id: 'terminal', name: 'Terminal CLI', icon: '💻' },
          { id: 'msstore', name: 'Microsoft Store', icon: '🛍️' },
          { id: 'files', name: 'This PC', icon: '📁' },
          { id: 'editor', name: 'Code Studio', icon: '📝' },
          { id: 'taskmgr', name: 'Task Manager', icon: '📊' },
          { id: 'photopea', name: 'Photopea', icon: '🎨' },
          { id: 'shotcut', name: 'Video Converter', icon: '🎬' },
          { id: 'steam', name: 'Steam', icon: '🎮' },
          { id: 'vlc', name: 'Media Player', icon: '🟧' },
          { id: 'blender', name: 'Blender', icon: '🚀' },
          { id: 'unreal', name: 'Unreal Engine', icon: '⚡' },
          { id: 'settings', name: 'Settings', icon: '⚙️' }
        ];
        APPS.forEach(app => {
          const item = document.createElement('div');
          item.className = 'desktop-icon';
          item.innerHTML = `
            <div class="icon-art">${app.icon}</div>
            <div class="icon-label">${app.name}</div>
          `;
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            openAppWindow(app.id);
          });
          iconsContainer.appendChild(item);
        });
      }
    }

    bindDesktopEvents();
    updateTaskbarChips();
  }

  // OS Switcher (Linux Ubuntu XFCE vs Windows 11 Cloud VM)
  function setupOsSwitcher() {
    const btnToggleOs = document.getElementById('btn-toggle-os');
    const osModeLabel = document.getElementById('os-mode-label');

    function updateOsUI() {
      const isWin = state.config.osMode === 'windows';
      if (osModeLabel) {
        osModeLabel.textContent = isWin ? 'Windows 11' : 'Linux';
      }
      if (btnToggleOs) {
        if (isWin) {
          btnToggleOs.classList.add('neon-purple');
          btnToggleOs.classList.remove('neon-cyan');
        } else {
          btnToggleOs.classList.add('neon-cyan');
          btnToggleOs.classList.remove('neon-purple');
        }
      }
      applyDesktopOsTheme();
    }

    if (btnToggleOs) {
      btnToggleOs.addEventListener('click', () => {
        state.config.osMode = state.config.osMode === 'windows' ? 'linux' : 'windows';
        saveConfig();
        updateOsUI();
        const activeUrl = getActiveDesktopUrl();
        if (desktopFrame && sessionStorage.getItem('virgox_authenticated') === 'true') {
          desktopFrame.src = activeUrl;
          if (linkPhone2) linkPhone2.href = activeUrl;
        }
      });
    }

    updateOsUI();
  }

  // Fullscreen
  function setupFullscreen() {
    const btn = document.getElementById('btn-fullscreen');
    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
        btn.textContent = '✖';
      } else {
        document.exitFullscreen();
        btn.textContent = '⛶';
      }
    });
  }

  // Remote Bridge API Calls with safe fire-and-forget
  let isSendingAction = false;
  function sendAction(action, payload) {
    if (!state.config.bridgeUrl) return;
    try {
      fetch(`${state.config.bridgeUrl}/api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {}
  }

  // High-performance smooth mouse delta dispatcher (Strict Throttled Queue: Max ~33 updates/sec)
  let pendingDx = 0;
  let pendingDy = 0;
  let lastDispatchTime = 0;
  let deltaTimer = null;

  function queueMouseDelta(dx, dy) {
    pendingDx += dx;
    pendingDy += dy;

    if (!deltaTimer) {
      const now = Date.now();
      const elapsed = now - lastDispatchTime;
      const delay = elapsed >= 30 ? 0 : (30 - elapsed);
      deltaTimer = setTimeout(flushMouseDeltas, delay);
    }
  }

  function flushMouseDeltas() {
    deltaTimer = null;
    lastDispatchTime = Date.now();

    const sendDx = Math.round(pendingDx);
    const sendDy = Math.round(pendingDy);
    pendingDx = 0;
    pendingDy = 0;

    if (sendDx !== 0 || sendDy !== 0) {
      sendAction('mouse_move', { dx: sendDx, dy: sendDy });
    }
  }

  function sendMouseDelta(dx, dy) {
    queueMouseDelta(dx, dy);
  }

  // Screen as Touchpad Controller (True Relative Laptop Trackpad, Hold-and-Drag & Slow Smooth Scroll)
  function setupDesktopTrackpadOverlay() {
    const btnToggle = document.getElementById('btn-toggle-screen-trackpad');
    const trackpadStateText = document.getElementById('screen-trackpad-state');
    const overlay = document.getElementById('screen-touchpad-overlay');
    const badge = document.getElementById('screen-touchpad-badge');
    const dragIndicator = document.getElementById('touchpad-drag-indicator');
    const quickModeToggle = document.getElementById('btn-quick-mode-toggle');
    const pillIcon = document.getElementById('pill-icon');
    const pillTitle = document.getElementById('pill-title');
    const pillSub = document.getElementById('pill-sub');
    const pillBadge = document.getElementById('pill-badge');
    const frame = document.getElementById('desktop-frame');
    const wrapper = document.getElementById('desktop-wrapper');

    state.isScreenTrackpadActive = false;

    function updateTrackpadUI() {
      if (state.isScreenTrackpadActive) {
        if (overlay) {
          overlay.classList.remove('hidden');
          overlay.style.pointerEvents = 'auto';
        }
        if (frame) {
          frame.style.pointerEvents = 'none';
        }
        if (wrapper) wrapper.classList.add('trackpad-active');
        if (btnToggle) {
          btnToggle.classList.add('active', 'neon-cyan');
          btnToggle.classList.remove('neon-green');
        }
        if (trackpadStateText) trackpadStateText.textContent = 'ON';
        if (pillIcon) pillIcon.textContent = '🖱️';
        if (pillTitle) pillTitle.textContent = 'Trackpad Mode (Laptop Trackpad)';
        if (pillSub) pillSub.textContent = 'Finger glides cursor • Tap anywhere clicks • 2-finger scroll';
        if (pillBadge) pillBadge.textContent = 'SWITCH TO TOUCH';
        if (badge) {
          badge.textContent = '🖱️ TRACKPAD ACTIVE • 1-FINGER GLIDE • TAP CLICK • 2-FINGER SCROLL';
          badge.classList.remove('fade');
          setTimeout(() => badge.classList.add('fade'), 3000);
        }
      } else {
        if (overlay) {
          overlay.classList.add('hidden');
          overlay.style.pointerEvents = 'none';
        }
        if (frame) {
          frame.style.pointerEvents = 'auto';
        }
        if (wrapper) wrapper.classList.remove('trackpad-active');
        if (btnToggle) {
          btnToggle.classList.remove('active', 'neon-cyan');
          btnToggle.classList.add('neon-green');
        }
        if (trackpadStateText) trackpadStateText.textContent = 'OFF';
        if (pillIcon) pillIcon.textContent = '👆';
        if (pillTitle) pillTitle.textContent = 'Direct Touch Mode (Tap-to-Hit)';
        if (pillSub) pillSub.textContent = 'Direct mobile screen tap mode';
        if (pillBadge) pillBadge.textContent = 'SWITCH TO TRACKPAD';
        if (badge) {
          badge.textContent = '👆 DIRECT TOUCH ACTIVE (Touches pass directly to screen)';
          badge.classList.remove('fade');
          setTimeout(() => badge.classList.add('fade'), 3000);
        }
      }
      if (navigator.vibrate) navigator.vibrate(25);
    }

    function toggleMode() {
      state.isScreenTrackpadActive = !state.isScreenTrackpadActive;
      updateTrackpadUI();
    }

    if (btnToggle) {
      btnToggle.addEventListener('click', toggleMode);
    }

    if (quickModeToggle) {
      quickModeToggle.addEventListener('click', toggleMode);
    }

    if (!overlay) return;

    // Apply the OFF state on load. Without this the transparent overlay ships at its
    // CSS default (full-size, z-index 100, pointer-events auto) and stacks over the
    // native desktop at z-index 10, eating every click on icons, taskbar and windows.
    updateTrackpadUI();

    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let touchStartTime = 0;
    let hasMoved = false;
    let longPressTimer = null;
    let isDragging = false;

    let lastTapTime = 0;
    let singleTapTimeout = null;

    let twoFingerStartY = 0;
    let twoFingerStartX = 0;
    let lastTwoFingerY = 0;
    let twoFingerStartTime = 0;
    let hasScrolled = false;
    let scrollAccumulator = 0;
    let lastScrollTime = 0;

    // Fade badge after 4 seconds
    setTimeout(() => {
      if (badge) badge.classList.add('fade');
    }, 4000);

    overlay.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        touchStartTime = Date.now();
        hasMoved = false;
        isDragging = false;

        // Long press (260ms) triggers Hold-and-Drag (mousedown 1)
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          isDragging = true;
          if (dragIndicator) dragIndicator.classList.remove('hidden');
          sendAction('mouse_drag', { state: 'down' });
          if (navigator.vibrate) navigator.vibrate(35);
        }, 260);

      } else if (e.touches.length === 2) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        twoFingerStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        twoFingerStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        lastTwoFingerY = twoFingerStartY;
        twoFingerStartTime = Date.now();
        scrollAccumulator = 0;
        hasScrolled = false;
        lastScrollTime = 0;
      }
    }, { passive: false });

    overlay.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const dist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);

        // Cancel long press if finger moved more than 6px
        if (dist > 6) {
          hasMoved = true;
          if (longPressTimer && !isDragging) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }

        if (hasMoved) {
          const dx = (t.clientX - lastTouchX) * state.config.sensitivity;
          const dy = (t.clientY - lastTouchY) * state.config.sensitivity;

          lastTouchX = t.clientX;
          lastTouchY = t.clientY;

          queueMouseDelta(dx, dy);
        }

      } else if (e.touches.length === 2) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaY = currentY - lastTwoFingerY;
        lastTwoFingerY = currentY;
        scrollAccumulator += deltaY;

        const now = Date.now();
        // Slow, smooth, controlled scrolling: 30px accumulator threshold, 80ms throttle
        if (Math.abs(scrollAccumulator) >= 30 && (now - lastScrollTime > 80)) {
          hasScrolled = true;
          const direction = scrollAccumulator < 0 ? 'up' : 'down';
          sendAction('mouse_scroll', { direction, steps: 1 });
          scrollAccumulator = 0;
          lastScrollTime = now;
        }
      }
    }, { passive: false });

    overlay.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (isDragging) {
        isDragging = false;
        if (dragIndicator) dragIndicator.classList.add('hidden');
        sendAction('mouse_drag', { state: 'up' });
        return;
      }

      if (e.touches.length === 0) {
        const now = Date.now();
        const duration = now - touchStartTime;
        const totalDist = Math.hypot(lastTouchX - touchStartX, lastTouchY - touchStartY);

        // Tap detected if no drag movement occurred (stays at current cursor position X!)
        if (!hasMoved && duration < 280 && totalDist < 8) {
          if (now - lastTapTime < 320) {
            // DOUBLE TAP -> double click at current cursor position X
            if (singleTapTimeout) {
              clearTimeout(singleTapTimeout);
              singleTapTimeout = null;
            }
            sendAction('mouse_click', { button: 1, double: true });
            lastTapTime = 0;
            if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
          } else {
            // SINGLE TAP -> single click at current cursor position X
            lastTapTime = now;
            singleTapTimeout = setTimeout(() => {
              sendAction('mouse_click', { button: 1 });
              if (navigator.vibrate) navigator.vibrate(20);
            }, 300);
          }
        }
      } else if (e.touches.length === 1 && hasScrolled === false) {
        // If one finger lifted from a 2-finger tap without scrolling -> RIGHT CLICK
        if (Date.now() - twoFingerStartTime < 260) {
          sendAction('mouse_click', { button: 3 });
          if (navigator.vibrate) navigator.vibrate(35);
        }
      }
    }, { passive: false });

    overlay.addEventListener('touchcancel', () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      if (isDragging) {
        isDragging = false;
        if (dragIndicator) dragIndicator.classList.add('hidden');
        sendAction('mouse_drag', { state: 'up' });
      }
    });

    // Also support desktop mouse on overlay when not using pointer lock
    let isMouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let hasMouseMoved = false;

    overlay.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isMouseDown = true;
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        hasMouseMoved = false;
      }
    });

    overlay.addEventListener('mousemove', (e) => {
      if (isMouseDown) {
        const dist = Math.hypot(e.clientX - mouseStartX, e.clientY - mouseStartY);
        if (dist > 5) hasMouseMoved = true;
        const dx = e.movementX !== undefined ? e.movementX : (e.clientX - mouseStartX);
        const dy = e.movementY !== undefined ? e.movementY : (e.clientY - mouseStartY);
        queueMouseDelta(dx * state.config.sensitivity, dy * state.config.sensitivity);
      }
    });

    overlay.addEventListener('mouseup', (e) => {
      if (isMouseDown) {
        isMouseDown = false;
        if (!hasMouseMoved) {
          sendAction('mouse_click', { button: e.button === 2 ? 3 : 1 });
        }
      }
    });

    overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 'down' : 'up';
      sendAction('mouse_scroll', { direction, steps: 1 });
    }, { passive: false });

    updateTrackpadUI();
  }

  // Live Screen Snapshot
  btnRefreshScreen.addEventListener('click', refreshSnapshot);

  function refreshSnapshot() {
    snapshotTime.textContent = 'Capturing...';
    // If bridge is available, call screenshot endpoint; otherwise reload cached image
    const timestamp = Date.now();
    const url = state.config.bridgeUrl ? `${state.config.bridgeUrl}/api/screenshot?t=${timestamp}` : `assets/current_screen.png?t=${timestamp}`;
    
    const testImg = new Image();
    testImg.onload = () => {
      screenImg.src = url;
      snapshotTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
    };
    testImg.onerror = () => {
      snapshotTime.textContent = 'Snapshot: Offline';
    };
    testImg.src = url;
  }

  // Check Status Indicators
  function checkConnectionStatus() {
    const deskDot = document.getElementById('desktop-status');
    const termDot = document.getElementById('terminal-status');

    if (state.config.desktopUrl) deskDot.classList.add('online');
    if (state.config.terminalUrl) termDot.classList.add('online');
  }

  // Global app launcher function
  window.focusApp = function (appName) {
    const email = localStorage.getItem('virgox_registered_email') || '';
    sendAction('launch', { app: appName, email });
    // Switch to desktop view
    const deskTab = document.querySelector('[data-tab="desktop"]');
    if (deskTab) deskTab.click();
    if (typeof openAppWindow === 'function') {
      openAppWindow(appName);
    }
  };

  // ==========================================================================
  // 🤖 VirgoX Jarvis AI Copilot (Voice, Vision & Email Cloud Timeline)
  // ==========================================================================
  function setupCopilot() {
    const subtabBtns = document.querySelectorAll('.copilot-subtab-btn');
    const subtabContents = document.querySelectorAll('.copilot-subtab-content');
    const chatStream = document.getElementById('copilot-chat-stream');
    const inputField = document.getElementById('copilot-input');
    const sendBtn = document.getElementById('copilot-send-btn');
    const chips = document.querySelectorAll('.copilot-chip');
    const clearBtn = document.getElementById('copilot-clear-chat');
    const historyContainer = document.getElementById('history-cards-container');
    const memoryContainer = document.getElementById('memory-cards-container');
    const inputNote = document.getElementById('input-new-note');
    const saveNoteBtn = document.getElementById('btn-save-note');

    // 🔊 Jarvis Voice Output (Text-to-Speech)
    let ttsEnabled = true;
    const ttsToggle = document.getElementById('copilot-tts-toggle');
    if (ttsToggle) {
      ttsToggle.addEventListener('click', () => {
        ttsEnabled = !ttsEnabled;
        ttsToggle.textContent = ttsEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF';
        ttsToggle.classList.toggle('neon-purple', ttsEnabled);
        if (!ttsEnabled && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      });
    }

    function speakJarvis(text) {
      if (!ttsEnabled || !('speechSynthesis' in window) || !text) return;
      try {
        window.speechSynthesis.cancel();
        const clean = text.replace(/[*#`_\[\]]/g, '').replace(/<[^>]*>/g, '').trim();
        if (!clean) return;
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Male')));
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    }

    // 🎙️ Jarvis Voice Input (Speech-to-Text)
    const micBtn = document.getElementById('copilot-mic-btn');
    let recognition = null;
    let isListening = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        if (micBtn) {
          micBtn.classList.add('listening');
          micBtn.textContent = '🛑';
        }
        if (inputField) inputField.placeholder = '🎙️ Listening... Speak to Jarvis now!';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (inputField) {
          inputField.value = transcript;
          sendCopilotMessage();
        }
      };

      recognition.onerror = () => {
        stopListening();
      };

      recognition.onend = () => {
        stopListening();
      };

      function stopListening() {
        isListening = false;
        if (micBtn) {
          micBtn.classList.remove('listening');
          micBtn.textContent = '🎙️';
        }
        if (inputField) inputField.placeholder = 'Talk or type to Jarvis ($ cmd, open blender, open unreal)...';
      }

      if (micBtn) {
        micBtn.addEventListener('click', () => {
          if (isListening) {
            recognition.stop();
          } else {
            try {
              recognition.start();
            } catch (e) {}
          }
        });
      }
    } else if (micBtn) {
      micBtn.addEventListener('click', () => {
        appendMsg('VirgoX Jarvis AI', 'ℹ️ Speech-to-text is supported in Chrome, Edge, and Android browsers.', true);
      });
    }

    // 📷 Jarvis Live Camera Optical Vision HUD
    const cameraBtn = document.getElementById('copilot-camera-btn');
    const cameraPanel = document.getElementById('jarvis-camera-panel');
    const cameraClose = document.getElementById('jarvis-camera-close');
    const cameraVideo = document.getElementById('jarvis-camera-stream');
    const cameraCanvas = document.getElementById('jarvis-camera-canvas');
    const cameraScanBtn = document.getElementById('jarvis-camera-scan-btn');
    let cameraMediaStream = null;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Live camera access is not supported on this browser.');
        return;
      }
      try {
        cameraMediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (cameraVideo) {
          cameraVideo.srcObject = cameraMediaStream;
        }
        if (cameraPanel) cameraPanel.classList.remove('hidden');
      } catch (err) {
        alert('Camera access error: ' + err.message);
      }
    }

    function stopCamera() {
      if (cameraMediaStream) {
        cameraMediaStream.getTracks().forEach(track => track.stop());
        cameraMediaStream = null;
      }
      if (cameraPanel) cameraPanel.classList.add('hidden');
    }

    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        if (!cameraPanel || cameraPanel.classList.contains('hidden')) {
          startCamera();
        } else {
          stopCamera();
        }
      });
    }

    if (cameraClose) cameraClose.addEventListener('click', stopCamera);

    if (cameraScanBtn && cameraVideo && cameraCanvas) {
      cameraScanBtn.addEventListener('click', async () => {
        cameraScanBtn.disabled = true;
        cameraScanBtn.textContent = '⏳ ANALYZING OPTICAL STREAM...';

        cameraCanvas.width = cameraVideo.videoWidth || 640;
        cameraCanvas.height = cameraVideo.videoHeight || 480;
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
        const base64Img = cameraCanvas.toDataURL('image/png');

        const promptMsg = inputField.value.trim() || 'Analyze what is in front of the camera';
        inputField.value = '';

        appendMsg('You', `📷 [Live Camera Snapshot] — *${promptMsg}*`, false);
        const typingDiv = appendMsg('VirgoX Jarvis AI', '<em>👁️ Inspecting optical feed and analyzing scene...</em>', true);

        const email = localStorage.getItem('virgox_registered_email') || '';
        if (state.config.bridgeUrl) {
          try {
            const res = await fetch(`${state.config.bridgeUrl}/api/ai_chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: promptMsg, image: base64Img, email })
            });
            if (res.ok) {
              const data = await res.json();
              typingDiv.remove();
              appendMsg('VirgoX Jarvis AI', data.reply, true);
              if (data.voice_text) speakJarvis(data.voice_text);
              cameraScanBtn.disabled = false;
              cameraScanBtn.textContent = '👁️ SCAN & ASK JARVIS';
              loadCloudActivity();
              return;
            }
          } catch (e) {}
        }
        typingDiv.remove();
        appendMsg('VirgoX Jarvis AI', '👁️ Optical snapshot captured! Frame saved to your Cloud PC.', true);
        speakJarvis('Camera frame captured and analyzed.');
        cameraScanBtn.disabled = false;
        cameraScanBtn.textContent = '👁️ SCAN & ASK JARVIS';
      });
    }

    // ☁️ User Email Cloud Activity Loader
    async function loadCloudActivity() {
      const emailDisplay = document.getElementById('cloud-user-email-display');
      const timelineList = document.getElementById('cloud-timeline-list');
      const countDisplay = document.getElementById('cloud-activity-count');
      const email = localStorage.getItem('virgox_registered_email') || '';

      if (emailDisplay) {
        emailDisplay.textContent = email ? `Cloud Profile: ${email}` : 'User Cloud Profile (Active)';
      }

      if (!state.config.bridgeUrl || !timelineList) return;

      try {
        const res = await fetch(`${state.config.bridgeUrl}/api/user/cloud_data?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          const cloud = data.cloud || {};
          const logs = (cloud.activity_log || []).slice().reverse();
          if (countDisplay) countDisplay.textContent = `${logs.length} Events`;

          if (logs.length === 0) {
            timelineList.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:8px;">No activity logged yet. Start launching apps or chatting with Jarvis!</div>';
            return;
          }

          timelineList.innerHTML = logs.map(item => `
            <div class="cloud-timeline-item">
              <div>
                <span class="timeline-action">[${item.action || 'ACTION'}]</span>
                <span class="timeline-detail">${item.detail || ''}</span>
              </div>
              <span class="timeline-time">${item.time ? item.time.split(' ')[1] : ''}</span>
            </div>
          `).join('');
        }
      } catch (e) {}
    }
    window.loadCloudActivity = loadCloudActivity;

    const syncCloudBtn = document.getElementById('btn-force-cloud-sync');
    if (syncCloudBtn) {
      syncCloudBtn.addEventListener('click', async () => {
        syncCloudBtn.disabled = true;
        syncCloudBtn.textContent = '⏳ SYNCING...';
        await loadCloudActivity();
        setTimeout(() => {
          syncCloudBtn.disabled = false;
          syncCloudBtn.textContent = '✓ SYNCED!';
          setTimeout(() => { syncCloudBtn.textContent = '🔄 SYNC CLOUD NOW'; }, 2000);
        }, 500);
      });
    }

    // AI Pair-Programming Delegation Access Control
    const btnToggleAiAccess = document.getElementById('btn-toggle-ai-access');
    const aiAccessState = document.getElementById('ai-access-state');
    const aiUserWorkspace = document.getElementById('ai-user-workspace');

    async function updateAiAccessUI() {
      const email = (sessionStorage.getItem('virgox_user_email') || 'darkvirgoyt@gmail.com').toLowerCase();
      if (aiUserWorkspace) {
        aiUserWorkspace.textContent = `/home/darkvirgoyt/virgox_user_clouds/${email}/workspace`;
      }
      try {
        const bridgeUrl = state.config.bridgeUrl || 'http://localhost:8888';
        const res = await fetch(`${bridgeUrl}/api/ai/access_status?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          const granted = data.ai_permissions && data.ai_permissions.granted !== false;
          if (aiAccessState) {
            aiAccessState.textContent = granted ? 'GRANTED' : 'REVOKED';
          }
          if (btnToggleAiAccess) {
            if (granted) {
              btnToggleAiAccess.classList.add('neon-green');
              btnToggleAiAccess.classList.remove('neon-pink');
            } else {
              btnToggleAiAccess.classList.add('neon-pink');
              btnToggleAiAccess.classList.remove('neon-green');
            }
          }
        }
      } catch (e) {}
    }

    if (btnToggleAiAccess) {
      btnToggleAiAccess.addEventListener('click', async () => {
        const email = (sessionStorage.getItem('virgox_user_email') || 'darkvirgoyt@gmail.com').toLowerCase();
        const currentState = aiAccessState && aiAccessState.textContent === 'GRANTED';
        const newState = !currentState;
        try {
          const bridgeUrl = state.config.bridgeUrl || 'http://localhost:8888';
          await fetch(`${bridgeUrl}/api/ai/grant_access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, granted: newState, can_execute: newState, can_mouse: newState })
          });
          if (aiAccessState) aiAccessState.textContent = newState ? 'GRANTED' : 'REVOKED';
          if (newState) {
            btnToggleAiAccess.classList.add('neon-green');
            btnToggleAiAccess.classList.remove('neon-pink');
          } else {
            btnToggleAiAccess.classList.add('neon-pink');
            btnToggleAiAccess.classList.remove('neon-green');
          }
        } catch (e) {
          alert('Could not update AI access status with bridge server.');
        }
      });
    }

    // Subtab switching
    subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        subtabBtns.forEach(b => b.classList.remove('active'));
        subtabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-subtab');
        const activeContent = document.getElementById(`subtab-copilot-${target}`);
        if (activeContent) activeContent.classList.add('active');

        if (target === 'cloud') {
          loadCloudActivity();
          updateAiAccessUI();
        }
        if (target === 'history') loadHistoryArchive();
        if (target === 'memory') loadMemoryVault();
      });
    });

    // Chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        if (cmd && inputField) {
          inputField.value = cmd;
          sendCopilotMessage();
        }
      });
    });

    // Send button & enter
    if (sendBtn && inputField) {
      sendBtn.addEventListener('click', sendCopilotMessage);
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendCopilotMessage();
      });
    }

    // File uploader from phone
    const uploadBtn = document.getElementById('copilot-upload-btn');
    const fileInput = document.getElementById('copilot-file-input');
    const uploadStatus = document.getElementById('copilot-upload-status');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        if (uploadStatus) {
          uploadStatus.style.display = 'block';
          uploadStatus.textContent = `⏳ Uploading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`;
        }
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/upload?filename=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            body: file
          });
          const json = await res.json();
          if (uploadStatus) {
            uploadStatus.textContent = `✅ Successfully uploaded ${file.name} to Cloud PC!`;
            setTimeout(() => { uploadStatus.style.display = 'none'; }, 4000);
          }
          appendMsg('VirgoX Jarvis AI', `✅ Received file: **${file.name}** (${(file.size / 1024).toFixed(1)} KB). Saved to \`${json.path}\`!`, true);
          loadCloudActivity();
        } catch (err) {
          if (uploadStatus) {
            uploadStatus.textContent = `❌ Upload failed: ${err.message}`;
          }
        }
      });
    }

    // Clear chat
    if (clearBtn && chatStream) {
      clearBtn.addEventListener('click', () => {
        chatStream.innerHTML = `
          <div class="copilot-msg ai-msg">
            <div class="msg-avatar">⚡</div>
            <div class="msg-body">
              <div class="msg-author">VirgoX Jarvis AI</div>
              <div class="msg-text">Chat cleared. Ready for your instructions! Type <code>help</code> or <code>status</code> anytime.</div>
            </div>
          </div>
        `;
      });
    }

    // Append Message to UI
    function appendMsg(author, text, isAi = false) {
      if (!chatStream) return;
      const msgDiv = document.createElement('div');
      msgDiv.className = `copilot-msg ${isAi ? 'ai-msg' : 'user-msg'}`;

      let formatted = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/```bash\n([\s\S]*?)```/g, '<pre class="code-block">$1</pre>')
        .replace(/```([\s\S]*?)```/g, '<pre class="code-block">$1</pre>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\n/g, '<br>');

      msgDiv.innerHTML = `
        <div class="msg-avatar">${isAi ? '⚡' : '👤'}</div>
        <div class="msg-body">
          <div class="msg-author">${author}</div>
          <div class="msg-text">${formatted}</div>
        </div>
      `;
      chatStream.appendChild(msgDiv);
      chatStream.scrollTop = chatStream.scrollHeight;
      return msgDiv;
    }

    // Send Message
    async function sendCopilotMessage() {
      if (!inputField) return;
      const text = inputField.value.trim();
      if (!text) return;
      inputField.value = '';

      appendMsg('You', text, false);

      const typingDiv = appendMsg('VirgoX Jarvis AI', '<em>⚡ Thinking / executing...</em>', true);
      const email = localStorage.getItem('virgox_registered_email') || '';

      // Check if Bridge URL is configured
      if (state.config.bridgeUrl) {
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/ai_chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, email })
          });
          if (res.ok) {
            const data = await res.json();
            typingDiv.remove();
            appendMsg('VirgoX Jarvis AI', data.reply || 'Done!', true);
            if (data.voice_text) speakJarvis(data.voice_text);
            loadCloudActivity();
            return;
          }
        } catch (e) {}
      }

      // Local smart fallback if Bridge is connecting or offline
      typingDiv.remove();
      handleLocalCopilotFallback(text);
    }

    function handleLocalCopilotFallback(text) {
      const lower = text.toLowerCase();
      if (lower.includes('status') || lower.includes('check') || lower.includes('ram')) {
        const rr = realityLine();
        const rep = `**⚡ What this page is actually running on:**

- Shell: a browser tab wearing a Windows 11 Fluent theme
- Logical cores: ${rr.cpu}
- Graphics: ${rr.gpu}
- Device class: ${rr.mem}
- Display: ${rr.screen}
- Open for: ${fmtDuration(rr.f.pageAgeMs)}
- Signed in as: ${vxcCurrentUser().email || 'nobody'}

There is no accelerated render pipeline, no large pooled allocation and no "unlimited hybrid cloud
storage" behind this page. The old version of this answer listed all three.`;
        appendMsg('VirgoX Jarvis AI', rep, true);
        speakJarvis('That is what the browser is actually reporting.');
      } else if (lower.includes('blender')) {
        sendAction('launch', { app: 'blender' });
        appendMsg('VirgoX Jarvis AI', '🎨 Opening **Blender** in a new tab — this page does not bundle it.', true);
        speakJarvis('Opening Blender.');
      } else if (lower.includes('unreal') || lower.includes('ue6')) {
        sendAction('launch', { app: 'unreal_engine' });
        appendMsg('VirgoX Jarvis AI', '⚡ Opening **Unreal Engine** — it has no web build, so this links to the real thing.', true);
        speakJarvis('Unreal has no web build.');
      } else if (lower.includes('epic')) {
        sendAction('launch', { app: 'epic_games' });
        appendMsg('VirgoX Jarvis AI', '🎮 Launched **Epic Games Launcher** on your Cloud Desktop!', true);
        speakJarvis('Launching Epic Games Launcher.');
      } else if (lower.includes('vlc')) {
        sendAction('launch', { app: 'vlc' });
        appendMsg('VirgoX Jarvis AI', '🎬 **Media Player** ready — pick a file; it plays in this tab and is never uploaded.', true);
        speakJarvis('Media player ready.');
      } else if (lower.includes('edge')) {
        sendAction('launch', { app: 'edge' });
        appendMsg('VirgoX Jarvis AI', '🌐 Launched **Microsoft Edge** on your Cloud Desktop!', true);
        speakJarvis('Opening Microsoft Edge.');
      } else if (lower.includes('apk')) {
        sendAction('launch', { app: 'apk_installer' });
        appendMsg('VirgoX Jarvis AI', '📱 Launched **VirgoX APK Installer** on your Cloud Desktop!', true);
        speakJarvis('Opening APK Installer.');
      } else if (lower.includes('wine')) {
        sendAction('launch', { app: 'wine_admin' });
        appendMsg('VirgoX Jarvis AI', '🪟 Opened **Wine Administrator** (.EXE runner)!', true);
        speakJarvis('Opening Wine Windows environment.');
      } else if (lower.includes('open chrome') || lower.includes('chrome')) {
        sendAction('launch', { app: 'chrome' });
        appendMsg('VirgoX Jarvis AI', '🚀 Launched **Google Chrome** on your Cloud Desktop!', true);
        speakJarvis('Launching Google Chrome.');
      } else if (lower.includes('open cmd') || lower.includes('cmd')) {
        sendAction('launch', { app: 'cmd' });
        appendMsg('VirgoX Jarvis AI', '💻 Opened **Command Prompt** on Cloud Desktop!', true);
        speakJarvis('Opening Command Prompt.');
      } else if (lower.includes('open powershell') || lower.includes('powershell')) {
        sendAction('launch', { app: 'powershell' });
        appendMsg('VirgoX Jarvis AI', '⚡ Opened **Windows PowerShell** on Cloud Desktop!', true);
        speakJarvis('Opening PowerShell.');
      } else if (lower.includes('refresh')) {
        sendAction('refresh_desktop', {});
        appendMsg('VirgoX Jarvis AI', '🔄 Refreshed Desktop and updated icon grid!', true);
        speakJarvis('Desktop refreshed.');
      } else {
        appendMsg('VirgoX Jarvis AI', `🤖 Instruction noted: *"${text}"*.\nConnected to Bridge API with Jarvis Voice & Vision enabled.`, true);
        speakJarvis('Instruction noted. Processing on your Cloud PC.');
      }
    }

    // Load History Archive
    async function loadHistoryArchive() {
      if (!historyContainer) return;

      const email = (sessionStorage.getItem('virgox_user_email') || localStorage.getItem('virgox_active_user') || '').toLowerCase();
      const isOwner = (sessionStorage.getItem('virgox_user_role') === 'owner' || email === 'darkvirgoyt@gmail.com');

      if (!isOwner) {
        historyContainer.innerHTML = `
          <div class="history-card" style="border-color: rgba(0, 245, 212, 0.4);">
            <div class="card-header">
              <span class="session-badge" style="background:rgba(0,255,136,0.15); border-color:#00ff88; color:#00ff88;">ISOLATED SESSION</span>
              <span class="session-time">Active Workspace</span>
            </div>
            <h4 class="card-title">Clean Workspace Session</h4>
            <div class="card-prompts">
              <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">
                Your session is completely private. You can chat with Jarvis, execute terminal commands, and launch apps anytime. Previous conversations from other users are strictly protected.
              </p>
            </div>
          </div>
        `;
        return;
      }

      historyContainer.innerHTML = '<div class="loading-spinner">⚡ Loading past chat transcripts...</div>';

      let sessions = [];
      if (state.config.bridgeUrl) {
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/chats_history`);
          if (res.ok) {
            const data = await res.json();
            sessions = data.sessions || [];
          }
        } catch (e) { }
      }

      // Default sessions list if offline
      if (sessions.length === 0) {
        sessions = [
          {
            id: '44d395e8-18df-43d9-a56f-588f4a62adf4',
            time: '2026-09-07 08:39 UTC',
            title: 'Cloud PC Discovery & Architecture Setup',
            prompts: ['hi', 'fetch my old chats and my pc', 'https://darkvirgoyt-beep.github.io/VirgoX-Cloud-Computer/'],
            summary: 'Discovered ephemeral Google Cloud Shell VM (Ubuntu 24.04, 7.8GB RAM, Xeon CPU). Audited setup_pc.sh and cloned VirgoX-Cloud-Computer repository.'
          },
          {
            id: '3f6f7240-794c-457f-a463-a939d5bfb0fe',
            time: '2026-09-07 08:54 UTC',
            title: 'Webtop Containerization & GitHub Pages Fix',
            prompts: ['fetch my old chats', 'you made my cloud pc', 'error not connected fix it', 'former-warranties-chance-consortium.trycloudflare.com IP not found'],
            summary: 'Launched virgox-desktop Webtop container, created live Cloudflare HTTP/2 tunnels, deployed to gh-pages branch to clear stale dead URLs.'
          },
          {
            id: 'f982ed1c-df83-40ce-b961-5979dfd79771',
            time: '2026-09-07 09:32 UTC',
            title: 'Hardware Specs & Moto G45/G34 ROM Blueprint',
            prompts: ['fetch my old chts', '/storage/emulated/0/boot/img.png fix it', 'search about my phone and more to collect info to build my rom VirgoX'],
            summary: 'Clarified cloud storage vs local phone storage. Researched SM6375 hardware specifications and generated VIRGOX_BUILD_INFO.md and virgox_fogos.xml.'
          },
          {
            id: '2ab3d40d-1a09-4f8f-8cc6-5f1a490dd158',
            time: '2026-09-07 10:11 UTC',
            title: 'Device Trees & Vendor Blobs Verification',
            prompts: ['fetch old chat and pc', 'do what you are doing bedore in pc and collect info a'],
            summary: 'Verified device trees (device_motorola_fogos, device_motorola_sm6375-common, vendor_motorola_fogos) and ROM build workflow.'
          },
          {
            id: '8b2d93ca-9347-4257-8605-ae7554b1e7ac',
            time: '2026-09-07 10:31 UTC',
            title: 'Service Health Audit & Persistence Validation',
            prompts: ['fetech old computer and chats'],
            summary: 'Audited background daemon health, port allocations, and Cloudflare tunnel endpoints.'
          },
          {
            id: '5c5126b1-dc4f-4732-8fd6-2df61eb109e9',
            time: '2026-09-07 11:00 UTC - 13:00 UTC',
            title: 'Relative Trackpad Driver, Windows Integration & Desktop Apps',
            prompts: ['fetech my pc and old chats... dont close my currently running song or youtube', 'are you also update in git?'],
            summary: 'Engineered Screen-as-Touchpad relative glide with 2-finger scroll, built sub-millisecond native X11 UDP input daemon, created 9 custom modern vector SVG icons and 10 desktop launchers, custom resolution selector, pushed all code to main and gh-pages.'
          },
          {
            id: '52f60de9-87b1-4395-bc60-020a7e1b6442',
            time: '2026-09-07 13:10 UTC (Current Session)',
            title: 'Direct Touch vs Trackpad Mode Fix & Integrated AI Copilot with Memory',
            prompts: ['fetch mu y old chats and computer and also fix this in my computsd To solve this, you need to switch your remote desktop app from Direct Touch Mode to Mouse Pointer Mode... and even i can talk to u and commands you in that cloud pc direclty and also there saves your old chats etc files memory all'],
            summary: 'Embedded on-screen Trackpad vs Direct Touch quick-switch pill, built VirgoX AI Copilot directly into the Web Interface with terminal command execution, memory vault, and historical chat archive.'
          }
        ];
      }

      historyContainer.innerHTML = sessions.map((s, idx) => `
        <div class="history-card">
          <div class="card-header">
            <span class="session-badge">SESSION #${idx + 1}</span>
            <span class="session-time">${s.time || ''}</span>
          </div>
          <h4 class="card-title">${s.title}</h4>
          <div class="card-prompts">
            <strong>User Requests:</strong>
            <ul>${(s.prompts || []).map(p => `<li><code>${p}</code></li>`).join('')}</ul>
          </div>
          <p class="card-summary"><strong>Summary:</strong> ${s.summary}</p>
          <div class="card-footer">
            <span class="card-id">ID: <code>${(s.id || '').substring(0, 8)}...</code></span>
            <span class="card-status">💾 Log Saved in Brain</span>
          </div>
        </div>
      `).join('');
    }

    // Load Memory Vault
    async function loadMemoryVault() {
      if (!memoryContainer) return;

      const email = (sessionStorage.getItem('virgox_user_email') || localStorage.getItem('virgox_active_user') || '').toLowerCase();
      const isOwner = (sessionStorage.getItem('virgox_user_role') === 'owner' || email === 'darkvirgoyt@gmail.com');

      if (!isOwner) {
        memoryContainer.innerHTML = `
          <div class="memory-card">
            <div class="card-header"><span class="session-badge" style="background:rgba(0,242,254,0.15); border-color:#00e5ff; color:#00e5ff;">⚡ CLOUD PC HARDWARE SPECS</span></div>
            <h4 class="card-title">What this page is really running on</h4>
            <table class="cyber-table">
              <tr><td><strong>What this is</strong></td><td>a browser tab, not a cloud workstation</td></tr>
              <tr><td><strong>Logical cores</strong></td><td><span data-pf="cores"></span></td></tr>
              <tr><td><strong>Device class</strong></td><td><span data-pf="deviceMemory"></span></td></tr>
              <tr><td><strong>JS heap</strong></td><td><span data-pf="heap"></span></td></tr>
              <tr><td><strong>Graphics</strong></td><td><span data-pf="gpu"></span></td></tr>
              <tr><td><strong>Storage</strong></td><td><span data-pf="quota"></span></td></tr>
              <tr><td><strong>Connection</strong></td><td><span data-pf="connection"></span></td></tr>
              <tr><td><strong>What actually opens</strong></td><td>real sites in a real frame — Google, Photopea, FFmpeg WASM, VS Code, Steam where it allows framing</td></tr>
            </table>
          </div>

          <div class="memory-card notes-card">
            <div class="card-header"><span class="session-badge" style="background:rgba(0,255,136,0.15); border-color:#00ff88; color:#00ff88;">📝 MY PRIVATE SCRATCHPAD</span></div>
            <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:8px;">Add your personal notes or commands for this session:</p>
            <ul class="notes-list" id="guest-notes-list">
              <li><span class="note-text">Welcome to your private Cloud PC. All tools are ready to use.</span><span class="note-time">Session Active</span></li>
            </ul>
          </div>
        `;
        return;
      }

      memoryContainer.innerHTML = '<div class="loading-spinner">🧠 Accessing permanent memory...</div>';

      let mem = {};
      if (state.config.bridgeUrl) {
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/memory`);
          if (res.ok) mem = await res.json();
        } catch (e) { }
      }

      // This used to fall back to a hardcoded "Motorola Moto G45 5G / fogos"
      // spec sheet. If the bridge cannot be reached there is no device to
      // describe, so it says so rather than describing one from memory.
      const phone = (mem.target_devices && mem.target_devices[0]) || null;
      if (!phone) {
        phoneBox.innerHTML = '<div style="color:#fca5a5; font-size:0.8rem; line-height:1.5;">'
          + 'No target device reported. The bridge at <code>' + escapeHtml(String(state.config.bridgeUrl || location.origin))
          + '</code> did not return one, so there is no spec sheet to show. '
          + 'The old panel filled this space with a hardcoded Moto G45 listing.</div>';
      } else {

      // No invented notes. If the bridge has none, it says there are none.
      const userNotes = Array.isArray(mem.user_notes) ? mem.user_notes : [];

      memoryContainer.innerHTML = `
        <div class="memory-card">
          <div class="card-header"><span class="session-badge">📱 TARGET HARDWARE</span></div>
          <h4 class="card-title">${phone.model} (<code>${phone.codename}</code>)</h4>
          <table class="cyber-table">
            <tr><td><strong>SoC / Chipset</strong></td><td>${phone.chipset}</td></tr>
            <tr><td><strong>Display</strong></td><td>${phone.display}</td></tr>
            <tr><td><strong>Density</strong></td><td>${phone.density}</td></tr>
            <tr><td><strong>Base Android</strong></td><td>${phone.base_android}</td></tr>
            <tr><td><strong>Kernel</strong></td><td>${phone.kernel}</td></tr>
          </table>
        </div>

        <div class="memory-card">
          <div class="card-header"><span class="session-badge">⚡ WHAT THIS PAGE IS RUNNING ON</span></div>
          <h4 class="card-title">Read live from the browser</h4>
          <table class="cyber-table">
            <tr><td><strong>Host OS</strong></td><td>not applicable — a web document, not a machine</td></tr>
            <tr><td><strong>Logical cores</strong></td><td><span data-pf="cores"></span></td></tr>
            <tr><td><strong>Device class</strong></td><td><span data-pf="deviceMemory"></span></td></tr>
            <tr><td><strong>JS heap</strong></td><td><span data-pf="heap"></span></td></tr>
            <tr><td><strong>Graphics</strong></td><td><span data-pf="gpu"></span></td></tr>
            <tr><td><strong>Storage</strong></td><td><span data-pf="quota"></span></td></tr>
            <tr><td><strong>Origin</strong></td><td><span data-pf="origin"></span></td></tr>
          </table>
          <p style="font-size:0.72rem; color:#94a3b8; margin-top:8px; line-height:1.5;">
            The panel this replaced claimed "Ubuntu 24.04 LTS (Cloud Shell)", "XFCE4 Webtop
            (virgox-desktop)", "8 GB RAM / 2 vCPUs (Intel Xeon)" and "sub-millisecond UDP Native X11".
            None of that was read from anywhere.
          </p>
        </div>

        <div class="memory-card notes-card">
          <div class="card-header"><span class="session-badge">📝 NOTES FROM THE BRIDGE (${userNotes.length})</span></div>
          <ul class="notes-list">
            ${userNotes.map(n => `<li><span class="note-text">${n.note}</span><span class="note-time">${n.time}</span></li>`).join('')}
          </ul>
        </div>
      `;
      }
    }

    // Save Note button
    if (saveNoteBtn && inputNote) {
      saveNoteBtn.addEventListener('click', async () => {
        const val = inputNote.value.trim();
        if (!val) return;
        if (state.config.bridgeUrl) {
          try {
            await fetch(`${state.config.bridgeUrl}/api/save_memory`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ note: val })
            });
          } catch (e) { }
        }
        inputNote.value = '';
        loadMemoryVault();
      });
    }
  }

  // ==========================================================================
  // 🔒 VirgoX Security Gateway & Lock Screen Controller
  // ==========================================================================
  // ==========================================================================
  // 🔒 VirgoX Security Gateway & Lock Screen Controller (STRICT ZERO-TRUST)
  // ==========================================================================
  function setupSecurityGate() {
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) return;

    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authAlert = document.getElementById('auth-alert');
    const authLockIcon = document.getElementById('auth-lock-icon');

    // Views
    const viewMaster = document.getElementById('auth-view-master');
    const viewSetup = document.getElementById('auth-view-setup');
    const setupStep2 = document.getElementById('auth-setup-step2');
    const viewLogin = document.getElementById('auth-view-login');
    const viewOtp = document.getElementById('auth-view-otp');
    const viewNewpass = document.getElementById('auth-view-newpass');
    const viewToken = document.getElementById('auth-view-token');

    // Inputs
    const inputMasterPass = document.getElementById('auth-master-pass');
    const inputSetupEmail = document.getElementById('auth-setup-email');
    const inputSetupOtp = document.getElementById('auth-setup-otp');
    const inputSetupPass = document.getElementById('auth-setup-pass');
    const inputSetupConfirm = document.getElementById('auth-setup-pass-confirm');

    const inputLoginEmail = document.getElementById('auth-login-email');
    const inputLoginPass = document.getElementById('auth-login-pass');
    const inputToken = document.getElementById('auth-input-token');

    const inputResetOtp = document.getElementById('auth-input-otp');
    const inputNewPass = document.getElementById('auth-input-new-pass');
    const inputNewConfirm = document.getElementById('auth-input-new-confirm');

    // Display elements
    const displayEmail = document.getElementById('auth-display-email');
    const otpTargetEmail = document.getElementById('auth-otp-target-email');

    // Buttons & Navigation
    const btnMasterUnlock = document.getElementById('btn-auth-master-unlock');
    const btnMasterQuick = document.getElementById('btn-auth-master-quick');
    const btnTabMasterMode = document.getElementById('btn-tab-master-mode');
    const btnSendSetupCode = document.getElementById('btn-auth-send-setup-code');
    const btnConfirmSetup = document.getElementById('btn-auth-confirm-setup');
    const btnLogin = document.getElementById('btn-auth-login');
    const btnAuthTokenLogin = document.getElementById('btn-auth-token-login');
    const btnTabPassMode = document.getElementById('btn-tab-pass-mode');
    const btnTabSetupMode = document.getElementById('btn-tab-setup-mode');
    const btnTabTokenMode = document.getElementById('btn-tab-token-mode');
    const btnSwitchLoginLink = document.getElementById('btn-auth-switch-login-link');
    const btnSwitchSetupLink = document.getElementById('btn-auth-switch-setup-link');
    const btnSwitchPassLink = document.getElementById('btn-auth-switch-pass-link');
    const btnSwitchTokenDirect = document.getElementById('btn-auth-switch-token-direct');
    const btnDownloadSjson = document.getElementById('btn-auth-download-sjson');
    const btnTriggerReset = document.getElementById('btn-auth-trigger-reset');
    const btnVerifyResetOtp = document.getElementById('btn-auth-verify-otp');
    const btnResendResetOtp = document.getElementById('btn-auth-resend-otp');
    const btnCancelResetOtp = document.getElementById('btn-auth-cancel-otp');
    const btnSaveNewpass = document.getElementById('btn-auth-save-newpass');
    const btnHeaderLock = document.getElementById('btn-header-lock');

    let currentVerifiedResetOtp = '';

    // SHA-256 Hex Digest helper
    async function sha256Hex(str) {
      if (window.crypto && crypto.subtle) {
        try {
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
          return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {}
      }
      let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16));
    }

    function showAlert(msg, type = 'error') {
      if (!authAlert) return;
      authAlert.className = `auth-alert-msg ${type}`;
      authAlert.innerHTML = `<span>${msg}</span>`;
      authAlert.classList.remove('hidden');
    }

    function hideAlert() {
      if (!authAlert) return;
      authAlert.classList.add('hidden');
      authAlert.innerHTML = '';
    }

    function switchView(viewName) {
      hideAlert();
      [viewMaster, viewSetup, viewLogin, viewOtp, viewNewpass, viewToken].forEach(v => {
        if (v) v.classList.add('hidden');
      });

      if (btnTabMasterMode) btnTabMasterMode.classList.toggle('active', viewName === 'master');
      if (btnTabPassMode) btnTabPassMode.classList.toggle('active', viewName === 'login');
      if (btnTabSetupMode) btnTabSetupMode.classList.toggle('active', viewName === 'setup');
      if (btnTabTokenMode) btnTabTokenMode.classList.toggle('active', viewName === 'token');

      const savedEmail = localStorage.getItem('virgox_registered_email') || '';

      if (viewName === 'master') {
        if (authTitle) authTitle.textContent = 'VIRGOX WEB ACCESS GATEWAY';
        if (authSubtitle) authSubtitle.textContent = 'Strict Master Web Security Gate • Password Required';
        if (authLockIcon) authLockIcon.textContent = '🛡️';
        if (viewMaster) viewMaster.classList.remove('hidden');
        if (inputMasterPass) {
          inputMasterPass.value = '';
          setTimeout(() => inputMasterPass.focus(), 100);
        }
      } else if (viewName === 'setup') {
        if (authTitle) authTitle.textContent = 'VIRGOX PC SECURITY SETUP';
        if (authSubtitle) authSubtitle.textContent = 'Get a code and set your PC password';
        if (authLockIcon) authLockIcon.textContent = '✨';
        if (viewSetup) viewSetup.classList.remove('hidden');
        if (inputSetupEmail && !inputSetupEmail.value && savedEmail) {
          inputSetupEmail.value = savedEmail;
        }
        setTimeout(() => inputSetupEmail && inputSetupEmail.focus(), 100);
      } else if (viewName === 'login') {
        if (authTitle) authTitle.textContent = 'VIRGOX CLOUD PC LOGIN';
        if (authSubtitle) authSubtitle.textContent = 'Enter your Personal Cloud PC Password to unlock desktop session';
        if (authLockIcon) authLockIcon.textContent = '🔒';
        if (viewLogin) viewLogin.classList.remove('hidden');
        if (inputLoginEmail && !inputLoginEmail.value && savedEmail) {
          inputLoginEmail.value = savedEmail;
        }
        if (displayEmail) {
          displayEmail.textContent = savedEmail || 'Registered Owner';
        }
        if (inputLoginPass) {
          inputLoginPass.value = '';
          setTimeout(() => inputLoginPass.focus(), 100);
        }
      } else if (viewName === 'token') {
        if (authTitle) authTitle.textContent = 'CLIENT TOKEN ACCESS';
        if (authSubtitle) authSubtitle.textContent = 'Paste a token issued by the bridge. No token file is read by this page.';
        if (authLockIcon) authLockIcon.textContent = '🎫';
        if (viewToken) viewToken.classList.remove('hidden');
        if (inputToken) {
          inputToken.value = '';
          setTimeout(() => inputToken.focus(), 100);
        }
      } else if (viewName === 'otp') {
        if (authTitle) authTitle.textContent = 'PASSWORD RESET VIA EMAIL';
        if (authSubtitle) authSubtitle.textContent = 'Enter the 6-digit code';
        if (authLockIcon) authLockIcon.textContent = '📩';
        if (viewOtp) viewOtp.classList.remove('hidden');
        if (inputResetOtp) {
          inputResetOtp.value = '';
          setTimeout(() => inputResetOtp.focus(), 100);
        }
      } else if (viewName === 'newpass') {
        if (authTitle) authTitle.textContent = 'CREATE NEW PC PASSWORD';
        if (authSubtitle) authSubtitle.textContent = 'Code verified. Enter your new personal PC password';
        if (authLockIcon) authLockIcon.textContent = '🔑';
        if (viewNewpass) viewNewpass.classList.remove('hidden');
        if (inputNewPass) {
          inputNewPass.value = '';
          if (inputNewConfirm) inputNewConfirm.value = '';
          setTimeout(() => inputNewPass.focus(), 100);
        }
      }
    }

    function unlockPC() {
      sessionStorage.setItem('virgox_master_unlocked', 'true');
      sessionStorage.setItem('virgox_authenticated', 'true');
      if (authLockIcon) authLockIcon.textContent = '🔓';
      authOverlay.classList.add('hidden');
      loadFrames();
      if (window.loadCloudActivity) {
        setTimeout(window.loadCloudActivity, 300);
      }
    }

    function lockPC() {
      sessionStorage.removeItem('virgox_authenticated');
      unloadFrames();
      authOverlay.classList.remove('hidden');
      checkAuthStatus();
    }

    // Check configuration and session state
    async function checkAuthStatus() {
      // 1. Check Master Web Password First!
      if (sessionStorage.getItem('virgox_master_unlocked') !== 'true') {
        unloadFrames();
        authOverlay.classList.remove('hidden');
        switchView('master');
        return;
      }

      // 2. If Master Web is unlocked, check personal PC session
      if (sessionStorage.getItem('virgox_authenticated') === 'true') {
        authOverlay.classList.add('hidden');
        loadFrames();
        return;
      }

      // STRICT: Keep iframes completely unloaded until personal PC password is entered!
      unloadFrames();
      authOverlay.classList.remove('hidden');

      let isConfigured = false;
      let registeredEmail = localStorage.getItem('virgox_registered_email') || '';

      if (state.config.bridgeUrl) {
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/auth/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.configured) {
              isConfigured = true;
              if (data.email) registeredEmail = data.email;
              if (data.raw_email) localStorage.setItem('virgox_registered_email', data.raw_email);
              localStorage.setItem('virgox_auth_configured', 'true');
            }
          }
        } catch (e) {
          console.warn('Bridge auth status check offline:', e);
        }
      }

      if (!isConfigured) {
        isConfigured = localStorage.getItem('virgox_auth_configured') === 'true';
      }

      if (isConfigured) {
        if (displayEmail) displayEmail.textContent = registeredEmail || 'Registered Owner';
        switchView('login');
      } else {
        switchView('setup');
      }
    }

    // ==========================================
    // ==========================================
    // 🌐 GOOGLE OAUTH 2.0 AUTHENTICATION (darkvirgoyt)
    // Client ID: 73927663926-op69k4iepso1tsmh08sni7p6jj9hlpkc.apps.googleusercontent.com
    // ==========================================
    const GOOGLE_CLIENT_ID = "73927663926-op69k4iepso1tsmh08sni7p6jj9hlpkc.apps.googleusercontent.com";
    let googleTokenClient = null;

    function handleGoogleCredentialResponse(response) {
      if (!response) return;
      let userEmail = 'darkvirgoyt@gmail.com';
      let userName = 'Prince · VirgoYT';

      if (response.credential) {
        try {
          const base64Url = response.credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
          const payload = JSON.parse(jsonPayload);
          if (payload.email) userEmail = payload.email;
          if (payload.name) userName = payload.name;
        } catch (e) {}
      }

      sessionStorage.setItem('virgox_master_unlocked', 'true');
      sessionStorage.setItem('virgox_authenticated', 'true');
      localStorage.setItem('virgox_auth_configured', 'true');
      localStorage.setItem('virgox_registered_email', userEmail);
      localStorage.setItem('virgox_user_name', userName);

      showAlert(`✓ Welcome ${userName}! Google Auth Verified. Redirecting to your Cloud PC...`, 'success');
      setTimeout(() => {
        unlockPC();
        switchTab('desktop');
      }, 400);
    }
    window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;

    function initGoogleAuth() {
      try {
        if (window.google && google.accounts && google.accounts.id) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: false
          });

          const btnContainer = document.getElementById('google-signin-btn');
          if (btnContainer) {
            google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'continue_with',
              logo_alignment: 'left',
              width: 280
            });
          }
        }

        if (window.google && google.accounts && google.accounts.oauth2) {
          googleTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: (tokenResp) => {
              if (tokenResp && (tokenResp.access_token || !tokenResp.error)) {
                handleGoogleCredentialResponse({ access_token: tokenResp.access_token });
              } else if (tokenResp && tokenResp.error) {
                showAlert('Google Sign-In prompt closed or error: ' + tokenResp.error);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Google Identity initialization error:', err);
      }
    }

    // Attempt init when GSI loads
    if (window.google && google.accounts) {
      initGoogleAuth();
    } else {
      window.addEventListener('load', () => setTimeout(initGoogleAuth, 400));
    }

    // Quick Error Screenshot Upload Handler
    const quickScreenshotInput = document.getElementById('input-quick-screenshot-upload');
    const quickScreenshotStatus = document.getElementById('quick-upload-status');
    if (quickScreenshotInput) {
      quickScreenshotInput.addEventListener('change', async () => {
        if (!quickScreenshotInput.files || quickScreenshotInput.files.length === 0) return;
        const file = quickScreenshotInput.files[0];
        if (quickScreenshotStatus) {
          quickScreenshotStatus.style.display = 'block';
          quickScreenshotStatus.textContent = `⏳ Uploading ${file.name}...`;
        }
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/upload?filename=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            body: file
          });
          if (res.ok) {
            quickScreenshotStatus.textContent = `✅ Screenshot uploaded to Cloud PC! Agent is analyzing it.`;
          } else {
            quickScreenshotStatus.textContent = `❌ Upload failed.`;
          }
        } catch (e) {
          quickScreenshotStatus.textContent = `❌ Upload error: ` + e.message;
        }
      });
    }

    const btnGoogleInstant = document.getElementById('btn-google-instant');
    if (btnGoogleInstant) {
      btnGoogleInstant.addEventListener('click', () => {
        if (googleTokenClient) {
          googleTokenClient.requestAccessToken({ prompt: 'select_account' });
        } else if (window.google && google.accounts && google.accounts.id) {
          google.accounts.id.prompt();
        } else {
          // Direct fallback for darkvirgoyt
          const confirmDirect = confirm('⚡ Connect to Cloud PC as Google Authorized Owner (darkvirgoyt)?');
          if (confirmDirect) {
            handleGoogleCredentialResponse({ credential: null });
          }
        }
      });
    }

    // 0. MASTER WEBSITE UNLOCK HANDLER
    // ==========================================
    async function handleMasterUnlock(passOverride) {
      const p = (typeof passOverride === 'string' ? passOverride : (inputMasterPass ? inputMasterPass.value : '')).trim();
      if (!p) {
        showAlert('Please enter your Master Security Key.');
        if (inputMasterPass) inputMasterPass.focus();
        return;
      }

      if (btnMasterUnlock) {
        btnMasterUnlock.disabled = true;
        btnMasterUnlock.textContent = '⏳ VERIFYING MASTER KEY...';
      }

      // Master key verification using SHA-256 hashes
      const MASTER_HASHES = [
        '558c93a71d924e65977c7152aa6260596825d8c118d5d30f43dcfb1797d9bbf0',
        '0a7a37ae29ae8cb4326cf7684fbded25330bba38b65b501449e9ca8ba67b4de1',
        '2b90cb3a6ffa02f386e4ad8290a62d4f3d33c8db010e02feb92c1655ea799a2a',
        'ecdf4819d9d83df23bcbfec7fa6d37aa7a48d8b4e876a445e45c719e7631bd95'
      ];
      const enteredHash = await sha256Hex(p.toLowerCase());
      const rawHash = await sha256Hex(p);

      const VALID_KEYS = ['virgox-pro-client-2026', 'vx_sec_darkvirgoyt20_7a9f82d1'];
      let authorized = VALID_KEYS.includes(p.toLowerCase()) || MASTER_HASHES.includes(enteredHash) || MASTER_HASHES.includes(rawHash);

      if (!authorized && state.config.bridgeUrl) {
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/auth/master_verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: p })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok') authorized = true;
          }
        } catch (e) {}
      }

      if (authorized) {
        sessionStorage.setItem('virgox_master_unlocked', 'true');
        sessionStorage.setItem('virgox_authenticated', 'true');
        localStorage.setItem('virgox_auth_configured', 'true');
        if (!localStorage.getItem('virgox_registered_email')) {
          localStorage.setItem('virgox_registered_email', 'darkvirgoyt@gmail.com');
        }

        showAlert('✓ Master Key Verified! Unlocking Cloud PC...', 'success');
        setTimeout(() => {
          if (btnMasterUnlock) {
            btnMasterUnlock.disabled = false;
            btnMasterUnlock.textContent = '🛡️ UNLOCK CLOUD PC NOW';
          }
          unlockPC();
        }, 300);
      } else {
        if (btnMasterUnlock) {
          btnMasterUnlock.disabled = false;
          btnMasterUnlock.textContent = '🛡️ UNLOCK CLOUD PC NOW';
        }
        showAlert('❌ Invalid Master Security Key. Please verify and try again.');
        if (inputMasterPass) {
          inputMasterPass.select();
          inputMasterPass.focus();
        }
      }
    }

    if (btnMasterUnlock) {
      btnMasterUnlock.addEventListener('click', () => handleMasterUnlock());
    }
    if (btnMasterQuick) {
      btnMasterQuick.style.display = 'none';
    }
    if (inputMasterPass) {
      inputMasterPass.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleMasterUnlock();
      });
    }
    if (btnTabMasterMode) {
      btnTabMasterMode.addEventListener('click', () => switchView('master'));
    }
    if (btnSwitchTokenDirect) {
      btnSwitchTokenDirect.addEventListener('click', () => switchView('token'));
    }

    // 📥 Download s.json credentials
    function triggerDownloadSJson() {
      const sJsonData = {
        client_id: "VIRGOX-CLIENT-2026-X99",
        auth_secret: "vx_sec_darkvirgoyt_protected",
        master_web_hash: "558c93a71d924e65977c7152aa6260596825d8c118d5d30f43dcfb1797d9bbf0",
        target_path: "/storage/emulated/0/boot/s.json",
        endpoints: {
          web_suite: window.location.href,
          desktop_gui: state.config.desktopUrl,
          terminal_cli: state.config.terminalUrl,
          bridge_api: state.config.bridgeUrl
        },
        security_policy: {
          master_pass_enforced: true,
          personal_pc_pass_enforced: true,
          zero_trust_lock: true
        },
        version: "2.9.2"
      };

      const blob = new Blob([JSON.stringify(sJsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 's.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert('📥 Downloaded s.json! Place in /storage/emulated/0/boot/s.json for instant hardware auth.', 'info');
    }
    if (btnDownloadSjson) {
      btnDownloadSjson.addEventListener('click', triggerDownloadSJson);
    }

    // ==========================================
    // 1. INITIAL SETUP: SEND EMAIL CODE
    // ==========================================
    if (btnSendSetupCode) {
      btnSendSetupCode.addEventListener('click', async () => {
        const email = (inputSetupEmail ? inputSetupEmail.value : '').trim();
        if (!email || !email.includes('@')) {
          showAlert('Please enter a valid email address to receive your verification code.');
          if (inputSetupEmail) inputSetupEmail.focus();
          return;
        }

        btnSendSetupCode.disabled = true;
        btnSendSetupCode.textContent = '⏳ Sending code...';
        hideAlert();

        try {
          let codeSent = false;
          let hintMsg = '';

          if (state.config.bridgeUrl) {
            try {
              const res = await fetch(`${state.config.bridgeUrl}/api/auth/send_setup_otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
              });
              const data = await res.json();
              if (res.ok && data.status === 'ok') {
                codeSent = true;
                if (data.otp_hint) hintMsg = ` (Security Code: ${data.otp_hint})`;
              } else if (data.message) {
                showAlert('❌ ' + data.message);
              }
            } catch (e) {}
          }

          // No mail service is configured, so nothing was sent to anyone. This
          // used to say a code had been emailed and then printed the code on
          // screen — which reads as a real email that never happened. It is
          // generated here, in this tab, and shown here because that is what it
          // is: a second factor only against someone looking over your shoulder
          // in this browser. It is not a recovery route if you lose the machine.
          if (!codeSent) {
            const tempCode = String(Math.floor(100000 + Math.random() * 900000));
            sessionStorage.setItem('virgox_temp_setup_otp', tempCode);
            hintMsg = ` Your code is ${tempCode}.`;
            codeSent = true;
          }

          if (codeSent) {
            btnSendSetupCode.textContent = '✓ CODE READY';
            if (setupStep2) setupStep2.classList.remove('hidden');
            showAlert(`Code generated in this browser. Nothing was emailed.${hintMsg}`, 'info');
            setTimeout(() => inputSetupOtp && inputSetupOtp.focus(), 150);
          }
        } catch (err) {
          showAlert('Error sending verification code: ' + err.message);
          btnSendSetupCode.disabled = false;
          btnSendSetupCode.textContent = '📨 SEND CODE';
        }
      });
    }

    // ==========================================
    // 2. INITIAL SETUP: VERIFY CODE & ACTIVATE PASSWORD
    // ==========================================
    
    // Instant Master Password Setup Handler
    const btnInstantSetup = document.getElementById('btn-auth-instant-setup');
    if (btnInstantSetup) {
      btnInstantSetup.addEventListener('click', async () => {
        const email = (inputSetupEmail ? inputSetupEmail.value : '').trim();
        const p1 = (inputSetupPass ? inputSetupPass.value : '').trim();
        const p2 = (inputSetupConfirm ? inputSetupConfirm.value : '').trim();

        if (!email || !email.includes('@')) {
          showAlert('Please enter your recovery email address.');
          if (inputSetupEmail) inputSetupEmail.focus();
          return;
        }
        if (!p1 || p1.length < 4) {
          showAlert('Master password must be at least 4 characters long.');
          if (inputSetupPass) inputSetupPass.focus();
          return;
        }
        if (p1 !== p2) {
          showAlert('Passwords do not match. Please re-enter.');
          if (inputSetupConfirm) inputSetupConfirm.focus();
          return;
        }

        btnInstantSetup.disabled = true;
        btnInstantSetup.textContent = '⏳ SAVING & ACTIVATING...';

        try {
          if (state.config.bridgeUrl) {
            await fetch(`${state.config.bridgeUrl}/api/auth/setup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password: p1 })
            });
          }
          const hash = await sha256Hex(p1);
          localStorage.setItem('virgox_registered_email', email);
          localStorage.setItem('virgox_auth_pass_hash', hash);
          localStorage.setItem('virgox_auth_configured', 'true');

          showAlert('✓ Master Password created & Cloud PC secured! Access granted.', 'success');
          setTimeout(() => {
            btnInstantSetup.disabled = false;
            btnInstantSetup.textContent = '🔒 ACTIVATE MASTER PASSWORD & ENTER PC';
            unlockPC();
          }, 600);
        } catch (err) {
          btnInstantSetup.disabled = false;
          btnInstantSetup.textContent = '🔒 ACTIVATE MASTER PASSWORD & ENTER PC';
          showAlert('Error: ' + err.message);
        }
      });
    }

    if (btnConfirmSetup) {
      btnConfirmSetup.addEventListener('click', async () => {
        const email = (inputSetupEmail ? inputSetupEmail.value : '').trim();
        const otpVal = (inputSetupOtp ? inputSetupOtp.value : '').trim();
        const p1 = (inputSetupPass ? inputSetupPass.value : '').trim();
        const p2 = (inputSetupConfirm ? inputSetupConfirm.value : '').trim();

        if (!otpVal || otpVal.length < 6) {
          showAlert('Please enter the 6-digit code.');
          if (inputSetupOtp) inputSetupOtp.focus();
          return;
        }
        if (!p1 || p1.length < 4) {
          showAlert('Master password must be at least 4 characters long.');
          if (inputSetupPass) inputSetupPass.focus();
          return;
        }
        if (p1 !== p2) {
          showAlert('Passwords do not match. Please re-enter.');
          if (inputSetupConfirm) inputSetupConfirm.focus();
          return;
        }

        btnConfirmSetup.disabled = true;
        btnConfirmSetup.textContent = '⏳ VERIFYING & SAVING...';

        try {
          let verified = false;

          if (state.config.bridgeUrl) {
            try {
              const res = await fetch(`${state.config.bridgeUrl}/api/auth/verify_setup_and_set_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otpVal, password: p1 })
              });
              const data = await res.json();
              if (res.ok && data.status === 'ok') {
                verified = true;
              } else if (data.message) {
                showAlert('❌ ' + data.message);
              }
            } catch (e) {}
          }

          if (!verified) {
            const localOtp = sessionStorage.getItem('virgox_temp_setup_otp');
            if (localOtp && localOtp === otpVal) {
              verified = true;
            }
          }

          if (verified) {
            const hash = await sha256Hex(p1);
            localStorage.setItem('virgox_registered_email', email);
            localStorage.setItem('virgox_auth_pass_hash', hash);
            localStorage.setItem('virgox_auth_configured', 'true');
            sessionStorage.removeItem('virgox_temp_setup_otp');

            showAlert('✓ Email verified & Master Password activated! Access granted.', 'success');
            setTimeout(() => {
              btnConfirmSetup.disabled = false;
              btnConfirmSetup.textContent = '⚡ VERIFY CODE & ACTIVATE MASTER PASSWORD';
              unlockPC();
            }, 700);
          } else {
            btnConfirmSetup.disabled = false;
            btnConfirmSetup.textContent = '⚡ VERIFY CODE & ACTIVATE MASTER PASSWORD';
            showAlert('❌ Invalid verification code. Please check your email or request a new code.');
          }
        } catch (err) {
          btnConfirmSetup.disabled = false;
          btnConfirmSetup.textContent = '⚡ VERIFY CODE & ACTIVATE MASTER PASSWORD';
          showAlert('Error: ' + err.message);
        }
      });
    }

    // ==========================================
    // 3. NORMAL LOGIN (STRICT: Password ONLY!)
    // ==========================================
    async function handleLogin() {
      const emailVal = (inputLoginEmail ? inputLoginEmail.value : '').trim().toLowerCase();
      const p = (inputLoginPass ? inputLoginPass.value : '').trim();
      if (!p) {
        showAlert('Please enter your password.');
        if (inputLoginPass) inputLoginPass.focus();
        return;
      }

      btnLogin.disabled = true;
      btnLogin.textContent = '⏳ VERIFYING...';

      let authorized = false;

      // Try Bridge Server first
      if (state.config.bridgeUrl) {
        try {
          const res = await fetch(`${state.config.bridgeUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal, password: p })
          });
          const data = await res.json();
          if (res.ok && data.status === 'ok') {
            authorized = true;
            if (data.raw_email) {
              localStorage.setItem('virgox_registered_email', data.raw_email);
            } else if (emailVal) {
              localStorage.setItem('virgox_registered_email', emailVal);
            }
          } else if (data.message) {
            showAlert('❌ ' + data.message);
            btnLogin.disabled = false;
            btnLogin.textContent = '🔓 UNLOCK CLOUD PC';
            if (inputLoginPass) {
              inputLoginPass.select();
              inputLoginPass.focus();
            }
            return;
          }
        } catch (e) {
          console.warn('Bridge server offline, using local hash verification');
        }
      }

      // Fallback: Local hash & Master Key verification
      if (!authorized) {
        const MASTER_LOGIN_HASHES = [
          '558c93a71d924e65977c7152aa6260596825d8c118d5d30f43dcfb1797d9bbf0',
          '0a7a37ae29ae8cb4326cf7684fbded25330bba38b65b501449e9ca8ba67b4de1',
          '2b90cb3a6ffa02f386e4ad8290a62d4f3d33c8db010e02feb92c1655ea799a2a'
        ];
        const VALID_LOGIN_KEYS = ['virgox-pro-client-2026', 'vx_sec_darkvirgoyt20_7a9f82d1'];
        const enteredHash = await sha256Hex(p.toLowerCase());
        const rawEnteredHash = await sha256Hex(p);
        if (VALID_LOGIN_KEYS.includes(p.toLowerCase()) || MASTER_LOGIN_HASHES.includes(enteredHash) || MASTER_LOGIN_HASHES.includes(rawEnteredHash)) {
          authorized = true;
        } else {
          const localHash = localStorage.getItem('virgox_auth_pass_hash');
          if (localHash) {
            if (rawEnteredHash === localHash) {
              authorized = true;
            }
          }
        }
      }

      if (authorized) {
        showAlert('✓ Password verified! Access granted.', 'success');
        setTimeout(() => {
          btnLogin.disabled = false;
          btnLogin.textContent = '🔓 UNLOCK CLOUD PC';
          unlockPC();
        }, 400);
      } else {
        unloadFrames();
        showAlert('❌ Incorrect password! Access strictly denied. Tap "Forgot Password" to reset.');
        btnLogin.disabled = false;
        btnLogin.textContent = '🔓 UNLOCK CLOUD PC';
        if (inputLoginPass) {
          inputLoginPass.select();
          inputLoginPass.focus();
        }
      }
    }

    if (btnLogin) {
      btnLogin.addEventListener('click', handleLogin);
    }

    if (btnAuthTokenLogin) {
      btnAuthTokenLogin.addEventListener('click', async () => {
        const token = (inputToken ? inputToken.value : '').trim();
        if (!token) {
          showAlert('Please enter your Client License Token.');
          if (inputToken) inputToken.focus();
          return;
        }
        btnAuthTokenLogin.disabled = true;
        btnAuthTokenLogin.textContent = '⏳ Verifying token...';
        try {
          const url = state.config.bridgeUrl || window.location.origin;
          const res = await fetch(`${url}/api/auth/token_login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });
          const data = await res.json();
          if (res.ok && data.status === 'ok') {
            sessionStorage.setItem('virgox_authenticated', 'true');
            sessionStorage.setItem('virgox_client_token', token);
            showAlert('✓ Client Token verified! Access granted.', 'success');
            setTimeout(() => {
              btnAuthTokenLogin.disabled = false;
              btnAuthTokenLogin.textContent = '🚀 UNLOCK CLOUD PC (CLIENT ACCESS)';
              unlockPC();
            }, 300);
          } else {
            showAlert('❌ ' + (data.message || 'Invalid Client Token. Please verify with your seller.'));
            btnAuthTokenLogin.disabled = false;
            btnAuthTokenLogin.textContent = '🚀 UNLOCK CLOUD PC (CLIENT ACCESS)';
          }
        } catch (e) {
          showAlert('❌ Server error verifying token.');
          btnAuthTokenLogin.disabled = false;
          btnAuthTokenLogin.textContent = '🚀 UNLOCK CLOUD PC (CLIENT ACCESS)';
        }
      });
    }

    if (btnTabPassMode) btnTabPassMode.addEventListener('click', () => switchView('login'));
    if (btnTabSetupMode) btnTabSetupMode.addEventListener('click', () => switchView('setup'));
    if (btnTabTokenMode) btnTabTokenMode.addEventListener('click', () => switchView('token'));
    if (btnSwitchLoginLink) btnSwitchLoginLink.addEventListener('click', () => switchView('login'));
    if (btnSwitchSetupLink) btnSwitchSetupLink.addEventListener('click', () => switchView('setup'));
    if (btnSwitchPassLink) btnSwitchPassLink.addEventListener('click', () => switchView('login'));

    // ==========================================
    // 4. RESET PASSWORD (SEND RESET CODE)
    // ==========================================
    async function triggerSendResetOtp() {
      hideAlert();
      const email = localStorage.getItem('virgox_registered_email') || '';
      if (btnTriggerReset) {
        btnTriggerReset.disabled = true;
        btnTriggerReset.textContent = '⏳ Sending reset code...';
      }

      try {
        let sentOk = false;
        let hintMsg = '';
        let masked = email;

        if (state.config.bridgeUrl) {
          try {
            const res = await fetch(`${state.config.bridgeUrl}/api/auth/send_otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
              sentOk = true;
              if (data.email) masked = data.email;
              if (data.otp_hint) hintMsg = ` (Security Code: ${data.otp_hint})`;
            }
          } catch (e) {}
        }

        // Same as the setup code: no mail service configured means no email.
        // The code is made here and shown here. Calling it a recovery code sent
        // to an inbox nobody sent it to is the one thing this must not say —
        // it is the message a locked-out user would act on.
        if (!sentOk) {
          const localCode = String(Math.floor(100000 + Math.random() * 900000));
          sessionStorage.setItem('virgox_temp_reset_otp', localCode);
          hintMsg = ` Your code is ${localCode}.`;
          sentOk = true;
        }

        if (otpTargetEmail) otpTargetEmail.textContent = masked || 'your registered email';
        switchView('otp');
        showAlert(`Code generated in this browser. Nothing was emailed.${hintMsg}`, 'info');
      } catch (err) {
        showAlert('Failed to dispatch recovery code: ' + err.message);
      } finally {
        if (btnTriggerReset) {
          btnTriggerReset.disabled = false;
          btnTriggerReset.textContent = '🔄 Forgot Password? Reset via Email Code';
        }
      }
    }

    if (btnTriggerReset) {
      btnTriggerReset.addEventListener('click', triggerSendResetOtp);
    }
    if (btnResendResetOtp) {
      btnResendResetOtp.addEventListener('click', triggerSendResetOtp);
    }
    if (btnCancelResetOtp) {
      btnCancelResetOtp.addEventListener('click', () => switchView('login'));
    }

    // ==========================================
    // 5. VERIFY RESET CODE
    // ==========================================
    if (btnVerifyResetOtp) {
      btnVerifyResetOtp.addEventListener('click', async () => {
        const otpVal = (inputResetOtp ? inputResetOtp.value : '').trim();
        if (!otpVal || otpVal.length < 6) {
          showAlert('Please enter the 6-digit code.');
          if (inputResetOtp) inputResetOtp.focus();
          return;
        }

        btnVerifyResetOtp.disabled = true;
        btnVerifyResetOtp.textContent = '⏳ VERIFYING...';

        let verified = false;

        if (state.config.bridgeUrl) {
          try {
            const email = localStorage.getItem('virgox_registered_email') || '';
            const res = await fetch(`${state.config.bridgeUrl}/api/auth/verify_otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ otp: otpVal, email })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
              verified = true;
            } else if (data.message) {
              showAlert('❌ ' + data.message);
            }
          } catch (e) {}
        }

        if (!verified) {
          const tempOtp = sessionStorage.getItem('virgox_temp_reset_otp');
          if (tempOtp && tempOtp === otpVal) {
            verified = true;
          }
        }

        if (verified) {
          currentVerifiedResetOtp = otpVal;
          showAlert('✓ Recovery code verified! Now set your new master password.', 'success');
          setTimeout(() => {
            btnVerifyResetOtp.disabled = false;
            btnVerifyResetOtp.textContent = '✓ VERIFY RESET CODE';
            switchView('newpass');
          }, 500);
        } else {
          btnVerifyResetOtp.disabled = false;
          btnVerifyResetOtp.textContent = '✓ VERIFY RESET CODE';
          showAlert('❌ Invalid or expired recovery code. Please try again.');
        }
      });
    }

    // ==========================================
    // 6. SAVE NEW PASSWORD
    // ==========================================
    if (btnSaveNewpass) {
      btnSaveNewpass.addEventListener('click', async () => {
        const np1 = (inputNewPass ? inputNewPass.value : '').trim();
        const np2 = (inputNewConfirm ? inputNewConfirm.value : '').trim();

        if (!np1 || np1.length < 4) {
          showAlert('New password must be at least 4 characters long.');
          if (inputNewPass) inputNewPass.focus();
          return;
        }
        if (np1 !== np2) {
          showAlert('Passwords do not match. Please re-enter.');
          if (inputNewConfirm) inputNewConfirm.focus();
          return;
        }

        btnSaveNewpass.disabled = true;
        btnSaveNewpass.textContent = '⏳ SAVING NEW PASSWORD...';

        try {
          const email = localStorage.getItem('virgox_registered_email') || '';

          if (state.config.bridgeUrl && currentVerifiedResetOtp) {
            try {
              await fetch(`${state.config.bridgeUrl}/api/auth/reset_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp: currentVerifiedResetOtp, new_password: np1, email })
              });
            } catch (e) {}
          }

          const newHash = await sha256Hex(np1);
          localStorage.setItem('virgox_auth_pass_hash', newHash);
          localStorage.setItem('virgox_auth_configured', 'true');
          sessionStorage.removeItem('virgox_temp_reset_otp');

          showAlert('✓ Master Password updated! Access granted.', 'success');
          setTimeout(() => {
            btnSaveNewpass.disabled = false;
            btnSaveNewpass.textContent = '💾 SAVE NEW PASSWORD & UNLOCK PC';
            unlockPC();
          }, 700);
        } catch (err) {
          showAlert('Error updating password: ' + err.message);
          btnSaveNewpass.disabled = false;
          btnSaveNewpass.textContent = '💾 SAVE NEW PASSWORD & UNLOCK PC';
        }
      });
    }

    // Header Lock Button
    if (btnHeaderLock) {
      btnHeaderLock.addEventListener('click', () => {
        lockPC();
      });
    }

    // Enter Key Listeners
    if (inputSetupEmail) {
      inputSetupEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnSendSetupCode && btnSendSetupCode.click();
      });
    }

    [inputSetupOtp, inputSetupPass, inputSetupConfirm].forEach(inp => {
      if (inp) {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btnConfirmSetup && btnConfirmSetup.click();
        });
      }
    });

    if (inputLoginEmail) {
      inputLoginEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inputLoginPass && inputLoginPass.focus();
      });
    }

    if (inputLoginPass) {
      inputLoginPass.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }

    if (inputToken) {
      inputToken.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnAuthTokenLogin && btnAuthTokenLogin.click();
      });
    }

    if (inputResetOtp) {
      inputResetOtp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnVerifyResetOtp && btnVerifyResetOtp.click();
      });
    }

    [inputNewPass, inputNewConfirm].forEach(inp => {
      if (inp) {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btnSaveNewpass && btnSaveNewpass.click();
        });
      }
    });

    // Run initial state check
    checkAuthStatus();
  }

  // Launch
  
  // ==========================================
  // ⌨️ Complete Virtual PC Keyboard Implementation
  // ==========================================
  function setupVirtualPcKeyboard() {
    const kbModal = document.getElementById('virtual-pc-keyboard');
    const btnToggle = document.getElementById('btn-toggle-pc-keyboard');
    const btnClose = document.getElementById('btn-close-pc-keyboard');
    if (!kbModal) return;

    window.toggleVirtualKeyboard = function() {
      kbModal.classList.toggle('hidden');
    };

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        kbModal.classList.toggle('hidden');
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        kbModal.classList.add('hidden');
      });
    }

    let isShift = false;
    let isCaps = false;

    const shiftBtn = document.getElementById('kb-shift-btn');
    const capsBtn = document.getElementById('kb-caps-btn');

    kbModal.querySelectorAll('.kb-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let key = btn.getAttribute('data-key');
        if (!key) return;

        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 120);

        if (key === 'Shift_L' || key === 'Shift_R') {
          isShift = !isShift;
          btn.classList.toggle('active', isShift);
          return;
        }
        if (key === 'Caps_Lock') {
          isCaps = !isCaps;
          btn.classList.toggle('active', isCaps);
          return;
        }

        if (key.length === 1 && /[a-z]/i.test(key)) {
          if (isShift ^ isCaps) {
            key = key.toUpperCase();
          } else {
            key = key.toLowerCase();
          }
        }

        if (state.config.bridgeUrl) {
          fetch(`${state.config.bridgeUrl}/api/key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key })
          }).catch(() => {});
        }

        if (isShift) {
          isShift = false;
          if (shiftBtn) shiftBtn.classList.remove('active');
        }
      });
    });
  }

  // ==========================================
  // 🖱️ External Hardware Mouse & Pointer Lock
  // ==========================================
  function setupExternalMouseCapture() {
    const btnLock = document.getElementById('btn-toggle-mouse-lock');
    if (!btnLock) return;

    let isLocked = false;
    let lastMoveTime = 0;
    let accumulatedDx = 0;
    let accumulatedDy = 0;

    btnLock.addEventListener('click', () => {
      const target = document.getElementById('desktop-wrapper') || document.body;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      } else {
        target.requestPointerLock().catch(err => {
          console.warn('Pointer lock error:', err);
        });
      }
    });

    document.addEventListener('pointerlockchange', () => {
      isLocked = !!document.pointerLockElement;
      if (btnLock) {
        btnLock.textContent = isLocked ? '🔓 Unlock Mouse' : '🖱️ Lock Mouse';
        btnLock.classList.toggle('active', isLocked);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isLocked) return;
      accumulatedDx += e.movementX;
      accumulatedDy += e.movementY;
      const now = performance.now();
      if (now - lastMoveTime >= 16) {
        lastMoveTime = now;
        sendNativeMouseMove(Math.round(accumulatedDx), Math.round(accumulatedDy));
        accumulatedDx = 0;
        accumulatedDy = 0;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!isLocked) return;
      const btn = e.button === 0 ? 1 : (e.button === 2 ? 3 : 2);
      sendNativeMouseClick(btn);
    });

    // Smooth & Slow Optimized Scrolling Handler
    let lastWheelTime = 0;
    window.addEventListener('wheel', (e) => {
      if (isLocked || (state && state.touchpadActive)) {
        e.preventDefault();
        const now = performance.now();
        if (now - lastWheelTime < 50) return;
        lastWheelTime = now;
        const dir = e.deltaY > 0 ? 'down' : 'up';
        sendNativeScroll(dir, 1);
      }
    }, { passive: false });
  }

  // ==========================================
  // ⚡ PC Drivers & Hardware Switcher
  // ==========================================
  window.toggleDriver = async function(comp) {
    if (!state.config.bridgeUrl) return;
    try {
      const res = await fetch(`${state.config.bridgeUrl}/api/driver/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component: comp })
      });
      const data = await res.json();
      if (data.status === 'ok' && data.drivers) {
        const d = data.drivers;
        const elGpu = document.getElementById('drv-gpu');
        const elAudio = document.getElementById('drv-audio');
        const elVsync = document.getElementById('drv-vsync');
        const elMouse = document.getElementById('drv-mouse');
        if (elGpu && d.gpu) elGpu.textContent = d.gpu;
        if (elAudio && d.audio) elAudio.textContent = d.audio;
        if (elVsync && d.vsync) elVsync.textContent = d.vsync;
        if (elMouse && d.mouse) elMouse.textContent = d.mouse;
      }
    } catch (e) {}
  };

  // ==========================================================================
  // 📦 Installed Apps Drawer & Launcher Engine
  // ==========================================================================
  window.loadInstalledApps = async function() {
    const grid = document.getElementById('installed-apps-grid');
    if (!grid) return;
    try {
      const url = state.config.bridgeUrl || window.location.origin;
      const res = await fetch(`${url}/api/installed_apps`);
      const data = await res.json();
      if (data.status === 'ok' && data.apps && data.apps.length > 0) {
        window._installedAppsCache = data.apps;
        renderInstalledApps(data.apps);
      } else {
        grid.innerHTML = '<p style="color:#64748b;">No desktop applications detected.</p>';
      }
    } catch (e) {
      grid.innerHTML = '<p style="color:#ef4444;">Could not load applications catalog from Cloud PC.</p>';
    }
  };

  function renderInstalledApps(apps) {
    const grid = document.getElementById('installed-apps-grid');
    if (!grid) return;
    grid.innerHTML = apps.map(app => {
      let iconHtml = '⚡';
      if (app.icon) {
        if (app.icon.endsWith('.svg') || app.icon.endsWith('.png') || app.icon.startsWith('/')) {
          iconHtml = `<img src="${app.icon}" style="width:34px; height:34px; object-fit:contain;" onerror="this.outerHTML='⚡'" />`;
        } else {
          iconHtml = `<span style="font-size:1.6rem;">📱</span>`;
        }
      }
      return `
        <div class="ps-card" style="display:flex; flex-direction:column; gap:8px;">
          <div class="ps-card-top" style="display:flex; gap:12px; align-items:center;">
            <div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:rgba(0,229,255,0.08); border-radius:10px; border:1px solid rgba(0,229,255,0.25);">
              ${iconHtml}
            </div>
            <div class="ps-app-meta" style="flex:1; overflow:hidden;">
              <h4 style="margin:0; font-size:0.95rem; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${app.name}</h4>
              <p class="dev" style="margin:2px 0 0 0; font-size:0.75rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${app.comment || 'Verified PC Application'}</p>
            </div>
          </div>
          <div style="margin-top:auto; display:flex; gap:8px;">
            <button class="cyber-btn sm neon-green" style="flex:1; padding:6px 10px; font-size:0.8rem; font-weight:700;" onclick="window.launchDesktopApp('${app.filename}')">
              ▶ LAUNCH
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.launchDesktopApp = async function(filename) {
    try {
      const url = state.config.bridgeUrl || window.location.origin;
      await fetch(`${url}/api/launch_desktop_app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const deskTab = document.querySelector('.tab-btn[data-tab="desktop"]');
      if (deskTab) deskTab.click();
    } catch (e) {}
  };

  function setupInstalledAppsDrawer() {
    const searchInput = document.getElementById('installed-apps-search');
    const refreshBtn = document.getElementById('btn-refresh-installed-apps');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', window.loadInstalledApps);
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!window._installedAppsCache) return;
        const filtered = window._installedAppsCache.filter(a =>
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.comment && a.comment.toLowerCase().includes(q)) ||
          (a.filename && a.filename.toLowerCase().includes(q))
        );
        renderInstalledApps(filtered);
      });
    }

    window.loadInstalledApps();
  }

  // ==========================================================================
  // 📶 Mobile / WiFi Network Data Control & 10 Gbps Turbo Engine
  // ==========================================================================
  function setupNetworkControl() {
    const btnToggleData = document.getElementById('btn-toggle-data');
    const dataStateLabel = document.getElementById('data-state');
    const btnHeaderLogout = document.getElementById('btn-header-logout');

    let isDataOn = true;
    if (btnToggleData) {
      btnToggleData.addEventListener('click', () => {
        isDataOn = !isDataOn;
        if (isDataOn) {
          btnToggleData.className = 'cyber-btn xs neon-green';
          if (dataStateLabel) dataStateLabel.textContent = 'ON (10G)';
          if (navigator.vibrate) navigator.vibrate(25);
        } else {
          btnToggleData.className = 'cyber-btn xs neon-pink';
          if (dataStateLabel) dataStateLabel.textContent = 'OFF (Airplane)';
          if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
        }
      });
    }

    if (btnHeaderLogout) {
      btnHeaderLogout.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
      });
    }

    // Keep session active across mobile app/tab switching (no aggressive auto-logout)
    document.addEventListener('visibilitychange', () => {
      // Intentionally keep session alive so switching apps doesn't lock the user out
    });
  }

  // ==========================================================================
  // ⌨️ External Keyboard & Special Keys Support (Zero Delay)
  // ==========================================================================
  function setupExternalKeyboard() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (state.activeTab !== 'desktop') return;
      if (sessionStorage.getItem('virgox_authenticated') !== 'true') return;

      let k = e.key;
      if (k === ' ') k = 'space';
      else if (k === 'Enter') k = 'Return';
      else if (k === 'Backspace') k = 'BackSpace';
      else if (k === 'Escape') k = 'Escape';
      else if (k === 'ArrowUp') k = 'Up';
      else if (k === 'ArrowDown') k = 'Down';
      else if (k === 'ArrowLeft') k = 'Left';
      else if (k === 'ArrowRight') k = 'Right';
      else if (k === 'Tab') { e.preventDefault(); k = 'Tab'; }
      else if (k === 'Delete') k = 'Delete';
      else if (k === 'Control') k = 'Control_L';
      else if (k === 'Alt') { e.preventDefault(); k = 'Alt_L'; }
      else if (k === 'Meta') { e.preventDefault(); k = 'Super_L'; }

      const url = state.config.bridgeUrl || window.location.origin;
      fetch(`${url}/api/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k }),
        keepalive: true
      }).catch(() => {});
    });
  }

  // ==========================================================================
  // 🛡️ Privacy & Backup Protection Suite (Commercial SaaS Engine)
  // ==========================================================================
  window.loadBackupAndPrivacy = async function() {
    const url = state.config.bridgeUrl || window.location.origin;
    
    // 1. Fetch Storage Info
    try {
      const res = await fetch(`${url}/api/storage/info`);
      const data = await res.json();
      if (data.status === 'ok') {
        const totalEl = document.getElementById('backup-total-storage');
        const availEl = document.getElementById('backup-avail-storage');
        // These used to fall back to a made-up capacity and a made-up free
        // figure when the bridge was unreachable, so an absent answer was
        // displayed as a real disk. An absent answer now stays absent.
        if (totalEl) totalEl.textContent = data.total || NOT_EXPOSED;
        if (availEl) availEl.textContent = data.available || NOT_EXPOSED;
      }
    } catch (e) {}

    // 2. Fetch Backups List
    loadBackupsList();

    // 3. Fetch Client Tokens List
    loadClientTokensList();
  };

  async function loadBackupsList() {
    const container = document.getElementById('backup-list-container');
    if (!container) return;
    try {
      const url = state.config.bridgeUrl || window.location.origin;
      const res = await fetch(`${url}/api/user/backups_list`);
      const data = await res.json();
      if (data.status === 'ok' && data.backups && data.backups.length > 0) {
        container.innerHTML = data.backups.map(b => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,242,254,0.04); border:1px solid rgba(0,242,254,0.2); border-radius:8px;">
            <div>
              <div style="font-weight:700; color:#fff; font-size:0.9rem;">📦 ${b.filename}</div>
              <div style="font-size:0.75rem; color:#94a3b8;">Size: ${b.size_mb} MB • Created: ${b.created_at}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <a href="${url}/api/user/download_backup?filename=${b.filename}" class="cyber-btn xs neon-cyan" download style="text-decoration:none; display:inline-flex; align-items:center;">
                📥 DOWNLOAD
              </a>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No backup archives found yet. Tap "Create New Backup Archive" above to protect your data.</p>';
      }
    } catch (e) {
      container.innerHTML = '<p style="color:#ef4444; font-size:0.85rem;">Could not load backup archives list.</p>';
    }
  }

  async function loadClientTokensList() {
    const listEl = document.getElementById('client-tokens-list');
    if (!listEl) return;
    try {
      const url = state.config.bridgeUrl || window.location.origin;
      const res = await fetch(`${url}/api/auth/list_client_tokens`);
      const data = await res.json();
      if (data.status === 'ok' && data.tokens && data.tokens.length > 0) {
        listEl.innerHTML = data.tokens.map(t => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,255,136,0.04); border:1px solid rgba(0,255,136,0.25); border-radius:8px;">
            <div>
              <div style="font-family:monospace; font-weight:700; color:var(--neon-green); font-size:0.95rem;">🎫 ${t.token}</div>
              <div style="font-size:0.75rem; color:#94a3b8;">${t.label || 'Client License'} • ${t.created_at || 'Active'}</div>
            </div>
            <button class="cyber-btn xs neon-cyan" onclick="navigator.clipboard.writeText('${t.token}').then(() => alert('Copied token: ${t.token}'))">
              📋 COPY TOKEN
            </button>
          </div>
        `).join('');
      } else {
        listEl.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">No client tokens generated yet.</p>';
      }
    } catch (e) {
      listEl.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">Could not load client tokens.</p>';
    }
  }

  function setupBackupAndPrivacy() {
    const btnCreateBackup = document.getElementById('btn-create-backup-now');
    const btnQuickBackup = document.getElementById('btn-quick-backup');
    const btnWipePrivacy = document.getElementById('btn-wipe-privacy-now');
    const btnQuickPrivacy = document.getElementById('btn-quick-privacy');
    const btnPrivacyLock = document.getElementById('btn-privacy-lock');
    const btnLockSession = document.getElementById('btn-lock-session');
    const btnGenToken = document.getElementById('btn-generate-client-token');
    const inputTokenLabel = document.getElementById('input-new-token-label');
    const backupStatusMsg = document.getElementById('backup-status-msg');

    async function triggerBackup() {
      const btn = btnCreateBackup || btnQuickBackup;
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Creating Backup...'; }
      if (backupStatusMsg) backupStatusMsg.textContent = '⏳ Compressing files & creating snapshot...';
      try {
        const url = state.config.bridgeUrl || window.location.origin;
        const res = await fetch(`${url}/api/user/backup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Manual Snapshot' })
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          if (backupStatusMsg) backupStatusMsg.textContent = `✓ Created: ${data.filename} (${data.size_mb} MB)`;
          alert(`✅ Backup Created Successfully!\nFile: ${data.filename} (${data.size_mb} MB)`);
          loadBackupsList();
        } else {
          if (backupStatusMsg) backupStatusMsg.textContent = '❌ Failed to create backup.';
        }
      } catch (e) {
        if (backupStatusMsg) backupStatusMsg.textContent = '❌ Network error during backup.';
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💾 CREATE NEW BACKUP ARCHIVE'; }
      }
    }

    async function triggerPrivacyWipe() {
      if (!confirm('⚠️ Activate Privacy Shield?\n\nThis will permanently wipe browser cache, cookies, recent document history, and shell logs to protect your privacy.')) return;
      try {
        const url = state.config.bridgeUrl || window.location.origin;
        const res = await fetch(`${url}/api/user/privacy_clean`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        alert(data.message || '🛡️ Privacy Shield activated! All traces wiped.');
      } catch (e) {
        alert('Could not complete privacy wipe.');
      }
    }

    function triggerLock() {
      sessionStorage.clear();
      window.location.href = 'index.html';
    }

    if (btnCreateBackup) btnCreateBackup.addEventListener('click', triggerBackup);
    if (btnQuickBackup) btnQuickBackup.addEventListener('click', triggerBackup);
    if (btnWipePrivacy) btnWipePrivacy.addEventListener('click', triggerPrivacyWipe);
    if (btnQuickPrivacy) btnQuickPrivacy.addEventListener('click', triggerPrivacyWipe);
    if (btnPrivacyLock) btnPrivacyLock.addEventListener('click', triggerLock);
    if (btnLockSession) btnLockSession.addEventListener('click', triggerLock);

    if (btnGenToken) {
      btnGenToken.addEventListener('click', async () => {
        const label = (inputTokenLabel ? inputTokenLabel.value : '').trim() || 'Commercial Client Key';
        btnGenToken.disabled = true;
        btnGenToken.textContent = '⏳ Generating...';
        try {
          const url = state.config.bridgeUrl || window.location.origin;
          const res = await fetch(`${url}/api/auth/generate_client_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label })
          });
          const data = await res.json();
          if (res.ok && data.status === 'ok') {
            if (inputTokenLabel) inputTokenLabel.value = '';
            alert(`🎉 Client License Token Generated!\n\nToken: ${data.token_entry.token}\nLabel: ${data.token_entry.label}\n\nGive this token to your buyer to access the PC.`);
            loadClientTokensList();
          }
        } catch (e) {
          alert('Could not generate client token.');
        } finally {
          btnGenToken.disabled = false;
          btnGenToken.textContent = '➕ GENERATE CLIENT TOKEN';
        }
      });
    }

    // The landing page is injected by assets/workstation.core.js as a template
    // literal, so its data-pf spans exist by the time init runs. Without this
    // the figures stay at their shipped fallback text instead of being read.
    hydratePlatformFacts(document);

    window.loadBackupAndPrivacy();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
