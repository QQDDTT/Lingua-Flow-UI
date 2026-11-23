/* ==========================================================================
   Lingua-Flow L2 主题主页多态机关控制器 (theme-home.js)
   适配三大全新主题：codex / tidal / prism
   ========================================================================== */
(function () {
  'use strict';

  const shell = window.ImmersionShell;
  const core = window.LinguaCore;
  if (!shell || !core) return;

  const theme = document.body.getAttribute('data-theme') || 'codex';
  let currentCourseNum = 1;
  let baseAngle = 0;
  let isOpening = false;

  shell.initRevealVeil();
  shell.initParallaxStage();
  if (theme === 'tidal') shell.initDarkroomToggle();
  shell.initSoundToggle();
  shell.initRuleOverlay();

  const returnLink = document.querySelector('a[href="index.html"]');
  if (returnLink) {
    returnLink.addEventListener('click', function (e) {
      e.preventDefault();
      const rect = returnLink.getBoundingClientRect();
      const exitVeil = document.createElement('div');
      exitVeil.className = 'lf-exit-veil';
      exitVeil.style.setProperty('--tx', Math.round(rect.left + rect.width / 2) + 'px');
      exitVeil.style.setProperty('--ty', Math.round(rect.top + rect.height / 2) + 'px');
      document.body.appendChild(exitVeil);
      core.playTone(420, 0.04, 'triangle');
      requestAnimationFrame(function () { exitVeil.classList.add('is-active'); });
      setTimeout(function () { window.location.href = 'index.html'; }, 400);
    });
  }

  function pad3(n) {
    return String(Math.max(1, Math.min(999, n))).padStart(3, '0');
  }

  function getItems() {
    const state = core.loadState();
    return (core.CORPORA[theme] && core.CORPORA[theme][state.lang]) || [];
  }

  function getCourseLabel(item) {
    if (!item) return '---';
    return item.targetWord || item.word || item.correctId || '---';
  }

  function applyKinematics(deg, needleDeg) {
    baseAngle = deg;
    const padded = pad3(currentCourseNum);
    const d0 = parseInt(padded[0], 10);
    const d1 = parseInt(padded[1], 10);
    const d2 = parseInt(padded[2], 10);

    if (theme === 'codex') {
      document.documentElement.style.setProperty('--gear-angle', deg + 'deg');
      const nDeg = typeof needleDeg === 'number' ? needleDeg : (-95 + ((currentCourseNum - 1) % 5) * 45);
      document.documentElement.style.setProperty('--needle-angle', nDeg + 'deg');
      const fluid = Math.min(0.92, 0.35 + ((currentCourseNum - 1) % 5) * 0.12);
      document.documentElement.style.setProperty('--fluid-level', fluid.toFixed(2));
      const stroke = (currentCourseNum % 2 === 0) ? 24 : -6;
      document.documentElement.style.setProperty('--piston-l', stroke + 'px');
      document.documentElement.style.setProperty('--piston-r', (-stroke) + 'px');
    } else if (theme === 'tidal') {
      document.documentElement.style.setProperty('--jade-rot', (deg * 0.5) + 'deg');
      document.documentElement.style.setProperty('--chime-sway', ((currentCourseNum % 2 === 0) ? 7 : -7) + 'deg');
      document.documentElement.style.setProperty('--beam-angle', (-14 + ((currentCourseNum % 5) * 7)) + 'deg');
    } else if (theme === 'prism') {
      document.documentElement.style.setProperty('--ring-outer', (d0 * 36) + 'deg');
      document.documentElement.style.setProperty('--ring-mid', (-d1 * 36) + 'deg');
      document.documentElement.style.setProperty('--ring-inner', (d2 * 36) + 'deg');
      document.documentElement.style.setProperty('--beam-converge', ((currentCourseNum % 4) * 4) + 'deg');
    }
  }

  function syncDisplay() {
    const items = getItems();
    const padded = pad3(currentCourseNum);
    const digits = [padded[0], padded[1], padded[2]];
    document.querySelectorAll('[data-drum-digit]').forEach(function (el) {
      const pos = parseInt(el.getAttribute('data-drum-digit'), 10);
      if (!isNaN(pos) && digits[pos] !== undefined) el.textContent = digits[pos];
    });
    const codeEl = document.getElementById('topic-screen-code');
    const titleEl = document.getElementById('topic-screen-title');
    const item = items[currentCourseNum - 1];
    if (codeEl) codeEl.textContent = '#' + padded;
    if (titleEl) {
      titleEl.textContent = item ? getCourseLabel(item) : '---';
      titleEl.style.opacity = item ? '1' : '0.45';
    }
  }

  function stepCourse(delta) {
    if (isOpening) return;
    const items = getItems();
    const next = currentCourseNum + delta;
    if (next < 1) currentCourseNum = Math.max(1, items.length);
    else if (next > 999) currentCourseNum = 1;
    else currentCourseNum = next;
    applyKinematics(baseAngle + (delta >= 0 ? 45 : -45));
    core.playTone(440 + (currentCourseNum % 8) * 35, 0.03, theme === 'tidal' ? 'sine' : 'triangle');
    syncDisplay();
  }

  document.querySelectorAll('[data-drum-delta]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      stepCourse(parseInt(btn.getAttribute('data-drum-delta'), 10) || 0);
    });
  });

  function triggerOpenGate() {
    if (isOpening) return;
    isOpening = true;

    const items = getItems();
    const targetLesson = items[currentCourseNum - 1] ? (currentCourseNum - 1) : 0;
    const lever = document.getElementById('gate-lever-btn');
    if (lever) lever.classList.add('is-tripped');

    if (theme === 'codex') {
      document.body.classList.add('is-mech-recoil', 'is-steam-pressurized');
      applyKinematics(baseAngle - 28, 70);
      document.documentElement.style.setProperty('--piston-l', '-16px');
      document.documentElement.style.setProperty('--piston-r', '16px');
      core.playTone(220, 0.06, 'triangle');

      setTimeout(function () {
        document.body.classList.add('is-pawl-released', 'is-bolt-retracted');
        applyKinematics(baseAngle + 195, 120);
        document.documentElement.style.setProperty('--piston-l', '28px');
        document.documentElement.style.setProperty('--piston-r', '-28px');
        core.playTone(440, 0.09, 'triangle');
      }, 150);

      setTimeout(function () {
        document.body.classList.add('is-gate-opening');
        core.playTone(580, 0.14, 'sine');
      }, 460);
    } else if (theme === 'tidal') {
      document.body.classList.add('is-mech-recoil');
      applyKinematics(baseAngle - 16);
      core.playTone(493.88, 0.08, 'sine');

      setTimeout(function () {
        document.body.classList.add('is-bolt-retracted', 'is-jade-split', 'is-optical-flash');
        applyKinematics(baseAngle + 45);
        core.playTone(659.25, 0.12, 'sine');
      }, 160);

      setTimeout(function () {
        document.body.classList.add('is-gate-opening');
        core.playTone(783.99, 0.15, 'sine');
      }, 460);
    } else if (theme === 'prism') {
      const chainBtn = document.getElementById('gate-chain-btn');
      if (chainBtn) chainBtn.classList.add('is-pulled');
      document.body.classList.add('is-mech-recoil');
      document.documentElement.style.setProperty('--ring-outer', '-24deg');
      document.documentElement.style.setProperty('--ring-mid', '24deg');
      document.documentElement.style.setProperty('--ring-inner', '-24deg');
      core.playTone(220, 0.08, 'triangle');

      setTimeout(function () {
        document.body.classList.add('is-orb-charged');
        document.documentElement.style.setProperty('--ring-outer', '0deg');
        document.documentElement.style.setProperty('--ring-mid', '0deg');
        document.documentElement.style.setProperty('--ring-inner', '0deg');
        core.playTone(392, 0.11, 'triangle');
      }, 160);

      setTimeout(function () {
        document.body.classList.add('is-gate-opening');
        core.playTone(523.25, 0.16, 'triangle');
      }, 420);
    }

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      window.location.href = theme + '-scenario.html?lesson=' + targetLesson;
    }, reduced ? 240 : 1080);
  }

  ['gate-master-btn', 'gate-lever-btn', 'jade-bi-portal-btn', 'astrolabe-orb-btn', 'gate-chain-btn'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', triggerOpenGate);
  });

  document.querySelectorAll('.gear-satellite').forEach(function (sat, idx) {
    sat.addEventListener('click', function () { stepCourse(idx === 0 ? 1 : -1); });
  });

  shell.initLangCycle(function () {
    currentCourseNum = 1;
    applyKinematics(0);
    syncDisplay();
  });

  applyKinematics(0);
  syncDisplay();
})();
