/* ==========================================================================
   L3 潮汐星图情景控制器 (tidal-scenario.js) — L-A4 X 轴横向声景滑轨
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
  shell.initDarkroomToggle();
  shell.initSoundToggle();
  shell.initRuleOverlay();
  const gate = shell.initGateSidebar();

  function getList() {
    const state = core.loadState();
    return (core.CORPORA.tidal && core.CORPORA.tidal[state.lang]) || [];
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
        '<img src="assets/textures/tidal-jade-token.svg" alt="" class="gate-lesson-sigil">' +
        '<div class="gate-lesson-meta">' +
        '<span class="gate-lesson-roman tabular-num">' + shell.pad3(idx + 1) + '</span>' +
        '<span class="gate-lesson-target">' + core.escapeHtml(item.word) + '</span>' +
        '</div>' +
        '<span class="tabular-num" style="font-size:12px;opacity:0.75;">' + repsText + '</span>' +
        '</button>'
      );
    }).join('');

    container.querySelectorAll('[data-lesson-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentIndex = parseInt(btn.getAttribute('data-lesson-idx'), 10) || 0;
        core.playTone(460, 0.03, 'sine');
        gate.close();
        renderStage();
      });
    });
  }

  function renderStage() {
    const list = getList();
    if (currentIndex >= list.length) currentIndex = 0;
    shell.setDockLocked(true);

    const track = document.getElementById('tidal-film-track');
    if (!track) return;

    track.innerHTML = list.map(function (item, idx) {
      const active = idx === currentIndex ? ' is-active' : '';
      const bars = (item.contour || []).map(function (h) {
        return '<span class="wave-bar" style="height:' + Math.max(20, Math.min(84, h)) + 'px;"></span>';
      }).join('');
      return (
        '<article class="tidal-slide-card' + active + '" data-slide-idx="' + idx + '">' +
        '<span class="tabular-num" style="font-weight:800; letter-spacing:0.18em; color:#3b7a75;">' + shell.pad3(idx + 1) + '</span>' +
        '<div><div class="sanctum-word">' + core.escapeHtml(item.word) + '</div>' +
        '<div class="sanctum-phonetic">' + core.escapeHtml(item.phonetic) + '</div></div>' +
        '<div class="kintsugi-wave-bars" id="bars-' + idx + '">' + bars + '</div>' +
        '<button type="button" class="resonance-play-btn" data-play-idx="' + idx + '" aria-label="Play Tone Contour">' +
        '<img src="assets/textures/sigil-tidal.svg" alt=""></button>' +
        '</article>'
      );
    }).join('');

    track.querySelectorAll('[data-play-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-play-idx'), 10) || 0;
        currentIndex = idx;
        const item = list[idx];
        if (!item) return;
        core.playContour(item.freqs);
        shell.setDockLocked(false);
        const barsEl = document.getElementById('bars-' + idx);
        if (barsEl) {
          barsEl.classList.add('is-playing');
          setTimeout(function () { barsEl.classList.remove('is-playing'); }, 720);
        }
      });
    });

    const activeCard = track.querySelector('.tidal-slide-card.is-active');
    if (activeCard && typeof activeCard.scrollIntoView === 'function') {
      activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    renderGateList();
  }

  document.querySelectorAll('[data-fsrs]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const rating = parseInt(btn.getAttribute('data-fsrs'), 10);
      const list = getList();
      const item = list[currentIndex];
      if (!item) return;
      core.scheduleFSRS(item.id, rating);
      core.playTone(rating >= 3 ? 660 : 360, 0.05, 'sine');
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
