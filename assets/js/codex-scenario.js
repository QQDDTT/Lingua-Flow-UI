/* ==========================================================================
   L3 时计法典情景控制器 (codex-scenario.js)
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
    return (core.CORPORA.codex && core.CORPORA.codex[state.lang]) || [];
  }

  function renderGateList() {
    const state = core.loadState();
    const list = getList();
    const container = document.getElementById('gate-curriculum-list');
    if (!container) return;

    container.innerHTML = list.map(function (item, idx) {
      const card = state.cards[item.id];
      const active = idx === currentIndex ? ' active' : '';
      const icon = card && card.reps > 0 ? 'assets/textures/codex-seal-crimson.svg' : 'assets/textures/codex-lock-glyph.svg';
      const repsText = card ? '×' + card.reps : '—';
      return (
        '<button type="button" class="gate-lesson-slot' + active + '" data-lesson-idx="' + idx + '">' +
        '<img src="' + icon + '" alt="" class="gate-lesson-sigil">' +
        '<div class="gate-lesson-meta">' +
        '<span class="gate-lesson-roman tabular-num">' + shell.pad3(idx + 1) + '</span>' +
        '<span class="gate-lesson-target">' + core.escapeHtml(item.targetWord) + '</span>' +
        '</div>' +
        '<span class="tabular-num" style="font-size:12px;opacity:0.75;">' + repsText + '</span>' +
        '</button>'
      );
    }).join('');

    container.querySelectorAll('[data-lesson-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentIndex = parseInt(btn.getAttribute('data-lesson-idx'), 10) || 0;
        core.playTone(420, 0.03, 'triangle');
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

    document.getElementById('case-code').textContent = shell.pad3(currentIndex + 1);
    document.getElementById('case-word').textContent = item.targetWord;
    document.getElementById('case-phonetic').textContent = item.phonetic;
    document.getElementById('case-testimony').textContent = item.testimony;
    document.getElementById('case-sidenote').textContent = item.sidenote || '';

    const seal = document.getElementById('verdict-seal-stamp');
    if (seal) seal.classList.remove('is-stamped');

    const rootsEl = document.getElementById('case-roots');
    rootsEl.innerHTML = (item.roots || []).map(function (r) {
      return '<span class="root-chip">' + core.escapeHtml(r) + '</span>';
    }).join('');

    const clausesEl = document.getElementById('case-clauses');
    clausesEl.innerHTML = (item.clauses || []).map(function (c, idx) {
      return '<button type="button" class="clause-btn" data-clause-idx="' + idx + '">' + core.escapeHtml(c.text) + '</button>';
    }).join('');

    clausesEl.querySelectorAll('[data-clause-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const clause = item.clauses[parseInt(btn.getAttribute('data-clause-idx'), 10)];
        if (!clause) return;
        if (clause.isFlaw) {
          btn.classList.add('is-flaw-hit');
          if (seal) seal.classList.add('is-stamped');
          shell.setDockLocked(false);
          core.playTone(660, 0.08, 'triangle');
        } else {
          btn.classList.add('is-miss');
          core.playTone(240, 0.05, 'sine');
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
      core.playTone(rating >= 3 ? 680 : 380, 0.05, 'sine');
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
