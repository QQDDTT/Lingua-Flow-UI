/* ==========================================================================
   L1 -> L2 跨页沉浸式转场控制器 (transition.js)
   ========================================================================== */
(function () {
  'use strict';

  const THEME_EMBLEMS = {
    codex: 'assets/textures/sigil-codex.svg',
    tidal: 'assets/textures/sigil-tidal.svg',
    prism: 'assets/textures/sigil-prism.svg'
  };

  function detectThemeFromHref(href) {
    if (!href) return null;
    if (href.indexOf('codex.html') !== -1) return 'codex';
    if (href.indexOf('tidal.html') !== -1) return 'tidal';
    if (href.indexOf('prism.html') !== -1) return 'prism';
    return null;
  }

  function ensureCurtain() {
    let curtain = document.getElementById('lf-transition-curtain');
    if (curtain) return curtain;
    curtain = document.createElement('div');
    curtain.id = 'lf-transition-curtain';
    curtain.className = 'lf-transition-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.className = 'lf-transition-emblem';
    img.alt = '';
    curtain.appendChild(img);
    document.body.appendChild(curtain);
    return curtain;
  }

  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const href = link.getAttribute('href');
    const theme = detectThemeFromHref(href);
    if (!theme) return;

    e.preventDefault();
    const rect = link.getBoundingClientRect();
    const curtain = ensureCurtain();
    const emblem = curtain.querySelector('.lf-transition-emblem');
    curtain.setAttribute('data-target-theme', theme);
    curtain.style.setProperty('--tx', Math.round(rect.left + rect.width / 2) + 'px');
    curtain.style.setProperty('--ty', Math.round(rect.top + rect.height / 2) + 'px');
    if (emblem) emblem.src = THEME_EMBLEMS[theme];

    if (window.LinguaCore) {
      const freqMap = { codex: 392, tidal: 523.25, prism: 440 };
      window.LinguaCore.playTone(freqMap[theme] || 440, 0.08, 'triangle');
    }

    requestAnimationFrame(function () { curtain.classList.add('is-active'); });
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () { window.location.href = href; }, reduced ? 160 : 480);
  });
})();
