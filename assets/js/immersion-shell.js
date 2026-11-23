/* ==========================================================================
   Lingua-Flow L2/L3 公共沉浸壳控制器 (immersion-shell.js)
   ========================================================================== */
(function (global) {
  'use strict';

  const LANG_ORDER = ['en', 'ja', 'zh'];
  const DARKROOM_KEY = 'lf_tidal_darkroom';

  function initRevealVeil() {
    const veil = document.getElementById('lf-reveal-veil');
    if (!veil) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { veil.classList.add('is-cleared'); });
    });
    setTimeout(function () {
      if (veil.parentNode) veil.parentNode.removeChild(veil);
    }, 620);
  }

  function initDarkroomToggle() {
    const core = global.LinguaCore;
    let isDark = false;
    try {
      isDark = global.localStorage.getItem(DARKROOM_KEY) === '1';
    } catch (err) {
      console.warn('[ImmersionShell] 读取暗房状态受限：', err);
    }
    document.body.classList.toggle('darkroom-mode', isDark);

    const btn = document.getElementById('sigil-darkroom-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.addEventListener('click', function () {
      const next = !document.body.classList.contains('darkroom-mode');
      document.body.classList.toggle('darkroom-mode', next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      try {
        global.localStorage.setItem(DARKROOM_KEY, next ? '1' : '0');
      } catch (err) {
        console.warn('[ImmersionShell] 保存暗房状态受限：', err);
      }
      if (core) core.playTone(520, 0.03, 'sine');
    });
  }

  function initLangCycle(onLangChange) {
    const core = global.LinguaCore;
    const btn = document.getElementById('sigil-lang-btn');
    if (!core || !btn) return;

    function syncLabel() {
      const state = core.loadState();
      const meta = core.LANG_META[state.lang] || core.LANG_META.en;
      btn.textContent = meta.badge;
      btn.setAttribute('data-lang', state.lang);
    }

    btn.addEventListener('click', function () {
      const state = core.loadState();
      const idx = LANG_ORDER.indexOf(state.lang);
      const next = LANG_ORDER[(idx + 1) % LANG_ORDER.length];
      state.lang = next;
      core.saveState(state);
      core.playTone(620, 0.025, 'sine');
      syncLabel();
      if (typeof onLangChange === 'function') onLangChange(next);
    });

    syncLabel();
  }

  function initSoundToggle() {
    const core = global.LinguaCore;
    const btn = document.getElementById('sigil-sound-btn');
    if (!core || !btn) return;

    function sync() {
      const state = core.loadState();
      btn.style.opacity = state.soundEnabled ? '1' : '0.45';
      btn.setAttribute('aria-pressed', state.soundEnabled ? 'true' : 'false');
    }

    btn.addEventListener('click', function () {
      const state = core.loadState();
      state.soundEnabled = !state.soundEnabled;
      core.saveState(state);
      if (state.soundEnabled) core.playTone(660, 0.03, 'sine');
      sync();
    });

    sync();
  }

  function initRuleOverlay() {
    const core = global.LinguaCore;
    const trigger = document.getElementById('sigil-rule-btn');
    const overlay = document.getElementById('rule-overlay');
    const closeBtn = document.getElementById('rule-close-btn');
    if (!trigger || !overlay) return;

    function open() {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      if (core) core.playTone(480, 0.025, 'sine');
    }
    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }

    trigger.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function initGateSidebar() {
    const core = global.LinguaCore;
    const trigger = document.getElementById('gate-trigger-btn');
    const closer = document.getElementById('gate-close-btn');
    const sidebar = document.getElementById('gate-sidebar');
    const scrim = document.getElementById('gate-scrim');
    if (!sidebar) return { close: function () {} };

    function open() {
      sidebar.classList.add('open');
      sidebar.setAttribute('aria-hidden', 'false');
      if (scrim) scrim.classList.add('open');
      if (core) core.playTone(340, 0.04, 'triangle');
    }
    function close() {
      sidebar.classList.remove('open');
      sidebar.setAttribute('aria-hidden', 'true');
      if (scrim) scrim.classList.remove('open');
    }

    if (trigger) trigger.addEventListener('click', open);
    if (closer) closer.addEventListener('click', close);
    if (scrim) scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    return { open: open, close: close };
  }

  function setDockLocked(locked) {
    const dock = document.getElementById('fsrs-dock');
    if (!dock) return;
    const isLocked = Boolean(locked);
    dock.classList.toggle('is-locked', isLocked);
    dock.querySelectorAll('[data-fsrs]').forEach(function (btn) { btn.disabled = isLocked; });
  }

  function initParallaxStage() {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (global.matchMedia && !global.matchMedia('(pointer: fine)').matches) return;
    document.addEventListener('pointermove', function (e) {
      const nx = (e.clientX / Math.max(1, global.innerWidth) - 0.5) * 14;
      const ny = (e.clientY / Math.max(1, global.innerHeight) - 0.5) * 10;
      document.documentElement.style.setProperty('--px', (-nx).toFixed(1) + 'px');
      document.documentElement.style.setProperty('--py', (-ny).toFixed(1) + 'px');
    }, { passive: true });
  }

  function initSceneTransitions() {
    const core = global.LinguaCore;
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href]');
      if (!link) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = link.getAttribute('href');
      if (!href || href.indexOf('.html') === -1) return;

      e.preventDefault();
      const rect = link.getBoundingClientRect();
      const exitVeil = document.createElement('div');
      exitVeil.className = 'lf-exit-veil';
      exitVeil.style.setProperty('--tx', Math.round(rect.left + rect.width / 2) + 'px');
      exitVeil.style.setProperty('--ty', Math.round(rect.top + rect.height / 2) + 'px');
      document.body.appendChild(exitVeil);

      if (core) core.playTone(480, 0.05, 'triangle');
      requestAnimationFrame(function () { exitVeil.classList.add('is-active'); });
      const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () { global.location.href = href; }, reduced ? 140 : 400);
    });
  }

  function pad3(n) {
    return '#' + String(Math.max(1, Math.min(999, n))).padStart(3, '0');
  }

  global.ImmersionShell = {
    initRevealVeil: initRevealVeil,
    initDarkroomToggle: initDarkroomToggle,
    initLangCycle: initLangCycle,
    initSoundToggle: initSoundToggle,
    initRuleOverlay: initRuleOverlay,
    initGateSidebar: initGateSidebar,
    setDockLocked: setDockLocked,
    initParallaxStage: initParallaxStage,
    initSceneTransitions: initSceneTransitions,
    pad3: pad3
  };
})(window);
