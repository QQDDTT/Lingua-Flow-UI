/* ==========================================================================
   主题三：刻痕圣殿交互控制器 (strategic.js)
   ========================================================================== */
(function () {
  'use strict';

  const core = window.LinguaCore;
  if (!core) return;

  let trialIdx = 0;
  let shield = 100;
  let timerId = null;

  const WHEEL_TIPS = {
    en: [
      { label: '被动分词', desc: 'be + 过去分词 (V-ed/en)' },
      { label: '主语一致', desc: '非谓语逻辑主语须与主句一致' },
      { label: '完成时态', desc: 'had + 过去分词表过去的过去' },
      { label: '词尾屈折', desc: '区分主动 -ing 与被动 -ed' }
    ],
    ja: [
      { label: 'イ音便', desc: 'く→いて / ぐ→いで' },
      { label: '促音便', desc: 'う・つ・る → って' },
      { label: '使役被动', desc: '未然形 + される (五段)' },
      { label: '接续助词', desc: '～てみる 表尝试' }
    ],
    zh: [
      { label: '把字句', desc: '谓语不可为光杆单动词' },
      { label: '结果补语', desc: '动词 + 好/完/破 表处置结果' },
      { label: '无条件', desc: '无论/不管……都……' },
      { label: '已然让步', desc: '尽管……但是……' }
    ]
  };

  function setShield(val) {
    shield = Math.max(0, Math.min(100, val));
    document.body.style.setProperty('--shield-scale', (shield / 100).toFixed(2));
    const pctEl = document.getElementById('shield-pct');
    if (pctEl) pctEl.textContent = shield + '%';
  }

  function renderWheel(lang) {
    const hub = document.getElementById('radial-hub');
    if (!hub) return;
    hub.querySelectorAll('.radial-node').forEach(function (n) { n.remove(); });
    const tips = WHEEL_TIPS[lang] || WHEEL_TIPS.en;
    const coords = [
      { left: '50%', top: '11%', tx: '-50%', ty: '-50%' },
      { left: '89%', top: '50%', tx: '-50%', ty: '-50%' },
      { left: '50%', top: '89%', tx: '-50%', ty: '-50%' },
      { left: '11%', top: '50%', tx: '-50%', ty: '-50%' }
    ];

    tips.forEach(function (tip, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radial-node';
      btn.textContent = tip.label;
      btn.style.left = coords[i].left;
      btn.style.top = coords[i].top;
      btn.style.transform = 'translate(' + coords[i].tx + ', ' + coords[i].ty + ')';
      btn.addEventListener('click', function () {
        hub.querySelectorAll('.radial-node').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('wheel-center-title').textContent = tip.label;
        document.getElementById('wheel-center-desc').textContent = tip.desc;
        core.playTone(560, 0.018, 'sine');
      });
      hub.appendChild(btn);
    });
  }

  function render() {
    const state = core.loadState();
    const lang = state.lang;
    const trials = core.CORPORA.strategic[lang] || core.CORPORA.strategic.en;
    if (trialIdx >= trials.length) trialIdx = 0;
    const current = trials[trialIdx];
    const next = trials[(trialIdx + 1) % trials.length];

    const meta = core.LANG_META[lang];
    const langLabel = document.getElementById('str-lang-label');
    if (langLabel && meta) langLabel.textContent = meta.name;

    document.querySelectorAll('[data-str-lang]').forEach(function (el) {
      el.setAttribute('aria-selected', el.getAttribute('data-str-lang') === lang ? 'true' : 'false');
    });

    // Z-04 层叠甲板
    const deckEl = document.getElementById('deck-stage');
    if (deckEl) {
      const stemHtml = current.stem.replace('______', '<span class="tenon-blank" id="tenon-slot">______</span>');
      deckEl.innerHTML =
        '<article class="deck-card is-back" aria-hidden="true">' +
        '<span style="font-size:var(--optic-font-xs); color:var(--text-tertiary);">下一试炼：' + next.rank + '</span>' +
        '<h3>' + next.prompt + '</h3>' +
        '</article>' +
        '<article class="deck-card is-front">' +
        '<div class="theme-hero-window" style="height: 112px;">' +
        '<img src="assets/images/strategic-keyart.jpg" alt="刻痕圣殿" class="hero-art">' +
        '<img src="assets/textures/rose-rune-crest.svg" alt="玫瑰晶球" class="theme-hero-badge">' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
        '<span style="font-size:var(--optic-font-xs); font-weight:700; color:var(--accent);">' + current.rank + '</span>' +
        '<button type="button" class="optic-btn" id="next-trial-btn">切换试炼 ↻</button>' +
        '</div>' +
        '<h2>' + current.prompt + '</h2>' +
        '<div class="stem-slot-box">' + stemHtml + '</div>' +
        '</article>';

      const nextBtn = document.getElementById('next-trial-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (timerId) { clearTimeout(timerId); timerId = null; }
          trialIdx = (trialIdx + 1) % trials.length;
          setShield(100);
          core.playTone(500, 0.018, 'sine');
          render();
        });
      }
    }

    // 底部扇形手牌 (倾角控制在 -5deg ~ +5deg 符合 D12 <= +-6deg)
    const handEl = document.getElementById('hand-tray');
    if (handEl) {
      const tilts = [-4.5, -1.5, 1.5, 4.5];
      handEl.innerHTML = current.options.map(function (opt, idx) {
        return (
          '<button type="button" class="tenon-card" style="--card-tilt: ' + tilts[idx % 4] + 'deg;" data-opt-id="' + opt.id + '">' +
          '<span style="font-size:var(--optic-font-h3); font-weight:700;">' + opt.label + '</span>' +
          '<span style="font-size:var(--optic-font-xs); color:var(--text-tertiary);">' + opt.tag + '</span>' +
          '</button>'
        );
      }).join('');

      handEl.querySelectorAll('[data-opt-id]').forEach(function (cardBtn) {
        cardBtn.addEventListener('click', function () {
          const picked = cardBtn.getAttribute('data-opt-id');
          const isOk = picked === current.correctId;
          const slot = document.getElementById('tenon-slot');
          if (slot) slot.textContent = picked;

          handEl.querySelectorAll('.tenon-card').forEach(function (c) {
            c.classList.remove('is-correct', 'is-wrong');
          });

          const res = core.scheduleFSRS(current.id, isOk ? 4 : 1);
          const badge = document.getElementById('str-fsrs-badge');
          if (badge) badge.textContent = 'FSRS 稳定性：' + res.card.s + 'd';

          const hintEl = document.getElementById('str-hint-box');
          if (isOk) {
            cardBtn.classList.add('is-correct');
            setShield(0);
            core.playTone(780, 0.024, 'triangle');
            if (hintEl) hintEl.textContent = '✔ 破盾成功！' + current.hint;
            if (timerId) clearTimeout(timerId);
            timerId = setTimeout(function () {
              trialIdx = (trialIdx + 1) % trials.length;
              setShield(100);
              render();
            }, 1300);
          } else {
            cardBtn.classList.add('is-wrong');
            const nextShield = Math.max(0, shield - 50);
            setShield(nextShield);
            core.playTone(220, 0.024, 'sawtooth');
            if (hintEl) {
              hintEl.textContent = nextShield <= 0
                ? '⚠ 护盾已破防归零！请点击「切换试炼 ↻」重铸本关：' + current.hint
                : '✘ 卡榫未咬合（护盾 -50%）：' + current.hint;
            }
          }
        });
      });
    }

    renderWheel(lang);

    const cardState = state.cards[current.id];
    const badge = document.getElementById('str-fsrs-badge');
    if (badge) {
      badge.textContent = cardState ? 'FSRS 稳定性：' + cardState.s + 'd' : 'FSRS：待试炼';
    }
  }

  document.querySelectorAll('[data-str-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (timerId) { clearTimeout(timerId); timerId = null; }
      const state = core.loadState();
      state.lang = btn.getAttribute('data-str-lang');
      core.saveState(state);
      trialIdx = 0;
      setShield(100);
      core.playTone(620, 0.02, 'sine');
      render();
    });
  });

  const slateBtn = document.getElementById('toggle-slate-btn');
  if (slateBtn) {
    slateBtn.addEventListener('click', function () {
      const isDark = document.body.getAttribute('data-slate') === 'dark';
      document.body.setAttribute('data-slate', isDark ? 'light' : 'dark');
      slateBtn.textContent = isDark ? '🪨 深岩态' : '☁️ 浅雾态';
      core.playTone(460, 0.02, 'sine');
    });
  }

  window.addEventListener('beforeunload', function () {
    if (timerId) clearTimeout(timerId);
  });

  core.initDropdowns();
  core.initDrawers();
  render();
})();
