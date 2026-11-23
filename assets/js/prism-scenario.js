/* ==========================================================================
   L3 棱镜圣殿情景控制器 (prism-scenario.js) — L-A11 扇形手牌 + 破盾残影
   ========================================================================== */
(function () {
  'use strict';

  const core = window.LinguaCore;
  const shell = window.ImmersionShell;
  if (!core || !shell) return;

  let currentIndex = 0;
  const params = new URLSearchParams(window.location.search);
  if (params.has('lesson')) {
    const parsed = parseInt(params.get('lesson'), 10);
    if (!isNaN(parsed) && parsed >= 0) currentIndex = parsed;
  }

  shell.initRevealVeil();
  shell.initParallaxStage();
  shell.initSceneTransitions();
  shell.initSoundToggle();
  shell.initRuleOverlay();
  const gate = shell.initGateSidebar();

  function getList() {
    const state = core.loadState();
    return (core.CORPORA.prism && core.CORPORA.prism[state.lang]) || [];
  }

  function renderGateList() {
    const state = core.loadState();
    const list = getList();
    const container = document.getElementById('gate-curriculum-list');
    if (!container) return;

    container.innerHTML = list.map(function (item, idx) {
      const card = state.cards[item.id];
      const active = idx === currentIndex ? ' active' : '';
      const repsText = card ? '×' + card.reps : '—';
      return (
        '<button type="button" class="gate-lesson-slot' + active + '" data-lesson-idx="' + idx + '">' +
        '<img src="assets/textures/prism-orb-glyph.svg" alt="" class="gate-lesson-sigil">' +
        '<div class="gate-lesson-meta">' +
        '<span class="gate-lesson-roman tabular-num">' + shell.pad3(idx + 1) + '</span>' +
        '<span class="gate-lesson-target">' + core.escapeHtml(item.correctId) + '</span>' +
        '</div>' +
        '<span class="tabular-num" style="font-size:12px;opacity:0.75;">' + repsText + '</span>' +
        '</button>'
      );
    }).join('');

    container.querySelectorAll('[data-lesson-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentIndex = parseInt(btn.getAttribute('data-lesson-idx'), 10) || 0;
        core.playTone(440, 0.03, 'triangle');
        gate.close();
        renderStage();
      });
    });
  }

  function renderStage() {
    const list = getList();
    if (currentIndex >= list.length) currentIndex = 0;
    const item = list[currentIndex];
    if (!item) return;

    shell.setDockLocked(true);
    document.documentElement.style.setProperty('--shield', '1');

    document.getElementById('str-code').textContent = shell.pad3(currentIndex + 1);
    document.getElementById('str-stem').textContent = item.stem;

    const orb = document.getElementById('str-orb');
    if (orb) orb.classList.remove('is-lit');

    const fanAngles = [-6, -2, 2, 6];
    const optsEl = document.getElementById('str-options');
    optsEl.innerHTML = (item.options || []).map(function (label, idx) {
      const ang = fanAngles[idx % fanAngles.length];
      return (
        '<button type="button" class="tenon-card" style="--fan-angle:' + ang + 'deg;" data-opt-id="' + core.escapeHtml(label) + '">' +
        '<img src="assets/textures/prism-tenon-glyph.svg" alt="">' +
        '<span>' + core.escapeHtml(label) + '</span>' +
        '</button>'
      );
    }).join('');

    optsEl.querySelectorAll('[data-opt-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const chosen = btn.getAttribute('data-opt-id');
        if (chosen === item.correctId) {
          btn.classList.add('is-correct');
          if (orb) orb.classList.add('is-lit');
          document.documentElement.style.setProperty('--shield', '0');
          document.getElementById('str-stem').textContent = item.stem.replace('______', item.correctId);
          shell.setDockLocked(false);
          core.playTone(720, 0.08, 'triangle');
        } else {
          btn.classList.add('is-wrong');
          core.playTone(220, 0.05, 'sine');
        }
      });
    });

    renderGateList();
  }

  document.querySelectorAll('[data-fsrs]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const rating = parseInt(btn.getAttribute('data-fsrs'), 10);
      const list = getList();
      const item = list[currentIndex];
      if (!item) return;
      core.scheduleFSRS(item.id, rating);
      core.playTone(rating >= 3 ? 700 : 350, 0.05, 'sine');
      currentIndex = (currentIndex + 1) % list.length;
      renderStage();
    });
  });

  shell.initLangCycle(function () {
    currentIndex = 0;
    renderStage();
  });

  renderStage();
})();
