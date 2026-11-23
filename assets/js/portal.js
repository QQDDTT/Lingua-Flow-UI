/* ==========================================================================
   L1 平台总览控制器 (portal.js)
   ========================================================================== */
(function () {
  'use strict';

  const core = window.LinguaCore;
  if (!core) return;

  function render() {
    const state = core.loadState();
    document.querySelectorAll('[data-set-lang]').forEach(function (el) {
      const active = el.getAttribute('data-set-lang') === state.lang;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const revEl = document.getElementById('stat-reviewed');
    const accEl = document.getElementById('stat-accuracy');
    const strEl = document.getElementById('stat-streak');
    if (revEl) revEl.textContent = String(state.stats.reviewed || 0);
    if (strEl) strEl.textContent = String(state.stats.streak || 0);
    if (accEl) {
      const rate = state.stats.reviewed > 0 ? Math.round((state.stats.correct / state.stats.reviewed) * 100) : 0;
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
        listEl.innerHTML = '<p class="portal-body">暂无记忆档案记录。进入任意主题门厅完成演练后，FSRS-5 稳定性数据将同步至此。</p>';
      } else {
        listEl.innerHTML = entries.map(function (pair) {
          const id = core.escapeHtml(pair[0]);
          const c = pair[1];
          return (
            '<div style="padding:12px 14px; border-radius:12px; border:1px solid var(--optic-porcelain-border); background:var(--optic-porcelain-alt);">' +
            '<div style="display:flex; justify-content:space-between; font-weight:700;"><span>' + id + '</span><span class="tabular-num">S=' + c.s + 'd</span></div>' +
            '<div style="font-size:12px; color:var(--optic-porcelain-text-ter); margin-top:4px;" class="tabular-num">难度 D=' + c.d + ' · 复习 ' + c.reps + ' 次</div>' +
            '</div>'
          );
        }).join('');
      }
    }
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const state = core.loadState();
      state.lang = btn.getAttribute('data-set-lang');
      core.saveState(state);
      core.playTone(620, 0.025, 'sine');
      render();
    });
  });

  const scrim = document.getElementById('optic-scrim');
  const drawer = document.getElementById('archive-drawer');
  function closeDrawer() {
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (scrim) scrim.classList.remove('open');
  }

  const openBtn = document.getElementById('open-archive-btn');
  if (openBtn && drawer) {
    openBtn.addEventListener('click', function () {
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      if (scrim) scrim.classList.add('open');
      core.playTone(460, 0.025, 'sine');
    });
  }

  const closeBtn = document.getElementById('close-archive-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (scrim) scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  const soundBtn = document.getElementById('toggle-sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      const state = core.loadState();
      state.soundEnabled = !state.soundEnabled;
      core.saveState(state);
      if (state.soundEnabled) core.playTone(660, 0.025, 'sine');
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
      core.playTone(360, 0.03, 'triangle');
      render();
    });
  }

  render();
})();
