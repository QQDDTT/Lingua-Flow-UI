/* ==========================================================================
   主题二：星尘漫游交互控制器 (immersive.js)
   ========================================================================== */
(function () {
  'use strict';

  const core = window.LinguaCore;
  if (!core) return;

  let activeSlide = 0;

  function render() {
    const state = core.loadState();
    const lang = state.lang;
    const items = core.CORPORA.immersive[lang] || core.CORPORA.immersive.en;
    if (activeSlide >= items.length) activeSlide = 0;

    const meta = core.LANG_META[lang];
    const label = document.getElementById('imm-lang-label');
    if (label && meta) label.textContent = meta.name;

    document.querySelectorAll('[data-imm-lang]').forEach(function (el) {
      el.setAttribute('aria-selected', el.getAttribute('data-imm-lang') === lang ? 'true' : 'false');
    });

    // 渲染幻灯片帧
    const stageEl = document.getElementById('slide-stage');
    if (stageEl) {
      stageEl.innerHTML = items.map(function (item, idx) {
        const cls = idx === activeSlide ? 'active' : (idx < activeSlide ? 'prev' : '');
        const barsHtml = item.contour.map(function (val) {
          const scaleY = (val / 100).toFixed(2);
          return '<div class="contour-col"><div class="contour-fill" style="transform: scaleY(' + scaleY + ');"></div></div>';
        }).join('');

        return (
          '<article class="slide-frame ' + cls + '" aria-hidden="' + (idx === activeSlide ? 'false' : 'true') + '">' +
          '<div style="display:flex; flex-direction:column; gap:14px;">' +
          '<span style="font-size:var(--optic-font-xs); font-weight:700; color:var(--gold); letter-spacing:0.04em;">' + item.chapter + '</span>' +
          '<h2 style="font-size:var(--optic-font-display);">' + item.word + '</h2>' +
          '<div style="font-family:var(--optic-font-mono); font-size:var(--optic-font-sm); color:var(--text-tertiary);">' + item.phonetic + ' · ' + item.meaning + '</div>' +
          '<div class="rubbing-card">' +
          '<div style="font-size:var(--optic-font-xs); font-weight:700; color:var(--accent); margin-bottom:4px;">青苔汝窑字源拓印</div>' +
          '<p class="optic-body-text" style="font-size:var(--optic-font-sm);">' + item.rubbing + '</p>' +
          '</div>' +
          '</div>' +
          '<div class="kintsugi-dial">' +
          '<div style="position:relative; border-radius:14px; overflow:hidden; aspect-ratio:16/9; border:1px solid var(--border);">' +
          '<img src="assets/images/immersive-keyart.jpg" alt="星尘漫游 24K 金缮汝窑" style="width:100%; height:100%; object-fit:cover; display:block;">' +
          '<img src="assets/textures/kintsugi-resonator.svg" alt="金缮调频徽章" width="48" height="48" style="position:absolute; right:10px; bottom:10px; width:48px; height:48px; border-radius:12px; background:rgba(255,255,255,0.86); padding:4px;">' +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-size:var(--optic-font-xs); font-weight:700; color:var(--text-tertiary);">24K 金缮声波调频盘</span>' +
          '<span class="tabular-num" style="font-size:var(--optic-font-xs); color:var(--gold);">' + item.contour.length + ' 音拍包络</span>' +
          '</div>' +
          '<div class="contour-bars">' + barsHtml + '</div>' +
          '<button type="button" class="optic-btn optic-btn-primary" data-resonate-idx="' + idx + '">' +
          '🎵 聆听声波并共鸣锚定' +
          '</button>' +
          '</div>' +
          '</article>'
        );
      }).join('');

      stageEl.querySelectorAll('[data-resonate-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const i = Number(btn.getAttribute('data-resonate-idx'));
          const item = items[i];
          if (!item) return;
          core.playContour(item.freqs);
          const res = core.scheduleFSRS(item.id, 3);
          const statusEl = document.getElementById('imm-fsrs-status');
          if (statusEl) {
            statusEl.textContent = '已共鸣锚定 · FSRS 稳定性 ' + res.card.s + 'd';
          }
          btn.textContent = '✔ 已完成声波共鸣 (S=' + res.card.s + 'd)';
        });
      });
    }

    // 渲染 X 轴横向滑轨
    const trackEl = document.getElementById('film-track');
    if (trackEl) {
      trackEl.innerHTML = items.map(function (item, idx) {
        return (
          '<button type="button" class="track-pill-card ' + (idx === activeSlide ? 'active' : '') + '" data-slide-idx="' + idx + '">' +
          '<div>' +
          '<div style="font-size:var(--optic-font-xs); color:var(--text-tertiary);">' + item.chapter + '</div>' +
          '<div style="font-weight:700; font-size:var(--optic-font-h3);">' + item.word + '</div>' +
          '</div>' +
          '<span class="tabular-num" style="font-size:var(--optic-font-xs); color:var(--gold);">0' + (idx + 1) + '</span>' +
          '</button>'
        );
      }).join('');

      trackEl.querySelectorAll('[data-slide-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeSlide = Number(btn.getAttribute('data-slide-idx'));
          core.playTone(580, 0.02, 'sine');
          render();
        });
      });
    }

    const activeItem = items[activeSlide];
    const cardState = state.cards[activeItem.id];
    const statusEl = document.getElementById('imm-fsrs-status');
    if (statusEl) {
      statusEl.textContent = cardState
        ? '共鸣稳定性：' + cardState.s + ' 天 · 复习 ' + cardState.reps + ' 次'
        : '共鸣稳定性：待调频';
    }
  }

  document.querySelectorAll('[data-imm-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const state = core.loadState();
      state.lang = btn.getAttribute('data-imm-lang');
      core.saveState(state);
      activeSlide = 0;
      core.playTone(620, 0.02, 'sine');
      render();
    });
  });

  const modeBtn = document.getElementById('toggle-darkroom-btn');
  if (modeBtn) {
    modeBtn.addEventListener('click', function () {
      const isDark = document.body.getAttribute('data-mode') === 'darkroom';
      document.body.setAttribute('data-mode', isDark ? 'gallery' : 'darkroom');
      modeBtn.textContent = isDark ? '🌓 暗房放映态' : '☀️ 美术馆素白';
      core.playTone(480, 0.02, 'sine');
    });
  }

  core.initDropdowns();
  core.initDrawers();
  render();
})();
