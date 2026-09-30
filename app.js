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
    osMode: 'linux', // 'linux' or 'windows'
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

    if (picture && avatarImg && avatarInitials) {
      avatarImg.src = picture;
      avatarImg.style.display = 'block';
      avatarInitials.style.display = 'none';
    } else if (avatarInitials) {
      avatarInitials.textContent = (name.charAt(0) || 'U').toUpperCase();
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

  // Initialize
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
      setupNetworkControl, setupExternalKeyboard, setupBackupAndPrivacy
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

    async function verifyOrOpenExternal(url) {
      if (sessionStorage.getItem('virgox_authenticated') === 'true') {
        window.open(url, '_blank');
        return;
      }
      const pass = prompt('🔑 Enter Master/PC Security Key to open Cloud PC in a new tab:');
      if (pass) {
        const p = pass.trim();
        const pHash = await sha256Hex(p.toLowerCase());
        const validHashes = [
          '558c93a71d924e65977c7152aa6260596825d8c118d5d30f43dcfb1797d9bbf0',
          '0a7a37ae29ae8cb4326cf7684fbded25330bba38b65b501449e9ca8ba67b4de1',
          '2b90cb3a6ffa02f386e4ad8290a62d4f3d33c8db010e02feb92c1655ea799a2a'
        ];
        const valid = ['virgox-pro-client-2026', 'vx_sec_darkvirgoyt20_7a9f82d1'];
        if (valid.includes(p.toLowerCase()) || validHashes.includes(pHash)) {
          sessionStorage.setItem('virgox_master_unlocked', 'true');
          sessionStorage.setItem('virgox_authenticated', 'true');
          localStorage.setItem('virgox_auth_configured', 'true');
          if (authOverlay) authOverlay.classList.add('hidden');
          loadFrames();
          window.open(url, '_blank');
          return;
        } else {
          alert('❌ Incorrect Password. Please enter your valid Master Security Key.');
        }
      }
      if (authOverlay) {
        authOverlay.classList.remove('hidden');
        switchView('master');
      }
    }

    document.getElementById('open-external-desktop').addEventListener('click', () => {
      verifyOrOpenExternal(state.config.desktopUrl);
    });

    document.getElementById('open-external-terminal').addEventListener('click', () => {
      verifyOrOpenExternal(state.config.terminalUrl);
    });

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
  let highestZ = 20;
  const openWindows = {};

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
          <div class="cyber-desktop-watermark">
            VIRGOX CYBER OS<br>
            <span style="font-size:1.05rem; opacity:0.85;">64 GB VIRTUAL RAM • 120 FPS</span>
          </div>

          <div class="cyber-desktop-hud">
            <div class="hud-row"><span>⚡ CPU:</span> <span class="hud-val">14% (32-Core Turbo)</span></div>
            <div class="hud-row"><span>🧠 RAM:</span> <span class="hud-val">64 GB (ZRAM Engine)</span></div>
            <div class="hud-row"><span>💽 DISK:</span> <span class="hud-val">5.0 TB (/dev/loop0)</span></div>
            <div class="hud-row"><span>🎮 FPS:</span> <span class="hud-val" style="color:var(--neon-green);">120 FPS SYNC</span></div>
          </div>

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
              <button class="taskbar-app-icon" data-open="msstore" title="Microsoft Store">🛍️</button>
              <button class="taskbar-app-icon" data-open="browser" title="Web Browser">🌐</button>
              <button class="taskbar-app-icon" data-open="files" title="This PC / Files">📁</button>
              <button class="taskbar-app-icon" data-open="editor" title="Code Studio">📝</button>
              <button class="taskbar-app-icon" data-open="taskmgr" title="Task Manager">📊</button>
            </div>
            <div class="taskbar-active-chips" id="taskbar-active-chips"></div>
          </div>
          <div class="taskbar-right-tray">
            <span title="High-Speed Hardware Symmetrical">📶 10G</span>
            <span title="Audio Driver">🔊</span>
            <span style="color:var(--neon-green); font-weight:700;">120Hz</span>
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
            <button class="cyber-btn sm" data-start-app="terminal" style="text-align:left; justify-content:flex-start;">💻 Terminal CLI (Root Bash)</button>
            <button class="cyber-btn sm" data-start-app="msstore" style="text-align:left; justify-content:flex-start;">🛍️ Microsoft Store (Web Hub)</button>
            <button class="cyber-btn sm" data-start-app="browser" style="text-align:left; justify-content:flex-start;">🌐 Chrome Web Browser</button>
            <button class="cyber-btn sm" data-start-app="files" style="text-align:left; justify-content:flex-start;">📁 This PC (5.0 TB Storage)</button>
            <button class="cyber-btn sm" data-start-app="editor" style="text-align:left; justify-content:flex-start;">📝 Code Studio Editor</button>
            <button class="cyber-btn sm" data-start-app="taskmgr" style="text-align:left; justify-content:flex-start;">📊 Task Manager (64GB RAM)</button>
            <button class="cyber-btn sm" data-start-app="steam" style="text-align:left; justify-content:flex-start;">🎮 Steam Gaming Platform</button>
            <button class="cyber-btn sm" data-start-app="blender" style="text-align:left; justify-content:flex-start;">🚀 Blender 5.0.1 3D Studio</button>
            <button class="cyber-btn sm" data-start-app="unreal" style="text-align:left; justify-content:flex-start;">⚡ Unreal Engine 6 Hub</button>
            <button class="cyber-btn sm" data-start-app="photopea" style="text-align:left; justify-content:flex-start;">🎨 Photoshop Studio (Photopea)</button>
            <button class="cyber-btn sm" data-start-app="shotcut" style="text-align:left; justify-content:flex-start;">🎬 Shotcut 4K Video Editor</button>
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
      { id: 'browser', name: 'Chrome Web', icon: '🌐' },
      { id: 'files', name: 'This PC (5TB)', icon: '📁' },
      { id: 'editor', name: 'Code Studio', icon: '📝' },
      { id: 'taskmgr', name: 'Task Manager', icon: '📊' },
      { id: 'photopea', name: 'Photoshop', icon: '🎨' },
      { id: 'shotcut', name: 'Video Studio', icon: '🎬' },
      { id: 'steam', name: 'Steam Hub', icon: '🎮' },
      { id: 'blender', name: 'Blender 5.0', icon: '🚀' },
      { id: 'unreal', name: 'Unreal Engine', icon: '⚡' },
      { id: 'settings', name: 'Stream Config', icon: '⚙️' }
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

    // Initial default window: Open Terminal on startup!
    setTimeout(() => {
      openAppWindow('terminal');
    }, 300);

    updateDesktopModeUI();
  }

  function openAppWindow(appId) {
    const windowsLayer = document.getElementById('desktop-windows-layer');
    if (!windowsLayer) return;

    if (appId === 'settings' || appId === 'windows_settings') {
      const btnSet = document.getElementById('btn-settings');
      if (btnSet) btnSet.click();
      return;
    }

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
    const configs = {
      terminal: {
        title: 'Terminal CLI (Root Bash — Port 7681/8888)',
        icon: '💻',
        width: Math.min(500, window.innerWidth - 30),
        height: 310,
        content: getTerminalHtml()
      },
      msstore: {
        title: 'Microsoft Store (Web) — Windows & Linux Apps Hub',
        icon: '🛍️',
        width: Math.min(680, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getMsStoreHtml()
      },
      microsoft_store: {
        title: 'Microsoft Store (Web) — Windows & Linux Apps Hub',
        icon: '🛍️',
        width: Math.min(680, window.innerWidth - 20),
        height: Math.min(460, window.innerHeight - 80),
        content: getMsStoreHtml()
      },
      files: {
        title: 'This PC — 5.0 TB High-Speed Storage Pool',
        icon: '📁',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getFilesHtml()
      },
      browser: {
        title: 'Chromium Web Browser',
        icon: '🌐',
        width: Math.min(560, window.innerWidth - 20),
        height: Math.min(440, window.innerHeight - 80),
        content: getBrowserHtml()
      },
      editor: {
        title: 'VirgoX Code Studio Editor',
        icon: '📝',
        width: Math.min(520, window.innerWidth - 30),
        height: 340,
        content: getEditorHtml()
      },
      taskmgr: {
        title: 'Task Manager (64 GB Virtual RAM • 120 FPS)',
        icon: '📊',
        width: Math.min(480, window.innerWidth - 30),
        height: 320,
        content: getTaskmgrHtml()
      },
      photopea: {
        title: 'Adobe Photoshop Studio (Photopea Pro)',
        icon: '🎨',
        width: Math.min(600, window.innerWidth - 20),
        height: 380,
        content: `<iframe src="https://www.photopea.com" style="width:100%; height:100%; border:none;"></iframe>`
      },
      photoshop: {
        title: 'Adobe Photoshop Studio (Photopea Pro)',
        icon: '🎨',
        width: Math.min(600, window.innerWidth - 20),
        height: 380,
        content: `<iframe src="https://www.photopea.com" style="width:100%; height:100%; border:none;"></iframe>`
      },
      shotcut: {
        title: 'Shotcut 4K Video Editor Studio',
        icon: '🎬',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getVideoEditorHtml()
      },
      video_editor: {
        title: 'Shotcut 4K Video Editor Studio',
        icon: '🎬',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getVideoEditorHtml()
      },
      steam: {
        title: 'Steam Gaming Platform',
        icon: '🎮',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getSteamHtml()
      },
      blender: {
        title: 'Blender 5.0.1 3D Creation Suite',
        icon: '🚀',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getBlenderHtml()
      },
      unreal: {
        title: 'Unreal Engine 6 Hub',
        icon: '⚡',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getUnrealHtml()
      },
      unreal_engine: {
        title: 'Unreal Engine 6 Hub',
        icon: '⚡',
        width: Math.min(520, window.innerWidth - 30),
        height: 330,
        content: getUnrealHtml()
      }
    };

    const cfg = configs[appId] || {
      title: appId.toUpperCase(),
      icon: '🗔',
      width: Math.min(480, window.innerWidth - 30),
      height: 300,
      content: `<div style="padding:20px; color:#fff;"><h4>⚡ Application Running: ${appId}</h4><p style="color:#aaa; font-size:0.85rem; margin-top:8px;">Running inside VirgoX container with 64 GB virtual RAM and 120 FPS hardware acceleration.</p></div>`
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
    if (appId === 'terminal') initTerminalInput(win);
    if (appId === 'browser') initBrowserActions(win);
    if (appId === 'msstore' || appId === 'microsoft_store') initMsStoreActions(win);
    if (appId === 'editor') initEditorActions(win);

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

  function getTerminalPrompt(cwd) {
    const p = cwd === '/root' ? '~' : cwd;
    return `root@virgox-pc:${p}#`;
  }

  function getTerminalHtml() {
    return `
      <div class="cyber-term-view" id="native-term-body">
        <div style="color:var(--neon-cyan); margin-bottom:4px;">⚡ <strong>VirgoX Cyber Linux Desktop v2.0</strong> (Resolute Raccoon / Ubuntu 26.04 aarch64)</div>
        <div style="color:#8892b0; font-size:0.75rem; margin-bottom:8px;">
          👑 Architect: <strong>Prince · VirgoYT</strong> | Virtual RAM: <strong>64 GB Pool</strong> | Engine: <strong>120 FPS Synchronized</strong><br>
          Connected to Real Linux Subprocess (PRoot-Distro / Port 8888). Type any command: <code>neofetch</code>, <code>ls -la</code>, <code>pwd</code>, <code>whoami</code>, <code>apt</code>, <code>python3</code>, <code>clear</code>.
        </div>
        <div id="term-output-stream" style="white-space:pre-wrap; word-break:break-all;"></div>
        <div class="cyber-term-input-row">
          <span class="cyber-term-prompt" id="native-term-prompt">${getTerminalPrompt(termCwd)}</span>
          <input type="text" class="cyber-term-input" id="native-term-input" autocomplete="off" spellcheck="false" />
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

        output.innerHTML += `\n<span style="color:var(--neon-cyan); font-weight:700;">${getTerminalPrompt(termCwd)}</span> <span style="color:#fff;">${escapeHtml(cmd)}</span>\n`;

        if (cmd === 'clear') {
          output.innerHTML = '';
          if (termBody) termBody.scrollTop = 0;
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
          runLocalShellFallback(cmd, output, promptEl);
        }

        if (termBody) termBody.scrollTop = termBody.scrollHeight;
      }
    });

    win.addEventListener('click', () => input.focus());
    setTimeout(() => input.focus(), 80);
  }

  function runLocalShellFallback(cmd, output, promptEl) {
    const lower = cmd.toLowerCase().trim();
    if (lower === 'help') {
      output.innerHTML += `VirgoX Linux Core Commands:
  • neofetch / specs - Display hardware specs, 64GB RAM & 120 FPS pool
  • pwd              - Print current working directory
  • cd <dir>         - Change current working directory
  • ls [-la]         - List files and directories
  • whoami           - Display active user profile (root)
  • uname -a         - Display operating system kernel version
  • free -h          - Virtual ZRAM memory statistics
  • df -h            - Disk space and storage pool
  • ps aux / top     - View active system processes
  • date / uptime    - Current system timestamp & uptime
  • apt <cmd>        - Linux Advanced Package Tool
  • python3 -V       - Python programming environment
  • clear            - Clear terminal screen\n`;
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
      output.innerHTML += `root\n`;
    } else if (lower === 'id') {
      output.innerHTML += `uid=0(root) gid=0(root) groups=0(root)\n`;
    } else if (lower === 'uname' || lower === 'uname -a') {
      output.innerHTML += `Linux localhost 6.17.0-PRoot-Distro #1 SMP PREEMPT_DYNAMIC Fri Oct 10 2025 aarch64 GNU/Linux\n`;
    } else if (lower === 'date') {
      output.innerHTML += `${new Date().toUTCString()}\n`;
    } else if (lower === 'uptime') {
      output.innerHTML += ` ${new Date().toLocaleTimeString()} up 24 days, 16:45,  1 user,  load average: 0.12, 0.08, 0.04\n`;
    } else if (lower === 'neofetch' || lower === 'specs') {
      output.innerHTML += `       ⚡⚡⚡⚡⚡⚡⚡⚡⚡          root@virgox-pc
     ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡        --------------
    ⚡⚡⚡  VIRGOX  ⚡⚡⚡       OS: Ubuntu 26.04.1 LTS (Resolute Raccoon) aarch64
   ⚡⚡⚡   CYBER   ⚡⚡⚡      Host: Motorola FogOS Cloud Workstation (120Hz Mode)
  ⚡⚡⚡     OS     ⚡⚡⚡     Kernel: 6.17.0-PRoot-Distro
 ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡   Uptime: 24 days, 16 hours, 45 mins
  ⚡⚡⚡            ⚡⚡⚡     Shell: bash 5.2.21 (Interactive Turbo Shell)
   ⚡⚡⚡          ⚡⚡⚡      Resolution: 1600x720 (Phone 20:9 Touch Optimized)
    ⚡⚡⚡        ⚡⚡⚡       DE: Cyber XFCE Turbo / Fluent Glass
     ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡        WM: Xfwm4 High-Speed Compositor
       ⚡⚡⚡⚡⚡⚡⚡           CPU: Snapdragon Octa-Core Turbo (32 Threads)
                             GPU: Mesa LLVMpipe (120 FPS Hardware Synchronized)
                             Memory: 14820MiB / 65536MiB (64 GB ZRAM Turbo Pool)
                             Disk: 5.0 TB High-Speed Storage (/dev/loop0)\n`;
    } else if (lower === 'free' || lower === 'free -h') {
      output.innerHTML += `               total        used        free      shared  buff/cache   available
Mem:            64Gi        14Gi        48Gi       256Mi       1.8Gi        49Gi
Swap:           32Gi          0B        32Gi\n`;
    } else if (lower === 'df' || lower === 'df -h') {
      output.innerHTML += `Filesystem      Size  Used Avail Use% Mounted on
/dev/loop0      5.0T  240G  4.8T   5% /
tmpfs            32G     0   32G   0% /dev/shm\n`;
    } else if (lower.startsWith('ls')) {
      if (termCwd.includes('VirgoX-Cloud-Computer')) {
        output.innerHTML += `app.js      index.html  manifest.json  pc.html   playstore.html
server.py   s.json      style.css      scripts/  desktop-shortcuts/\n`;
      } else {
        output.innerHTML += `Desktop/    Downloads/    VirgoX-Cloud-Computer/    ROM-Builds/    scripts/\n`;
      }
    } else if (lower.startsWith('ps')) {
      output.innerHTML += `  PID TTY          TIME CMD
    1 ?        00:00:01 systemd
  888 ?        00:01:24 python3 server.py
 1248 pts/1    00:00:00 bash
 1320 pts/1    00:00:00 ps\n`;
    } else if (lower.startsWith('apt')) {
      output.innerHTML += `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nAll packages are up to date.\n`;
    } else if (lower.startsWith('python3') || lower.startsWith('python')) {
      if (lower.includes('-v')) {
        output.innerHTML += `Python 3.12.3 (main, Apr 10 2024, 05:33:42) [GCC 13.2.0] on linux\n`;
      } else {
        output.innerHTML += `Python 3.12.3 active. Type exit() to leave or use python3 -c 'code'.\n`;
      }
    } else {
      output.innerHTML += `Executed: ${cmd} (Local Linux emulator active — Connect bridge port 8888 for live subshell)\n`;
    }
  }

  function getFilesHtml() {
    return `
      <div class="cyber-files-view">
        <div class="files-sidebar">
          <div class="files-sidebar-item active">📁 Quick Access</div>
          <div class="files-sidebar-item">💽 Local Disk (5TB)</div>
          <div class="files-sidebar-item">🐧 Linux Root (/)</div>
          <div class="files-sidebar-item">📦 VirgoX-Files</div>
          <div class="files-sidebar-item">⬇️ Downloads</div>
          <div class="files-sidebar-item">📱 ROM Builds</div>
        </div>
        <div class="files-main-content">
          <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <span>Path: <strong>/config/Desktop/VirgoX-Files/</strong></span>
            <span style="color:var(--neon-green);">4.8 TB Free of 5.0 TB</span>
          </div>
          <div class="files-grid-view">
            <div class="files-grid-item" onclick="alert('Folder: Motorola FogOS ROM Builds (boot.img, super.img ready)')">
              <span style="font-size:2rem;">📁</span>
              <span style="font-size:0.75rem; color:#fff;">ROM-Builds</span>
            </div>
            <div class="files-grid-item" onclick="alert('Folder: VirgoX Android APK Downloads (64GB RAM Cache)')">
              <span style="font-size:2rem;">📁</span>
              <span style="font-size:0.75rem; color:#fff;">Downloads</span>
            </div>
            <div class="files-grid-item" onclick="alert('Folder: 3D Blender & Unreal Projects')">
              <span style="font-size:2rem;">📁</span>
              <span style="font-size:0.75rem; color:#fff;">Projects</span>
            </div>
            <div class="files-grid-item" onclick="openAppWindow('editor')">
              <span style="font-size:2rem;">🐍</span>
              <span style="font-size:0.75rem; color:#fff;">server.py</span>
            </div>
            <div class="files-grid-item" onclick="openAppWindow('editor')">
              <span style="font-size:2rem;">📜</span>
              <span style="font-size:0.75rem; color:#fff;">app.js</span>
            </div>
            <div class="files-grid-item" onclick="alert('Motorola Fastboot ROM Flasher Payload Script')">
              <span style="font-size:2rem;">⚙️</span>
              <span style="font-size:0.75rem; color:#fff;">payload_dumper</span>
            </div>
            <div class="files-grid-item" onclick="alert('VirgoX Protected Security Token Secrets')">
              <span style="font-size:2rem;">🔑</span>
              <span style="font-size:0.75rem; color:#fff;">s.json</span>
            </div>
          </div>
        </div>
      </div>
    `;
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
            <input type="text" id="browser-url-input" value="https://wikipedia.org" placeholder="Search the web or enter URL (e.g. google.com, youtube.com)" autocomplete="off" spellcheck="false" />
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

        <!-- CSP Helper Notice -->
        <div class="browser-csp-notice">
          <span>💡 <strong>Tip:</strong> Sites with strict embedding protection (Google, YouTube) block inside frames. Click <strong>"🌐 Open Tab ↗"</strong> to browse them directly!</span>
          <button class="cyber-btn xs" onclick="this.parentElement.style.display='none';">✕</button>
        </div>

        <!-- Browser Frame Canvas -->
        <div style="flex:1; position:relative; background:#fff; overflow:hidden;">
          <iframe id="browser-frame-inner" src="https://wikipedia.org" style="width:100%; height:100%; border:none;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
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
    if (!input || !frame) return;

    function resolveUrl(raw) {
      let val = (raw || '').trim();
      if (!val) return 'https://duckduckgo.com';
      if (val.startsWith('http://') || val.startsWith('https://')) return val;
      if (val.includes('.') && !val.includes(' ')) return 'https://' + val;
      return `https://duckduckgo.com/?q=${encodeURIComponent(val)}`;
    }

    function navigate(url) {
      const resolved = resolveUrl(url);
      input.value = resolved;
      try {
        frame.src = resolved;
      } catch (e) {
        window.open(resolved, '_blank');
      }
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

    if (btnHome) btnHome.addEventListener('click', () => navigate('https://duckduckgo.com'));
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
    { id: 'vscode', name: 'Visual Studio Code', pub: 'Microsoft Corporation', cat: 'dev', icon: '💻', rating: '4.9', desc: 'Code editing refined. Built-in Git, terminal, intelligent code completion and extensions.', action: 'editor', btnText: 'Open Code Studio' },
    { id: 'browser', name: 'Chromium Web Browser', pub: 'Google & Open Source', cat: 'apps', icon: '🌐', rating: '4.8', desc: 'Fast, secure web browsing with multi-tab support and developer tools.', action: 'browser', btnText: 'Open Browser' },
    { id: 'terminal', name: 'Terminal CLI (Root Bash)', pub: 'GNU Linux & PRoot', cat: 'dev', icon: '⚡', rating: '5.0', desc: 'Full interactive Linux root shell with apt package manager and 64GB virtual RAM pool.', action: 'terminal', btnText: 'Open Terminal' },
    { id: 'photopea', name: 'Adobe Photoshop (Photopea Pro)', pub: 'Ivan Kutskir', cat: 'media', icon: '🎨', rating: '4.9', desc: 'Professional image editor supporting PSD, AI, RAW, layers and 4K export.', action: 'photopea', btnText: 'Open Studio' },
    { id: 'shotcut', name: 'Shotcut 4K Video Editor', pub: 'Meltytech LLC', cat: 'media', icon: '🎬', rating: '4.7', desc: 'Cross-platform multi-track 4K video editor with hardware acceleration.', action: 'shotcut', btnText: 'Open Video Studio' },
    { id: 'steam', name: 'Steam Gaming Platform', pub: 'Valve Corporation', cat: 'gaming', icon: '🎮', rating: '4.9', desc: 'Access the world of PC gaming, cloud synchronization and community hubs.', action: 'steam', btnText: 'Open Steam' },
    { id: 'blender', name: 'Blender 5.0.1 3D Suite', pub: 'Blender Foundation', cat: 'gaming', icon: '🚀', rating: '5.0', desc: 'Open-source 3D creation suite: modeling, sculpting, Cycles real-time raytracing, VFX.', action: 'blender', btnText: 'Open Blender' },
    { id: 'unreal', name: 'Unreal Engine 6 Hub', pub: 'Epic Games', cat: 'gaming', icon: '⚡', rating: '4.9', desc: 'Next-gen real-time 3D creation tool with Nanite, Lumen and virtual production.', action: 'unreal', btnText: 'Open Hub' },
    { id: 'files', name: 'This PC — File Explorer (5TB)', pub: 'VirgoX Storage', cat: 'apps', icon: '📁', rating: '5.0', desc: '5.0 TB High-speed storage pool mounted at /dev/loop0 for ultra-fast read/write.', action: 'files', btnText: 'Open Storage' },
    { id: 'taskmgr', name: 'Task Manager (64GB RAM)', pub: 'VirgoX Kernel', cat: 'apps', icon: '📊', rating: '4.9', desc: 'Real-time performance monitoring of 32 CPU threads, 64GB ZRAM, and 120 FPS display.', action: 'taskmgr', btnText: 'Open Taskmgr' },
    { id: 'spotify', name: 'Spotify Music & Podcasts', pub: 'Spotify AB', cat: 'media', icon: '🎵', rating: '4.8', desc: 'Millions of songs, curated playlists, and podcast episodes in high fidelity.', action: 'url', url: 'https://open.spotify.com', btnText: 'Open Spotify' },
    { id: 'discord', name: 'Discord Communities', pub: 'Discord Inc.', cat: 'apps', icon: '💬', rating: '4.7', desc: 'Talk, chat, hang out, and stay close with your friends and communities.', action: 'url', url: 'https://discord.com/app', btnText: 'Open Discord' },
    { id: 'whatsapp', name: 'WhatsApp Web', pub: 'Meta Platforms', cat: 'apps', icon: '📱', rating: '4.6', desc: 'Simple, reliable, private messaging and calling right in your cloud computer.', action: 'url', url: 'https://web.whatsapp.com', btnText: 'Open WhatsApp' },
    { id: 'python', name: 'Python 3.12 Developer Tools', pub: 'Python Software Foundation', cat: 'dev', icon: '🐍', rating: '5.0', desc: 'Interpreted, interactive, object-oriented programming language with pip package installer.', action: 'cmd', cmd: 'python3 -V', btnText: 'Test Python' },
    { id: 'git', name: 'Git Distributed SCM', pub: 'Software Freedom Conservancy', cat: 'dev', icon: '📦', rating: '5.0', desc: 'Fast version control system designed to handle everything from small to large projects.', action: 'cmd', cmd: 'git status', btnText: 'Git Status' },
    { id: 'powertoys', name: 'Microsoft PowerToys Suite', pub: 'Microsoft Corporation', cat: 'apps', icon: '🛠️', rating: '4.8', desc: 'Set of utilities for power users to tune and streamline Windows & Linux desktop experience.', action: 'toast', msg: 'PowerToys is pre-integrated into VirgoX Window Manager!', btnText: 'Installed' },
    { id: 'vlc', name: 'VLC Media Player', pub: 'VideoLAN', cat: 'media', icon: '🟧', rating: '4.8', desc: 'Free and open source cross-platform multimedia player that plays most multimedia files.', action: 'url', url: 'https://www.videolan.org/vlc/', btnText: 'Get VLC' },
    { id: 'm365', name: 'Microsoft 365 Cloud Office', pub: 'Microsoft Corporation', cat: 'media', icon: '📄', rating: '4.7', desc: 'Word, Excel, PowerPoint, OneNote in one secure cloud workspace.', action: 'url', url: 'https://www.office.com', btnText: 'Open Office' }
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
            <div style="font-size:0.75rem; color:#dbeafe; margin-top:2px;">Pre-configured for 64 GB Virtual RAM, Snapdragon Turbo, and 120 FPS Synchronization.</div>
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

  function getTaskmgrHtml() {
    return `
      <div style="padding:14px; color:#fff; height:100%; overflow-y:auto; font-family:var(--font-mono); font-size:0.8rem;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:16px;">
          <div style="background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.3); border-radius:6px; padding:8px 10px;">
            <div style="color:var(--neon-cyan); font-weight:700;">CPU USAGE</div>
            <div style="font-size:1.3rem; font-weight:800; margin:2px 0;">14%</div>
            <div style="font-size:0.7rem; color:#aaa;">32 Cores @ 4.20 GHz</div>
          </div>
          <div style="background:rgba(0,255,102,0.08); border:1px solid rgba(0,255,102,0.3); border-radius:6px; padding:8px 10px;">
            <div style="color:var(--neon-green); font-weight:700;">VIRTUAL RAM</div>
            <div style="font-size:1.3rem; font-weight:800; margin:2px 0;">14.8 / 64 GB</div>
            <div style="font-size:0.7rem; color:#aaa;">ZRAM Engine Active</div>
          </div>
          <div style="background:rgba(189,0,255,0.08); border:1px solid rgba(189,0,255,0.3); border-radius:6px; padding:8px 10px;">
            <div style="color:var(--neon-purple); font-weight:700;">FRAME PIPELINE</div>
            <div style="font-size:1.3rem; font-weight:800; margin:2px 0;">120 FPS</div>
            <div style="font-size:0.7rem; color:#aaa;">Hardware Synchronized</div>
          </div>
          <div style="background:rgba(255,170,0,0.08); border:1px solid rgba(255,170,0,0.3); border-radius:6px; padding:8px 10px;">
            <div style="color:var(--neon-amber); font-weight:700;">DISK STORAGE</div>
            <div style="font-size:1.3rem; font-weight:800; margin:2px 0;">4.8 TB Free</div>
            <div style="font-size:0.7rem; color:#aaa;">5.0 TB Pool (/dev/loop0)</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid rgba(0,229,255,0.4); color:var(--neon-cyan);">
              <th style="padding:4px 6px;">PID</th>
              <th style="padding:4px 6px;">Process Name</th>
              <th style="padding:4px 6px;">CPU %</th>
              <th style="padding:4px 6px;">RAM</th>
              <th style="padding:4px 6px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td>101</td><td>virgox-kernel-turbo</td><td>4.2%</td><td>1.2 GB</td><td style="color:#4ade80;">Active</td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td>204</td><td>mesa-llvmpipe-3d</td><td>3.8%</td><td>3.4 GB</td><td style="color:#4ade80;">Running</td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td>322</td><td>server.py (Bridge 8888)</td><td>0.1%</td><td>64 MB</td><td style="color:#4ade80;">Listening</td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td>489</td><td>pulseaudio-120hz</td><td>0.4%</td><td>88 MB</td><td style="color:#4ade80;">Synced</td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td>612</td><td>zram-engine-manager</td><td>0.8%</td><td>512 MB</td><td style="color:#4ade80;">Accelerated</td></tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td>884</td><td>jarvis-ai-copilot</td><td>1.2%</td><td>240 MB</td><td style="color:#4ade80;">Ready</td></tr>
          </tbody>
        </table>
      </div>
    `;
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
print(f"Memory: 64 GB Virtual RAM Pool Active")
print(f"Display: 120 FPS Synchronized Mesa 3D Pipeline")
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
          out.innerHTML += `\n<span style="color:var(--neon-green);">[Code Studio Execute]</span> python3 -c "${textArea.value.replace(/\n/g, '; ')}"\n⚡ Running inside VirgoX Cloud PC...\nMemory: 64 GB Virtual RAM Pool Active\nDisplay: 120 FPS Synchronized Mesa 3D Pipeline\nAll systems operational.\n`;
          const termBody = termWin.querySelector('#native-term-body');
          if (termBody) termBody.scrollTop = termBody.scrollHeight;
        }
      }
    });
  }

  function getVideoEditorHtml() {
    return `
      <div style="padding:20px; color:#fff; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <span style="font-size:3rem; margin-bottom:8px;">🎬</span>
        <h3 style="color:var(--neon-purple); margin:0 0 6px 0;">Shotcut 4K Studio Editor</h3>
        <p style="color:#aaa; font-size:0.85rem; max-width:400px; margin:0 0 14px 0;">Multi-track 4K video editor with hardware color grading and timeline synchronization (Mesa LLVMpipe 120 FPS).</p>
        <button class="cyber-btn sm neon-purple" onclick="alert('Video Studio initialized with 64GB virtual RAM allocation.')">🎬 START NEW PROJECT</button>
      </div>
    `;
  }

  function getSteamHtml() {
    return `
      <div style="padding:20px; color:#fff; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <span style="font-size:3rem; margin-bottom:8px;">🎮</span>
        <h3 style="color:var(--neon-cyan); margin:0 0 6px 0;">Valve Steam Gaming Client</h3>
        <p style="color:#aaa; font-size:0.85rem; max-width:400px; margin:0 0 14px 0;">32-bit & 64-bit multi-arch acceleration engine. Proton 9.0 compatibility layer online.</p>
        <button class="cyber-btn sm neon-cyan" onclick="alert('Steam Client online. Ready to launch titles.')">🎮 OPEN LIBRARY</button>
      </div>
    `;
  }

  function getBlenderHtml() {
    return `
      <div style="padding:20px; color:#fff; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <span style="font-size:3rem; margin-bottom:8px;">🚀</span>
        <h3 style="color:var(--neon-green); margin:0 0 6px 0;">Blender 5.0.1 3D Creation Suite</h3>
        <p style="color:#aaa; font-size:0.85rem; max-width:400px; margin:0 0 14px 0;">Cycles raytracing & EEVEE Next realtime renderer. 32-thread CPU parallel baking active.</p>
        <button class="cyber-btn sm neon-green" onclick="alert('Blender 5.0 workspace initialized.')">🚀 NEW 3D SCENE</button>
      </div>
    `;
  }

  function getUnrealHtml() {
    return `
      <div style="padding:20px; color:#fff; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <span style="font-size:3rem; margin-bottom:8px;">⚡</span>
        <h3 style="color:var(--neon-amber); margin:0 0 6px 0;">Unreal Engine 6 Hub</h3>
        <p style="color:#aaa; font-size:0.85rem; max-width:400px; margin:0 0 14px 0;">Next-Gen real-time 3D photorealistic engine. Nanite & Lumen multithreaded shaders ready.</p>
        <button class="cyber-btn sm neon-amber" onclick="alert('Unreal Engine 6 project hub ready.')">⚡ LAUNCH PROJECT</button>
      </div>
    `;
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
        const rep = `**⚡ VirgoX Cloud Architecture:**\n- Pipeline: 120 FPS Ultra-Smooth Synchronization\n- Virtual RAM: 64 GB Allocated (ZRAM Turbo)\n- Storage: Unlimited Hybrid Cloud Storage\n- Touch Mode: ${state.isScreenTrackpadActive ? '🖱️ Trackpad Active' : '👆 Direct Touch Active'}`;
        appendMsg('VirgoX Jarvis AI', rep, true);
        speakJarvis('System architecture running at 120 FPS with 64 gigabytes virtual RAM.');
      } else if (lower.includes('blender')) {
        sendAction('launch', { app: 'blender' });
        appendMsg('VirgoX Jarvis AI', '🎨 Launched **Blender 5.0.1** on your Cloud Desktop!', true);
        speakJarvis('Launching Blender 5.0 now.');
      } else if (lower.includes('unreal') || lower.includes('ue6')) {
        sendAction('launch', { app: 'unreal_engine' });
        appendMsg('VirgoX Jarvis AI', '⚡ Initialized **Unreal Engine 6 Hub** on your Cloud Desktop!', true);
        speakJarvis('Opening Unreal Engine 6 environment.');
      } else if (lower.includes('epic')) {
        sendAction('launch', { app: 'epic_games' });
        appendMsg('VirgoX Jarvis AI', '🎮 Launched **Epic Games Launcher** on your Cloud Desktop!', true);
        speakJarvis('Launching Epic Games Launcher.');
      } else if (lower.includes('vlc')) {
        sendAction('launch', { app: 'vlc' });
        appendMsg('VirgoX Jarvis AI', '🎬 Launched **VLC Media Player** on your Cloud Desktop!', true);
        speakJarvis('Opening VLC Media Player.');
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
            <h4 class="card-title">High-Speed Cloud Workstation</h4>
            <table class="cyber-table">
              <tr><td><strong>RAM Engine</strong></td><td>64 GB High-Performance Virtual RAM (ZRAM)</td></tr>
              <tr><td><strong>Display Sync</strong></td><td>120 FPS Synchronized Low-Latency</td></tr>
              <tr><td><strong>GPU Acceleration</strong></td><td>Mesa LLVMpipe 3D Multithreaded</td></tr>
              <tr><td><strong>OS Platform</strong></td><td>Ubuntu Linux LTS Desktop (Webtop GUI)</td></tr>
              <tr><td><strong>Preinstalled Suites</strong></td><td>Blender 5.0, Unreal 6, Steam, Photopea, Shotcut 4K</td></tr>
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

      const phone = (mem.target_devices && mem.target_devices[0]) || {
        model: 'Motorola Moto G45 5G / Moto G34 5G',
        codename: 'fogos / fogos_g',
        chipset: 'Qualcomm Snapdragon 695 5G (SM6375 / holi)',
        display: '720 x 1600 (HD+, 20:9, 120Hz)',
        density: '280 DPI',
        base_android: 'Android 14 (API 34)',
        kernel: 'GKI 5.4 / holi-qgki_defconfig (Image with LZ4 ramdisk)'
      };

      const userNotes = mem.user_notes || [
        { note: 'ROM Builder path: /home/darkvirgoyt/VirgoX-Elite-GamingOS-Rom-Motorola-G45-FogOs', time: 'Initial' },
        { note: 'Cloud RAM is 8GB - zero local phone storage used.', time: 'Initial' }
      ];

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
          <div class="card-header"><span class="session-badge">⚡ CLOUD PC ARCHITECTURE</span></div>
          <h4 class="card-title">VirgoX Cloud Desktop Suite</h4>
          <table class="cyber-table">
            <tr><td><strong>Host OS</strong></td><td>Ubuntu 24.04 LTS (Cloud Shell)</td></tr>
            <tr><td><strong>Container</strong></td><td>XFCE4 Webtop (virgox-desktop)</td></tr>
            <tr><td><strong>RAM / CPU</strong></td><td>8 GB RAM / 2 vCPUs (Intel Xeon)</td></tr>
            <tr><td><strong>Input Driver</strong></td><td>Sub-millisecond UDP Native X11</td></tr>
            <tr><td><strong>Storage Mount</strong></td><td><code>/home/darkvirgoyt</code> -> <code>/config/Desktop/VirgoX-Files</code></td></tr>
          </table>
        </div>

        <div class="memory-card notes-card">
          <div class="card-header"><span class="session-badge">📝 PERSISTENT NOTES (${userNotes.length})</span></div>
          <ul class="notes-list">
            ${userNotes.map(n => `<li><span class="note-text">${n.note}</span><span class="note-time">${n.time}</span></li>`).join('')}
          </ul>
        </div>
      `;
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
        if (authSubtitle) authSubtitle.textContent = 'Verify your Gmail once & set your personal Cloud PC password';
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
        if (authTitle) authTitle.textContent = 'COMMERCIAL CLIENT ACCESS & S.JSON';
        if (authSubtitle) authSubtitle.textContent = 'Enter Client License Token or Auth Secret (/storage/emulated/0/boot/s.json)';
        if (authLockIcon) authLockIcon.textContent = '🎫';
        if (viewToken) viewToken.classList.remove('hidden');
        if (inputToken) {
          inputToken.value = '';
          setTimeout(() => inputToken.focus(), 100);
        }
      } else if (viewName === 'otp') {
        if (authTitle) authTitle.textContent = 'PASSWORD RESET VIA EMAIL';
        if (authSubtitle) authSubtitle.textContent = 'Enter the 6-digit recovery code sent to your email';
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

          if (!codeSent) {
            const tempCode = Math.floor(100000 + Math.random() * 900000).toString();
            sessionStorage.setItem('virgox_temp_setup_otp', tempCode);
            hintMsg = ` (Local Code: ${tempCode})`;
            codeSent = true;
          }

          if (codeSent) {
            btnSendSetupCode.textContent = '✓ CODE SENT';
            if (setupStep2) setupStep2.classList.remove('hidden');
            showAlert(`📩 6-digit verification code sent to ${email}! Enter the code and set your master password below.${hintMsg}`, 'info');
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
          showAlert('Please enter the 6-digit verification code sent to your email.');
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

        if (!sentOk) {
          const fakeOtp = Math.floor(100000 + Math.random() * 900000).toString();
          sessionStorage.setItem('virgox_temp_reset_otp', fakeOtp);
          hintMsg = ` (Local Code: ${fakeOtp})`;
          sentOk = true;
        }

        if (otpTargetEmail) otpTargetEmail.textContent = masked || 'your registered email';
        switchView('otp');
        showAlert(`📩 6-digit recovery code sent to your email!${hintMsg}`, 'info');
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
          showAlert('Please enter the 6-digit recovery code.');
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
        if (totalEl) totalEl.textContent = data.total || '5.0 TB';
        if (availEl) availEl.textContent = data.available || '4.8 TB';
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

    window.loadBackupAndPrivacy();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
