/**
 * Lingua-Flow 客户端运行时与三级网页认知调度引擎 (app.js)
 * 承载：
 *   1. 三级网页架构路由与偏好同步：
 *      - L1 一级主页 (index.html)：选择【叙事主题】与【学习语言 (all/en/ja/zh)】
 *      - L2 二级主题主页 (deductive.html / immersive.html / strategic.html)：介绍【规则与操作方法】，选择【难度等级 (tier1/tier2/tier3)】与【学习内容 (all/lemma/grammar + 章节)】
 *      - L3 三级学习实操页 (learn.html)：按所选主题、语言、难度与章节展开双原语物理装置学习与 FSRS-5 结算
 *   2. Service Worker (sw.js) 离线缓存注册与在线/离线状态感知
 *   3. IndexedDB (LinguaFlowDB v1) 四大 ObjectStore 持久化层与语料分片自动入库
 *   4. 19 维 FSRS-5 确定性记忆状态转移方程与 FlowStateChannel 心流滑动窗口调节算子
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Lingua-Flow] Runtime System Online.');

  // =========================================================================
  // 0. HTML 安全转义与 Ruby 富文本白名单净化函数 (防御 DOM XSS)
  // =========================================================================
  function escapeHtml(raw) {
    return String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeRubyHtml(raw) {
    return escapeHtml(raw).replace(/&lt;(\/?(?:ruby|rt|strong))&gt;/gi, '<$1>');
  }

  // =========================================================================
  // 1. 三级网页全局状态与 URL 参数同步器 (Theme / Language / Difficulty / Content)
  // =========================================================================
  const PREFS_STORAGE_KEY = 'lingua_flow_prefs_v2';
  const STATE_MIRROR_KEY = 'lingua_flow_state_mirror_v1';
  const WINDOW_NAME_PREFIX = 'LF_ENVELOPE_V1:';
  const KU_ID_REGEX = /^(en|ja|zh)_(a[12]|b[12]|c[12]|n[1-5]|hsk([1-9]|79))_(lemma|grammar|hanzi)_[a-z0-9_]+$/;
  const ENCOUNTER_ID_REGEX = /^(deductive|immersive|strategic)_ep01_enc0[1-9]$/;

  const LANG_META = {
    en: {
      label: '🇬🇧 英语 · English (CEFR B1)',
      short: '🇬🇧 英语 (CEFR B1)',
      nameOnly: '英语专场',
      stdTag: 'CEFR B1',
      badge: '🇬🇧 已绑定语种：英语 English (2 专属案卷)'
    },
    ja: {
      label: '🇯🇵 日语 · 日本語 (JLPT N5)',
      short: '🇯🇵 日语 (JLPT N5)',
      nameOnly: '日语专场',
      stdTag: 'JLPT N5',
      badge: '🇯🇵 已绑定语种：日语 日本語 (2 专属案卷)'
    },
    zh: {
      label: '🇨🇳 汉语 · 中文 (HSK 3.0)',
      short: '🇨🇳 汉语 (HSK 1)',
      nameOnly: '汉语专场',
      stdTag: 'HSK 3.0',
      badge: '🇨🇳 已绑定语种：汉语 中文 (2 专属案卷)'
    }
  };

  function readWindowEnvelope() {
    try {
      if (typeof window.name === 'string' && window.name.startsWith(WINDOW_NAME_PREFIX)) {
        return JSON.parse(window.name.slice(WINDOW_NAME_PREFIX.length)) || {};
      }
    } catch (e) {
      // 忽略异常
    }
    return {};
  }

  function writeWindowEnvelope(patch) {
    try {
      const prev = readWindowEnvelope();
      const merged = { ...prev, ...patch };
      window.name = WINDOW_NAME_PREFIX + JSON.stringify(merged);
    } catch (e) {
      // 忽略异常
    }
  }

  const DIFFICULTY_META = {
    tier1: {
      label: '入门 (Foundation)',
      easyMaxMs: 6000,
      zeissMin: 60,
      rubbingMin: 65,
      freqBonusHz: 5,
      minOrbs: 2
    },
    tier2: {
      label: '进阶 (Standard)',
      easyMaxMs: 4000,
      zeissMin: 70,
      rubbingMin: 75,
      freqBonusHz: 0,
      minOrbs: 3
    },
    tier3: {
      label: '精通 (Mastery)',
      easyMaxMs: 3000,
      zeissMin: 85,
      rubbingMin: 88,
      freqBonusHz: -4,
      minOrbs: 99
    }
  };

  const CONTENT_META = {
    all: { label: '综合双轴实操', short: '📚 综合双轴实操' },
    lemma: { label: '核心词汇与字源专项', short: '🔬 词汇与字源专项' },
    grammar: { label: '句法时态与接续专项', short: '🎯 句法与接续专项' }
  };

  const SPECTRUM_META = {
    auto: { label: '情境自适应', short: '自适应', metaColor: '#f8fafc' },
    porcelain: { label: 'S1 日光白瓷', short: '白瓷', metaColor: '#f8fafc' },
    gallery: { label: 'S2 汝窑暖素', short: '汝窑暖素', metaColor: '#f5f5ef' },
    parchment: { label: 'S3 羊皮暖砂', short: '羊皮暖砂', metaColor: '#f3efe6' },
    slate: { label: 'S4 北欧雾灰', short: '北欧雾灰', metaColor: '#edf2f7' },
    obsidian: { label: 'S5 黑曜暗夜', short: '黑曜暗夜', metaColor: '#0a0c10' }
  };

  const THEME_META = {
    deductive: {
      name: '雾都回响 · 推理破案世界',
      short: '🔍 雾都回响',
      hubPage: 'deductive.html',
      defaultSpectrum: 'parchment',
      accentColor: 'var(--theme-accent)',
      hudImg: 'assets/textures/deductive/mechanic_hud.svg',
      companionName: '🦉 首席档案员 · 艾琳·诺克斯',
      companionEn: 'Irene Knox',
      companionDefault: '“先旋动蔡司黄铜调焦环看清物证词根，再点击证词中的破绽词块与正确物证。若需要语法支援，随时翻阅我的《取证笔记》。”',
      rigTiers: ['T1 黄铜单筒放大镜', 'T2 蔡司双环分光游标镜', 'T3 皇家法庭丁达尔全息取证仪']
    },
    immersive: {
      name: '星尘漫游 · 异星漫步世界',
      short: '🌌 星尘漫游',
      hubPage: 'immersive.html',
      defaultSpectrum: 'gallery',
      accentColor: 'var(--theme-accent)',
      hudImg: 'assets/textures/immersive/mechanic_hud.svg',
      companionName: '🪼 星尘螺钿水母向导 · 露米',
      companionEn: 'Lumi',
      companionDefault: '“先将声波滑块拨入目标赫兹区间对齐金缮母语波谷，再将下方汝窑石碑拓印滑块擦拭至目标阈值以上即可点亮螺钿字源。”',
      rigTiers: ['T1 汝窑天青单环音叉', 'T2 汝窑金缮八角折扇罗盘', 'T3 推光黑漆全光谱夜光螺钿浑天仪']
    },
    strategic: {
      name: '刻痕圣殿 · 符文策略世界',
      short: '⚔️ 刻痕圣殿',
      hubPage: 'strategic.html',
      defaultSpectrum: 'slate',
      accentColor: 'var(--theme-accent)',
      hudImg: 'assets/textures/strategic/mechanic_hud.svg',
      companionName: '📖 机巧魔典之灵 · 奥隆',
      companionEn: 'Oron',
      companionDefault: '“先点选正确词缀卡榫完成凹凸咬合，再按难度要求点亮六翼花窗句法晶球，即可释放焦散射线击碎护盾！”',
      rigTiers: ['T1 玄铁单槽鲁班锁', 'T2 双翼秘银燕尾槽锁', 'T3 六翼玫瑰花窗彩色焦散圣物核心']
    }
  };

  function loadLearningPrefs() {
    let stored = {};
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) || {};
    } catch (e) {
      // 忽略存储读取限制
    }
    const winEnv = readWindowEnvelope();
    const envPrefs = (winEnv && winEnv.prefs && typeof winEnv.prefs === 'object') ? winEnv.prefs : {};
    const params = new URLSearchParams(window.location.search);

    const rawUrlLang = params.get('lang');
    const urlLang = LANG_META[rawUrlLang] ? rawUrlLang : null;
    const envLang = LANG_META[envPrefs.lang] ? envPrefs.lang : null;
    const storedLang = LANG_META[stored.lang] ? stored.lang : null;

    const theme = params.get('theme') || envPrefs.theme || stored.theme || 'deductive';
    const lang = urlLang || envLang || storedLang || 'en';
    const difficulty = params.get('difficulty') || envPrefs.difficulty || stored.difficulty || 'tier2';
    const content = params.get('content') || envPrefs.content || stored.content || 'all';
    const spectrum = params.get('spectrum') || envPrefs.spectrum || stored.spectrum || 'auto';
    const chapter =
      params.get('chapter') !== null
        ? Number(params.get('chapter'))
        : envPrefs.chapter !== undefined
          ? Number(envPrefs.chapter)
          : stored.chapter || 0;

    const cleanPrefs = {
      theme: THEME_META[theme] ? theme : 'deductive',
      lang: LANG_META[lang] ? lang : 'en',
      difficulty: DIFFICULTY_META[difficulty] ? difficulty : 'tier2',
      content: CONTENT_META[content] ? content : 'all',
      spectrum: SPECTRUM_META[spectrum] ? spectrum : 'auto',
      chapter: Number.isFinite(chapter) && chapter >= 0 ? chapter : 0
    };
    saveLearningPrefs(cleanPrefs);
    return cleanPrefs;
  }

  function saveLearningPrefs(prefs) {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      // 忽略存储写入限制
    }
    writeWindowEnvelope({ prefs });
  }

  function buildLearnUrl(prefs, chapterIdx = 0) {
    const q = new URLSearchParams({
      theme: prefs.theme,
      lang: prefs.lang,
      difficulty: prefs.difficulty,
      content: prefs.content,
      chapter: String(chapterIdx)
    });
    return `learn.html?${q.toString()}`;
  }

  function buildHubUrl(themeKey, prefs) {
    const q = new URLSearchParams({
      lang: prefs.lang,
      difficulty: prefs.difficulty,
      content: prefs.content
    });
    return `${themeKey}.html?${q.toString()}`;
  }

  // =========================================================================
  // 2. 注册 Offline-First Service Worker (sw.js) 与网络状态同步
  // =========================================================================
  const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

  if ('serviceWorker' in navigator && !IS_FILE_PROTOCOL) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('[Lingua-Flow] ServiceWorker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Lingua-Flow] ServiceWorker registration skipped:', err.message);
        });
    });
  }

  const netDot = document.getElementById('network-dot');
  const netText = document.getElementById('network-text');
  const dbStatsText = document.getElementById('db-stats-text');

  function syncNetworkStatus() {
    if (!netDot || !netText) return;
    if (navigator.onLine) {
      netDot.style.backgroundColor = 'var(--accent-emerald)';
      netDot.style.boxShadow = '0 0 8px var(--accent-emerald)';
      netText.textContent = '离线就绪 · 实时同步';
    } else {
      netDot.style.backgroundColor = 'var(--accent-amber)';
      netDot.style.boxShadow = '0 0 8px var(--accent-amber)';
      netText.textContent = '离线运行中';
    }
  }

  window.addEventListener('online', syncNetworkStatus);
  window.addEventListener('offline', syncNetworkStatus);
  syncNetworkStatus();

  // =========================================================================
  // 3. 非阻塞心流 Toast 通知器 (视口顶部居中高辨识度全息通知，支持 success/warn/info)
  // =========================================================================
  const toastContainer = document.getElementById('toast-container');
  const MAX_VISIBLE_TOASTS = 3;

  function showFlowToast(message, tone = 'info') {
    if (!toastContainer) return;
    const msgStr = String(message || '');
    let inferredTone = tone;
    if (inferredTone === 'info') {
      if (/^(✅|🎯|✨|💥|🔬|🌊|🪨|🌐|📥|📤|🏆)/.test(msgStr)) {
        inferredTone = 'success';
      } else if (/^(⚠️|⚡|❌)/.test(msgStr)) {
        inferredTone = 'warn';
      }
    }
    while (toastContainer.children.length >= MAX_VISIBLE_TOASTS) {
      toastContainer.firstElementChild.remove();
    }
    const toast = document.createElement('div');
    toast.className = `toast-banner toast-${inferredTone}`;
    toast.textContent = msgStr;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.28s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 290);
    }, 3800);
  }

  // =========================================================================
  // 4. 19 维 FSRS-5 确定性记忆状态转移数学引擎 & FlowStateChannel 心流算子
  // =========================================================================
  const FSRS5_WEIGHTS = [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14,
    0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61, 0.51, 0.65
  ];
  const FSRS_DECAY = -0.5;
  const FSRS_FACTOR = 19 / 81;
  const GRADE_MAP = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
  const FLOW_WINDOW_SIZE = 10;
  const T_SLOW_MS = 12000;
  const flowSlidingWindow = [];

  function clamp(val, minVal, maxVal) {
    if (Number.isNaN(val) || !Number.isFinite(val)) return minVal;
    return Math.min(maxVal, Math.max(minVal, val));
  }

  function computeFlowChannelMetrics(windowEntries) {
    const entries = Array.isArray(windowEntries) ? windowEntries.slice(-FLOW_WINDOW_SIZE) : [];
    if (entries.length === 0) {
      return {
        channel_state: 'FLOW',
        avg_error_rate: 0.15,
        avg_tau: 0.75,
        target_retention: 0.9,
        window_size: 0
      };
    }
    let errSum = 0;
    let tauSum = 0;
    entries.forEach((item) => {
      errSum += Math.min(1, Math.max(0, Number(item.error_count) || 0));
      tauSum += Math.max(0, Number(item.duration_ms) || 0) / T_SLOW_MS;
    });
    const avgErrorRate = Number((errSum / entries.length).toFixed(3));
    const avgTau = Number((tauSum / entries.length).toFixed(3));

    let channelState = 'FLOW';
    let targetRetention = 0.9;
    if (avgErrorRate > 0.35 || avgTau > 1.2) {
      channelState = 'OVERLOAD';
      targetRetention = 0.86;
    } else if (avgErrorRate < 0.1 && avgTau < 0.5) {
      channelState = 'UNDERLOAD';
      targetRetention = 0.92;
    }

    return {
      channel_state: channelState,
      avg_error_rate: avgErrorRate,
      avg_tau: avgTau,
      target_retention: targetRetention,
      window_size: entries.length
    };
  }

  function computeRetrievability(elapsedDays, stability) {
    const safeS = clamp(stability, 0.1, 36500);
    const tEff = Math.max(0, Number(elapsedDays) || 0);
    return Math.pow(1 + FSRS_FACTOR * (tEff / safeS), FSRS_DECAY);
  }

  function computeFsrs5Transition(prevItem, seed, ratingGrade, nowIso, targetRetention = 0.9) {
    const w = FSRS5_WEIGHTS;
    const G = GRADE_MAP[ratingGrade] || 3;
    const dSeed = clamp(seed && seed.initial_difficulty ? seed.initial_difficulty : w[4], 1.0, 10.0);
    const sSeed = Math.max(0.1, seed && seed.initial_stability ? seed.initial_stability : w[2]);
    const rReq = clamp(targetRetention, 0.8, 0.95);

    let newS = 0.1;
    let newD = dSeed;
    let retrievability = 1.0;
    let reps = 1;
    let lapses = G === 1 ? 1 : 0;

    if (!prevItem || !prevItem.reps) {
      const s0 = w[G - 1] * Math.pow(sSeed / w[2], 0.5);
      newS = clamp(s0, 0.1, 36500);
      const dRaw = w[4] - (G - 3) * w[5];
      newD = clamp(0.5 * dSeed + 0.5 * dRaw, 1.0, 10.0);
    } else {
      reps = (prevItem.reps || 0) + 1;
      lapses = (prevItem.lapses || 0) + (G === 1 ? 1 : 0);
      const prevS = clamp(prevItem.stability, 0.1, 36500);
      const prevD = clamp(prevItem.difficulty, 1.0, 10.0);
      const prevTimeMs = Date.parse(prevItem.last_review_at || nowIso);
      const nowTimeMs = Date.parse(nowIso);
      const elapsedDays = Math.max(0, (nowTimeMs - prevTimeMs) / 86400000);

      retrievability = computeRetrievability(elapsedDays, prevS);
      newD = clamp(w[7] * dSeed + (1 - w[7]) * (prevD - w[6] * (G - 3)), 1.0, 10.0);

      if (elapsedDays < 1.0) {
        newS = clamp(prevS * Math.exp(w[17] * (G - 3 + w[18])), 0.1, 36500);
      } else if (G === 1) {
        const sf =
          w[11] *
          Math.pow(newD, -w[12]) *
          (Math.pow(prevS + 1, w[13]) - 1) *
          Math.exp(w[14] * (1 - retrievability));
        newS = clamp(sf, 0.1, prevS);
      } else {
        const gamma = G === 2 ? w[15] : G === 4 ? w[16] : 1.0;
        const sr =
          prevS *
          (1 +
            Math.exp(w[8]) *
              (11 - newD) *
              Math.pow(prevS, -w[9]) *
              (Math.exp(w[10] * (1 - retrievability)) - 1) *
              gamma);
        newS = clamp(sr, 0.1, 36500);
      }
    }

    const rawInterval = (newS / FSRS_FACTOR) * (Math.pow(rReq, 1 / FSRS_DECAY) - 1);
    const intervalDays = Math.max(1, Math.round(rawInterval));
    const nextDueIso = new Date(Date.parse(nowIso) + intervalDays * 86400000).toISOString();

    return {
      stability: Number(newS.toFixed(2)),
      difficulty: Number(newD.toFixed(2)),
      retrievability: Number(retrievability.toFixed(4)),
      interval_days: intervalDays,
      reps,
      lapses,
      last_review_at: nowIso,
      next_due_at: nextDueIso
    };
  }

  // =========================================================================
  // 5. 客户端离线状态仓 IndexedDB (LinguaFlowDB v1)
  // =========================================================================
  const DB_NAME = 'LinguaFlowDB';
  const DB_VERSION = 1;
  let dbInstance = null;
  const memorySeedMap = new Map();

  function openLinguaFlowDB() {
    return new Promise((resolve) => {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('knowledge_units')) {
          const kuStore = db.createObjectStore('knowledge_units', { keyPath: 'ku_id' });
          kuStore.createIndex('by_lang_level', ['lang', 'level'], { unique: false });
          kuStore.createIndex('by_unit_type', 'unit_type', { unique: false });
        }
        if (!db.objectStoreNames.contains('memory_items')) {
          const memStore = db.createObjectStore('memory_items', { keyPath: 'ku_id' });
          memStore.createIndex('next_due_at', 'next_due_at', { unique: false });
          memStore.createIndex('stability', 'stability', { unique: false });
          memStore.createIndex('difficulty', 'difficulty', { unique: false });
        }
        if (!db.objectStoreNames.contains('action_audit_logs')) {
          const logStore = db.createObjectStore('action_audit_logs', {
            keyPath: 'log_id',
            autoIncrement: true
          });
          logStore.createIndex('ku_id', 'ku_id', { unique: false });
          logStore.createIndex('reviewed_at', 'reviewed_at', { unique: false });
        }
        if (!db.objectStoreNames.contains('theme_progress')) {
          db.createObjectStore('theme_progress', { keyPath: 'theme_id' });
        }
      };
      req.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };
      req.onerror = () => {
        console.warn('[Lingua-Flow] IndexedDB open fallback to memory.');
        resolve(null);
      };
    });
  }

  function createEmptyStateMirror() {
    return {
      schema_version: '1.0.0',
      updated_at: new Date().toISOString(),
      memory_items: Object.create(null),
      theme_progress: Object.create(null)
    };
  }

  function sanitizeMemoryRecord(kuId, rawRec) {
    if (!KU_ID_REGEX.test(String(kuId || '')) || !rawRec || typeof rawRec !== 'object') return null;
    const nowIso = new Date().toISOString();
    const safeGrade = ['AGAIN', 'HARD', 'GOOD', 'EASY'].includes(rawRec.last_grade) ? rawRec.last_grade : 'GOOD';
    const safeS = Number(clamp(Number(rawRec.stability) || 2.5, 0.1, 36500).toFixed(2));
    const safeD = Number(clamp(Number(rawRec.difficulty) || 4.0, 1.0, 10.0).toFixed(2));
    const safeR = Number(clamp(Number(rawRec.retrievability) || 0.9, 0.01, 1.0).toFixed(4));
    const safeInterval = Math.max(1, Math.min(36500, Math.round(Number(rawRec.interval_days) || 1)));
    const safeReps = Math.max(1, Math.min(100000, Math.round(Number(rawRec.reps) || 1)));
    const safeLapses = Math.max(0, Math.min(100000, Math.round(Number(rawRec.lapses) || 0)));
    return {
      ku_id: kuId,
      last_grade: safeGrade,
      stability: safeS,
      difficulty: safeD,
      retrievability: safeR,
      interval_days: safeInterval,
      reps: safeReps,
      lapses: safeLapses,
      last_review_at: typeof rawRec.last_review_at === 'string' ? rawRec.last_review_at : nowIso,
      next_due_at: typeof rawRec.next_due_at === 'string' ? rawRec.next_due_at : nowIso
    };
  }

  function sanitizeThemeProgressRecord(themeId, rawProg) {
    if (!THEME_META[themeId] || !rawProg || typeof rawProg !== 'object') return null;
    const rawClues = Array.isArray(rawProg.unlocked_clues) ? rawProg.unlocked_clues : [];
    const rawEncs = Array.isArray(rawProg.completed_encounters) ? rawProg.completed_encounters : [];
    const safeClues = Array.from(new Set(rawClues.filter((c) => KU_ID_REGEX.test(String(c || '')))));
    const safeEncs = Array.from(new Set(rawEncs.filter((e) => ENCOUNTER_ID_REGEX.test(String(e || '')))));
    return {
      theme_id: themeId,
      current_episode_id: `${themeId}_ep01`,
      unlocked_clues: safeClues,
      completed_encounters: safeEncs,
      flow_window_metrics:
        rawProg.flow_window_metrics && typeof rawProg.flow_window_metrics === 'object'
          ? {
              channel_state: ['FLOW', 'OVERLOAD', 'UNDERLOAD'].includes(rawProg.flow_window_metrics.channel_state)
                ? rawProg.flow_window_metrics.channel_state
                : 'FLOW',
              avg_error_rate: clamp(Number(rawProg.flow_window_metrics.avg_error_rate) || 0, 0, 1),
              avg_tau: clamp(Number(rawProg.flow_window_metrics.avg_tau) || 0.75, 0, 10),
              target_retention: clamp(Number(rawProg.flow_window_metrics.target_retention) || 0.9, 0.8, 0.95),
              window_size: Math.max(0, Math.min(50, Math.round(Number(rawProg.flow_window_metrics.window_size) || 0)))
            }
          : computeFlowChannelMetrics(flowSlidingWindow),
      updated_at: typeof rawProg.updated_at === 'string' ? rawProg.updated_at : new Date().toISOString()
    };
  }

  function loadStateMirror() {
    const base = createEmptyStateMirror();
    const sources = [];
    try {
      const raw = localStorage.getItem(STATE_MIRROR_KEY);
      if (raw) sources.push(JSON.parse(raw));
    } catch (e) {
      // 忽略读取限制
    }
    const winEnv = readWindowEnvelope();
    if (winEnv && winEnv.mirror && typeof winEnv.mirror === 'object') {
      sources.push(winEnv.mirror);
    }
    sources.forEach((parsed) => {
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.memory_items && typeof parsed.memory_items === 'object') {
        Object.keys(parsed.memory_items).forEach((k) => {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
          const clean = sanitizeMemoryRecord(k, parsed.memory_items[k]);
          if (clean) base.memory_items[k] = clean;
        });
      }
      if (parsed.theme_progress && typeof parsed.theme_progress === 'object') {
        Object.keys(parsed.theme_progress).forEach((tKey) => {
          if (tKey === '__proto__' || tKey === 'constructor' || tKey === 'prototype') return;
          const cleanProg = sanitizeThemeProgressRecord(tKey, parsed.theme_progress[tKey]);
          if (!cleanProg) return;
          const prevP = base.theme_progress[tKey];
          if (!prevP) {
            base.theme_progress[tKey] = cleanProg;
          } else {
            base.theme_progress[tKey] = {
              ...cleanProg,
              unlocked_clues: Array.from(new Set([...(prevP.unlocked_clues || []), ...(cleanProg.unlocked_clues || [])])),
              completed_encounters: Array.from(
                new Set([...(prevP.completed_encounters || []), ...(cleanProg.completed_encounters || [])])
              )
            };
          }
        });
      }
    });
    return base;
  }

  function saveStateMirror(mirrorState) {
    mirrorState.updated_at = new Date().toISOString();
    try {
      localStorage.setItem(STATE_MIRROR_KEY, JSON.stringify(mirrorState));
    } catch (e) {
      // 忽略写入限制
    }
    writeWindowEnvelope({ mirror: mirrorState });
  }

  async function getUnifiedProgressState() {
    const mirror = loadStateMirror();
    const db = await openLinguaFlowDB();
    if (!db) return mirror;
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(['memory_items', 'theme_progress'], 'readonly');
        const memReq = tx.objectStore('memory_items').getAll();
        const progReq = tx.objectStore('theme_progress').getAll();
        tx.oncomplete = () => {
          const dbMems = Array.isArray(memReq.result) ? memReq.result : [];
          dbMems.forEach((m) => {
            const clean = sanitizeMemoryRecord(m && m.ku_id, m);
            if (!clean) return;
            const existing = mirror.memory_items[clean.ku_id];
            if (!existing || (clean.reps || 0) >= (existing.reps || 0)) {
              mirror.memory_items[clean.ku_id] = clean;
            }
          });
          const dbProgs = Array.isArray(progReq.result) ? progReq.result : [];
          dbProgs.forEach((p) => {
            const cleanP = sanitizeThemeProgressRecord(p && p.theme_id, p);
            if (!cleanP) return;
            const prevP = mirror.theme_progress[cleanP.theme_id];
            if (!prevP) {
              mirror.theme_progress[cleanP.theme_id] = cleanP;
            } else {
              mirror.theme_progress[cleanP.theme_id] = {
                ...cleanP,
                unlocked_clues: Array.from(new Set([...(prevP.unlocked_clues || []), ...(cleanP.unlocked_clues || [])])),
                completed_encounters: Array.from(
                  new Set([...(prevP.completed_encounters || []), ...(cleanP.completed_encounters || [])])
                )
              };
            }
          });
          saveStateMirror(mirror);
          resolve();
        };
        tx.onerror = () => resolve();
      });
    } catch (e) {
      // 忽略只读合并异常
    }
    return mirror;
  }

  async function syncMirrorToIndexedDB(mirrorState) {
    const db = await openLinguaFlowDB();
    if (!db) return;
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(['memory_items', 'theme_progress'], 'readwrite');
        const memStore = tx.objectStore('memory_items');
        const progStore = tx.objectStore('theme_progress');
        Object.values(mirrorState.memory_items || {}).forEach((m) => memStore.put(m));
        Object.values(mirrorState.theme_progress || {}).forEach((p) => progStore.put(p));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      // 忽略同步异常
    }
  }

  async function exportClientProgressJson() {
    const unified = await getUnifiedProgressState();
    const prefs = loadLearningPrefs();
    const payload = {
      schema_version: '1.0.0',
      exported_at: new Date().toISOString(),
      prefs,
      memory_items: unified.memory_items,
      theme_progress: unified.theme_progress
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lingua-flow-progress-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showFlowToast('📥 已导出客户端学习进度备份 JSON 文件');
  }

  async function importClientProgressJson(rawJsonText) {
    let parsed = null;
    try {
      parsed = JSON.parse(String(rawJsonText || ''));
    } catch (e) {
      showFlowToast('⚠️ 进度备份文件解析失败：不是合法的 JSON 格式');
      return false;
    }
    if (!parsed || typeof parsed !== 'object') {
      showFlowToast('⚠️ 进度备份格式无效');
      return false;
    }
    const current = await getUnifiedProgressState();
    let importedMemCount = 0;
    let importedEncCount = 0;

    if (parsed.memory_items && typeof parsed.memory_items === 'object') {
      const entries = Array.isArray(parsed.memory_items)
        ? parsed.memory_items.map((it) => [it && it.ku_id, it])
        : Object.entries(parsed.memory_items);
      entries.forEach(([k, val]) => {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
        const clean = sanitizeMemoryRecord(k, val);
        if (clean) {
          current.memory_items[clean.ku_id] = clean;
          importedMemCount += 1;
        }
      });
    }

    if (parsed.theme_progress && typeof parsed.theme_progress === 'object') {
      const entries = Array.isArray(parsed.theme_progress)
        ? parsed.theme_progress.map((it) => [it && it.theme_id, it])
        : Object.entries(parsed.theme_progress);
      entries.forEach(([tKey, val]) => {
        if (tKey === '__proto__' || tKey === 'constructor' || tKey === 'prototype') return;
        const cleanP = sanitizeThemeProgressRecord(tKey, val);
        if (cleanP) {
          const prevP = current.theme_progress[cleanP.theme_id];
          current.theme_progress[cleanP.theme_id] = {
            ...cleanP,
            unlocked_clues: Array.from(
              new Set([...((prevP && prevP.unlocked_clues) || []), ...cleanP.unlocked_clues])
            ),
            completed_encounters: Array.from(
              new Set([...((prevP && prevP.completed_encounters) || []), ...cleanP.completed_encounters])
            )
          };
          importedEncCount += current.theme_progress[cleanP.theme_id].completed_encounters.length;
        }
      });
    }

    saveStateMirror(current);
    await syncMirrorToIndexedDB(current);
    await refreshDbStatsBadge();
    showFlowToast(`📤 进度导入完成：已恢复 ${importedMemCount} 张 FSRS 记忆卡与 ${importedEncCount} 处章节进度`);
    return true;
  }

  async function resetClientProgress() {
    const emptyMirror = createEmptyStateMirror();
    saveStateMirror(emptyMirror);
    const db = await openLinguaFlowDB();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(['memory_items', 'action_audit_logs', 'theme_progress'], 'readwrite');
        tx.objectStore('memory_items').clear();
        tx.objectStore('action_audit_logs').clear();
        tx.objectStore('theme_progress').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    await refreshDbStatsBadge();
    showFlowToast('🗑️ 已清空客户端本地学习进度与 FSRS 记忆卡');
  }

  async function refreshDbStatsBadge() {
    if (!dbStatsText) return;
    const unified = await getUnifiedProgressState();
    const memCount = Object.keys(unified.memory_items || {}).length;
    const db = await openLinguaFlowDB();
    const flowInfo = computeFlowChannelMetrics(flowSlidingWindow);
    if (!db) {
      dbStatsText.textContent = `本地记忆仓: ${memorySeedMap.size} KU / ${memCount} 记忆卡 · ${flowInfo.channel_state}`;
      return;
    }
    try {
      const tx = db.transaction(['knowledge_units', 'memory_items'], 'readonly');
      const kuCountReq = tx.objectStore('knowledge_units').count();
      const memCountReq = tx.objectStore('memory_items').count();
      tx.oncomplete = () => {
        const finalMemCount = Math.max(memCount, memCountReq.result || 0);
        dbStatsText.textContent = `LinguaFlowDB · ${kuCountReq.result || memorySeedMap.size} KU / ${finalMemCount} 记忆卡 · ${flowInfo.channel_state}`;
      };
    } catch (e) {
      dbStatsText.textContent = `LinguaFlowDB · ${memCount} 记忆卡就绪`;
    }
  }

  const OFFLINE_KU_SEEDS = {
    en_b1_grammar_past_continuous: { initial_difficulty: 4.2, initial_stability: 2.6 },
    en_b1_grammar_subjunctive_past: { initial_difficulty: 5.4, initial_stability: 2.0 },
    en_b1_lemma_contradict: { initial_difficulty: 4.8, initial_stability: 2.3 },
    en_b1_lemma_alibi: { initial_difficulty: 4.5, initial_stability: 2.4 },
    ja_n5_grammar_0001: { initial_difficulty: 3.2, initial_stability: 3.4 },
    ja_n5_grammar_0012: { initial_difficulty: 4.6, initial_stability: 2.4 },
    ja_n5_lemma_0001: { initial_difficulty: 3.0, initial_stability: 3.6 },
    ja_n5_lemma_0002: { initial_difficulty: 3.8, initial_stability: 2.9 },
    ja_n5_hanzi_0001: { initial_difficulty: 3.5, initial_stability: 3.2 },
    ja_n5_hanzi_0002: { initial_difficulty: 4.1, initial_stability: 2.7 },
    zh_hsk1_grammar_0001: { initial_difficulty: 3.6, initial_stability: 3.0 },
    zh_hsk1_grammar_0002: { initial_difficulty: 3.1, initial_stability: 3.5 },
    zh_hsk1_lemma_0001: { initial_difficulty: 2.9, initial_stability: 3.8 },
    zh_hsk1_lemma_0002: { initial_difficulty: 3.0, initial_stability: 3.6 },
    zh_hsk1_hanzi_0001: { initial_difficulty: 3.4, initial_stability: 3.1 },
    zh_hsk1_hanzi_0002: { initial_difficulty: 3.3, initial_stability: 3.2 }
  };
  Object.entries(OFFLINE_KU_SEEDS).forEach(([k, v]) => memorySeedMap.set(k, v));

  async function syncProcessedShardsToIndexedDB() {
    if (IS_FILE_PROTOCOL) {
      await refreshDbStatsBadge();
      return;
    }
    const db = await openLinguaFlowDB();
    try {
      const manifestResp = await fetch('./assets/data/processed/manifest.json');
      if (!manifestResp.ok) return;
      const manifest = await manifestResp.json();
      const groups = manifest.partition_groups || {};
      const shardFiles = [];
      Object.values(groups).forEach((group) => {
        (group.shards || []).forEach((s) => {
          if (s.shard_file) shardFiles.push(s.shard_file);
        });
      });

      for (const fileName of shardFiles) {
        const shardResp = await fetch(`./assets/data/processed/${encodeURIComponent(fileName)}`);
        if (!shardResp.ok) continue;
        const shardData = await shardResp.json();
        const items = Array.isArray(shardData.items) ? shardData.items : [];
        items.forEach((it) => {
          if (it.ku_id && it.fsrs_seed) {
            memorySeedMap.set(it.ku_id, it.fsrs_seed);
          }
        });
        if (db && items.length > 0) {
          await new Promise((resolve) => {
            const tx = db.transaction('knowledge_units', 'readwrite');
            const store = tx.objectStore('knowledge_units');
            items.forEach((it) => store.put(it));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        }
      }
    } catch (e) {
      console.warn('[Lingua-Flow] Corpus shard sync deferred:', e.message);
    }
    await refreshDbStatsBadge();
  }

  // =========================================================================
  // 6. 活跃专注计时器与难度感知 ReviewRating 映射
  // =========================================================================
  const MAX_EFFECTIVE_DURATION_MS = 60000;
  let activeTimer = {
    isRunning: false,
    accumulatedMs: 0,
    lastResumeTime: 0
  };

  function startActiveTimer() {
    activeTimer.isRunning = true;
    activeTimer.accumulatedMs = 0;
    activeTimer.lastResumeTime = performance.now();
  }

  function stopAndGetActiveDurationMs() {
    if (!activeTimer.isRunning) return 0;
    if (document.visibilityState === 'visible') {
      activeTimer.accumulatedMs += performance.now() - activeTimer.lastResumeTime;
    }
    activeTimer.isRunning = false;
    return Math.min(MAX_EFFECTIVE_DURATION_MS, Math.max(0, Math.round(activeTimer.accumulatedMs)));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (activeTimer.isRunning) {
        activeTimer.accumulatedMs += performance.now() - activeTimer.lastResumeTime;
      }
      if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend().catch(() => {});
      }
    } else if (document.visibilityState === 'visible') {
      if (activeTimer.isRunning) {
        activeTimer.lastResumeTime = performance.now();
      }
      if (audioEnabled && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }
  });

  function evaluateReviewRating(errorCount, durationMs, usedCompanionHint = false, difficultyKey = 'tier2') {
    const easyCapMs = (DIFFICULTY_META[difficultyKey] && DIFFICULTY_META[difficultyKey].easyMaxMs) || 4000;
    if (usedCompanionHint || errorCount >= 2) {
      return { grade: 'AGAIN', multiplierLabel: '触发同伴线索重构' };
    }
    if (errorCount === 0 && durationMs <= easyCapMs) {
      return { grade: 'EASY', multiplierLabel: '自动化图式秒答' };
    }
    if (errorCount === 0 && durationMs <= 12000) {
      return { grade: 'GOOD', multiplierLabel: '稳态心流提取' };
    }
    return { grade: 'HARD', multiplierLabel: '深层阻滞提取成功' };
  }

  async function recordDualKuReviewInDB(encounterId, themeId, durationMs, attributions, difficultyKey = 'tier2') {
    const db = await openLinguaFlowDB();
    const mirror = loadStateMirror();
    const nowIso = new Date().toISOString();
    const results = [];

    attributions.forEach((attr) => {
      flowSlidingWindow.push({
        error_count: attr.errorCount,
        duration_ms: durationMs
      });
    });
    while (flowSlidingWindow.length > FLOW_WINDOW_SIZE) {
      flowSlidingWindow.shift();
    }
    const flowMetrics = computeFlowChannelMetrics(flowSlidingWindow);

    for (const attr of attributions) {
      const { kuId, errorCount, usedCompanionHint } = attr;
      const ratingInfo = evaluateReviewRating(errorCount, durationMs, usedCompanionHint, difficultyKey);

      if (!db) {
        const fallbackSeed = memorySeedMap.get(kuId) || { initial_difficulty: 4.0, initial_stability: 2.5 };
        const prevMirrorItem = mirror.memory_items[kuId] || null;
        const nextState = computeFsrs5Transition(
          prevMirrorItem,
          fallbackSeed,
          ratingInfo.grade,
          nowIso,
          flowMetrics.target_retention
        );
        const memRecord = {
          ku_id: kuId,
          last_grade: ratingInfo.grade,
          ...nextState
        };
        mirror.memory_items[kuId] = memRecord;
        const prevMirrorProg = mirror.theme_progress[themeId] || null;
        mirror.theme_progress[themeId] = {
          theme_id: themeId,
          current_episode_id: `${themeId}_ep01`,
          unlocked_clues: Array.from(new Set([...((prevMirrorProg && prevMirrorProg.unlocked_clues) || []), kuId])),
          completed_encounters: Array.from(
            new Set([...((prevMirrorProg && prevMirrorProg.completed_encounters) || []), encounterId])
          ),
          flow_window_metrics: flowMetrics,
          updated_at: nowIso
        };
        results.push({
          kuId,
          grade: ratingInfo.grade,
          stability: nextState.stability,
          difficulty: nextState.difficulty,
          intervalDays: nextState.interval_days,
          flowChannel: flowMetrics.channel_state
        });
        continue;
      }

      // 单一 readwrite 事务内同步完成 Read-Modify-Write（冷启动回填 fsrs_seed + 原子更新记忆卡与主题进度）
      const txResult = await new Promise((resolve) => {
        const tx = db.transaction(
          ['knowledge_units', 'memory_items', 'action_audit_logs', 'theme_progress'],
          'readwrite'
        );
        const kuStore = tx.objectStore('knowledge_units');
        const memStore = tx.objectStore('memory_items');
        const logStore = tx.objectStore('action_audit_logs');
        const progStore = tx.objectStore('theme_progress');

        const kuReq = kuStore.get(kuId);
        const memReq = memStore.get(kuId);
        const progReq = progStore.get(themeId);
        let computedRecord = null;

        progReq.onsuccess = () => {
          const kuDoc = kuReq.result || null;
          if (kuDoc && kuDoc.fsrs_seed && !memorySeedMap.has(kuId)) {
            memorySeedMap.set(kuId, kuDoc.fsrs_seed);
          }
          const seed =
            memorySeedMap.get(kuId) ||
            (kuDoc && kuDoc.fsrs_seed) ||
            { initial_difficulty: 4.0, initial_stability: 2.5 };
          const prevItem = memReq.result || mirror.memory_items[kuId] || null;
          const prevThemeProgress = progReq.result || mirror.theme_progress[themeId] || null;

          const nextState = computeFsrs5Transition(
            prevItem,
            seed,
            ratingInfo.grade,
            nowIso,
            flowMetrics.target_retention
          );
          const memoryRecord = {
            ku_id: kuId,
            last_grade: ratingInfo.grade,
            ...nextState
          };

          const unlockedClues = Array.from(
            new Set([
              ...((prevThemeProgress && prevThemeProgress.unlocked_clues) || []),
              ...((mirror.theme_progress[themeId] && mirror.theme_progress[themeId].unlocked_clues) || []),
              kuId
            ])
          );
          const completedEncounters = Array.from(
            new Set([
              ...((prevThemeProgress && prevThemeProgress.completed_encounters) || []),
              ...((mirror.theme_progress[themeId] && mirror.theme_progress[themeId].completed_encounters) || []),
              encounterId
            ])
          );
          const progRecord = {
            theme_id: themeId,
            current_episode_id: `${themeId}_ep01`,
            unlocked_clues: unlockedClues,
            completed_encounters: completedEncounters,
            flow_window_metrics: flowMetrics,
            updated_at: nowIso
          };

          memStore.put(memoryRecord);
          logStore.add({
            ku_id: kuId,
            encounter_id: encounterId,
            rating: ratingInfo.grade,
            duration_ms: durationMs,
            error_count: errorCount,
            reviewed_at: nowIso
          });
          progStore.put(progRecord);

          mirror.memory_items[kuId] = memoryRecord;
          mirror.theme_progress[themeId] = progRecord;

          computedRecord = {
            kuId,
            grade: ratingInfo.grade,
            stability: nextState.stability,
            difficulty: nextState.difficulty,
            intervalDays: nextState.interval_days,
            flowChannel: flowMetrics.channel_state
          };
        };

        tx.oncomplete = () => resolve(computedRecord);
        tx.onerror = () => resolve(computedRecord);
      });

      if (txResult) {
        results.push(txResult);
      }
    }

    saveStateMirror(mirror);
    await refreshDbStatsBadge();
    return results;
  }

  syncProcessedShardsToIndexedDB();

  // =========================================================================
  // 7. 运行期剧情包加载与三语全覆盖 (EN/JA/ZH) 离线容灾回退字典
  // =========================================================================
  const episodeCache = new Map();

  const OFFLINE_EPISODE_FALLBACKS = {
    deductive: {
      episode_id: 'deductive_ep01',
      theme_id: 'deductive',
      title: '🔍 雾都回响 · 皇家高等质证法庭与蔡司取证台',
      feedback_prefix: '🎯 异议 (Objection!)！精准命中证词矛盾',
      encounters: [
        {
          encounter_id: 'deductive_ep01_enc01',
          lang: 'en',
          chapter_title: '第一卷（英语 I）：雾都钟楼的不在场证明',
          chapter_badge: 'CASE EN-I · CEFR B1',
          mechanic_type: 'contradiction_pinpoint',
          action_button_label: '射出矛盾指控针 (Objection!)',
          clue_label: '📄 证物 A：咖啡馆电子小票 (9:15 PM · contradict)',
          distractor_clue_label: '🎫 干扰物证：三天前旧火车票',
          magnifier_target_word: 'contradict',
          magnifier_phonetic: '/ˌkɒn.trəˈdɪkt/',
          magnifier_etymology: 'contra- (逆、反) + dicere (言说) → 证词与物证正面冲突',
          instruction_text: '【第 1 步】拖动蔡司透镜调焦环看清物证词根 contradict；【第 2 步】点击证词中违反过去进行时的动词 stay 并勾选正确咖啡馆小票；【第 3 步】发射指控针。',
          dialogue_stream: [
            {
              segment_id: 'seg_01',
              speaker: '嫌疑人 · 钟表匠亚瑟 (Arthur)',
              text: 'At 9:00 PM yesterday, while the vault was opened, I stay at home alone reading books.',
              flaw_token: 'stay',
              distractor_token: 'yesterday',
              expected_correction: 'was staying (过去进行时)',
              has_flaw: true,
              flaw_grammar_ku_id_ref: 'en_b1_grammar_past_continuous',
              target_evidence_ku_id_ref: 'en_b1_lemma_contradict'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '艾琳·诺克斯提示：注意案发具体时刻（9:00 PM）伴随 while 从句，持续动作必须使用过去进行时 was staying，不可用一般现在时 stay！'
            }
          }
        },
        {
          encounter_id: 'deductive_ep01_enc02',
          lang: 'en',
          chapter_title: '第二卷（英语 II）：午夜酒馆的假想证词',
          chapter_badge: 'CASE EN-II · CEFR B1',
          mechanic_type: 'semantic_magnifier',
          action_button_label: '锁定伪造不在场证明 (Expose Alibi!)',
          clue_label: '🕰️ 证物 B：停摆的怀表与酒馆账单 (alibi)',
          distractor_clue_label: '📰 干扰物证：上周泰晤士报剪报',
          magnifier_target_word: 'alibi',
          magnifier_phonetic: '/ˈæl.ɪ.baɪ/',
          magnifier_etymology: '拉丁语 alibi (在别处) → 嫌疑人声称案发时身处他处的法律抗辩',
          instruction_text: '【第 1 步】调焦蔡司显微透镜提取关键词 alibi；【第 2 步】点击虚拟语气假想句中主句破绽词 will 并勾选怀表账单；【第 3 步】锁定伪证。',
          dialogue_stream: [
            {
              segment_id: 'seg_02',
              speaker: '嫌疑人 · 银行书记官维克多 (Victor)',
              text: 'If I were at the dockyard tonight, I will confess immediately, but my alibi is solid!',
              flaw_token: 'will',
              distractor_token: 'tonight',
              expected_correction: 'would (与现在事实相反的虚拟语气主句)',
              has_flaw: true,
              flaw_grammar_ku_id_ref: 'en_b1_grammar_subjunctive_past',
              target_evidence_ku_id_ref: 'en_b1_lemma_alibi'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '艾琳·诺克斯提示：条件从句使用了 If I were...（非真实假设），主句必须使用过去将来模态词 would confess 而非 will！'
            }
          }
        },
        {
          encounter_id: 'deductive_ep01_enc03',
          lang: 'ja',
          chapter_title: '第一卷（日语 I）：墨迹未干的署名文书',
          chapter_badge: 'CASE JA-I · JLPT N5',
          mechanic_type: 'semantic_magnifier',
          action_button_label: '击破伪造契约证言 (Verdict!)',
          clue_label: '🖋️ 证物 A：火漆契约残页『書』字源印鉴',
          distractor_clue_label: '🕯️ 干扰物证：空白鲸油蜡烛台',
          magnifier_target_word: '書 (かく / ショ)',
          magnifier_phonetic: '部首：曰 (ひらび) · 10画',
          magnifier_etymology: '聿 (执笔之手) + 曰 (文书言辞) → 以毛笔签署契约文书',
          instruction_text: '【第 1 步】调焦蔡司显微透镜鉴定火漆契约上的汉字『書』；【第 2 步】点击五段动词否定接续错误的『書きない』并勾选火漆残页；【第 3 步】击破伪证。',
          dialogue_stream: [
            {
              segment_id: 'seg_03',
              speaker: '证人 · 古籍商佐藤 (Sato)',
              text: '私はその秘密の契約書を決して書きない！',
              flaw_token: '書きない',
              distractor_token: '契約書',
              expected_correction: '書かない (五段动词未然形 + ない)',
              has_flaw: true,
              flaw_grammar_ku_id_ref: 'ja_n5_grammar_0012',
              target_evidence_ku_id_ref: 'ja_n5_hanzi_0002'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '艾琳·诺克斯提示：五段动词『書く』接否定助动词『ない』时，词尾『く』需变为あ段未然形『か』（書かない），说成『書きない』暴露了伪证！'
            }
          }
        },
        {
          encounter_id: 'deductive_ep01_enc04',
          lang: 'ja',
          chapter_title: '第二卷（日语 II）：雾夜商会的第一人称供状',
          chapter_badge: 'CASE JA-II · JLPT N5',
          mechanic_type: 'contradiction_pinpoint',
          action_button_label: '锁定主格助词伪证 (Objection!)',
          clue_label: '📜 证物 B：商会名簿『私 (わたし)』署名印章',
          distractor_clue_label: '🗝️ 干扰物证：生锈的备用铜钥',
          magnifier_target_word: '私 (わたし)',
          magnifier_phonetic: '部首：禾 (のぎへん) · 7画',
          magnifier_etymology: '禾 (谷物) + 厶 (环抱自守) → 个人专属署名与第一人称代词',
          instruction_text: '【第 1 步】调焦蔡司显微透镜核验『私 (わたし)』印章字源；【第 2 步】点击供词中漏掉主题助词『は』的破绽片段『私その帳簿』并勾选商会名簿；【第 3 步】发射指控针。',
          dialogue_stream: [
            {
              segment_id: 'seg_04',
              speaker: '证人 · 商会掌柜高桥 (Takahashi)',
              text: '昨夜、私その帳簿を金庫の奥に保管しました。',
              flaw_token: '私その帳簿',
              distractor_token: '金庫の奥に',
              expected_correction: '私はその帳簿 (需提示主题助词『は』)',
              has_flaw: true,
              flaw_grammar_ku_id_ref: 'ja_n5_grammar_0001',
              target_evidence_ku_id_ref: 'ja_n5_hanzi_0001'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '艾琳·诺克斯提示：日语标准陈述句提示主语主题时，第一人称『私』后必须接系助词『は (wa)』构成『私は...』，慌乱漏掉助词暴露了证言破绽！'
            }
          }
        },
        {
          encounter_id: 'deductive_ep01_enc05',
          lang: 'zh',
          chapter_title: '第一卷（汉语 I）：东方快车的钟表证言',
          chapter_badge: 'CASE ZH-I · HSK 1',
          mechanic_type: 'contradiction_pinpoint',
          action_button_label: '击破时间语序伪证 (Objection!)',
          clue_label: '⏱️ 证物 A：列车长怀表与『时间』签收单 (shí jiān)',
          distractor_clue_label: '🧳 干扰物证：空置的旧行李箱',
          magnifier_target_word: '时间 (shí jiān)',
          magnifier_phonetic: 'HSK 1 核心词 · 阳平(35) + 阴平(55)',
          magnifier_etymology: '日 (太阳运行) + 寸 (法度刻度) / 门 + 日 → 日影推移所度量的光阴刻度',
          instruction_text: '【第 1 步】调焦蔡司显微透镜核验列车签收单上的『时间』词源；【第 2 步】点击违反汉语『时间状语前置』的破绽片段并勾选签收单；【第 3 步】发射指控针。',
          dialogue_stream: [
            {
              segment_id: 'seg_05',
              speaker: '嫌疑人 · 东方快车旅客林先生',
              text: '我是大学的学生，我读书在车厢里昨天晚上八点，绝对没有离开座位！',
              flaw_token: '读书在车厢里昨天晚上八点',
              distractor_token: '大学的学生',
              expected_correction: '昨天晚上八点在车厢里读书 (时间+地点状语置于动词前)',
              has_flaw: true,
              flaw_grammar_ku_id_ref: 'zh_hsk1_grammar_0001',
              target_evidence_ku_id_ref: 'zh_hsk1_lemma_0002'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '艾琳·诺克斯提示：现代汉语标准语序要求时间状语与处所状语置于核心动词之前（『主语 + 时间 + 在地点 + 动词』），将时间状语后置暴露了临时编造的谎言！'
            }
          }
        },
        {
          encounter_id: 'deductive_ep01_enc06',
          lang: 'zh',
          chapter_title: '第二卷（汉语 II）：皇家档案馆的借阅登记',
          chapter_badge: 'CASE ZH-II · HSK 1',
          mechanic_type: 'semantic_magnifier',
          action_button_label: '拆穿身份判断句伪证 (Verdict!)',
          clue_label: '🪪 证物 B：皇家学院『学生 (xué shēng)』铜牌借书证',
          distractor_clue_label: '🪶 干扰物证：折断的鹅毛笔尖',
          magnifier_target_word: '学生 (xué shēng)',
          magnifier_phonetic: 'HSK 1 核心词 · 阳平(35) + 轻声/阴平(55)',
          magnifier_etymology: '学 (双手结网启蒙) + 生 (草木破土生长) → 在学堂研习知识的求学者',
          instruction_text: '【第 1 步】调焦蔡司显微透镜鉴定『学生 (xué shēng)』铜牌字源；【第 2 步】点击主谓宾倒置的破绽片段『学生是王先生』并勾选铜牌借书证；【第 3 步】拆穿伪证。',
          dialogue_stream: [
            {
              segment_id: 'seg_06',
              speaker: '嫌疑人 · 档案馆访客王先生',
              text: '这张借书证是我的，学生是王先生在皇家学院，所以我能进入密室！',
              flaw_token: '学生是王先生在皇家学院',
              distractor_token: '这张借书证',
              expected_correction: '我是皇家学院的学生 (标准『主语 + 是 + 定语 + 宾语』)',
              has_flaw: true,
              flaw_grammar_ku_id_ref: 'zh_hsk1_grammar_0002',
              target_evidence_ku_id_ref: 'zh_hsk1_lemma_0001'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '艾琳·诺克斯提示：汉语判断句说明某人身份时，应遵循『主语（我）+ 是 + 所属定语（皇家学院的）+ 身份宾语（学生）』，倒置语序暴露了冒充身份！'
            }
          }
        }
      ]
    },
    immersive: {
      episode_id: 'immersive_ep01',
      theme_id: 'immersive',
      title: '🌌 星尘漫游 · 汝窑金缮与夜光螺钿八角谐振星盘',
      feedback_prefix: '✨ 声波共振重叠！原住民向你致以温和的微风问候',
      encounters: [
        {
          encounter_id: 'immersive_ep01_enc01',
          lang: 'en',
          chapter_title: '第一章（英语 I）：双子星港的回声漫步',
          chapter_badge: 'CHAPTER EN-I · CEFR B1',
          mechanic_type: 'harmonic_waveform_tuner',
          action_button_label: '共鸣星港拉丁词源泛音',
          rubbing_glyph: 'alibi · contradict',
          rubbing_reading: '/ˈæl.ɪ.baɪ/ · /ˌkɒn.trəˈdɪkt/',
          rubbing_etymology: '拉丁语源 alibi (身处他方之静谧) 与 contra+dicere (逆向回声) 的双轨重音节拍',
          target_freq_min: 46,
          target_freq_max: 66,
          default_freq: 56,
          instruction_text: '【第 1 步】拨动金缮星盘滑块将频率调入目标赫兹区间完成声波重合；【第 2 步】拖动汝窑青苔滑块擦拭石碑至阈值以上显影拉丁词源；【第 3 步】点击共鸣收录。',
          dialogue_stream: [
            {
              segment_id: 'seg_01',
              speaker: '星港灯塔守望者 · 赛琳 (Selene)',
              ruby_html: 'While the twin stars <strong>were shining</strong>, no echo would <strong>contradict</strong> our peaceful <strong>alibi</strong>.',
              translation: '当双子恒星闪耀之时，没有任何回声会违逆我们宁静的栖居。',
              text: 'While the twin stars were shining, no echo would contradict our peaceful alibi.',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'en_b1_grammar_past_continuous',
              target_evidence_ku_id_ref: 'en_b1_lemma_alibi'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '露米提示：感受『were shining』与『would contradict』的轻柔重音起伏，将声波滑入目标区间并擦亮石碑即可收录。'
            }
          }
        },
        {
          encounter_id: 'immersive_ep01_enc02',
          lang: 'en',
          chapter_title: '第二章（英语 II）：极光温室的假想花语',
          chapter_badge: 'CHAPTER EN-II · CEFR B1',
          mechanic_type: 'sensory_rubbing',
          action_button_label: '拓印极光虚拟花语并收录',
          rubbing_glyph: 'contradict',
          rubbing_reading: '/ˌkɒn.trəˈdɪkt/ (contra + dicere)',
          rubbing_etymology: '汝窑冰裂纹下浮现的古典拉丁铭文：contra (相对、辉映) + dicere (吟诵)',
          target_freq_min: 48,
          target_freq_max: 68,
          default_freq: 58,
          instruction_text: '【第 1 步】拨动金缮星盘使英语虚拟语气『If I were... I would...』语调波峰同频；【第 2 步】轻擦汝窑石碑拭去星尘青苔显影词根；【第 3 步】收录进手帐。',
          dialogue_stream: [
            {
              segment_id: 'seg_02',
              speaker: '温室园艺师 · 艾莉亚 (Aria)',
              ruby_html: 'If I <strong>were</strong> a breeze in this nebula, I <strong>would never contradict</strong> the rhythm of blooming stars.',
              translation: '假如我是这片星云中的一缕微风，我绝不会违逆繁星盛放的韵律。',
              text: 'If I were a breeze in this nebula, I would never contradict the rhythm of blooming stars.',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'en_b1_grammar_subjunctive_past',
              target_evidence_ku_id_ref: 'en_b1_lemma_contradict'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '露米提示：虚拟条件句『If I were...』传递出轻盈超然的想象语调，将声波调入目标赫兹窗并擦亮螺钿铭文即可共鸣。'
            }
          }
        },
        {
          encounter_id: 'immersive_ep01_enc03',
          lang: 'ja',
          chapter_title: '第一章（日语 I）：晨曦林间的初次问候',
          chapter_badge: 'CHAPTER JA-I · JLPT N5',
          mechanic_type: 'harmonic_waveform_tuner',
          action_button_label: '完成金缮调频共振',
          rubbing_glyph: '私',
          rubbing_reading: 'わたし (watashi)',
          rubbing_etymology: '禾 (饱满谷穗) + 厶 (环抱自守) → 温和谦逊的第一人称自称',
          target_freq_min: 45,
          target_freq_max: 65,
          default_freq: 55,
          instruction_text: '【第 1 步】拨动八角螺钿星盘使夜光螺钿声波与 24K 金缮母语基准波重合；【第 2 步】轻擦汝窑瓷面拭去青苔显影『私』字源；【第 3 步】完成共振收录。',
          dialogue_stream: [
            {
              segment_id: 'seg_03',
              speaker: '星尘水母向导 · 露米 (Lumi)',
              ruby_html: '<ruby>私<rt>わたし</rt></ruby>は<ruby>異星<rt>いせい</rt></ruby>の<ruby>探検家<rt>たんけんか</rt></ruby>です。',
              translation: '我是来自异星的探险家。',
              text: '私は異星の探検家です。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'ja_n5_grammar_0001',
              target_evidence_ku_id_ref: 'ja_n5_lemma_0001'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '露米泛起柔和金缮微光：聆听主题助词『は (wa)』轻柔平稳的平板型过渡音高，将频率滑入目标赫兹区间即可同频。'
            }
          }
        },
        {
          encounter_id: 'immersive_ep01_enc04',
          lang: 'ja',
          chapter_title: '第二章（日语 II）：苔原石碑上的自称图腾',
          chapter_badge: 'CHAPTER JA-II · JLPT N5 HANZI',
          mechanic_type: 'sensory_rubbing',
          action_button_label: '拓印螺钿图腾并收录手帐',
          rubbing_glyph: '私 · 書',
          rubbing_reading: 'わたし (私) / かく (書)',
          rubbing_etymology: '汝窑天青开片下镶嵌的鲍鱼壳夜光螺钿字源：『私』(禾+厶) 与『書』(聿+曰)',
          target_freq_min: 48,
          target_freq_max: 68,
          default_freq: 56,
          instruction_text: '【第 1 步】拨动星盘对齐日语五段未然形『書かない』声波包络；【第 2 步】在青苔汝窑石碑上来回擦拭显影夜光螺钿汉字部首；【第 3 步】拓印收录。',
          dialogue_stream: [
            {
              segment_id: 'seg_04',
              speaker: '石碑守望者 · 苍苔古树',
              ruby_html: '<ruby>私<rt>わたし</rt></ruby>は<ruby>星<rt>ほし</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>を<ruby>書<rt>か</rt></ruby>かない。',
              translation: '我尚未书写星辰的记录。',
              text: '私は星の記録を書かない。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'ja_n5_grammar_0012',
              target_evidence_ku_id_ref: 'ja_n5_hanzi_0001'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '露米提示：顺着汝窑金缮裂隙滑动拓印滑杆至目标阈值以上，同时保持声波在谐振区间。'
            }
          }
        },
        {
          encounter_id: 'immersive_ep01_enc05',
          lang: 'zh',
          chapter_title: '第一章（汉语 I）：云端茶馆的时光漫谈',
          chapter_badge: 'CHAPTER ZH-I · HSK 1',
          mechanic_type: 'harmonic_waveform_tuner',
          action_button_label: '共鸣茶馆风铃声波',
          rubbing_glyph: '学生 · 时间',
          rubbing_reading: 'xué shēng / shí jiān',
          rubbing_etymology: '汉语阳平 (35调值) 上扬曲线与阴平 (55调值) 高平延展的螺钿声学曲线',
          target_freq_min: 50,
          target_freq_max: 70,
          default_freq: 58,
          instruction_text: '【第 1 步】拨动金缮星盘使『学生 (xué shēng)』与『时间 (shí jiān)』的泛音相位重合；【第 2 步】轻擦汝窑瓷面显影汉字字源；【第 3 步】共鸣收录。',
          dialogue_stream: [
            {
              segment_id: 'seg_05',
              speaker: '云端茶馆主人 · 云舒',
              ruby_html: '我是星际学院的<ruby>学生<rt>xué shēng</rt></ruby>，在茶香中感受静谧的<ruby>时间<rt>shí jiān</rt></ruby>。',
              translation: '作为星际学院的求学者，在茶香中静静品味流淌的光阴。',
              text: '我是星际学院的学生，在茶香中感受静谧的时间。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'zh_hsk1_grammar_0002',
              target_evidence_ku_id_ref: 'zh_hsk1_lemma_0002'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '露米提示：『学 (xué)』与『时 (shí)』皆为第二声阳平（由中音平滑上扬至高音），将频率调至目标赫兹区间即可达成茶馆风铃共鸣。'
            }
          }
        },
        {
          encounter_id: 'immersive_ep01_enc06',
          lang: 'zh',
          chapter_title: '第二章（汉语 II）：竹林书院的晨读碑文',
          chapter_badge: 'CHAPTER ZH-II · HSK 1',
          mechanic_type: 'sensory_rubbing',
          action_button_label: '拓印竹林晨读碑文并收录',
          rubbing_glyph: '时间',
          rubbing_reading: 'shí jiān (日+寸 · 门+日)',
          rubbing_etymology: '门扉之间投射的日晷光影：汉语时间状语前置语序的自然韵律',
          target_freq_min: 47,
          target_freq_max: 67,
          default_freq: 57,
          instruction_text: '【第 1 步】调谐竹林风声频率对齐汉语『时间状语前置』语调曲线；【第 2 步】擦拭青苔汝窑石碑显影『时间』甲骨金文字源；【第 3 步】拓印收录。',
          dialogue_stream: [
            {
              segment_id: 'seg_06',
              speaker: '竹林书院先生 · 怀瑾',
              ruby_html: '年轻的<ruby>学生<rt>xué shēng</rt></ruby>清晨在竹林里安静地珍惜每一刻<ruby>时间<rt>shí jiān</rt></ruby>。',
              translation: '清晨时分，年轻的学子在竹林间静心珍惜每一寸光阴。',
              text: '年轻的学生清晨在竹林里安静地珍惜每一刻时间。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'zh_hsk1_grammar_0001',
              target_evidence_ku_id_ref: 'zh_hsk1_hanzi_0001'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '露米提示：感受『清晨在竹林里』状语前置时的平稳节奏，将频率滑入目标区间并擦亮碑面即可收录。'
            }
          }
        }
      ]
    },
    strategic: {
      episode_id: 'strategic_ep01',
      theme_id: 'strategic',
      title: '⚔️ 刻痕圣殿 · 六翼玫瑰花窗与果冻透光榫卯构筑台',
      feedback_prefix: '💥 榫卯咬合锁定！释放【破盾奥义】轰碎守卫护盾',
      encounters: [
        {
          encounter_id: 'strategic_ep01_enc01',
          lang: 'en',
          chapter_title: '第一层（英语 I）：镜像回廊的虚拟结界',
          chapter_badge: 'STRATUM EN-I · CEFR B1',
          mechanic_type: 'spell_gesture_routing',
          action_button_label: '星轨闭环 · 轰碎镜像结界',
          stem_label: 'If the rune were fake, (虚拟条件词干)',
          affix_label: 'it would contradict the scroll (过去将来主句卡榫)',
          distractor_affix_label: 'it will contradicts the scroll (时态冲突干扰卡榫)',
          spell_orbs: ['If', 'were', 'fake,', 'it', 'would', 'contradict'],
          instruction_text: '【第 1 步】点击果冻透光正序卡榫『it would contradict...』嵌入虚拟条件凹槽；【第 2 步】依次点亮下方六翼玫瑰花窗的语法晶球；【第 3 步】释放破盾射线。',
          dialogue_stream: [
            {
              segment_id: 'seg_01',
              speaker: '镜像守卫魔像 · 阿尔戈斯 (Argos)',
              ruby_html: 'If the ancient rune <strong>were</strong> fake, it <strong>would contradict</strong> the sacred scroll.',
              text: 'If the ancient rune were fake, it would contradict the sacred scroll.',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'en_b1_grammar_subjunctive_past',
              target_evidence_ku_id_ref: 'en_b1_lemma_contradict'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '奥隆提示：非真实条件句『If + 主语 + were...』的主句接口必须咬合『would + 动词原形 contradict』！'
            }
          }
        },
        {
          encounter_id: 'strategic_ep01_enc02',
          lang: 'en',
          chapter_title: '第二层（英语 II）：钟摆深渊的过去持续护盾',
          chapter_badge: 'STRATUM EN-II · CEFR B1',
          mechanic_type: 'conjugation_mortise',
          action_button_label: '榫卯咬合 · 斩断钟摆护盾',
          stem_label: 'While the guardian (过去持续从句词干)',
          affix_label: 'was checking the alibi (过去进行时卡榫)',
          distractor_affix_label: 'checks the alibi yesterday (时态错位干扰卡榫)',
          spell_orbs: ['While', 'guardian', 'was', 'checking', 'the', 'alibi'],
          instruction_text: '【第 1 步】点击果冻透光过去进行时卡榫『was checking the alibi』与从句词干咬合；【第 2 步】点亮玫瑰花窗晶球贯通回路；【第 3 步】斩断钟摆护盾。',
          dialogue_stream: [
            {
              segment_id: 'seg_02',
              speaker: '深渊钟摆骑士 · 加拉哈德 (Galahad)',
              ruby_html: 'While the guardian <strong>was checking</strong> the ancient <strong>alibi</strong>, the sanctuary gate opened.',
              text: 'While the guardian was checking the ancient alibi, the sanctuary gate opened.',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'en_b1_grammar_past_continuous',
              target_evidence_ku_id_ref: 'en_b1_lemma_alibi'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '奥隆提示：While 引导的过去持续背景动作必须咬合『was/were + doing (was checking)』过去进行时卡榫！'
            }
          }
        },
        {
          encounter_id: 'strategic_ep01_enc03',
          lang: 'ja',
          chapter_title: '第一层（日语 I）：冰封遗迹的未然形石门',
          chapter_badge: 'STRATUM JA-I · JLPT N5',
          mechanic_type: 'conjugation_mortise',
          action_button_label: '榫卯咬合 · 释放霜冻射线',
          stem_label: '書か- (五段未然形词干)',
          affix_label: '-ない (未然形否定卡榫)',
          distractor_affix_label: '-ます (连用形干扰卡榫)',
          spell_orbs: ['古い', 'ルーン', 'を', '書か-', '-ない'],
          instruction_text: '【第 1 步】点击果冻透光否定卡榫『-ない』嵌入五段动词未然形凹槽『書か-』；【第 2 步】沿六翼玫瑰花窗点亮晶球；【第 3 步】释放霜冻射线。',
          dialogue_stream: [
            {
              segment_id: 'seg_03',
              speaker: '机巧魔典之灵 · 奥隆 (Oron)',
              ruby_html: '<ruby>古<rt>ふる</rt></ruby>いルーン<ruby>文字<rt>もじ</rt></ruby>を<ruby>書<rt>か</rt></ruby>かない。',
              text: '古いルーン文字を書かない。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'ja_n5_grammar_0012',
              target_evidence_ku_id_ref: 'ja_n5_lemma_0002'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '奥隆展开青铜星环：五段动词『書く (kaku)』连接否定助动词『ない』时，词尾『く』需变为あ段未然形『か』，严禁接连用形『-ます』！'
            }
          }
        },
        {
          encounter_id: 'strategic_ep01_enc04',
          lang: 'ja',
          chapter_title: '第二层（日语 II）：星铁王座的契约结界',
          chapter_badge: 'STRATUM JA-II · JLPT N5',
          mechanic_type: 'spell_gesture_routing',
          action_button_label: '星轨闭环 · 贯通王座结界',
          stem_label: '私- (第一人称主语词干)',
          affix_label: '-は契約書を守る (主题助词は+谓语卡榫)',
          distractor_affix_label: '-を契約書が守る (助词错格干扰卡榫)',
          spell_orbs: ['私', 'は', '聖なる', '契約書', 'を', '守る'],
          instruction_text: '【第 1 步】点击正确的主题助词卡榫『-は契約書を守る』与主语『私』咬合；【第 2 步】点亮六翼花窗晶球贯通回路；【第 3 步】击破王座结界。',
          dialogue_stream: [
            {
              segment_id: 'seg_04',
              speaker: '星铁王座守卫 · 苍星骑士',
              ruby_html: '<ruby>私<rt>わたし</rt></ruby>は<ruby>聖<rt>せい</rt></ruby>なる<ruby>契約書<rt>けいやくしょ</rt></ruby>を<ruby>守<rt>まも</rt></ruby>る。',
              text: '私は聖なる契約書を守る。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'ja_n5_grammar_0001',
              target_evidence_ku_id_ref: 'ja_n5_hanzi_0001'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '奥隆提示：提示句子主题『私 (わたし)』需咬合系助词『は』，宾语『契約書』后接格助词『を』！'
            }
          }
        },
        {
          encounter_id: 'strategic_ep01_enc05',
          lang: 'zh',
          chapter_title: '第一层（汉语 I）：时之沙漏的动宾护盾',
          chapter_badge: 'STRATUM ZH-I · HSK 1',
          mechanic_type: 'conjugation_mortise',
          action_button_label: '双轨咬合 · 贯穿沙漏核心',
          stem_label: '我是圣殿的学生，(主语凹槽 · xué shēng)',
          affix_label: '守护宝贵的时间 (动宾正序卡榫 · shí jiān)',
          distractor_affix_label: '宝贵的时间守护在后 (宾语错置干扰卡榫)',
          spell_orbs: ['我是', '学生', '守护', '宝贵的', '时间'],
          instruction_text: '【第 1 步】点击汉语标准动宾正序卡榫『守护宝贵的时间』与主语凹槽咬合；【第 2 步】点亮六翼花窗晶球；【第 3 步】贯穿沙漏核心！',
          dialogue_stream: [
            {
              segment_id: 'seg_05',
              speaker: '时之沙漏领主 · 克洛诺斯',
              ruby_html: '我是圣殿的<ruby>学生<rt>xué shēng</rt></ruby>，在沙漏流转中守护宝贵的<ruby>时间<rt>shí jiān</rt></ruby>。',
              text: '我是圣殿的学生，在沙漏流转中守护宝贵的时间。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'zh_hsk1_grammar_0002',
              target_evidence_ku_id_ref: 'zh_hsk1_lemma_0002'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '奥隆提示：汉语核心动宾结构要求谓语动词『守护』居于宾语『时间 (shí jiān)』之前，准确咬合正序卡榫即可破盾！'
            }
          }
        },
        {
          encounter_id: 'strategic_ep01_enc06',
          lang: 'zh',
          chapter_title: '第二层（汉语 II）：晷影圣坛的语序法阵',
          chapter_badge: 'STRATUM ZH-II · HSK 1',
          mechanic_type: 'spell_gesture_routing',
          action_button_label: '正序咏唱 · 激活晷影法阵',
          stem_label: '我 (主语基座)',
          affix_label: '上午八点在圣坛读书 (时间+处所状语前置卡榫)',
          distractor_affix_label: '读书在圣坛上午八点 (状语后置排斥卡榫)',
          spell_orbs: ['我', '上午八点', '在圣坛', '专心', '读书'],
          instruction_text: '【第 1 步】点击符合汉语『时间与处所状语置于动词前』的正序卡榫嵌入主语基座；【第 2 步】按语序点亮六翼花窗晶球；【第 3 步】激活晷影法阵！',
          dialogue_stream: [
            {
              segment_id: 'seg_06',
              speaker: '晷影圣坛守护者 · 羲和',
              ruby_html: '我上午八点在圣坛校准古老的<ruby>时间<rt>shí jiān</rt></ruby>刻度。',
              text: '我上午八点在圣坛校准古老的时间刻度。',
              has_flaw: false,
              flaw_grammar_ku_id_ref: 'zh_hsk1_grammar_0001',
              target_evidence_ku_id_ref: 'zh_hsk1_lemma_0002'
            }
          ],
          rating_rules: {
            again: {
              companion_hint: '奥隆提示：现代汉语要求时间状语（上午八点）与处所状语（在圣坛）依次置于核心动词之前，不可倒置！'
            }
          }
        }
      ]
    }
  };

  function normalizeEpisodeBundle(bundle) {
    if (!bundle || !Array.isArray(bundle.encounters)) return bundle;
    bundle.encounters.forEach((enc) => {
      const hint =
        (enc.rating_rules && enc.rating_rules.again && enc.rating_rules.again.companion_hint) ||
        '观察语境时间锚点与词尾接续法则！';
      enc.rating_rules = {
        easy: { max_error_count: 0, max_duration_ms: 4000, ...((enc.rating_rules && enc.rating_rules.easy) || {}) },
        good: {
          max_error_count: 0,
          min_duration_ms: 4001,
          max_duration_ms: 12000,
          ...((enc.rating_rules && enc.rating_rules.good) || {})
        },
        hard: {
          max_error_count: 1,
          fallback_on_slow_zero_error: true,
          description: '完备兜底分支：(error_count == 0 && duration_ms > 12000) || (error_count == 1 && duration_ms >= 0)',
          ...((enc.rating_rules && enc.rating_rules.hard) || {})
        },
        again: {
          min_error_count: 2,
          trigger_on_companion_hint: true,
          companion_hint: hint,
          ...((enc.rating_rules && enc.rating_rules.again) || {})
        }
      };
      if (!enc.telemetry_policy) {
        enc.telemetry_policy = {
          pause_on_visibility_hidden: true,
          max_effective_duration_cap_ms: 60000,
          dual_ku_attribution: {
            wrong_evidence_selected: 'target_evidence_ku_id_ref',
            wrong_sentence_pinpointed: 'flaw_grammar_ku_id_ref'
          }
        };
      }
    });
    return bundle;
  }

  async function loadEpisodeBundle(themeKey) {
    if (episodeCache.has(themeKey)) {
      return episodeCache.get(themeKey);
    }
    if (!IS_FILE_PROTOCOL) {
      try {
        const resp = await fetch(`./assets/data/episodes/${encodeURIComponent(themeKey)}_ep01.json`);
        if (resp.ok) {
          const data = normalizeEpisodeBundle(await resp.json());
          episodeCache.set(themeKey, data);
          return data;
        }
      } catch (e) {
        console.warn('[Lingua-Flow] Fallback to built-in offline bundle descriptor:', e.message);
      }
    }
    const fallback = normalizeEpisodeBundle(OFFLINE_EPISODE_FALLBACKS[themeKey] || null);
    if (fallback) {
      episodeCache.set(themeKey, fallback);
    }
    return fallback;
  }

  // =========================================================================
  // 8. WebAudio 零行程微晶声学状态机 (默认静音、<=25ms 瞬态、±2.5% 防疲劳微抖动)
  // =========================================================================
  let audioCtx = null;
  let audioEnabled = false;
  const audioToggleBtn = document.getElementById('audio-toggle-btn');
  const audioToggleLabel = document.getElementById('audio-toggle-label');

  function playTactileClick(kind = 'down') {
    if (!audioEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const jitter = 1 + (Math.random() * 0.05 - 0.025);
      const baseFreq = kind === 'success' ? 1320 : kind === 'repulse' ? 280 : kind === 'up' ? 1080 : 880;
      osc.type = kind === 'repulse' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq * jitter, now);
      if (kind === 'success') {
        osc.frequency.exponentialRampToValueAtTime(1680 * jitter, now + 0.022);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.022);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.024);
    } catch (e) {
      // 忽略浏览器自动播放限制异常
    }
  }

  if (audioToggleBtn && audioToggleLabel) {
    audioToggleBtn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      audioToggleLabel.textContent = audioEnabled ? '🔊 音效' : '🔇 静音';
      if (audioEnabled) playTactileClick('success');
    });
  }

  // 自然语言考点标签转换器（隐藏底层工程 ku_id 字符串，降低外在认知负荷）
  const NATURAL_KU_LABELS = {
    en_b1_grammar_past_continuous: '过去进行时 (was/were doing)',
    en_b1_grammar_subjunctive_past: '虚拟语气 (If... were/would)',
    en_b1_lemma_contradict: '词根 contradict',
    en_b1_lemma_alibi: '词源 alibi',
    ja_n5_grammar_0001: '主题助词「は」',
    ja_n5_grammar_0012: '未然形否定「〜ない」',
    ja_n5_lemma_0001: '词汇「私 (わたし)」',
    ja_n5_lemma_0002: '五段动词「書く」',
    ja_n5_hanzi_0001: '汉字「私」',
    ja_n5_hanzi_0002: '汉字「書」',
    zh_hsk1_grammar_0001: '时间状语前置',
    zh_hsk1_grammar_0002: '判断与动宾正序',
    zh_hsk1_lemma_0001: '词汇「学生」',
    zh_hsk1_lemma_0002: '词汇「时间」',
    zh_hsk1_hanzi_0001: '汉字「学」',
    zh_hsk1_hanzi_0002: '汉字「时」'
  };

  function formatNaturalKuLabel(kuId) {
    if (!kuId) return '核心考点';
    if (NATURAL_KU_LABELS[kuId]) return NATURAL_KU_LABELS[kuId];
    return String(kuId).replace(/^(en|ja|zh)_[a-z0-9]+_(grammar|lemma|hanzi)_/i, '');
  }

  // =========================================================================
  // 8.2 Z-01 主动唤醒抽屉控制器 (Scrim 背景压暗 + 420ms/220ms 非对称时间 + D15 零孤儿定时器)
  // =========================================================================
  let lastSheetTriggerEl = null;
  const sheetCloseTimers = new Map();

  function openOpticSheet(sheetId, triggerEl = null) {
    const backdrop = document.getElementById(sheetId);
    if (!backdrop) return;
    closeSpectrumDropdown();
    if (sheetCloseTimers.has(backdrop.id)) {
      clearTimeout(sheetCloseTimers.get(backdrop.id));
      sheetCloseTimers.delete(backdrop.id);
    }
    lastSheetTriggerEl = triggerEl || document.activeElement;
    backdrop.removeAttribute('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    void backdrop.offsetWidth;
    backdrop.classList.add('is-open');
    playTactileClick('up');
    const closeBtn = backdrop.querySelector('[data-close-sheet]');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 45);
    }
  }

  function closeOpticSheet(sheetId) {
    const backdrop = typeof sheetId === 'string' ? document.getElementById(sheetId) : sheetId;
    if (!backdrop || backdrop.hasAttribute('hidden')) return;
    backdrop.classList.remove('is-open');
    playTactileClick('down');
    if (sheetCloseTimers.has(backdrop.id)) {
      clearTimeout(sheetCloseTimers.get(backdrop.id));
    }
    const timerId = setTimeout(() => {
      backdrop.setAttribute('hidden', '');
      backdrop.setAttribute('aria-hidden', 'true');
      sheetCloseTimers.delete(backdrop.id);
    }, prefersReducedMotion ? 10 : 225);
    sheetCloseTimers.set(backdrop.id, timerId);

    if (lastSheetTriggerEl && typeof lastSheetTriggerEl.focus === 'function') {
      lastSheetTriggerEl.focus();
      lastSheetTriggerEl = null;
    }
  }

  // =========================================================================
  // 8.3 五维明暗色域光谱控制器 & Z-02 智能边界避让下拉菜单 (L01 & L08)
  // =========================================================================
  function resolveActiveSpectrum(rawSpectrum, activeThemeKey = null) {
    if (rawSpectrum && rawSpectrum !== 'auto' && SPECTRUM_META[rawSpectrum]) {
      return rawSpectrum;
    }
    const lvl = document.body ? document.body.getAttribute('data-page-level') : '1';
    if (lvl === '1') return 'porcelain';
    const tKey = activeThemeKey || (document.body && document.body.getAttribute('data-theme-hub')) || 'deductive';
    return (THEME_META[tKey] && THEME_META[tKey].defaultSpectrum) || 'parchment';
  }

  function applyOpticSpectrum(spectrumChoice, activeThemeKey = null) {
    const prefs = loadLearningPrefs();
    const validChoice = SPECTRUM_META[spectrumChoice] ? spectrumChoice : 'auto';
    prefs.spectrum = validChoice;
    saveLearningPrefs(prefs);

    const resolved = resolveActiveSpectrum(validChoice, activeThemeKey || prefs.theme);
    document.documentElement.setAttribute('data-spectrum', resolved);
    if (document.body) {
      document.body.setAttribute('data-spectrum', resolved);
    }
    const metaThemeEl = document.querySelector('meta[name="theme-color"]');
    if (metaThemeEl && SPECTRUM_META[resolved]) {
      metaThemeEl.setAttribute('content', SPECTRUM_META[resolved].metaColor);
    }

    const labelEl = document.getElementById('optic-spectrum-label');
    if (labelEl && SPECTRUM_META[resolved]) {
      labelEl.innerHTML = `🎨 <span class="hide-on-mobile">色域：</span>${escapeHtml(SPECTRUM_META[resolved].short)}`;
    }

    document.querySelectorAll('[data-spectrum-choice]').forEach((optBtn) => {
      const cVal = optBtn.getAttribute('data-spectrum-choice') || 'auto';
      const isSelected = cVal === validChoice;
      optBtn.classList.toggle('is-active', isSelected);
      optBtn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }

  function closeSpectrumDropdown() {
    const menu = document.getElementById('optic-spectrum-menu');
    const trigger = document.getElementById('optic-spectrum-trigger');
    if (!menu || !menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function initSpectrumSwitcher() {
    const prefs = loadLearningPrefs();
    applyOpticSpectrum(prefs.spectrum, prefs.theme);

    const trigger = document.getElementById('optic-spectrum-trigger');
    const menu = document.getElementById('optic-spectrum-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const willOpen = !menu.classList.contains('is-open');
      playTactileClick(willOpen ? 'up' : 'down');
      if (!willOpen) {
        closeSpectrumDropdown();
        return;
      }
      // Z-02 视口边界智能翻转检测：留足 8px 呼吸间隙，绝不遮盖触发按钮本身
      menu.classList.remove('is-flipped-up', 'is-flipped-left');
      const trigRect = trigger.getBoundingClientRect();
      if (window.innerHeight - trigRect.bottom < 320 && trigRect.top > 320) {
        menu.classList.add('is-flipped-up');
      }
      if (trigRect.right < 280) {
        menu.classList.add('is-flipped-left');
      }
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
    });

    menu.querySelectorAll('[data-spectrum-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-spectrum-choice') || 'auto';
        const curPrefs = loadLearningPrefs();
        applyOpticSpectrum(chosen, curPrefs.theme);
        playTactileClick('success');
        closeSpectrumDropdown();
        const activeResolved = resolveActiveSpectrum(chosen, curPrefs.theme);
        const specTitle = (SPECTRUM_META[activeResolved] && SPECTRUM_META[activeResolved].label) || chosen;
        showFlowToast(`✨ 已切换光学色域：${specTitle}`, 'info');
      });
    });
  }

  document.addEventListener('click', (ev) => {
    const anchor = document.getElementById('spectrum-dropdown-anchor');
    if (anchor && ev.target && !anchor.contains(ev.target)) {
      closeSpectrumDropdown();
    }
    const closeBtn = ev.target && ev.target.closest ? ev.target.closest('[data-close-sheet]') : null;
    if (closeBtn) {
      const targetId = closeBtn.getAttribute('data-close-sheet');
      closeOpticSheet(targetId);
      return;
    }
    if (ev.target && ev.target.classList && ev.target.classList.contains('optic-sheet-backdrop')) {
      closeOpticSheet(ev.target);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      closeSpectrumDropdown();
      document.querySelectorAll('.optic-sheet-backdrop:not([hidden])').forEach((sheet) => {
        closeOpticSheet(sheet);
      });
    }
  });

  // =========================================================================
  // 8.5 Optic-Resonance 物理运动学与微交互引擎 (二阶阻尼 3D 视差 + 80ms 受压保底 + Dolly 运镜)
  // =========================================================================
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initOpticTiltEngine(rootEl = document) {
    if (prefersReducedMotion) return;
    const targets = rootEl.querySelectorAll(
      '.theme-card, .apparatus-hero, .apparatus-stage-panel, .hub-chapter-card'
    );
    targets.forEach((card) => {
      if (card.dataset.opticTiltBound === '1') return;
      card.dataset.opticTiltBound = '1';
      card.classList.add('optic-tilt-target');

      let targetRx = 0;
      let targetRy = 0;
      let currentRx = 0;
      let currentRy = 0;
      let rafId = null;

      function stepLerp() {
        currentRx += (targetRx - currentRx) * 0.14;
        currentRy += (targetRy - currentRy) * 0.14;
        card.style.setProperty('--tilt-rx', `${currentRx.toFixed(2)}deg`);
        card.style.setProperty('--tilt-ry', `${currentRy.toFixed(2)}deg`);

        if (Math.abs(targetRx - currentRx) > 0.04 || Math.abs(targetRy - currentRy) > 0.04) {
          rafId = requestAnimationFrame(stepLerp);
        } else {
          rafId = null;
          if (targetRx === 0 && targetRy === 0) {
            card.style.setProperty('--tilt-rx', '0deg');
            card.style.setProperty('--tilt-ry', '0deg');
            card.classList.remove('is-tilting');
          }
        }
      }

      card.addEventListener('pointermove', (ev) => {
        if (ev.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = (ev.clientX - rect.left) / rect.width - 0.5;
        const ny = (ev.clientY - rect.top) / rect.height - 0.5;
        const maxDeg = card.classList.contains('apparatus-stage-panel') ? 2.0 : 4.2;
        targetRx = clamp(-ny * maxDeg * 2, -5.5, 5.5);
        targetRy = clamp(nx * maxDeg * 2, -5.5, 5.5);
        card.classList.add('is-tilting');
        if (!rafId) rafId = requestAnimationFrame(stepLerp);
      });

      card.addEventListener('pointerleave', () => {
        targetRx = 0;
        targetRy = 0;
        if (!rafId) rafId = requestAnimationFrame(stepLerp);
      });
    });
  }

  // 全局委托：80ms 最小受压行程保底与连续介质体积守恒回弹 (Optic-Resonance 11 号规范第 5 节)
  const INTERACTIVE_SELECTOR =
    '.btn-theme, .btn-secondary-ghost, .interactive-token, .interactive-choice, .spell-orb-btn, .chapter-tab-btn, .seg-pill-btn, .lang-option-card, .micro-island-btn';

  document.addEventListener('pointerdown', (ev) => {
    const btn = ev.target && ev.target.closest ? ev.target.closest(INTERACTIVE_SELECTOR) : null;
    if (!btn) return;
    btn.dataset.pressTimestamp = String(performance.now());
    btn.classList.remove('is-optic-released');
    btn.classList.add('is-optic-pressed');
  });

  function handleGlobalPointerRelease(ev) {
    const pressedList = document.querySelectorAll('.is-optic-pressed');
    pressedList.forEach((btn) => {
      const downTs = Number(btn.dataset.pressTimestamp) || 0;
      const elapsed = performance.now() - downTs;
      const remainingHold = Math.max(0, 80 - elapsed);
      const isInside = ev && ev.target && btn.contains(ev.target);

      setTimeout(() => {
        btn.classList.remove('is-optic-pressed');
        if (isInside && !prefersReducedMotion) {
          btn.classList.remove('is-optic-released');
          void btn.offsetWidth;
          btn.classList.add('is-optic-released');
        }
      }, remainingHold);
    });
  }

  document.addEventListener('pointerup', handleGlobalPointerRelease);
  document.addEventListener('pointercancel', handleGlobalPointerRelease);

  function runWithViewTransition(updateDomCallback) {
    if (
      !prefersReducedMotion &&
      typeof document.startViewTransition === 'function'
    ) {
      try {
        document.startViewTransition(() => {
          updateDomCallback();
        });
        return;
      } catch (e) {
        // 降级直接执行
      }
    }
    updateDomCallback();
  }

  initOpticTiltEngine(document);
  initSpectrumSwitcher();

  // =========================================================================
  // 9. L1 一级主页控制器 (index.html：负责先选单一目标语言 -> 再选叙事主题，绝不混排)
  // =========================================================================
  function initLevel1HomePage() {
    const prefs = loadLearningPrefs();
    const langButtons = document.querySelectorAll('[data-lang-select]');
    const summaryEl = document.getElementById('current-lang-summary');
    const themePills = document.querySelectorAll('[data-theme-lang-pill]');
    const progressPills = document.querySelectorAll('[data-theme-progress-pill]');
    const themeLinks = document.querySelectorAll('[data-theme-link]');
    const themeBtnTexts = document.querySelectorAll('[data-theme-btn-text]');
    const themeCards = document.querySelectorAll('[data-theme-card]');
    const homeProgressSummaryEl = document.getElementById('home-progress-summary');
    const homeCompletedCountEl = document.getElementById('home-completed-count');
    const homeMemcardCountEl = document.getElementById('home-memcard-count');
    const openBackupTopBtn = document.getElementById('open-backup-sheet-btn');
    const openBackupBentoBtn = document.getElementById('bento-open-backup-btn');
    const exportBtn = document.getElementById('btn-export-progress');
    const importBtn = document.getElementById('btn-import-progress');
    const importInput = document.getElementById('input-import-progress');
    const resetBtn = document.getElementById('btn-reset-progress');

    [openBackupTopBtn, openBackupBentoBtn].forEach((bBtn) => {
      if (!bBtn) return;
      bBtn.addEventListener('click', () => {
        openOpticSheet('backup-progress-sheet', bBtn);
      });
    });

    async function renderHomeClientProgress() {
      const unified = await getUnifiedProgressState();
      const memCount = Object.keys(unified.memory_items || {}).length;
      let totalCompleted = 0;

      progressPills.forEach((pill) => {
        const tKey = pill.getAttribute('data-theme-progress-pill') || 'deductive';
        const tProg = (unified.theme_progress && unified.theme_progress[tKey]) || null;
        const completedArr = (tProg && Array.isArray(tProg.completed_encounters)) ? tProg.completed_encounters : [];
        const completedCount = completedArr.length;
        totalCompleted += completedCount;
        const fallbackEncs = (OFFLINE_EPISODE_FALLBACKS[tKey] && OFFLINE_EPISODE_FALLBACKS[tKey].encounters) || [];
        const langEncs = fallbackEncs.filter((e) => e.lang === prefs.lang);
        const langCompleted = langEncs.filter((e) => completedArr.includes(e.encounter_id)).length;
        const tierNum = Math.min(3, completedCount + 1);
        pill.textContent = `🏆 当前语种进度：${langCompleted}/${Math.max(2, langEncs.length)} 章 (全馆 ${completedCount}/6) · 装备 T${tierNum}`;
      });

      if (homeCompletedCountEl) homeCompletedCountEl.textContent = `${totalCompleted}/18`;
      if (homeMemcardCountEl) homeMemcardCountEl.textContent = String(memCount);
      if (homeProgressSummaryEl) {
        homeProgressSummaryEl.textContent = `已通关 ${totalCompleted}/18 章 · 激活 ${memCount} 张 FSRS 记忆卡 · 本地双轨同步就绪`;
      }
    }

    function applyHomeLangSelection(selectedLang, notifyToast = false) {
      prefs.lang = LANG_META[selectedLang] ? selectedLang : 'en';
      saveLearningPrefs(prefs);
      const meta = LANG_META[prefs.lang];
      const shortLangName = prefs.lang === 'ja' ? '日语' : prefs.lang === 'zh' ? '汉语' : '英语';

      langButtons.forEach((btn) => {
        const bLang = btn.getAttribute('data-lang-select') || 'en';
        const isMatch = bLang === prefs.lang;
        btn.classList.toggle('is-selected', isMatch);
        btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
        const stdBadge = btn.querySelector('.lang-std-badge');
        if (stdBadge) {
          const baseStd = bLang === 'ja' ? 'JLPT N5' : bLang === 'zh' ? 'HSK 1' : 'CEFR B1';
          stdBadge.textContent = isMatch ? `${baseStd} · 已锁定` : baseStd;
        }
      });

      if (summaryEl) {
        summaryEl.textContent = `${meta.label}（纯净单语专场）`;
      }

      themePills.forEach((pill) => {
        pill.textContent = meta.badge;
      });

      themeLinks.forEach((link) => {
        const tKey = link.getAttribute('data-theme-link') || 'deductive';
        link.setAttribute('href', buildHubUrl(tKey, prefs));
      });

      themeBtnTexts.forEach((span) => {
        const tKey = span.getAttribute('data-theme-btn-text') || 'deductive';
        const tName = tKey === 'deductive' ? '雾都回响' : tKey === 'immersive' ? '星尘漫游' : '刻痕圣殿';
        span.textContent = `进入${tName}（${shortLangName}专场）`;
      });

      renderHomeClientProgress();

      if (notifyToast) {
        playTactileClick('up');
        showFlowToast(`🌐 第 1 步已完成：已锁定【${meta.label}】，请继续在下方点击任意主题进入专场！`, 'success');
      }
    }

    langButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-lang-select') || 'en';
        applyHomeLangSelection(chosen, true);
      });
    });

    themeLinks.forEach((link) => {
      link.addEventListener('click', () => {
        const tKey = link.getAttribute('data-theme-link') || 'deductive';
        prefs.theme = tKey;
        saveLearningPrefs(prefs);
        link.setAttribute('href', buildHubUrl(tKey, prefs));
      });
    });

    themeCards.forEach((card) => {
      card.addEventListener('click', (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest('a[data-theme-link]')) {
          return;
        }
        const tKey = card.getAttribute('data-theme-card') || 'deductive';
        prefs.theme = tKey;
        saveLearningPrefs(prefs);
        window.location.href = buildHubUrl(tKey, prefs);
      });
    });

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportClientProgressJson();
      });
    }

    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.value = '';
        importInput.click();
      });
      importInput.addEventListener('change', async () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        const text = await file.text();
        const ok = await importClientProgressJson(text);
        if (ok) {
          await renderHomeClientProgress();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        await resetClientProgress();
        await renderHomeClientProgress();
      });
    }

    applyHomeLangSelection(prefs.lang, false);
  }

  // =========================================================================
  // 10. L2 二级主题主页控制器 (initDedicatedThemePage：L-A2 黄金主从双舞台与主题差异化案卷陈列)
  // =========================================================================
  async function initDedicatedThemePage(themeKey) {
    const prefs = loadLearningPrefs();
    prefs.theme = themeKey;
    saveLearningPrefs(prefs);
    applyOpticSpectrum(prefs.spectrum, themeKey);

    const langBadgeEl = document.getElementById('hub-lang-badge');
    const diffBadgeEl = document.getElementById('hub-diff-badge');
    const contentBadgeEl = document.getElementById('hub-content-badge');
    const rigTierValEl = document.getElementById('hub-rig-tier-val');
    const quickStartBtn = document.getElementById('hub-quick-start-btn');
    const openRulesBtn = document.getElementById('open-rules-sheet-btn');
    const backHomeLink = document.getElementById('back-to-home-link');
    const hubSwitchLinks = document.querySelectorAll('[data-hub-switch]');
    const miniLangBtns = document.querySelectorAll('[data-hub-lang]');
    const diffBtns = document.querySelectorAll('[data-difficulty-select]');
    const focusBtns = document.querySelectorAll('[data-content-select]');
    const chaptersMount = document.getElementById('hub-chapters-mount');
    const tMeta = THEME_META[themeKey] || THEME_META.deductive;

    if (openRulesBtn) {
      openRulesBtn.addEventListener('click', () => {
        playTactileClick('down');
        openOpticSheet('rules-guide-sheet', openRulesBtn);
      });
    }

    let allEncounters = (OFFLINE_EPISODE_FALLBACKS[themeKey] && OFFLINE_EPISODE_FALLBACKS[themeKey].encounters) || [];
    let completedSet = new Set();
    let memMap = {};

    function getFilteredEncounters() {
      const withOriginalIdx = allEncounters.map((enc, idx) => ({ enc, originalIdx: idx }));
      const matched = withOriginalIdx.filter((item) => item.enc.lang === prefs.lang);
      return matched.length > 0 ? matched : withOriginalIdx;
    }

    function syncHubUI() {
      saveLearningPrefs(prefs);
      const langMeta = LANG_META[prefs.lang] || LANG_META.en;
      const diffMeta = DIFFICULTY_META[prefs.difficulty] || DIFFICULTY_META.tier2;
      const contentMeta = CONTENT_META[prefs.content] || CONTENT_META.all;
      const filtered = getFilteredEncounters();
      const langCompletedCount = filtered.filter(({ enc, originalIdx }) => {
        const eId = enc.encounter_id || `${themeKey}_ep01_enc0${originalIdx + 1}`;
        return completedSet.has(eId);
      }).length;

      if (langBadgeEl) langBadgeEl.textContent = `${langMeta.short}`;
      if (diffBadgeEl) diffBadgeEl.textContent = `🎚️ ${diffMeta.label}`;
      if (contentBadgeEl) {
        contentBadgeEl.textContent = `${contentMeta.short} · 已通关 ${langCompletedCount}/${filtered.length}`;
      }
      if (rigTierValEl && tMeta.rigTiers) {
        const rigIdx = Math.min(2, completedSet.size);
        rigTierValEl.textContent = tMeta.rigTiers[rigIdx];
      }

      if (backHomeLink) {
        backHomeLink.setAttribute('href', `index.html?lang=${encodeURIComponent(prefs.lang)}`);
      }

      hubSwitchLinks.forEach((link) => {
        const targetTheme = link.getAttribute('data-hub-switch') || 'deductive';
        link.setAttribute('href', buildHubUrl(targetTheme, prefs));
      });

      miniLangBtns.forEach((btn) => {
        const isMatch = btn.getAttribute('data-hub-lang') === prefs.lang;
        btn.classList.toggle('is-selected', isMatch);
      });

      diffBtns.forEach((btn) => {
        const isMatch = btn.getAttribute('data-difficulty-select') === prefs.difficulty;
        btn.classList.toggle('is-selected', isMatch);
        btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
      });

      focusBtns.forEach((btn) => {
        const isMatch = btn.getAttribute('data-content-select') === prefs.content;
        btn.classList.toggle('is-selected', isMatch);
        btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
      });

      const nextUncompletedItem =
        filtered.find(({ enc, originalIdx }) => {
          const eId = enc.encounter_id || `${themeKey}_ep01_enc0${originalIdx + 1}`;
          return !completedSet.has(eId);
        }) || filtered[0];
      const targetQuickIdx = nextUncompletedItem ? nextUncompletedItem.originalIdx : 0;

      if (quickStartBtn) {
        quickStartBtn.setAttribute('href', buildLearnUrl(prefs, targetQuickIdx));
      }

      if (!chaptersMount) return;

      const btnClass =
        themeKey === 'deductive'
          ? 'btn-deductive'
          : themeKey === 'immersive'
            ? 'btn-immersive'
            : 'btn-strategic';

      const actionLabelPrefix =
        themeKey === 'deductive'
          ? '🔍 升堂质证本卷'
          : themeKey === 'immersive'
            ? '🌌 开启本篇共鸣'
            : '⚔️ 攻克本层结界';

      chaptersMount.innerHTML = filtered
        .map(({ enc, originalIdx }, cardIdx) => {
          const seg = (enc.dialogue_stream && enc.dialogue_stream[0]) || {};
          const gKu = seg.flaw_grammar_ku_id_ref || '';
          const eKu = seg.target_evidence_ku_id_ref || '';
          const encId = enc.encounter_id || `${themeKey}_ep01_enc0${originalIdx + 1}`;
          const isCompleted = completedSet.has(encId);
          const gMem = memMap[gKu];
          const eMem = memMap[eKu];
          const statusChip = isCompleted
            ? `<span class="meta-pill meta-pill-success">✅ 已通关${gMem ? ` · S'=${gMem.stability}d` : ''}</span>`
            : `<span class="meta-pill">${escapeHtml(diffMeta.label)} · 待挑战</span>`;
          const naturalFocusLabel = `🎯 考点：${formatNaturalKuLabel(gKu)} · ${formatNaturalKuLabel(eKu)}`;
          const fsrsLine =
            gMem || eMem
              ? `<div class="hub-chapter-fsrs-line">💾 记忆稳定度：${gMem ? `${escapeHtml(gMem.last_grade)} · S'=${gMem.stability}d / D'=${gMem.difficulty}` : '待建立'}</div>`
              : `<div class="hub-chapter-fsrs-line">✨ 首次演练：通关后建立双轴 FSRS-5 记忆卡</div>`;
          const learnHref = buildLearnUrl(prefs, originalIdx);
          return `
            <article class="hub-chapter-card optic-stagger-item" style="--stagger-idx: ${cardIdx};">
              <div class="hub-chapter-top">
                <span class="status-badge">${escapeHtml(enc.chapter_badge || 'CHAPTER')}</span>
                ${statusChip}
              </div>
              <h3 class="hub-chapter-title">${escapeHtml(enc.chapter_title || '')}</h3>
              <div class="hub-chapter-focus-tag">${escapeHtml(naturalFocusLabel)}</div>
              ${fsrsLine}
              <a href="${escapeHtml(learnHref)}" class="btn-theme ${btnClass}" data-start-chapter="${originalIdx}" style="width: 100%; margin-top: auto;">
                <span>${isCompleted ? '🔄 再次复习本节' : actionLabelPrefix}</span>
                <span aria-hidden="true">→</span>
              </a>
            </article>
          `;
        })
        .join('');
      initOpticTiltEngine(chaptersMount);
    }

    syncHubUI();

    const bundle = await loadEpisodeBundle(themeKey);
    if (bundle && Array.isArray(bundle.encounters) && bundle.encounters.length > 0) {
      allEncounters = bundle.encounters;
    }
    const unified = await getUnifiedProgressState();
    const themeProg = (unified.theme_progress && unified.theme_progress[themeKey]) || null;
    completedSet = new Set((themeProg && themeProg.completed_encounters) || []);
    memMap = unified.memory_items || {};

    miniLangBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-hub-lang') || 'en';
        prefs.lang = LANG_META[chosen] ? chosen : 'en';
        syncHubUI();
        playTactileClick('up');
        showFlowToast(`🌐 已切换专场语言：${(LANG_META[prefs.lang] || LANG_META.en).label}`, 'success');
      });
    });

    diffBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        prefs.difficulty = btn.getAttribute('data-difficulty-select') || 'tier2';
        syncHubUI();
        playTactileClick('up');
        showFlowToast(`🎚️ 已选择挑战难度：${(DIFFICULTY_META[prefs.difficulty] || DIFFICULTY_META.tier2).label}`, 'info');
      });
    });

    focusBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        prefs.content = btn.getAttribute('data-content-select') || 'all';
        syncHubUI();
        playTactileClick('up');
        showFlowToast(`📚 已切换训练重心：${(CONTENT_META[prefs.content] || CONTENT_META.all).label}`, 'info');
      });
    });

    syncHubUI();
  }

  const initLevel2ThemeHubPage = initDedicatedThemePage;

  // =========================================================================
  // 11. L3 三级学习实操页控制器 (learn.html：100dvh 守恒 + Z-03 幻灯片甲板 + 底部拇指坞)
  // =========================================================================
  async function initLevel3LearnPage() {
    const prefs = loadLearningPrefs();
    const themeKey = prefs.theme;
    const tMeta = THEME_META[themeKey] || THEME_META.deductive;
    const lMeta = LANG_META[prefs.lang] || LANG_META.en;
    const dMeta = DIFFICULTY_META[prefs.difficulty] || DIFFICULTY_META.tier2;
    const cMeta = CONTENT_META[prefs.content] || CONTENT_META.all;

    // 1. 切换三级页面主题皮肤与五维色域光谱
    document.body.className = `theme-page-${themeKey} learn-single-screen-body`;
    applyOpticSpectrum(prefs.spectrum, themeKey);
    document.title = `${tMeta.name}（${lMeta.short}） · 语言学习实操台 | Lingua-Flow`;

    const backL1 = document.getElementById('learn-back-l1');
    const backL2 = document.getElementById('learn-back-l2');
    const themePill = document.getElementById('learn-theme-pill');
    const langPill = document.getElementById('learn-lang-pill');
    const diffPill = document.getElementById('learn-diff-pill');
    const focusPill = document.getElementById('learn-focus-pill');
    const openTelemetryBtn = document.getElementById('open-telemetry-sheet-btn');
    const hudImg = document.getElementById('learn-hud-img');
    const companionNameEl = document.getElementById('companion-name-label');
    const companionEnEl = document.getElementById('companion-en-label');
    const companionSpeechEl = document.getElementById('companion-speech-text');
    const rigTierEl = document.getElementById('rig-tier-label');
    const footerTextEl = document.getElementById('learn-footer-text');

    // 宽屏协同侧岛元素同步
    const deskHudImg = document.getElementById('desk-hud-img');
    const deskRigTierEl = document.getElementById('desk-rig-tier-val');
    const deskCompanionNameEl = document.getElementById('desk-companion-name');
    const deskThemePillEl = document.getElementById('desk-theme-pill');
    const deskWhisperEl = document.getElementById('desk-companion-whisper');
    const deskTimerValEl = document.getElementById('desk-timer-val');
    const deskFlowValEl = document.getElementById('desk-flow-val');

    if (backL1) backL1.setAttribute('href', `index.html?lang=${encodeURIComponent(prefs.lang)}`);
    if (backL2) {
      backL2.setAttribute('href', buildHubUrl(themeKey, prefs));
      backL2.textContent = `← ${tMeta.short}`;
    }
    if (themePill) themePill.textContent = tMeta.short;
    if (langPill) langPill.textContent = `${lMeta.short}`;
    if (diffPill) diffPill.textContent = `🎚️ ${dMeta.label}`;
    if (focusPill) focusPill.textContent = cMeta.short;
    if (hudImg) hudImg.setAttribute('src', tMeta.hudImg);
    if (deskHudImg) deskHudImg.setAttribute('src', tMeta.hudImg);
    if (companionNameEl) companionNameEl.textContent = tMeta.companionName;
    if (deskCompanionNameEl) deskCompanionNameEl.textContent = tMeta.companionName;
    if (deskThemePillEl) deskThemePillEl.textContent = tMeta.short;
    if (companionEnEl) companionEnEl.textContent = tMeta.companionEn;
    if (companionSpeechEl) companionSpeechEl.textContent = tMeta.companionDefault;
    if (deskWhisperEl) deskWhisperEl.textContent = tMeta.companionDefault;
    if (rigTierEl) rigTierEl.textContent = tMeta.rigTiers[0];
    if (deskRigTierEl) deskRigTierEl.textContent = tMeta.rigTiers[0];
    if (footerTextEl) {
      footerTextEl.textContent = `© 2026 Lingua-Flow · ${tMeta.short} (${lMeta.short})`;
    }

    if (openTelemetryBtn) {
      openTelemetryBtn.addEventListener('click', () => {
        playTactileClick('down');
        openOpticSheet('telemetry-sheet', openTelemetryBtn);
      });
    }

    const mountEl = document.getElementById('theme-workbench-mount');
    const tabsMountEl = document.getElementById('learn-chapter-tabs');
    const chapterHeadingEl = document.getElementById('stage-chapter-heading');
    const kuBadgeEl = document.getElementById('stage-ku-badge');
    const timerValEl = document.getElementById('telemetry-timer-val');
    const errorsValEl = document.getElementById('telemetry-errors-val');
    const grammarSdEl = document.getElementById('telemetry-grammar-sd');
    const evidenceSdEl = document.getElementById('telemetry-evidence-sd');
    const flowBadgeEl = document.getElementById('telemetry-flow-badge');
    const unlockedListEl = document.getElementById('telemetry-unlocked-list');
    const stagePanelEl = document.getElementById('theme-stage-panel');

    if (!mountEl) return;

    const bundle = await loadEpisodeBundle(themeKey);
    const encounters = (bundle && Array.isArray(bundle.encounters) && bundle.encounters.length > 0)
      ? bundle.encounters
      : [];

    function getLangEncounters() {
      const mapped = encounters.map((enc, idx) => ({ enc, originalIdx: idx }));
      const filtered = mapped.filter((item) => item.enc.lang === prefs.lang);
      return filtered.length > 0 ? filtered : mapped;
    }

    let grammarErrors = 0;
    let evidenceErrors = 0;
    let usedCompanionHint = false;
    let clueLocked = false;
    let tokenLocked = false;
    let magnifierFocused = false;
    let waveResonant = false;
    let rubbingCompleted = false;
    let orbsRoutedCount = 0;
    let isEncounterSubmitting = false;
    let phaseAdvanceTimerId = null;

    // 实时刷新活跃专注计时器显示（页面销毁时显式清理全部定时器防泄漏 D15）
    const telemetryIntervalId = setInterval(() => {
      if (!activeTimer.isRunning) return;
      const curMs = document.visibilityState === 'visible'
        ? activeTimer.accumulatedMs + (performance.now() - activeTimer.lastResumeTime)
        : activeTimer.accumulatedMs;
      const clampedSec = (Math.min(MAX_EFFECTIVE_DURATION_MS, Math.max(0, curMs)) / 1000).toFixed(1);
      if (timerValEl) timerValEl.textContent = `${clampedSec}s`;
      if (deskTimerValEl) deskTimerValEl.textContent = `${clampedSec}s`;
    }, 200);
    window.addEventListener(
      'pagehide',
      () => {
        clearInterval(telemetryIntervalId);
        if (phaseAdvanceTimerId) {
          clearTimeout(phaseAdvanceTimerId);
          phaseAdvanceTimerId = null;
        }
      },
      { once: true }
    );

    async function refreshThemeTelemetryFromDB(grammarKuId, evidenceKuId) {
      const flowMetrics = computeFlowChannelMetrics(flowSlidingWindow);
      if (flowBadgeEl) {
        flowBadgeEl.textContent = `${flowMetrics.channel_state} · R=${flowMetrics.target_retention}`;
      }
      if (deskFlowValEl) {
        deskFlowValEl.textContent = `${flowMetrics.channel_state} · ${flowMetrics.target_retention}`;
      }
      const unified = await getUnifiedProgressState();
      const gItem = (unified.memory_items && unified.memory_items[grammarKuId]) || null;
      const eItem = (unified.memory_items && unified.memory_items[evidenceKuId]) || null;
      const pItem = (unified.theme_progress && unified.theme_progress[themeKey]) || null;

      const defaultSdLabel =
        themeKey === 'deductive'
          ? '待质证结算'
          : themeKey === 'immersive'
            ? '待共鸣收录'
            : '待破盾结算';
      if (grammarSdEl) {
        if (gItem) {
          const gPrefix = gItem.last_grade ? `${gItem.last_grade} · ` : '';
          grammarSdEl.textContent = `${gPrefix}S'=${gItem.stability}d / D'=${gItem.difficulty}`;
        } else {
          grammarSdEl.textContent = defaultSdLabel;
        }
      }
      if (evidenceSdEl) {
        if (eItem) {
          const ePrefix = eItem.last_grade ? `${eItem.last_grade} · ` : '';
          evidenceSdEl.textContent = `${ePrefix}S'=${eItem.stability}d / D'=${eItem.difficulty}`;
        } else {
          evidenceSdEl.textContent = defaultSdLabel;
        }
      }
      if (unlockedListEl) {
        const unlocked = pItem && Array.isArray(pItem.unlocked_clues) ? pItem.unlocked_clues : [];
        const completed = pItem && Array.isArray(pItem.completed_encounters) ? pItem.completed_encounters : [];
        const langList = getLangEncounters();
        const langCompleted = langList.filter(({ enc, originalIdx }) => {
          const eId = enc.encounter_id || `${themeKey}_ep01_enc0${originalIdx + 1}`;
          return completed.includes(eId);
        }).length;
        const tierIdx = Math.min(2, completed.length);
        if (rigTierEl && tMeta.rigTiers) {
          rigTierEl.textContent = tMeta.rigTiers[tierIdx];
        }
        if (deskRigTierEl && tMeta.rigTiers) {
          deskRigTierEl.textContent = tMeta.rigTiers[tierIdx];
        }
        const naturalUnlocked = unlocked.map((k) => formatNaturalKuLabel(k));
        unlockedListEl.textContent =
          naturalUnlocked.length > 0
            ? `📂 已归档 (${naturalUnlocked.length} 项 · 通关 ${langCompleted}/${langList.length} 章)：${naturalUnlocked.join(' · ')}`
            : '📂 尚无归档记录：完成本节双幕实操即可写入客户端本地记忆仓。';
      }
    }

    function updateErrorsBadge() {
      if (!errorsValEl) return;
      if (themeKey === 'deductive') {
        errorsValEl.textContent = `语法 ${grammarErrors} / 物证 ${evidenceErrors}`;
      } else if (themeKey === 'immersive') {
        errorsValEl.textContent = `语调 ${grammarErrors} / 拓印 ${evidenceErrors}`;
      } else {
        errorsValEl.textContent = `卡榫 ${grammarErrors} / 星轨 ${evidenceErrors}`;
      }
    }

    function triggerStageShake() {
      playTactileClick('repulse');
      if (!stagePanelEl) return;
      stagePanelEl.classList.remove('is-shaking');
      void stagePanelEl.offsetWidth;
      stagePanelEl.classList.add('is-shaking');
    }

    // 仅渲染当前选定语言的专属章节 Tab，杜绝跨语言混排
    function renderChapterTabs(activeIdx) {
      if (!tabsMountEl) return;
      const mirror = loadStateMirror();
      const prog = (mirror.theme_progress && mirror.theme_progress[themeKey]) || null;
      const completedSet = new Set((prog && prog.completed_encounters) || []);
      const langList = getLangEncounters();

      tabsMountEl.innerHTML = langList
        .map(({ enc, originalIdx }, seqIdx) => {
          const isActive = originalIdx === activeIdx;
          const langPrefix = enc.lang === 'en' ? '🇬🇧' : enc.lang === 'ja' ? '🇯🇵' : '🇨🇳';
          const encId = enc.encounter_id || `${themeKey}_ep01_enc0${originalIdx + 1}`;
          const isDone = completedSet.has(encId);
          const rawTitle = String(enc.chapter_title || `章节 ${seqIdx + 1}`);
          const shortTitle = rawTitle.includes('：')
            ? `0${seqIdx + 1} · ${rawTitle.split('：').slice(1).join('：')}`
            : rawTitle.replace(/（[^）]*）/g, '');
          return `
            <button
              type="button"
              class="chapter-tab-btn ${isActive ? 'is-active' : ''}"
              data-encounter-idx="${originalIdx}"
              data-lang-seq="${seqIdx}"
              role="tab"
              aria-selected="${isActive ? 'true' : 'false'}"
              title="${escapeHtml(rawTitle)}"
            >
              <span>${isDone ? '✅' : langPrefix}</span>
              <span>${escapeHtml(shortTitle)}</span>
            </button>
          `;
        })
        .join('');

      tabsMountEl.querySelectorAll('.chapter-tab-btn[data-encounter-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          playTactileClick('down');
          const nextIdx = Number(btn.getAttribute('data-encounter-idx')) || 0;
          prefs.chapter = nextIdx;
          saveLearningPrefs(prefs);
          runWithViewTransition(() => {
            renderChapterTabs(nextIdx);
            renderActiveChapter(nextIdx);
          });
        });
        btn.addEventListener('keydown', (ev) => {
          if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
          ev.preventDefault();
          const curSeq = Number(btn.getAttribute('data-lang-seq')) || 0;
          const delta = ev.key === 'ArrowRight' ? 1 : -1;
          const nextSeq = (curSeq + delta + langList.length) % langList.length;
          const nextIdx = langList[nextSeq].originalIdx;
          prefs.chapter = nextIdx;
          saveLearningPrefs(prefs);
          runWithViewTransition(() => {
            renderChapterTabs(nextIdx);
            renderActiveChapter(nextIdx);
          });
          const nextBtn = tabsMountEl.querySelector(`.chapter-tab-btn[data-encounter-idx="${nextIdx}"]`);
          if (nextBtn) nextBtn.focus();
        });
      });
    }

    function renderActiveChapter(idx) {
      const langList = getLangEncounters();
      // 若传入章节不属于当前选定语言，则自动对齐至当前语言的第一章
      const matchedInLang = langList.find((item) => item.originalIdx === idx) || langList[0] || { enc: encounters[0] || {}, originalIdx: 0 };
      const safeIdx = matchedInLang.originalIdx;
      const enc = matchedInLang.enc || {};
      const seg = (enc.dialogue_stream && enc.dialogue_stream[0]) || {};
      const encounterId = enc.encounter_id || `${themeKey}_ep01_enc0${safeIdx + 1}`;
      const grammarKuId = seg.flaw_grammar_ku_id_ref || 'en_b1_grammar_past_continuous';
      const evidenceKuId = seg.target_evidence_ku_id_ref || 'en_b1_lemma_contradict';
      const companionHint =
        (enc.rating_rules && enc.rating_rules.again && enc.rating_rules.again.companion_hint) ||
        '观察语境时间锚点与词尾接续法则！';

      const zeissTarget = dMeta.zeissMin || 70;
      const rubbingTarget = dMeta.rubbingMin || 75;
      const freqBonus = dMeta.freqBonusHz || 0;
      const isTier1Guided = prefs.difficulty === 'tier1';
      const isLemmaFocus = prefs.content === 'lemma';
      const isGrammarFocus = prefs.content === 'grammar';

      if (phaseAdvanceTimerId) {
        clearTimeout(phaseAdvanceTimerId);
        phaseAdvanceTimerId = null;
      }

      grammarErrors = 0;
      evidenceErrors = 0;
      usedCompanionHint = false;
      clueLocked = themeKey !== 'deductive' || isGrammarFocus;
      tokenLocked = themeKey === 'immersive' || isLemmaFocus;
      magnifierFocused = isGrammarFocus;
      waveResonant = isLemmaFocus;
      rubbingCompleted = isGrammarFocus;
      orbsRoutedCount = 0;
      isEncounterSubmitting = false;
      let isEncounterCompleted = false;

      // 分幕式单焦点状态：默认处于第一幕 (Phase 1)，若第一幕已由专项模式自动托管完成则直接进入第二幕 (Phase 2)
      let activePhase = (themeKey === 'deductive' && magnifierFocused) ||
                        (themeKey === 'immersive' && waveResonant) ||
                        (themeKey === 'strategic' && tokenLocked)
        ? 2
        : 1;
      let autoAdvancedPhase1 = activePhase === 2;
      let notifiedStep1 = magnifierFocused || waveResonant;
      let notifiedStep2 = rubbingCompleted;

      startActiveTimer();
      updateErrorsBadge();

      if (chapterHeadingEl) {
        chapterHeadingEl.textContent = enc.chapter_title || `章节 ${safeIdx + 1}`;
      }
      if (kuBadgeEl) {
        kuBadgeEl.textContent = `🎯 ${formatNaturalKuLabel(grammarKuId)} · ${formatNaturalKuLabel(evidenceKuId)}`;
      }
      if (companionSpeechEl) {
        companionSpeechEl.textContent = tMeta.companionDefault;
      }
      if (deskWhisperEl) {
        deskWhisperEl.textContent = tMeta.companionDefault;
      }

      const slide1StateClass = activePhase === 1 ? 'is-slide-active' : 'prev';
      const slide2StateClass = activePhase === 2 ? 'is-slide-active' : 'next';

      if (themeKey === 'deductive') {
        const speaker = escapeHtml(seg.speaker || '法庭证人');
        const flawToken = escapeHtml(seg.flaw_token || 'stay');
        const distractorToken = escapeHtml(seg.distractor_token || 'yesterday');
        const rawClue = String(enc.clue_label || '📄 关键物证');
        const rawDistractorClue = String(enc.distractor_clue_label || '🎫 候选物证 B');
        const clueLabel = escapeHtml(rawClue);
        const distractorClue = escapeHtml(
          isTier1Guided ? rawDistractorClue : rawDistractorClue.replace(/干扰物证[：:]?\s*/g, '候选物证 B：')
        );
        const magWord = escapeHtml(enc.magnifier_target_word || 'contradict');
        const magPhonetic = escapeHtml(enc.magnifier_phonetic || '/ˌkɒn.trəˈdɪkt/');
        const magEtym = escapeHtml(enc.magnifier_etymology || '词根拆解与语境义项');
        const initialZeissVal = isGrammarFocus ? Math.min(100, zeissTarget + 10) : 48;
        const initialZeissBlur = isGrammarFocus ? 'none' : 'blur(1.6px)';
        const initialZeissStatus = isGrammarFocus
          ? `✅ 已锁焦 ${initialZeissVal}%`
          : `⏳ ${initialZeissVal}% (目标 ≥${zeissTarget}%)`;

        const distractorTokenText = isTier1Guided
          ? `🔍 ${distractorToken} (正常词)`
          : `🔍 ${distractorToken}`;
        const conciseCorrection = escapeHtml(
          String(seg.expected_correction || 'was staying')
            .replace(/\s*[（(].*?[)）]/g, '')
            .trim()
        );
        const flawTokenText = isTier1Guided || isLemmaFocus
          ? `🎯 ${flawToken} → ${conciseCorrection}`
          : `🎯 ${flawToken}`;

        mountEl.innerHTML = `
          <div class="stage-phase-bar" role="tablist" aria-label="雾都回响双幕切换">
            <button type="button" class="stage-phase-pill ${activePhase === 1 ? 'is-active' : ''} ${magnifierFocused ? 'is-done' : ''}" data-phase-tab="1" role="tab" aria-selected="${activePhase === 1 ? 'true' : 'false'}">
              <span class="phase-num" id="phase-num-1">${magnifierFocused ? '✓' : '1'}</span>
              <span>显微取证</span>
            </button>
            <button type="button" class="stage-phase-pill ${activePhase === 2 ? 'is-active' : ''} ${tokenLocked && clueLocked ? 'is-done' : ''}" data-phase-tab="2" role="tab" aria-selected="${activePhase === 2 ? 'true' : 'false'}">
              <span class="phase-num" id="phase-num-2">${tokenLocked && clueLocked ? '✓' : '2'}</span>
              <span>当庭质证</span>
            </button>
          </div>

          <!-- Z-03 恒定画幅时间线幻灯片舞台 (grid-area: 1 / 1 原地推拉，零 CLS) -->
          <div class="optic-slide-deck-frame">
            <!-- 第一幕：蔡司黄铜显微透镜台 (semantic_magnifier) -->
            <div class="instrument-module ${slide1StateClass} ${magnifierFocused ? 'is-module-ready' : ''}" id="inst-module-1" aria-hidden="${activePhase === 1 ? 'false' : 'true'}">
              <div class="panel-section-title">
                <span style="color: var(--theme-accent);">🔬 蔡司黄铜显微透镜</span>
                <span id="zeiss-focus-status" class="zeiss-focus-readout" style="font-size: var(--optic-font-xs); color: ${isGrammarFocus ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${initialZeissStatus}</span>
              </div>
              <div class="micro-prompt-pill" id="inst-feedback-1">
                <span>${magnifierFocused ? '✅' : '🔬'}</span>
                <span id="inst-feedback-1-text">${magnifierFocused ? `已锁焦词源【${magWord}】，自动进入当庭质证` : `向右旋动黄铜滑块至 ≥${zeissTarget}% 锁焦词源`}</span>
              </div>
              <div class="zeiss-lens-viewport ${magnifierFocused ? 'is-zeiss-locked' : ''}" id="zeiss-viewport" style="filter: ${initialZeissBlur};">
                <div>
                  <div class="zeiss-lens-word">${magWord}<span class="zeiss-phonetic-tag">${magPhonetic}</span></div>
                  <div class="zeiss-lens-etymology">${magEtym}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  <span class="status-badge meta-pill-accent">${escapeHtml(formatNaturalKuLabel(evidenceKuId))}</span>
                  <svg class="zeiss-reticle-dial" id="zeiss-reticle-svg" viewBox="0 0 40 40" aria-hidden="true">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#d97706" stroke-width="1.8" stroke-dasharray="4 3" />
                    <circle cx="20" cy="20" r="9" fill="none" stroke="#0284c7" stroke-width="1.4" />
                    <line x1="20" y1="1" x2="20" y2="39" stroke="#d97706" stroke-width="1.2" opacity="0.75" />
                    <line x1="1" y1="20" x2="39" y2="20" stroke="#d97706" stroke-width="1.2" opacity="0.75" />
                  </svg>
                </div>
              </div>
              <input type="range" class="apparatus-slider" id="zeiss-focus-slider" aria-label="蔡司显微透镜屈光度调焦滑块" min="10" max="100" value="${initialZeissVal}">
            </div>

            <!-- 第二幕：高等法庭证词流与 L-A11 扇形候选词牌场 (contradiction_pinpoint) -->
            <div class="instrument-module ${slide2StateClass} ${tokenLocked && clueLocked ? 'is-module-ready' : ''}" id="inst-module-2" aria-hidden="${activePhase === 2 ? 'false' : 'true'}" style="position: relative; overflow: hidden;">
              <svg class="crimson-laser-overlay" id="crimson-laser-beam" viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="crimson-beam-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#dc2626" />
                    <stop offset="50%" stop-color="#d97706" />
                    <stop offset="100%" stop-color="#059669" />
                  </linearGradient>
                </defs>
                <path d="M 35,38 L 310,95 L 565,152" fill="none" stroke="url(#crimson-beam-grad)" stroke-width="4" stroke-dasharray="14 6" />
                <circle cx="310" cy="95" r="14" fill="none" stroke="#dc2626" stroke-width="3" />
                <circle cx="565" cy="152" r="16" fill="none" stroke="#059669" stroke-width="3" />
              </svg>
              <div class="panel-section-title">
                <span style="color: var(--accent-crimson);">🎯 法庭矛盾指控针</span>
                <span style="font-size: var(--optic-font-xs); color: var(--text-secondary);">${speaker}</span>
              </div>
              <div class="micro-prompt-pill" id="inst-feedback-2">
                <span>${tokenLocked && clueLocked ? '✅' : '🎯'}</span>
                <span id="inst-feedback-2-text">${tokenLocked && clueLocked ? '破绽与物证均已锁定，点击下方发射指控针' : '点选证词破绽词块 + 匹配法庭物证卡'}</span>
              </div>
              <blockquote class="deductive-testimony-box">
                “${escapeHtml(seg.text || '')}”
                <div class="optic-token-fan-row">
                  <button type="button" class="interactive-token" data-page-token="distractor">
                    ${distractorTokenText}
                  </button>
                  <button type="button" class="interactive-token ${isLemmaFocus ? 'is-locked' : ''}" data-page-token="flaw" style="${isTier1Guided ? 'border-color: var(--accent-crimson);' : ''}">
                    ${flawTokenText}
                  </button>
                </div>
              </blockquote>

              <div class="deductive-clue-grid">
                <button type="button" class="interactive-choice ${isGrammarFocus ? 'is-locked' : ''}" data-page-clue="correct" style="${isTier1Guided ? 'border-color: var(--accent-amber);' : ''}">
                  ${clueLabel}
                </button>
                <button type="button" class="interactive-choice" data-page-clue="distractor">
                  ${distractorClue}
                </button>
              </div>
            </div>

            <div class="stage-victory-card" id="stage-victory-card" role="status" aria-live="polite" aria-hidden="true"></div>
          </div>

          <div class="workbench-action-bar thumb-ergonomic-dock">
            <button type="button" class="btn-secondary-ghost" id="page-hint-btn">
              💡 笔记提示
            </button>
            <button type="button" class="btn-theme btn-deductive" id="page-submit-btn">
              ⚡ ${escapeHtml(enc.action_button_label || '射出矛盾指控针')}
            </button>
            <button type="button" class="btn-secondary-ghost" id="page-next-chapter-btn" title="进入当前语言下一章节">
              ⏭️ 下一章
            </button>
          </div>
        `;
      } else if (themeKey === 'immersive') {
        const freqMin = Math.max(20, (Number(enc.target_freq_min) || 45) - freqBonus);
        const freqMax = Math.min(88, (Number(enc.target_freq_max) || 65) + freqBonus);
        const initialFreq = isLemmaFocus ? Math.round((freqMin + freqMax) / 2) : 28;
        const initialRubbing = isGrammarFocus ? Math.min(100, rubbingTarget + 10) : 40;
        const rubyHtml = sanitizeRubyHtml(seg.ruby_html || seg.text || '');
        const translation = escapeHtml(seg.translation || '');
        const rubbingGlyph = escapeHtml(enc.rubbing_glyph || '私');
        const rubbingReading = escapeHtml(enc.rubbing_reading || 'わたし');
        const rubbingEtym = escapeHtml(enc.rubbing_etymology || '汝窑天青冰裂螺钿字源');

        mountEl.innerHTML = `
          <div class="stage-phase-bar" role="tablist" aria-label="星尘漫游双幕切换">
            <button type="button" class="stage-phase-pill ${activePhase === 1 ? 'is-active' : ''} ${waveResonant ? 'is-done' : ''}" data-phase-tab="1" role="tab" aria-selected="${activePhase === 1 ? 'true' : 'false'}">
              <span class="phase-num" id="phase-num-1">${waveResonant ? '✓' : '1'}</span>
              <span>声波调频</span>
            </button>
            <button type="button" class="stage-phase-pill ${activePhase === 2 ? 'is-active' : ''} ${rubbingCompleted ? 'is-done' : ''}" data-phase-tab="2" role="tab" aria-selected="${activePhase === 2 ? 'true' : 'false'}">
              <span class="phase-num" id="phase-num-2">${rubbingCompleted ? '✓' : '2'}</span>
              <span>汝窑拓印</span>
            </button>
          </div>

          <div class="optic-slide-deck-frame">
            <!-- 第一幕：八角螺钿与 24K 金缮声波共振调频盘 (harmonic_waveform_tuner) -->
            <div class="instrument-module ${slide1StateClass} ${waveResonant ? 'is-module-ready' : ''}" id="inst-module-1" aria-hidden="${activePhase === 1 ? 'false' : 'true'}">
              <div class="panel-section-title">
                <span style="color: var(--theme-accent);">🌊 24K 金缮声波调频盘</span>
                <span id="immersive-phase-badge" style="font-size: var(--optic-font-xs); color: ${waveResonant ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${waveResonant ? `✅ 已同频 ${initialFreq}Hz` : `⏳ <span id="immersive-freq-val">${initialFreq}</span>Hz (目标 ${freqMin}~${freqMax}Hz)`}</span>
              </div>
              <div class="micro-prompt-pill" id="inst-feedback-1">
                <span>${waveResonant ? '✅' : '🌊'}</span>
                <span id="inst-feedback-1-text">${waveResonant ? `声波已同频 (${initialFreq}Hz)，自动进入汝窑拓印` : `拖动滑块调入 ${freqMin}~${freqMax}Hz 使双波重合`}</span>
              </div>
              <div class="immersive-sentence-card">
                <div class="immersive-ruby-line">${rubyHtml}</div>
                <div class="immersive-translation-line">${translation}</div>
              </div>
              <div class="harmonic-wave-stage ${waveResonant ? 'is-wave-resonant' : ''}" id="harmonic-wave-box">
                <svg width="100%" height="46" viewBox="0 0 360 56" role="img" aria-label="24K金缮基准波与夜光螺钿调频波">
                  <defs>
                    <linearGradient id="page-raden-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#0284c7" />
                      <stop offset="50%" stop-color="#7c3aed" />
                      <stop offset="100%" stop-color="#059669" />
                    </linearGradient>
                  </defs>
                  <path d="M 0,28 Q 45,8 90,28 T 180,28 T 270,28 T 360,28" fill="none" stroke="#d97706" stroke-width="2.2" opacity="0.88" />
                  <path id="page-user-wave" d="M 0,28 Q 45,${waveResonant ? 8 : 36} 90,28 T 180,28 T 270,28 T 360,28" fill="none" stroke="url(#page-raden-wave)" stroke-width="3.2" />
                </svg>
              </div>
              <input type="range" class="apparatus-slider" id="immersive-freq-slider" aria-label="金缮声波调频滑块" min="15" max="90" value="${initialFreq}">
            </div>

            <!-- 第二幕：青苔汝窑天青石碑螺钿拓印台 (sensory_rubbing) -->
            <div class="instrument-module ${slide2StateClass} ${rubbingCompleted ? 'is-module-ready' : ''}" id="inst-module-2" aria-hidden="${activePhase === 2 ? 'false' : 'true'}">
              <div class="panel-section-title">
                <span style="color: var(--theme-accent);">🪨 青苔汝窑螺钿拓印台</span>
                <span id="rubbing-status-label" style="font-size: var(--optic-font-xs); color: ${rubbingCompleted ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${rubbingCompleted ? `✅ 已显影 ${initialRubbing}%` : `⏳ ${initialRubbing}% (目标 ≥${rubbingTarget}%)`}</span>
              </div>
              <div class="micro-prompt-pill" id="inst-feedback-2">
                <span>${rubbingCompleted ? '✅' : '🪨'}</span>
                <span id="inst-feedback-2-text">${rubbingCompleted ? `字源【${rubbingGlyph}】已显影，点击下方共鸣收录` : `在石碑表面滑动擦拭或拖滑块至 ≥${rubbingTarget}%`}</span>
              </div>
              <div class="celadon-rubbing-tablet ${rubbingCompleted ? 'is-rubbing-complete' : ''}" id="celadon-tablet">
                <div class="celadon-moss-layer" id="celadon-moss-overlay" style="opacity: ${rubbingCompleted ? 0 : 0.65};"></div>
                <div class="rubbing-glyph-display" id="rubbing-glyph-el" style="filter: ${rubbingCompleted ? 'none' : 'blur(2.6px)'}; position: relative; z-index: 2;">${rubbingGlyph}</div>
                <div class="rubbing-reading-line" style="position: relative; z-index: 2;">${rubbingReading}</div>
                <div class="rubbing-etym-line" style="position: relative; z-index: 2;">${rubbingEtym}</div>
              </div>
              <input type="range" class="apparatus-slider" id="immersive-rubbing-slider" aria-label="汝窑石碑拭苔拓印滑块" min="10" max="100" value="${initialRubbing}">
            </div>

            <div class="stage-victory-card" id="stage-victory-card" role="status" aria-live="polite" aria-hidden="true"></div>
          </div>

          <div class="workbench-action-bar thumb-ergonomic-dock">
            <button type="button" class="btn-secondary-ghost" id="page-hint-btn">
              💡 示范音提示
            </button>
            <button type="button" class="btn-theme btn-immersive" id="page-submit-btn">
              ✨ ${escapeHtml(enc.action_button_label || '完成金缮调频共振')}
            </button>
            <button type="button" class="btn-secondary-ghost" id="page-next-chapter-btn" title="进入当前语言下一章节">
              ⏭️ 下一章
            </button>
          </div>
        `;
      } else {
        const stemLabel = escapeHtml(enc.stem_label || '書か- (未然形词干)');
        const rawAffix = String(enc.affix_label || '-ない (未然形否定卡榫)');
        const rawDistractorAffix = String(enc.distractor_affix_label || '-ます (候选卡榫 B)');
        const affixLabel = escapeHtml(
          isTier1Guided ? rawAffix : rawAffix.replace(/\s*\(.*?\)/g, '')
        );
        const distractorAffix = escapeHtml(
          isTier1Guided ? rawDistractorAffix : rawDistractorAffix.replace(/\s*\(.*?\)/g, '')
        );
        const rubyHtml = sanitizeRubyHtml(seg.ruby_html || seg.text || '');
        const orbs = Array.isArray(enc.spell_orbs) && enc.spell_orbs.length > 0
          ? enc.spell_orbs
          : ['古い', 'ルーン', 'を', '書か-', '-ない'];
        const requiredOrbs = Math.min(orbs.length, dMeta.minOrbs || 3);
        orbsRoutedCount = isGrammarFocus ? requiredOrbs : 0;
        notifiedStep1 = tokenLocked;
        notifiedStep2 = orbsRoutedCount >= requiredOrbs;

        const orbButtonsHtml = orbs
          .map(
            (orbText, oIdx) => `
            <button type="button" class="spell-orb-btn ${isGrammarFocus && oIdx < requiredOrbs ? 'is-routed' : ''}" data-orb-idx="${oIdx}">
              ✦ ${escapeHtml(orbText)}
            </button>
          `
          )
          .join('');

        mountEl.innerHTML = `
          <div class="stage-phase-bar" role="tablist" aria-label="刻痕圣殿双幕切换">
            <button type="button" class="stage-phase-pill ${activePhase === 1 ? 'is-active' : ''} ${tokenLocked ? 'is-done' : ''}" data-phase-tab="1" role="tab" aria-selected="${activePhase === 1 ? 'true' : 'false'}">
              <span class="phase-num" id="phase-num-1">${tokenLocked ? '✓' : '1'}</span>
              <span>榫卯咬合</span>
            </button>
            <button type="button" class="stage-phase-pill ${activePhase === 2 ? 'is-active' : ''} ${orbsRoutedCount >= requiredOrbs ? 'is-done' : ''}" data-phase-tab="2" role="tab" aria-selected="${activePhase === 2 ? 'true' : 'false'}">
              <span class="phase-num" id="phase-num-2">${orbsRoutedCount >= requiredOrbs ? '✓' : '2'}</span>
              <span>星轨咏唱</span>
            </button>
          </div>

          <div class="optic-slide-deck-frame">
            <!-- 第一幕：果冻 SSS 动词变位凹凸榫卯构筑器 (conjugation_mortise) -->
            <div class="instrument-module ${slide1StateClass} ${tokenLocked ? 'is-module-ready' : ''}" id="inst-module-1" aria-hidden="${activePhase === 1 ? 'false' : 'true'}">
              <div class="panel-section-title">
                <span style="color: var(--theme-accent);">⚙️ 果冻 SSS 榫卯构筑</span>
                <span id="mortise-lock-status" style="font-size: var(--optic-font-xs); color: ${tokenLocked ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${tokenLocked ? '✅ 已咬合锁定' : '⏳ 待点击卡榫'}</span>
              </div>
              <div class="micro-prompt-pill" id="inst-feedback-1">
                <span>${tokenLocked ? '✅' : '⚙️'}</span>
                <span id="inst-feedback-1-text">${tokenLocked ? `卡榫【${affixLabel}】已咬合，自动进入星轨咏唱` : '点选与青铜词干凹槽匹配的果冻卡榫'}</span>
              </div>
              <div class="mortise-joint-stage ${tokenLocked ? 'is-mortise-snapped' : ''}" id="mortise-stage-box">
                <div class="stem-mortise-box">${stemLabel}</div>
                <span style="font-size: 1.15rem; font-weight: 900; color: var(--accent-amber);" aria-hidden="true">⚡</span>
                <button type="button" class="interactive-choice strategic-tenon-btn ${isLemmaFocus ? 'is-locked' : ''}" data-page-tenon="correct">
                  🧩 ${affixLabel}
                </button>
                <button type="button" class="interactive-choice strategic-tenon-btn" data-page-tenon="distractor">
                  ${isTier1Guided ? '❌' : '🧩'} ${distractorAffix}
                </button>
              </div>
            </div>

            <!-- 第二幕：六翼玫瑰花窗法术手势咏唱盘 (spell_gesture_routing) -->
            <div class="instrument-module ${slide2StateClass} ${orbsRoutedCount >= requiredOrbs ? 'is-module-ready' : ''}" id="inst-module-2" aria-hidden="${activePhase === 2 ? 'false' : 'true'}">
              <div class="panel-section-title">
                <span style="color: var(--accent-cyan);">✨ 六翼玫瑰花窗星轨咏唱</span>
                <span id="constellation-status" style="font-size: var(--optic-font-xs); color: ${orbsRoutedCount >= requiredOrbs ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${orbsRoutedCount}/${orbs.length} 晶球 (需 ≥${requiredOrbs})</span>
              </div>
              <div class="micro-prompt-pill" id="inst-feedback-2">
                <span>${orbsRoutedCount >= requiredOrbs ? '✅' : '✨'}</span>
                <span id="inst-feedback-2-text">${orbsRoutedCount >= requiredOrbs ? `星轨回路已贯通 (${orbsRoutedCount}/${orbs.length})，点击下方释放破盾奥义` : `点亮或划过下方至少 ${requiredOrbs} 颗语法晶球`}</span>
              </div>
              <div class="strategic-formula-banner">
                ${rubyHtml}
              </div>
              <div class="constellation-orb-row" id="strategic-orb-row" style="touch-action: manipulation;">
                ${orbButtonsHtml}
              </div>
            </div>

            <div class="stage-victory-card" id="stage-victory-card" role="status" aria-live="polite" aria-hidden="true"></div>
          </div>

          <div class="workbench-action-bar thumb-ergonomic-dock">
            <button type="button" class="btn-secondary-ghost" id="page-hint-btn">
              💡 星轨提示
            </button>
            <button type="button" class="btn-theme btn-strategic" id="page-submit-btn">
              💥 ${escapeHtml(enc.action_button_label || '榫卯咬合 · 释放破盾奥义')}
            </button>
            <button type="button" class="btn-secondary-ghost" id="page-next-chapter-btn" title="进入当前语言下一章节">
              ⏭️ 下一章
            </button>
          </div>
        `;
      }

      // Z-03 恒定画幅幻灯片切换器：基于 grid-area: 1 / 1 与 X-Z 轴景深位移切换，零高度跳变 (CLS = 0)
      function setActivePhase(nextPhase) {
        activePhase = nextPhase === 2 ? 2 : 1;
        const mod1 = document.getElementById('inst-module-1');
        const mod2 = document.getElementById('inst-module-2');
        const victoryCardEl = document.getElementById('stage-victory-card');
        if (victoryCardEl && victoryCardEl.classList.contains('is-visible')) {
          victoryCardEl.classList.remove('is-visible');
          victoryCardEl.setAttribute('aria-hidden', 'true');
        }
        if (mod1) {
          mod1.classList.toggle('is-slide-active', activePhase === 1);
          mod1.classList.toggle('prev', activePhase !== 1);
          mod1.classList.remove('next');
          mod1.setAttribute('aria-hidden', activePhase === 1 ? 'false' : 'true');
        }
        if (mod2) {
          mod2.classList.toggle('is-slide-active', activePhase === 2);
          mod2.classList.toggle('next', activePhase !== 2);
          mod2.classList.remove('prev');
          mod2.setAttribute('aria-hidden', activePhase === 2 ? 'false' : 'true');
        }
        mountEl.querySelectorAll('[data-phase-tab]').forEach((tab) => {
          const tPhase = Number(tab.getAttribute('data-phase-tab'));
          const isMatch = tPhase === activePhase;
          tab.classList.toggle('is-active', isMatch);
          tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
      }

      mountEl.querySelectorAll('[data-phase-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
          if (phaseAdvanceTimerId) {
            clearTimeout(phaseAdvanceTimerId);
            phaseAdvanceTimerId = null;
          }
          playTactileClick('down');
          const targetP = Number(tab.getAttribute('data-phase-tab')) || 1;
          setActivePhase(targetP);
        });
      });

      function isStep1CurrentlyDone() {
        if (themeKey === 'deductive') return magnifierFocused;
        if (themeKey === 'immersive') return waveResonant;
        return tokenLocked;
      }

      function isStep2CurrentlyDone() {
        if (themeKey === 'deductive') return tokenLocked && clueLocked;
        if (themeKey === 'immersive') return rubbingCompleted;
        const orbsList = Array.isArray(enc.spell_orbs) && enc.spell_orbs.length > 0 ? enc.spell_orbs : [1, 2, 3, 4, 5];
        const reqOrbs = Math.min(orbsList.length, dMeta.minOrbs || 3);
        return orbsRoutedCount >= reqOrbs;
      }

      function syncOperationStepper() {
        const phaseTab1 = mountEl.querySelector('[data-phase-tab="1"]');
        const phaseTab2 = mountEl.querySelector('[data-phase-tab="2"]');
        const phaseNum1 = document.getElementById('phase-num-1');
        const phaseNum2 = document.getElementById('phase-num-2');
        const submitBtn = document.getElementById('page-submit-btn');
        const instMod1 = document.getElementById('inst-module-1');
        const instMod2 = document.getElementById('inst-module-2');

        const s1Done = isStep1CurrentlyDone();
        const s2Done = isStep2CurrentlyDone();
        const allReady = s1Done && s2Done;

        if (instMod1) instMod1.classList.toggle('is-module-ready', s1Done);
        if (instMod2) instMod2.classList.toggle('is-module-ready', s2Done);
        if (phaseTab1) phaseTab1.classList.toggle('is-done', s1Done);
        if (phaseTab2) phaseTab2.classList.toggle('is-done', s2Done);
        if (phaseNum1) phaseNum1.textContent = s1Done ? '✓' : '1';
        if (phaseNum2) phaseNum2.textContent = s2Done ? '✓' : '2';
        if (submitBtn) {
          submitBtn.classList.toggle('is-submit-ready', allReady);
        }

        if (!s1Done) {
          if (phaseAdvanceTimerId) {
            clearTimeout(phaseAdvanceTimerId);
            phaseAdvanceTimerId = null;
          }
          autoAdvancedPhase1 = false;
          return;
        }

        if (s1Done && !s2Done && !autoAdvancedPhase1 && activePhase === 1) {
          autoAdvancedPhase1 = true;
          if (phaseAdvanceTimerId) clearTimeout(phaseAdvanceTimerId);
          const advanceDelayMs = prefersReducedMotion ? 40 : 380;
          phaseAdvanceTimerId = setTimeout(() => {
            phaseAdvanceTimerId = null;
            if (
              isStep1CurrentlyDone() &&
              !isStep2CurrentlyDone() &&
              !isEncounterSubmitting &&
              !isEncounterCompleted &&
              activePhase === 1
            ) {
              setActivePhase(2);
            }
          }, advanceDelayMs);
        }
      }

      if (themeKey === 'deductive') {
        const focusSlider = document.getElementById('zeiss-focus-slider');
        const focusStatus = document.getElementById('zeiss-focus-status');
        const zeissViewport = document.getElementById('zeiss-viewport');
        const reticleSvg = document.getElementById('zeiss-reticle-svg');
        const fb1 = document.getElementById('inst-feedback-1');
        const fb1Text = document.getElementById('inst-feedback-1-text');

        if (focusSlider) {
          focusSlider.addEventListener('input', () => {
            const val = Number(focusSlider.value);
            const blurPx = Math.max(0, ((zeissTarget + 5 - val) / 15)).toFixed(1);
            magnifierFocused = val >= zeissTarget;
            if (zeissViewport) {
              zeissViewport.style.filter = magnifierFocused ? 'none' : `blur(${blurPx}px)`;
              zeissViewport.classList.toggle('is-zeiss-locked', magnifierFocused);
            }
            if (reticleSvg) {
              reticleSvg.style.transform = `rotate(${(val - 48) * 2.4}deg) scale(${magnifierFocused ? 1.08 : 1})`;
            }
            if (focusStatus) {
              focusStatus.textContent = magnifierFocused
                ? `✅ 已锁焦 ${val}%`
                : `⏳ ${val}% (目标 ≥${zeissTarget}%)`;
              focusStatus.style.color = magnifierFocused ? 'var(--accent-emerald)' : 'var(--accent-amber)';
            }
            if (fb1 && fb1Text) {
              fb1Text.textContent = magnifierFocused
                ? `已锁焦词源【${enc.magnifier_target_word || ''}】，切入当庭质证`
                : `向右拖动滑块 (${val}% / 目标 ≥${zeissTarget}%)`;
            }
            if (magnifierFocused && !notifiedStep1) {
              notifiedStep1 = true;
              playTactileClick('success');
              showFlowToast(`🔬 蔡司透镜已锁定词源【${enc.magnifier_target_word || formatNaturalKuLabel(evidenceKuId)}】`, 'success');
            }
            syncOperationStepper();
          });
        }
      } else if (themeKey === 'immersive') {
        const freqMin = Math.max(20, (Number(enc.target_freq_min) || 45) - freqBonus);
        const freqMax = Math.min(88, (Number(enc.target_freq_max) || 65) + freqBonus);
        const freqSlider = document.getElementById('immersive-freq-slider');
        const freqValEl = document.getElementById('immersive-freq-val');
        const phaseBadge = document.getElementById('immersive-phase-badge');
        const userWave = document.getElementById('page-user-wave');
        const waveBox = document.getElementById('harmonic-wave-box');
        const fb1 = document.getElementById('inst-feedback-1');
        const fb1Text = document.getElementById('inst-feedback-1-text');

        if (freqSlider) {
          freqSlider.addEventListener('input', () => {
            const val = Number(freqSlider.value);
            if (freqValEl) freqValEl.textContent = String(val);
            const inBand = val >= freqMin && val <= freqMax;
            waveResonant = inBand;
            const peak = inBand ? 8 : Math.max(4, Math.min(52, 28 - (val - 35) * 0.65));
            if (userWave) {
              userWave.setAttribute('d', `M 0,28 Q 45,${peak} 90,28 T 180,28 T 270,28 T 360,28`);
            }
            if (waveBox) {
              waveBox.classList.toggle('is-wave-resonant', inBand);
            }
            if (phaseBadge) {
              phaseBadge.textContent = inBand
                ? `✅ 已同频 ${val}Hz`
                : `⏳ ${val}Hz (目标 ${freqMin}~${freqMax}Hz)`;
              phaseBadge.style.color = inBand ? 'var(--accent-emerald)' : 'var(--accent-amber)';
            }
            if (fb1 && fb1Text) {
              fb1Text.textContent = inBand
                ? `24K 金缮声波已同频 (${val}Hz)，切入汝窑拓印`
                : `拖动滑块调入 ${freqMin}~${freqMax}Hz 谐振带`;
            }
            if (inBand && !notifiedStep1) {
              notifiedStep1 = true;
              playTactileClick('success');
              showFlowToast(`🌊 金缮声波已在 ${val}Hz 达成同频共振`, 'success');
            }
            syncOperationStepper();
          });
        }

        const rubSlider = document.getElementById('immersive-rubbing-slider');
        const rubStatus = document.getElementById('rubbing-status-label');
        const rubGlyphEl = document.getElementById('rubbing-glyph-el');
        const celadonTablet = document.getElementById('celadon-tablet');
        const mossOverlay = document.getElementById('celadon-moss-overlay');
        const fb2 = document.getElementById('inst-feedback-2');
        const fb2Text = document.getElementById('inst-feedback-2-text');

        function applyRubbingValue(val) {
          const clamped = clamp(Math.round(val), 10, 100);
          if (rubSlider) rubSlider.value = String(clamped);
          rubbingCompleted = clamped >= rubbingTarget;
          if (rubGlyphEl) {
            const blurVal = Math.max(0, (rubbingTarget + 5 - clamped) / 14).toFixed(1);
            rubGlyphEl.style.filter = rubbingCompleted ? 'none' : `blur(${blurVal}px)`;
          }
          if (mossOverlay) {
            const mossOpacity = rubbingCompleted ? 0 : Math.max(0.08, ((100 - clamped) / 100) * 0.75);
            mossOverlay.style.opacity = String(mossOpacity.toFixed(2));
          }
          if (celadonTablet) {
            celadonTablet.classList.toggle('is-rubbing-complete', rubbingCompleted);
          }
          if (rubStatus) {
            rubStatus.textContent = rubbingCompleted
              ? `✅ 已显影 ${clamped}%`
              : `⏳ ${clamped}% (目标 ≥${rubbingTarget}%)`;
            rubStatus.style.color = rubbingCompleted ? 'var(--accent-emerald)' : 'var(--accent-amber)';
          }
          if (fb2 && fb2Text) {
            fb2Text.textContent = rubbingCompleted
              ? `螺钿字源【${enc.rubbing_glyph || ''}】已显影，点击下方共鸣收录`
              : `继续擦拭石碑或拖动滑块 (${clamped}% / 目标 ≥${rubbingTarget}%)`;
          }
          if (rubbingCompleted && !notifiedStep2) {
            notifiedStep2 = true;
            playTactileClick('success');
            showFlowToast(`🪨 夜光螺钿字源【${enc.rubbing_glyph || ''}】显影完成`, 'success');
          }
          syncOperationStepper();
        }

        if (rubSlider) {
          rubSlider.addEventListener('input', () => {
            applyRubbingValue(Number(rubSlider.value));
          });
        }

        if (celadonTablet && rubSlider) {
          let isRubbingPointerDown = false;
          celadonTablet.addEventListener('pointerdown', (ev) => {
            isRubbingPointerDown = true;
            if (celadonTablet.setPointerCapture) {
              try { celadonTablet.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
            }
            applyRubbingValue(Number(rubSlider.value) + 12);
          });
          celadonTablet.addEventListener('pointermove', (ev) => {
            if (!isRubbingPointerDown) return;
            const delta = Math.abs(ev.movementX || 0) + Math.abs(ev.movementY || 0);
            if (delta > 2) {
              applyRubbingValue(Number(rubSlider.value) + Math.max(2, delta * 0.35));
            }
          });
          const stopRubbingPointer = () => { isRubbingPointerDown = false; };
          celadonTablet.addEventListener('pointerup', stopRubbingPointer);
          celadonTablet.addEventListener('pointercancel', stopRubbingPointer);
        }
      } else {
        const orbs = Array.isArray(enc.spell_orbs) && enc.spell_orbs.length > 0
          ? enc.spell_orbs
          : ['古い', 'ルーン', 'を', '書か-', '-ない'];
        const requiredOrbs = Math.min(orbs.length, dMeta.minOrbs || 3);
        const fb2 = document.getElementById('inst-feedback-2');
        const fb2Text = document.getElementById('inst-feedback-2-text');

        function activateSpellOrb(orbBtn) {
          if (!orbBtn || orbBtn.classList.contains('is-routed')) return;
          playTactileClick('up');
          orbBtn.classList.add('is-routed');
          const routed = mountEl.querySelectorAll('.spell-orb-btn.is-routed').length;
          orbsRoutedCount = routed;
          const isOrbReady = routed >= requiredOrbs;
          const statusEl = document.getElementById('constellation-status');
          if (statusEl) {
            statusEl.textContent = isOrbReady
              ? `✅ ${routed}/${orbs.length} 已贯通`
              : `⏳ ${routed}/${orbs.length} (需 ≥${requiredOrbs})`;
            statusEl.style.color = isOrbReady ? 'var(--accent-emerald)' : 'var(--accent-amber)';
          }
          if (fb2 && fb2Text) {
            fb2Text.textContent = isOrbReady
              ? `星轨回路已贯通 (${routed}/${orbs.length})，点击下方释放破盾奥义`
              : `已点亮 ${routed}/${requiredOrbs} 颗必需晶球，继续点选其余晶球`;
          }
          if (isOrbReady && !notifiedStep2) {
            notifiedStep2 = true;
            playTactileClick('success');
            showFlowToast(`✨ 六翼玫瑰花窗星轨回路已贯通 (${routed}/${orbs.length})`, 'success');
          }
          syncOperationStepper();
        }

        let isOrbDragging = false;
        mountEl.querySelectorAll('.spell-orb-btn').forEach((orbBtn) => {
          orbBtn.addEventListener('click', () => activateSpellOrb(orbBtn));
          orbBtn.addEventListener('pointerdown', () => {
            isOrbDragging = true;
            activateSpellOrb(orbBtn);
          });
          orbBtn.addEventListener('pointerenter', () => {
            if (isOrbDragging) activateSpellOrb(orbBtn);
          });
        });
        window.addEventListener('pointerup', () => { isOrbDragging = false; }, { passive: true });
      }

      function updateDeductiveStep2Strip(tone, customMsg) {
        const fb2Text = document.getElementById('inst-feedback-2-text');
        if (!fb2Text) return;
        const bothDone = tokenLocked && clueLocked;
        fb2Text.textContent =
          customMsg ||
          (bothDone
            ? '破绽词与法庭物证均已锁定，点击下方发射指控针'
            : `待锁定：${!tokenLocked ? '证词破绽词' : '✅破绽词'} + ${!clueLocked ? '匹配物证卡' : '✅物证卡'}`);
      }

      mountEl.querySelectorAll('[data-page-clue="distractor"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          evidenceErrors += 1;
          clueLocked = false;
          mountEl.querySelectorAll('[data-page-clue="correct"]').forEach((b) => b.classList.remove('is-locked'));
          updateErrorsBadge();
          triggerStageShake();
          updateDeductiveStep2Strip('warn', '⚠️ 干扰物证时间线不符，请改点左侧正确物证');
          syncOperationStepper();
          showFlowToast('⚠️ 证物时间线与案发现场不符，请重选正确物证', 'warn');
        });
      });

      mountEl.querySelectorAll('[data-page-clue="correct"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          playTactileClick('success');
          btn.classList.add('is-locked');
          clueLocked = true;
          updateDeductiveStep2Strip('success');
          syncOperationStepper();
          showFlowToast(
            tokenLocked
              ? '✅ 破绽词与物证均已锁定，可发射指控针'
              : '✅ 已锁定法庭物证，请再点选上方证词破绽词块',
            'success'
          );
        });
      });

      mountEl.querySelectorAll('[data-page-token="distractor"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          grammarErrors += 1;
          tokenLocked = false;
          mountEl.querySelectorAll('[data-page-token="flaw"]').forEach((b) => b.classList.remove('is-locked'));
          updateErrorsBadge();
          triggerStageShake();
          updateDeductiveStep2Strip('warn', '⚠️ 该词语法结构正常，请点选右侧破绽靶点词');
          syncOperationStepper();
          showFlowToast('⚠️ 该词语法结构正常，非破绽靶点', 'warn');
        });
      });

      mountEl.querySelectorAll('[data-page-token="flaw"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          playTactileClick('success');
          btn.classList.add('is-locked');
          tokenLocked = true;
          updateDeductiveStep2Strip('success');
          syncOperationStepper();
          showFlowToast(
            clueLocked
              ? '🎯 证词破绽与关键物证均已锁定，可发射指控针'
              : '🎯 已锁定证词破绽，请继续点选下方匹配物证卡',
            'success'
          );
        });
      });

      mountEl.querySelectorAll('[data-page-tenon="distractor"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          grammarErrors += 1;
          tokenLocked = false;
          mountEl.querySelectorAll('[data-page-tenon="correct"]').forEach((b) => b.classList.remove('is-locked'));
          const mortiseBox = document.getElementById('mortise-stage-box');
          if (mortiseBox) mortiseBox.classList.remove('is-mortise-snapped');
          updateErrorsBadge();
          triggerStageShake();
          const lockStatus = document.getElementById('mortise-lock-status');
          if (lockStatus) {
            lockStatus.textContent = '⚡ 磁极排斥';
            lockStatus.style.color = 'var(--accent-crimson)';
          }
          const fb1Text = document.getElementById('inst-feedback-1-text');
          if (fb1Text) {
            fb1Text.textContent = '⚠️ 干扰词缀磁极排斥，请点选正序果冻卡榫';
          }
          syncOperationStepper();
          showFlowToast('⚡ 榫卯磁极排斥！词干接口无法与干扰词缀咬合', 'warn');
        });
      });

      mountEl.querySelectorAll('[data-page-tenon="correct"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          playTactileClick('success');
          btn.classList.add('is-locked');
          tokenLocked = true;
          const mortiseBox = document.getElementById('mortise-stage-box');
          if (mortiseBox) {
            mortiseBox.classList.remove('is-mortise-snapped');
            void mortiseBox.offsetWidth;
            mortiseBox.classList.add('is-mortise-snapped');
          }
          const lockStatus = document.getElementById('mortise-lock-status');
          if (lockStatus) {
            lockStatus.textContent = '✅ 已咬合锁定';
            lockStatus.style.color = 'var(--accent-emerald)';
          }
          const fb1Text = document.getElementById('inst-feedback-1-text');
          if (fb1Text) {
            fb1Text.textContent = '✅ 果冻卡榫已严丝合缝咬合，自动切入星轨咏唱';
          }
          syncOperationStepper();
          showFlowToast(`✅ 果冻 SSS 卡榫咬合锁定（${formatNaturalKuLabel(grammarKuId)}）`, 'success');
        });
      });

      const pageHintBtn = document.getElementById('page-hint-btn');
      if (pageHintBtn) {
        pageHintBtn.addEventListener('click', () => {
          playTactileClick('down');
          usedCompanionHint = true;
          if (companionSpeechEl) {
            companionSpeechEl.textContent = `“${companionHint}”`;
          }
          if (deskWhisperEl) {
            deskWhisperEl.textContent = `“${companionHint}”`;
          }
          openOpticSheet('companion-sheet', pageHintBtn);
        });
      }

      function goToNextLangChapter() {
        playTactileClick('down');
        const curLangList = getLangEncounters();
        const curPos = curLangList.findIndex((item) => item.originalIdx === safeIdx);
        const nextItem = curLangList[(curPos + 1) % Math.max(1, curLangList.length)] || curLangList[0];
        const nextIdx = nextItem ? nextItem.originalIdx : 0;
        prefs.chapter = nextIdx;
        saveLearningPrefs(prefs);
        runWithViewTransition(() => {
          renderChapterTabs(nextIdx);
          renderActiveChapter(nextIdx);
        });
        showFlowToast(`⏭️ 已进入下一章：${(encounters[nextIdx] && encounters[nextIdx].chapter_title) || ''}`, 'info');
      }

      const pageNextChapterBtn = document.getElementById('page-next-chapter-btn');
      if (pageNextChapterBtn) {
        pageNextChapterBtn.addEventListener('click', goToNextLangChapter);
      }

      const pageSubmitBtn = document.getElementById('page-submit-btn');
      if (pageSubmitBtn) {
        pageSubmitBtn.addEventListener('click', async () => {
          if (isEncounterSubmitting) return;
          if (isEncounterCompleted) {
            goToNextLangChapter();
            return;
          }

          if (themeKey === 'deductive') {
            const zSlider = document.getElementById('zeiss-focus-slider');
            const curFocus = zSlider ? Number(zSlider.value) : 0;
            if (curFocus < zeissTarget) {
              setActivePhase(1);
              evidenceErrors += 1;
              updateErrorsBadge();
              triggerStageShake();
              showFlowToast(`🔬 请先在【① 显微取证】将透镜滑块旋至 ${zeissTarget}% 以上`, 'warn');
              return;
            }
            if (!tokenLocked || !clueLocked) {
              setActivePhase(2);
              triggerStageShake();
              showFlowToast(
                `🎯 请在【② 当庭质证】点选${!tokenLocked ? '证词破绽词' : ''}${!tokenLocked && !clueLocked ? '与' : ''}${!clueLocked ? '正确法庭物证卡' : ''}`,
                'warn'
              );
              return;
            }
          } else if (themeKey === 'immersive') {
            const freqSlider = document.getElementById('immersive-freq-slider');
            const fMin = Math.max(20, (Number(enc.target_freq_min) || 45) - freqBonus);
            const fMax = Math.min(88, (Number(enc.target_freq_max) || 65) + freqBonus);
            if (freqSlider) {
              const curF = Number(freqSlider.value);
              if (curF < fMin || curF > fMax) {
                setActivePhase(1);
                grammarErrors += 1;
                updateErrorsBadge();
                triggerStageShake();
                showFlowToast(`🌊 请先在【① 声波调频】将频率调入 ${fMin}~${fMax}Hz`, 'warn');
                return;
              }
            }
            const rSlider = document.getElementById('immersive-rubbing-slider');
            const curRub = rSlider ? Number(rSlider.value) : 0;
            if (curRub < rubbingTarget) {
              setActivePhase(2);
              evidenceErrors += 1;
              updateErrorsBadge();
              triggerStageShake();
              showFlowToast(`🪨 请在【② 汝窑拓印】擦拭石碑至 ${rubbingTarget}% 以上`, 'warn');
              return;
            }
          } else {
            if (!tokenLocked) {
              setActivePhase(1);
              triggerStageShake();
              showFlowToast('⚙️ 请先在【① 榫卯咬合】点击匹配的果冻卡榫', 'warn');
              return;
            }
            const orbsList = Array.isArray(enc.spell_orbs) && enc.spell_orbs.length > 0 ? enc.spell_orbs : [1, 2, 3, 4, 5];
            const minRequiredOrbs = Math.min(orbsList.length, dMeta.minOrbs || 3);
            if (orbsRoutedCount < minRequiredOrbs) {
              setActivePhase(2);
              evidenceErrors += 1;
              updateErrorsBadge();
              triggerStageShake();
              showFlowToast(`✨ 请在【② 星轨咏唱】点亮至少 ${minRequiredOrbs} 颗语法晶球`, 'warn');
              return;
            }
          }

          isEncounterSubmitting = true;
          playTactileClick('success');
          const durationMs = stopAndGetActiveDurationMs();

          if (themeKey === 'deductive') {
            setActivePhase(2);
            const laserEl = document.getElementById('crimson-laser-beam');
            if (laserEl) {
              laserEl.classList.remove('is-firing');
              void laserEl.offsetWidth;
              laserEl.classList.add('is-firing');
            }
            await new Promise((r) => setTimeout(r, prefersReducedMotion ? 40 : 360));
          } else if (themeKey === 'strategic' && stagePanelEl) {
            stagePanelEl.classList.remove('is-shield-shattered');
            void stagePanelEl.offsetWidth;
            stagePanelEl.classList.add('is-shield-shattered');
          }

          pageSubmitBtn.classList.remove('is-submit-ready');

          const fsrsRecords = await recordDualKuReviewInDB(
            encounterId,
            themeKey,
            durationMs,
            [
              { kuId: grammarKuId, errorCount: grammarErrors, usedCompanionHint },
              { kuId: evidenceKuId, errorCount: evidenceErrors, usedCompanionHint }
            ],
            prefs.difficulty
          );

          const gRec = fsrsRecords[0];
          const eRec = fsrsRecords[1] || gRec;
          if (grammarSdEl) {
            grammarSdEl.textContent = `${gRec.grade} · S'=${gRec.stability}d / D'=${gRec.difficulty}`;
          }
          if (evidenceSdEl) {
            evidenceSdEl.textContent = `${eRec.grade} · S'=${eRec.stability}d / D'=${eRec.difficulty}`;
          }
          if (kuBadgeEl && themeKey === 'strategic') {
            kuBadgeEl.textContent = '💥 守卫护盾已击碎 (0%)';
          }

          await refreshThemeTelemetryFromDB(grammarKuId, evidenceKuId);
          renderChapterTabs(safeIdx);
          const prefix = (bundle && bundle.feedback_prefix) || '✨ 交互完成';

          // Z-03 幻灯片原地推入通关战报卡 (Stage Victory Card)，保持画幅恒定零抖动
          const mod1 = document.getElementById('inst-module-1');
          const mod2 = document.getElementById('inst-module-2');
          if (mod1) {
            mod1.classList.remove('is-slide-active', 'next');
            mod1.classList.add('prev');
            mod1.setAttribute('aria-hidden', 'true');
          }
          if (mod2) {
            mod2.classList.remove('is-slide-active', 'next');
            mod2.classList.add('prev');
            mod2.setAttribute('aria-hidden', 'true');
          }

          isEncounterCompleted = true;
          pageSubmitBtn.textContent = '⏭️ 已通关 · 进入下一章';

          const victoryCard = document.getElementById('stage-victory-card');
          if (victoryCard) {
            victoryCard.innerHTML = `
              <div class="stage-victory-header">
                <div class="stage-victory-title">
                  <span>🏆</span>
                  <span>${escapeHtml(prefix)}</span>
                </div>
                <span class="meta-pill meta-pill-success">
                  评级 ${escapeHtml(gRec.grade)} · ${(durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <div class="stage-victory-metrics">
                <span class="meta-pill meta-pill-accent">🎯 ${escapeHtml(formatNaturalKuLabel(grammarKuId))}：S'=${gRec.stability}d (${gRec.intervalDays}d 后复习)</span>
                <span class="meta-pill">🔬 ${escapeHtml(formatNaturalKuLabel(evidenceKuId))}：S'=${eRec.stability}d</span>
                <span class="meta-pill meta-pill-success">🌊 心流：${escapeHtml(gRec.flowChannel)}</span>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
                <button type="button" class="btn-theme ${themeKey === 'deductive' ? 'btn-deductive' : themeKey === 'immersive' ? 'btn-immersive' : 'btn-strategic'}" id="victory-next-btn" style="width: 100%; min-height: 46px;">
                  <span>⏭️ 进入当前语种下一章</span>
                </button>
              </div>
            `;
            victoryCard.setAttribute('aria-hidden', 'false');
            victoryCard.classList.add('is-visible');
            const vNextBtn = document.getElementById('victory-next-btn');
            if (vNextBtn) {
              vNextBtn.addEventListener('click', goToNextLangChapter);
            }
          }

          showFlowToast(
            `${prefix} [评级 ${gRec.grade} | 稳定度 S'=${gRec.stability}d]`,
            'success'
          );

          setTimeout(() => {
            isEncounterSubmitting = false;
          }, 300);
        });
      }

      syncOperationStepper();
      refreshThemeTelemetryFromDB(grammarKuId, evidenceKuId);
    }

    // 确定初始打开章节：严格限定在当前选定语言 (prefs.lang) 的章节列表内
    const unifiedInit = await getUnifiedProgressState();
    const initProg = (unifiedInit.theme_progress && unifiedInit.theme_progress[themeKey]) || null;
    const initCompletedSet = new Set((initProg && initProg.completed_encounters) || []);
    const langCandidates = getLangEncounters();
    const urlParams = new URLSearchParams(window.location.search);
    let initialChapter = langCandidates[0] ? langCandidates[0].originalIdx : 0;

    if (urlParams.has('chapter')) {
      const requestedIdx = clamp(Number(urlParams.get('chapter')) || 0, 0, Math.max(0, encounters.length - 1));
      const isRequestedInLang = langCandidates.some((item) => item.originalIdx === requestedIdx);
      if (isRequestedInLang) {
        initialChapter = requestedIdx;
      }
    } else {
      const uncompletedMatch = langCandidates.find(({ enc, originalIdx }) => {
        const eId = enc.encounter_id || `${themeKey}_ep01_enc0${originalIdx + 1}`;
        return !initCompletedSet.has(eId);
      });
      if (uncompletedMatch) {
        initialChapter = uncompletedMatch.originalIdx;
      }
    }

    renderChapterTabs(initialChapter);
    renderActiveChapter(initialChapter);
  }

  // =========================================================================
  // 12. 页面层级路由分发入口 (Level 1 / Level 2 / Level 3)
  // =========================================================================
  const pageLevel = document.body ? document.body.getAttribute('data-page-level') : null;
  const themeHub = document.body ? document.body.getAttribute('data-theme-hub') : null;

  if (pageLevel === '1') {
    initLevel1HomePage();
  } else if (pageLevel === '2' && themeHub) {
    initLevel2ThemeHubPage(themeHub);
  } else if (pageLevel === '3') {
    initLevel3LearnPage();
  }
});
