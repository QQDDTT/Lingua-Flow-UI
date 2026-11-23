/* ==========================================================================
   Lingua-Flow 核心引擎：三语种语料、FSRS-5 记忆调度与 WebAudio 声触反馈
   ========================================================================== */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'lingua_flow_optic_v3';

  const LANG_META = {
    en: { code: 'en', name: '英语 · CEFR', badge: 'EN', level: 'B2' },
    ja: { code: 'ja', name: '日语 · JLPT', badge: 'JA', level: 'N2' },
    zh: { code: 'zh', name: '汉语 · HSK 3.0', badge: 'ZH', level: '4级' }
  };

  /* 三大全新主题 (codex / tidal / prism) × 三语种 纯目标语结构化语料 */
  const CORPORA = {
    codex: {
      en: [
        {
          id: 'cdx-en-1',
          targetWord: 'anachronism',
          phonetic: '/əˈnækrənɪzəm/',
          roots: ['ana-', 'chron', '-ism'],
          sidenote: 'chron- : Greek khronos (time) → chronic, chronology, synchronize.',
          testimony: '"At 8:00 PM last night, I saw him checking the time on a smartphone in the square." — Year: 1894.',
          clauses: [
            { text: 'At 8:00 PM last night', isFlaw: false },
            { text: 'checking the time on a smartphone (1894)', isFlaw: true },
            { text: 'in the square', isFlaw: false }
          ]
        },
        {
          id: 'cdx-en-2',
          targetWord: 'counterfeit',
          phonetic: '/ˈkaʊntərfɪt/',
          roots: ['counter-', 'feit'],
          sidenote: 'counter- (against) + Latin facere (to make) → counterfeit, feat, artifact.',
          testimony: '"If the master was still alive today, he will sign this document without hesitation."',
          clauses: [
            { text: 'If the master was... he will sign', isFlaw: true },
            { text: 'still alive today', isFlaw: false },
            { text: 'without hesitation', isFlaw: false }
          ]
        },
        {
          id: 'cdx-en-3',
          targetWord: 'alibi',
          phonetic: '/ˈæl.ə.baɪ/',
          roots: ['ali-', '-ibi'],
          sidenote: 'Latin alius (other) + ibi (there) → elsewhere at the time of an act.',
          testimony: '"I was boarding the midnight express in London while the bell struck twelve in Paris."',
          clauses: [
            { text: 'boarding the midnight express', isFlaw: false },
            { text: 'in London while twelve in Paris', isFlaw: true },
            { text: 'struck twelve', isFlaw: false }
          ]
        }
      ],
      ja: [
        {
          id: 'cdx-ja-1',
          targetWord: '矛盾（むじゅん）',
          phonetic: 'mu-jun [0]',
          roots: ['矛 (む)', '盾 (じゅん)'],
          sidenote: '「～ばかりか」：A だけでなく B も（累加・強調）。',
          testimony: '「雨が降っていたのに、彼のコートはまったく濡れていなかったばかりか、傘もさしていなかった。」',
          clauses: [
            { text: '雨が降っていたのに', isFlaw: false },
            { text: '濡れていなかったばかりか・傘もさしていなかった', isFlaw: true },
            { text: '彼のコート', isFlaw: false }
          ]
        },
        {
          id: 'cdx-ja-2',
          targetWord: '推測（すいそく）',
          phonetic: 'su-i-so-ku [0]',
          roots: ['推 (すい)', '測 (そく)'],
          sidenote: '「～わけではない」：部分否定。「～はずがない」との論理的対比。',
          testimony: '「犯人は鍵を持っていなかったはずなのに、内側から施錠されているわけではないと断言できます。」',
          clauses: [
            { text: '鍵を持っていなかったはずなのに', isFlaw: false },
            { text: '施錠されているわけではないと断言', isFlaw: true },
            { text: '内側から', isFlaw: false }
          ]
        },
        {
          id: 'cdx-ja-3',
          targetWord: '曖昧（あいまい）',
          phonetic: 'a-i-ma-i [0]',
          roots: ['曖 (あい)', '昧 (まい)'],
          sidenote: '「～に違いない」：確信に基づく断定。記憶欠如と矛盾。',
          testimony: '「鍵を閉めた覚えがないにもかかわらず、部屋の中は完璧に片付いていたに違いない。」',
          clauses: [
            { text: '鍵を閉めた覚えがない', isFlaw: false },
            { text: '片付いていたに違いない', isFlaw: true },
            { text: 'にもかかわらず', isFlaw: false }
          ]
        }
      ],
      zh: [
        {
          id: 'cdx-zh-1',
          targetWord: '南辕北辙',
          phonetic: 'nán yuán běi zhé',
          roots: ['辕 (yuán)', '辙 (zhé)'],
          sidenote: '行动方向与既定目标背道而驰，应为“南辕北辙”而非“未雨绸缪”。',
          testimony: '“他分明是想往南边码头逃跑，却偏偏雇了向北疾驰的快马，真可谓未雨绸缪。”',
          clauses: [
            { text: '想往南边码头逃跑', isFlaw: false },
            { text: '真可谓未雨绸缪', isFlaw: true },
            { text: '雇了向北疾驰的快马', isFlaw: false }
          ]
        },
        {
          id: 'cdx-zh-2',
          targetWord: '首当其冲',
          phonetic: 'shǒu dāng qí chōng',
          roots: ['首', '当', '冲 (chōng)'],
          sidenote: '“首当其冲”意为最先承受冲击或灾难，并非避风之所。',
          testimony: '“暴雨将至，钟楼北侧的木窗首当其冲，最先被狂风震碎；因此大家纷纷推举它作为避风港。”',
          clauses: [
            { text: '最先被狂风震碎', isFlaw: false },
            { text: '因此大家纷纷推举它作为避风港', isFlaw: true },
            { text: '暴雨将至', isFlaw: false }
          ]
        },
        {
          id: 'cdx-zh-3',
          targetWord: '炙手可热',
          phonetic: 'zhì shǒu kě rè',
          roots: ['炙 (zhì)', '手', '热'],
          sidenote: '“炙手可热”比喻声势显赫，与“无人问津”构成直接语义冲突。',
          testimony: '“这位隐居深山二十载、无人问津的画师，其画作在坊间可谓炙手可热。”',
          clauses: [
            { text: '隐居深山二十载', isFlaw: false },
            { text: '无人问津却炙手可热', isFlaw: true },
            { text: '其画作在坊间', isFlaw: false }
          ]
        }
      ]
    },

    tidal: {
      en: [
        { id: 'tdl-en-1', word: 'serendipity', phonetic: '/ˌser.ənˈdɪp.ə.ti/', contour: [28, 62, 40, 88, 35], freqs: [293.66, 392.00, 329.63, 493.88, 293.66] },
        { id: 'tdl-en-2', word: 'ephemeral', phonetic: '/ɪˈfem.ər.əl/', contour: [32, 86, 48, 30], freqs: [261.63, 440.00, 349.23, 261.63] },
        { id: 'tdl-en-3', word: 'luminescence', phonetic: '/ˌluː.mɪˈnes.əns/', contour: [40, 35, 84, 38], freqs: [329.63, 293.66, 466.16, 293.66] }
      ],
      ja: [
        { id: 'tdl-ja-1', word: '桜（さくら）', phonetic: 'sa-KU-RA [0]', contour: [26, 78, 80], freqs: [246.94, 369.99, 369.99] },
        { id: 'tdl-ja-2', word: '雨（あめ）', phonetic: 'A-me [1]', contour: [85, 30], freqs: [415.30, 246.94] },
        { id: 'tdl-ja-3', word: '心（こころ）', phonetic: 'ko-KO-ro [2]', contour: [30, 84, 34], freqs: [261.63, 392.00, 277.18] }
      ],
      zh: [
        { id: 'tdl-zh-1', word: '星 辰', phonetic: 'xīng (55) · chén (35)', contour: [82, 82, 48, 84], freqs: [440.00, 440.00, 329.63, 440.00] },
        { id: 'tdl-zh-2', word: '皎 洁', phonetic: 'jiǎo (214) · jié (35)', contour: [45, 22, 76, 48, 82], freqs: [293.66, 220.00, 392.00, 329.63, 440.00] },
        { id: 'tdl-zh-3', word: '静 谧', phonetic: 'jìng (51) · mì (51)', contour: [88, 26, 86, 24], freqs: [466.16, 246.94, 466.16, 246.94] }
      ]
    },

    prism: {
      en: [
        { id: 'prs-en-1', stem: 'The treaty had already been ______ before dawn.', correctId: 'written', options: ['wrote', 'written', 'writing', 'writes'] },
        { id: 'prs-en-2', stem: '______ from the summit, the ancient citadel looks serene.', correctId: 'Seen', options: ['Seeing', 'Seen', 'To see', 'Saw'] },
        { id: 'prs-en-3', stem: 'Seldom ______ such a luminous aurora over the fjord.', correctId: 'have we witnessed', options: ['we have witnessed', 'have we witnessed', 'witnessed we', 'did we witnessed'] }
      ],
      ja: [
        { id: 'prs-ja-1', stem: 'この古文書を一度______みよう。', correctId: '書いて', options: ['書きて', '書いて', '書いで', '書って'] },
        { id: 'prs-ja-2', stem: '雨の中、一時間も______された。', correctId: '待た', options: ['待ち', '待た', '待て', '待と'] },
        { id: 'prs-ja-3', stem: '先生、こちらの資料をご覧に______。', correctId: 'なりましたか', options: ['しましたか', 'なりましたか', 'いたましたか', 'くれましたか'] }
      ],
      zh: [
        { id: 'prs-zh-1', stem: '守护者终于把那道损坏的符文______。', correctId: '修复好了', options: ['修复', '修复好了', '能修复', '没修复'] },
        { id: 'prs-zh-2', stem: '______遇到多大的风雪，圣殿的星轨都不会停转。', correctId: '无论', options: ['尽管', '无论', '既然', '除非'] },
        { id: 'prs-zh-3', stem: '他越是冷静思索，线索就______清晰。', correctId: '越发', options: ['越发', '反而', '何况', '尽管'] }
      ]
    }
  };

  function isPlainObject(val) {
    return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPlainObject(parsed)) {
          return {
            lang: LANG_META[parsed.lang] ? parsed.lang : 'en',
            soundEnabled: parsed.soundEnabled !== false,
            cards: isPlainObject(parsed.cards) ? parsed.cards : {},
            stats: isPlainObject(parsed.stats) ? parsed.stats : { reviewed: 0, correct: 0, streak: 0 }
          };
        }
      }
    } catch (err) {
      console.warn('[LinguaCore] 读取本地状态失败：', err);
    }
    return { lang: 'en', soundEnabled: true, cards: {}, stats: { reviewed: 0, correct: 0, streak: 0 } };
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[LinguaCore] 保存本地状态失败：', err);
    }
  }

  function scheduleFSRS(cardId, rating) {
    const state = loadState();
    const prev = state.cards[cardId] || { s: 1.0, d: 5.0, reps: 0, lastAt: Date.now() };
    const elapsedDays = Math.max(0, (Date.now() - prev.lastAt) / 86400000);
    const r = Math.pow(1 + (19 / 81) * (elapsedDays / Math.max(0.1, prev.s)), -0.5);

    let nextD = prev.d - 0.65 * (rating - 3);
    nextD = Math.min(10.0, Math.max(1.0, Number(nextD.toFixed(2))));

    let nextS;
    if (rating === 1) {
      nextS = Math.max(0.2, prev.s * 0.45);
    } else {
      const mult = rating === 2 ? 1.25 : rating === 3 ? 2.15 : 3.05;
      nextS = Math.min(36500, prev.s * (1 + (mult - 1) * (1.15 - nextD / 14)));
    }
    nextS = Number(nextS.toFixed(2));

    state.cards[cardId] = { s: nextS, d: nextD, r: Number(r.toFixed(3)), reps: prev.reps + 1, lastAt: Date.now() };
    state.stats.reviewed += 1;
    if (rating >= 3) {
      state.stats.correct += 1;
      state.stats.streak += 1;
    } else {
      state.stats.streak = 0;
    }
    saveState(state);
    return state;
  }

  let audioCtx = null;
  function playTone(freq, durationSec, type) {
    const state = loadState();
    if (!state.soundEnabled) return;
    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq || 520, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (durationSec || 0.025));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (durationSec || 0.025));
    } catch (err) {
      console.warn('[LinguaCore] 提示音播放受限：', err);
    }
  }

  function playContour(freqs) {
    if (!Array.isArray(freqs) || !freqs.length) return;
    const state = loadState();
    if (!state.soundEnabled) return;
    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      freqs.forEach(function (f, idx) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.22;
        osc.frequency.setValueAtTime(f, t0);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.08, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.21);
      });
    } catch (err) {
      console.warn('[LinguaCore] 声景播放受限：', err);
    }
  }

  global.LinguaCore = {
    LANG_META: LANG_META,
    CORPORA: CORPORA,
    escapeHtml: escapeHtml,
    loadState: loadState,
    saveState: saveState,
    scheduleFSRS: scheduleFSRS,
    playTone: playTone,
    playContour: playContour
  };
})(window);
