/* ==========================================================================
   主题一：雾都回响交互控制器 (deductive.js)
   ========================================================================== */
(function () {
  'use strict';

  const core = window.LinguaCore;
  if (!core) return;

  let activeIndex = 0;
  let lensOpen = true;

  function render() {
    const state = core.loadState();
    const lang = state.lang;
    const cases = core.CORPORA.deductive[lang] || core.CORPORA.deductive.en;
    if (activeIndex >= cases.length) activeIndex = 0;
    const item = cases[activeIndex];

    const langMeta = core.LANG_META[lang];
    const langLabel = document.getElementById('ded-lang-label');
    if (langLabel && langMeta) langLabel.textContent = langMeta.name;

    document.querySelectorAll('[data-ded-lang]').forEach(function (el) {
      el.setAttribute('aria-selected', el.getAttribute('data-ded-lang') === lang ? 'true' : 'false');
    });

    // 左栏卷宗目录
    const caseListEl = document.getElementById('case-list');
    if (caseListEl) {
      caseListEl.innerHTML = cases.map(function (c, idx) {
        return (
          '<button type="button" class="case-nav-btn ' + (idx === activeIndex ? 'active' : '') + '" data-case-idx="' + idx + '">' +
          '<span style="font-size:var(--optic-font-xs); color:var(--accent); font-weight:700;">' + c.caseNo + '</span>' +
          '<span style="font-weight:600; font-size:var(--optic-font-sm);">' + c.title + '</span>' +
          '</button>'
        );
      }).join('');

      caseListEl.querySelectorAll('[data-case-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeIndex = Number(btn.getAttribute('data-case-idx'));
          core.playTone(500, 0.018, 'sine');
          render();
        });
      });
    }

    // 中栏案卷正文
    document.getElementById('dossier-case-no').textContent = item.caseNo;
    document.getElementById('dossier-title').textContent = item.title;
    document.getElementById('dossier-word').textContent = item.targetWord;
    document.getElementById('dossier-phonetic').textContent = item.phonetic;
    document.getElementById('dossier-testimony').textContent = item.testimony;

    const lensEl = document.getElementById('lens-panel');
    const toggleLensBtn = document.getElementById('toggle-lens-btn');
    if (lensEl && toggleLensBtn) {
      lensEl.hidden = !lensOpen;
      toggleLensBtn.textContent = lensOpen ? '🔍 蔡司显微透镜：收起' : '🔍 蔡司显微透镜：展开';
      lensEl.innerHTML = item.roots.map(function (r) {
        return (
          '<div class="root-chip">' +
          '<div class="root-part">' + r.part + '</div>' +
          '<div style="font-size:var(--optic-font-xs); color:var(--text-tertiary);">' + r.role + '</div>' +
          '<div style="font-size:var(--optic-font-sm); margin-top:2px;">' + r.meaning + '</div>' +
          '</div>'
        );
      }).join('');
    }

    // 右栏法庭指控与旁注
    document.getElementById('dossier-question').textContent = item.question;
    document.getElementById('dossier-sidenote').textContent = item.sidenote;

    const verdictBanner = document.getElementById('verdict-banner');
    if (verdictBanner) verdictBanner.hidden = true;

    const clauseListEl = document.getElementById('clause-list');
    if (clauseListEl) {
      clauseListEl.innerHTML = item.clauses.map(function (cl) {
        return (
          '<button type="button" class="clause-btn" data-clause-id="' + cl.id + '">' +
          '<span>' + cl.text + '</span><span aria-hidden="true">⚖️</span>' +
          '</button>'
        );
      }).join('');

      clauseListEl.querySelectorAll('[data-clause-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const cid = btn.getAttribute('data-clause-id');
          const cl = item.clauses.find(function (x) { return x.id === cid; });
          if (!cl) return;

          clauseListEl.querySelectorAll('.clause-btn').forEach(function (b) {
            b.classList.remove('hit-flaw', 'miss-flaw');
          });

          const res = core.scheduleFSRS(item.id, cl.isFlaw ? 4 : 1);
          if (cl.isFlaw) {
            btn.classList.add('hit-flaw');
            core.playTone(740, 0.024, 'triangle');
          } else {
            btn.classList.add('miss-flaw');
            core.playTone(240, 0.024, 'sawtooth');
          }

          if (verdictBanner) {
            verdictBanner.hidden = false;
            verdictBanner.style.display = 'flex';
            verdictBanner.style.alignItems = 'center';
            verdictBanner.style.justifyContent = 'space-between';
            verdictBanner.style.gap = '12px';
            document.getElementById('verdict-title').textContent = cl.isFlaw
              ? '✔ 矛盾指控成立 · FSRS 稳定性升至 ' + res.card.s + 'd'
              : '✘ 未发现破绽 · 请重新审视证词';
            document.getElementById('verdict-note').textContent = cl.note;
            const sealEl = document.getElementById('verdict-seal-img');
            if (sealEl) sealEl.hidden = !cl.isFlaw;
          }
          updateBadge(item.id);
        });
      });
    }

    updateBadge(item.id);
  }

  function updateBadge(cardId) {
    const state = core.loadState();
    const card = state.cards[cardId];
    const badge = document.getElementById('ded-fsrs-badge');
    if (badge) {
      badge.textContent = card
        ? 'FSRS 稳定性：' + card.s + ' 天 · 难度 ' + card.d
        : 'FSRS 稳定性：待审阅';
    }
  }

  document.querySelectorAll('[data-ded-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const state = core.loadState();
      state.lang = btn.getAttribute('data-ded-lang');
      core.saveState(state);
      activeIndex = 0;
      core.playTone(600, 0.018, 'sine');
      render();
    });
  });

  const lensBtn = document.getElementById('toggle-lens-btn');
  if (lensBtn) {
    lensBtn.addEventListener('click', function () {
      lensOpen = !lensOpen;
      core.playTone(520, 0.018, 'sine');
      render();
    });
  }

  core.initDropdowns();
  core.initDrawers();
  render();
})();
