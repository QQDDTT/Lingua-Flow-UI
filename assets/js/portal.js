/* ==========================================================================
   L1 总览页交互控制器 (portal.js)
   ========================================================================== */
(function () {
  'use strict';

  const core = window.LinguaCore;
  if (!core) return;

  function render() {
    const state = core.loadState();
    const meta = core.LANG_META[state.lang] || core.LANG_META.en;

    const labelEl = document.getElementById('current-lang-label');
    if (labelEl) labelEl.textContent = meta.name;

    document.querySelectorAll('[data-set-lang]').forEach(function (el) {
      const active = el.getAttribute('data-set-lang') === state.lang;
      el.classList.toggle('active', active);
      if (el.hasAttribute('role') || el.classList.contains('optic-dropdown-item')) {
        el.setAttribute('aria-selected', active ? 'true' : 'false');
      }
    });

    const revEl = document.getElementById('stat-reviewed');
    const accEl = document.getElementById('stat-accuracy');
    const strEl = document.getElementById('stat-streak');
    if (revEl) revEl.textContent = String(state.stats.reviewed || 0);
    if (strEl) strEl.textContent = String(state.stats.streak || 0);
    if (accEl) {
      const rate = state.stats.reviewed > 0
        ? Math.round((state.stats.correct / state.stats.reviewed) * 100)
        : 0;
      accEl.textContent = rate + '%';
    }

    const soundBtn = document.getElementById('toggle-sound-btn');
    if (soundBtn) {
      soundBtn.textContent = '声触反馈：' + (state.soundEnabled ? '开启' : '静音');
    }

    const listEl = document.getElementById('drawer-cards-list');
    if (listEl) {
      const entries = Object.entries(state.cards || {});
      if (!entries.length) {
        listEl.innerHTML = '<p class="optic-body-text">暂无记忆记录。请进入任意主题网页完成一次演练。</p>';
      } else {
        listEl.innerHTML = entries.map(function (pair) {
          const id = pair[0];
          const c = pair[1];
          return (
            '<div style="padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-alt);">' +
            '<div style="display:flex; justify-content:space-between; font-weight:600; font-size:var(--optic-font-sm);">' +
            '<span>' + id + '</span><span class="tabular-num">S=' + c.s + 'd</span></div>' +
            '<div style="font-size:var(--optic-font-xs); color:var(--text-tertiary); margin-top:4px;" class="tabular-num">' +
            '难度 D=' + c.d + ' · 复习 ' + c.reps + ' 次</div></div>'
          );
        }).join('');
      }
    }
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const nextLang = btn.getAttribute('data-set-lang');
      const state = core.loadState();
      state.lang = nextLang;
      core.saveState(state);
      core.playTone(620, 0.02, 'sine');
      render();
    });
  });

  const soundBtn = document.getElementById('toggle-sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      const state = core.loadState();
      state.soundEnabled = !state.soundEnabled;
      core.saveState(state);
      if (state.soundEnabled) core.playTone(660, 0.02, 'sine');
      render();
    });
  }

  const resetBtn = document.getElementById('reset-progress-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      const state = core.loadState();
      state.cards = {};
      state.stats = { reviewed: 0, correct: 0, streak: 0 };
      core.saveState(state);
      core.playTone(360, 0.022, 'triangle');
      render();
    });
  }

  core.initDropdowns();
  core.initDrawers();
  render();
})();
