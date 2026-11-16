/* ==========================================================================
   Lingua-Flow 核心引擎：三语种语料、FSRS-5 记忆调度、Z 轴交互调度与声触反馈
   ========================================================================== */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'lingua_flow_optic_v2';

  const LANG_META = {
    en: { code: 'en', name: '英语 · CEFR', badge: 'EN', level: 'B2 上中级' },
    ja: { code: 'ja', name: '日语 · JLPT', badge: 'JA', level: 'N2 进阶' },
    zh: { code: 'zh', name: '汉语 · HSK 3.0', badge: 'ZH', level: '4 级高阶' }
  };

  /* 三大主题 × 三语种 结构化学习语料 */
  const CORPORA = {
    deductive: {
      en: [
        {
          id: 'ded-en-1',
          caseNo: '卷宗 #01-A',
          title: '钟表匠的不在场证明',
          targetWord: 'anachronism',
          phonetic: '/əˈnækrənɪzəm/',
          roots: [
            { part: 'ana-', role: '前缀', meaning: '向后、逆向 (back / against)' },
            { part: 'chron', role: '词根', meaning: '时间 (time, 希腊语 khronos)' },
            { part: '-ism', role: '后缀', meaning: '现象、状态' }
          ],
          testimony: '证人声称：“昨晚八点整，我亲眼看见嫌疑人在广场用智能手机核对时间。”然而案发年份为 1894 年。',
          question: '请用蔡司透镜锁定证词中违背时代逻辑的核心词法或时态破绽：',
          clauses: [
            { id: 'c1', text: '昨晚八点整', isFlaw: false, note: '时间状语本身完整，未与年份直接冲突。' },
            { id: 'c2', text: '用智能手机核对时间（时代错置 anachronism）', isFlaw: true, note: '命中破绽！1894 年不存在智能手机，构成典型时代错置（ana- 逆向 + chron 时间）。' },
            { id: 'c3', text: '案发年份为 1894 年', isFlaw: false, note: '客观背景事实，作为推理锚点使用。' }
          ],
          sidenote: 'Tufte 旁注：英语学术与推理文本中，chron- 衍生出 chronic（慢性的）、chronology（编年史）与 synchronize（同步）。'
        },
        {
          id: 'ded-en-2',
          caseNo: '卷宗 #02-B',
          title: '遗嘱签名的虚拟语气漏洞',
          targetWord: 'counterfeit',
          phonetic: '/ˈkaʊntərfɪt/',
          roots: [
            { part: 'counter-', role: '前缀', meaning: '相对、仿造 (against)' },
            { part: 'feit', role: '词根', meaning: '制作 (拉丁语 facere)' }
          ],
          testimony: '管家辩称：“If the master was still alive today, he will sign this document without hesitation.”',
          question: '指出虚拟语气（Subjunctive Mood）中暴露伪造口供的语法矛盾：',
          clauses: [
            { id: 'c1', text: 'If the master was... he will sign', isFlaw: true, note: '命中破绽！与现在事实相反的虚拟条件句应使用 were 与 would sign，混用真实将来时 will 暴露陈述虚假。' },
            { id: 'c2', text: 'still alive today', isFlaw: false, note: '时间参照点，用于确立非真实前提。' },
            { id: 'c3', text: 'without hesitation', isFlaw: false, note: '修饰语，无语法矛盾。' }
          ],
          sidenote: 'Tufte 旁注：在法务与证词审阅中，反事实虚拟（Counterfactual）时态不一致常暗示陈述者未经历真实情景。'
        }
      ],
      ja: [
        {
          id: 'ded-ja-1',
          caseNo: '調書 #01-A',
          title: '霧の駅の終電証言',
          targetWord: '矛盾（むじゅん）',
          phonetic: 'mu-jun [0]',
          roots: [
            { part: '矛 (む)', role: '前字', meaning: '刺穿一切的长矛' },
            { part: '盾 (じゅん)', role: '后字', meaning: '抵挡一切的坚盾' }
          ],
          testimony: '目撃者の供述：「雨が降っていたのに、彼のコートはまったく濡れていなかったばかりか、傘もさしていなかった。」',
          question: '找出助词接续「ばかりか」在逻辑推演中揭示的异常点：',
          clauses: [
            { id: 'c1', text: '雨が降っていたのに', isFlaw: false, note: '逆接前提「のに」交代了雨夜背景。' },
            { id: 'c2', text: '濡れていなかったばかりか（不仅没湿，甚至没打伞）', isFlaw: true, note: '命中破绽！雨中既未打伞衣服又完全干燥，说明嫌疑人当时根本不在户外。' },
            { id: 'c3', text: '目撃者の供述', isFlaw: false, note: '案卷引述标记。' }
          ],
          sidenote: 'Tufte 旁注：N2 核心句型「～ばかりか」表示递进累加（不仅……而且……），常用于强化两个同时成立的反常事实。'
        },
        {
          id: 'ded-ja-2',
          caseNo: '調書 #02-B',
          title: '古書店の暗号メモ',
          targetWord: '推測（すいそく）',
          phonetic: 'su-i-so-ku [0]',
          roots: [
            { part: '推 (すい)', role: '动词根', meaning: '推演、推敲' },
            { part: '測 (そく)', role: '动词根', meaning: '度量、测算' }
          ],
          testimony: '店主：「犯人は鍵を持っていなかったはずなのに、内側から施錠されているわけではないと断言できます。」',
          question: '锁定传闻/推测助动词「はず」与否定表达的逻辑冲突：',
          clauses: [
            { id: 'c1', text: '鍵を持っていなかったはずなのに', isFlaw: false, note: '「はず」表达基于客观依据的合理推断。' },
            { id: 'c2', text: '施錠されているわけではないと断言', isFlaw: true, note: '命中破绽！「～わけではない」意为“并非如此”，与后文“断言密室成立”语义自相矛盾。' },
            { id: 'c3', text: '内側から', isFlaw: false, note: '空间方位状语。' }
          ],
          sidenote: 'Tufte 旁注：区分「～はずがない（绝不可能）」与「～わけではない（并非如此）」是日语逻辑阅读的关键分水岭。'
        }
      ],
      zh: [
        {
          id: 'ded-zh-1',
          caseNo: '案卷 #01-A',
          title: '古宅密室的刻痕证词',
          targetWord: '南辕北辙',
          phonetic: 'nán yuán běi zhé',
          roots: [
            { part: '辕 (yuán)', role: '名词素', meaning: '古代车前驾牲畜的直木，代指行进方向' },
            { part: '辙 (zhé)', role: '名词素', meaning: '车轮压出的痕迹' }
          ],
          testimony: '证人笔录：“他分明是想往南边码头逃跑，却偏偏雇了向北疾驰的快马，真可谓未雨绸缪。”',
          question: '请用显微透镜指出证词中成语误用导致的逻辑破绽：',
          clauses: [
            { id: 'c1', text: '想往南边码头逃跑', isFlaw: false, note: '陈述目标方向。' },
            { id: 'c2', text: '真可谓未雨绸缪（应为“南辕北辙”）', isFlaw: true, note: '命中破绽！行动与目的完全背道而驰应为“南辕北辙”，误用褒义词“未雨绸缪”暴露证人刻意美化。' },
            { id: 'c3', text: '雇了向北疾驰的快马', isFlaw: false, note: '客观行为描述。' }
          ],
          sidenote: 'Tufte 旁注：HSK 4 级以上成语习得需紧扣“语素本义 + 褒贬感情色彩”，避免望文生义。'
        },
        {
          id: 'ded-zh-2',
          caseNo: '案卷 #02-B',
          title: '钟楼信件的时间倒错',
          targetWord: '首当其冲',
          phonetic: 'shǒu dāng qí chōng',
          roots: [
            { part: '首', role: '副词素', meaning: '最先、首先' },
            { part: '冲 (chōng)', role: '名词素', meaning: '要冲、交通要道或攻击锋芒' }
          ],
          testimony: '管家记录：“暴雨将至，钟楼北侧的木窗首当其冲，最先被狂风震碎；因此大家纷纷推举它作为避风港。”',
          question: '锁定因误解“首当其冲”词义而产生的推理矛盾：',
          clauses: [
            { id: 'c1', text: '最先被狂风震碎', isFlaw: false, note: '准确体现了“最先遭受冲击”的语义。' },
            { id: 'c2', text: '因此大家纷纷推举它作为避风港', isFlaw: true, note: '命中破绽！“首当其冲”指最先承受灾难或冲击，既已震碎便绝不可能成为避风港。' },
            { id: 'c3', text: '暴雨将至', isFlaw: false, note: '环境时间状语。' }
          ],
          sidenote: 'Tufte 旁注：“首当其冲”并非“冲在最前面带头”，而是“最先面对迎面而来的冲击”。'
        }
      ]
    },

    immersive: {
      en: [
        {
          id: 'imm-en-1',
          chapter: '星域 I · 潮汐重音',
          word: 'serendipity',
          phonetic: '/ˌser.ənˈdɪp.ə.ti/',
          meaning: '意外发现珍奇事物的机缘',
          contour: [28, 62, 40, 88, 35],
          freqs: [293.66, 392.00, 329.63, 493.88, 293.66],
          rubbing: '源自锡兰（Serendip）古老传说：三位王子总能凭敏锐洞察力在旅途中意外邂逅善意。'
        },
        {
          id: 'imm-en-2',
          chapter: '星域 II · 极光共振',
          word: 'ephemeral',
          phonetic: '/ɪˈfem.ər.əl/',
          meaning: '朝生暮死的、转瞬即逝的澄明',
          contour: [32, 86, 48, 30],
          freqs: [261.63, 440.00, 349.23, 261.63],
          rubbing: '希腊语 epi（在……之上）+ hemera（一日）：如星尘掠过大气层的微光，正因短暂而值得铭记。'
        },
        {
          id: 'imm-en-3',
          chapter: '星域 III · 静默星环',
          word: 'luminescence',
          phonetic: '/ˌluː.mɪˈnes.əns/',
          meaning: '不借炽热而自行散发的冷光',
          contour: [40, 35, 84, 38],
          freqs: [329.63, 293.66, 466.16, 293.66],
          rubbing: '拉丁语 lumen（光）与 -escence（渐起的状态）：深海与星云在零重压力下悄然点亮的微光。'
        }
      ],
      ja: [
        {
          id: 'imm-ja-1',
          chapter: '星域 I · 高低音调 [0] 平板型',
          word: '桜（さくら）',
          phonetic: 'sa-KU-RA (L-H-H)',
          meaning: '春风中盛放的樱花（高低音调：低→高→高）',
          contour: [26, 78, 80],
          freqs: [246.94, 369.99, 369.99],
          rubbing: '日语平板型（0型）音调特征：第一拍低起，第二拍跃升并平稳延续至词尾，如微风拂过水面。'
        },
        {
          id: 'imm-ja-2',
          chapter: '星域 II · 起伏音调 [1] 头高型',
          word: '雨（あめ）',
          phonetic: 'A-me (H-L)',
          meaning: '自天际落下的细雨（区别于平板型“饴”）',
          contour: [85, 30],
          freqs: [415.30, 246.94],
          rubbing: '头高型（1型）：首拍如雨滴落下般高扬清脆，随即自然降落；同音词“飴（あめ）”则为低→高。'
        },
        {
          id: 'imm-ja-3',
          chapter: '星域 III · 中高音调 [2] 中高型',
          word: '心（こころ）',
          phonetic: 'ko-KO-ro (L-H-L)',
          meaning: '宁静共情的内心（低→高→低弧线）',
          contour: [30, 84, 34],
          freqs: [261.63, 392.00, 277.18],
          rubbing: '中高型（2型）：中央音拍如金缮修补的弧线般隆起，随后温柔收敛归于寂静。'
        }
      ],
      zh: [
        {
          id: 'imm-zh-1',
          chapter: '星域 I · 阴平与阳平（55 → 35）',
          word: '星 辰',
          phonetic: 'xīng (55) · chén (35)',
          meaning: '高平稳恒与清亮上扬的声调共鸣',
          contour: [82, 82, 48, 84],
          freqs: [440.00, 440.00, 329.63, 440.00],
          rubbing: '第一声（阴平 55）如水平星轨般高平稳定；第二声（阳平 35）自中音区清朗扬起。'
        },
        {
          id: 'imm-zh-2',
          chapter: '星域 II · 上声折调（214）',
          word: '皎 洁',
          phonetic: 'jiǎo (214) · jié (35)',
          meaning: '月光般先沉后扬的柔润曲折调',
          contour: [45, 22, 76, 48, 82],
          freqs: [293.66, 220.00, 392.00, 329.63, 440.00],
          rubbing: '第三声（上声 214）在语流中先温和沉入低谷，再缓缓托起，赋予汉语音律独特的呼吸感。'
        },
        {
          id: 'imm-zh-3',
          chapter: '星域 III · 去声坠落（51）',
          word: '静 谧',
          phonetic: 'jìng (51) · mì (51)',
          meaning: '由高处干脆落定的双去声韵律',
          contour: [88, 26, 86, 24],
          freqs: [466.16, 246.94, 466.16, 246.94],
          rubbing: '第四声（去声 51）自五度制最高点果断降落，如金缮落笔般干净利落。'
        }
      ]
    },

    strategic: {
      en: [
        {
          id: 'str-en-1',
          rank: '试炼 I · 屈折词尾卡榫',
          prompt: '将动词【write】拼装为过去完成时被动语态的核心分词卡榫：',
          stem: 'The treaty had already been ______ before dawn.',
          correctId: 'written',
          options: [
            { id: 'wrote', label: 'wrote', tag: '过去式', angle: -18 },
            { id: 'written', label: 'written', tag: '过去分词', angle: -6 },
            { id: 'writing', label: 'writing', tag: '现在分词', angle: 6 },
            { id: 'writes', label: 'writes', tag: '三单现在', angle: 18 }
          ],
          hint: 'had been + 过去分词（Past Participle）构成过去完成时被动结构。'
        },
        {
          id: 'str-en-2',
          rank: '试炼 II · 非谓语逻辑主语',
          prompt: '为圣殿铭文选择正确的分词卡榫，避免悬垂修饰：',
          stem: '______ from the summit, the ancient citadel looks serene.',
          correctId: 'Seen',
          options: [
            { id: 'Seeing', label: 'Seeing', tag: '主动分词', angle: -18 },
            { id: 'Seen', label: 'Seen', tag: '被动分词', angle: -6 },
            { id: 'To see', label: 'To see', tag: '不定式', angle: 6 },
            { id: 'Saw', label: 'Saw', tag: '过去式', angle: 18 }
          ],
          hint: '主句主语 the ancient citadel 是“被从山顶俯瞰”，故用过去分词 Seen。'
        }
      ],
      ja: [
        {
          id: 'str-ja-1',
          rank: '試練 I · 五段動詞「て形」榫卯',
          prompt: '将五段动词「書く（か・く）」音便拼装为「～てみる」接续卡榫：',
          stem: 'この古文書を一度______みよう。',
          correctId: '書いて',
          options: [
            { id: '書きて', label: '書きて', tag: '未音便', angle: -18 },
            { id: '書いて', label: '書いて', tag: 'イ音便', angle: -6 },
            { id: '書いで', label: '書いで', tag: '浊音误用', angle: 6 },
            { id: '書って', label: '書って', tag: '促音误用', angle: 18 }
          ],
          hint: 'く结尾五段动词接て时发生イ音便（く → いて），ぐ结尾才浊化为いで。'
        },
        {
          id: 'str-ja-2',
          rank: '試練 II · 被役態（使役被动）破盾',
          prompt: '将动词「待つ（ま・つ）」转为“被迫等待”的使役被动卡榫：',
          stem: '雨の中、一時間も______された。',
          correctId: '待た',
          options: [
            { id: '待ち', label: '待ち', tag: '连用形', angle: -18 },
            { id: '待た', label: '待た', tag: '未然形', angle: -6 },
            { id: '待て', label: '待て', tag: '假定形', angle: 6 },
            { id: '待と', label: '待と', tag: '意志形', angle: 18 }
          ],
          hint: '五段动词使役被动：未然形（待つ → 待た）+ される（待たされる）。'
        }
      ],
      zh: [
        {
          id: 'str-zh-1',
          rank: '试炼 I · “把”字句结果补语榫卯',
          prompt: '选择唯一符合“把”字句语法约束（必须带后续结果/处置成分）的卡榫：',
          stem: '守护者终于把那道损坏的符文______。',
          correctId: '修复好了',
          options: [
            { id: '修复', label: '修复', tag: '光杆动词', angle: -18 },
            { id: '修复好了', label: '修复好了', tag: '动结补语', angle: -6 },
            { id: '能修复', label: '能修复', tag: '能愿前置', angle: 6 },
            { id: '没修复', label: '没修复', tag: '否定错位', angle: 18 }
          ],
          hint: '“把”字句谓语不能是光杆单动词，必须带有结果补语、动态助词“了”等处置结果成分。'
        },
        {
          id: 'str-zh-2',
          rank: '试炼 II · 复句关联词破盾',
          prompt: '匹配表示“无条件全称让步”的关联词卡榫：',
          stem: '______遇到多大的风雪，圣殿的星轨都不会停转。',
          correctId: '无论',
          options: [
            { id: '尽管', label: '尽管', tag: '已然让步', angle: -18 },
            { id: '无论', label: '无论', tag: '无条件', angle: -6 },
            { id: '既然', label: '既然', tag: '既定因果', angle: 6 },
            { id: '除非', label: '除非', tag: '唯一条件', angle: 18 }
          ],
          hint: '后文出现“多大的……都……”，需与“无论 / 不管”构成无条件周遍关联框架。'
        }
      ]
    }
  };

  /* 读取与保存全局状态 */
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
            soundEnabled: Boolean(parsed.soundEnabled),
            cards: isPlainObject(parsed.cards) ? parsed.cards : {},
            stats: isPlainObject(parsed.stats) ? parsed.stats : { reviewed: 0, correct: 0, streak: 0 }
          };
        }
      }
    } catch (err) {
      console.warn('[LinguaCore] 读取本地记忆状态失败，已回退默认状态：', err);
    }
    return {
      lang: 'en',
      soundEnabled: true,
      cards: {},
      stats: { reviewed: 0, correct: 0, streak: 0 }
    };
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[LinguaCore] 保存本地记忆状态失败：', err);
    }
  }

  /* FSRS-5 简明确定性记忆调度器 (防 NaN / 时钟回拨保护) */
  function scheduleFSRS(cardId, rating) {
    const state = loadState();
    const prev = state.cards[cardId] || { s: 1.0, d: 5.0, reps: 0, lastAt: Date.now() };
    const elapsedDays = Math.max(0, (Date.now() - prev.lastAt) / 86400000);
    const r = Math.pow(1 + (19 / 81) * (elapsedDays / Math.max(0.1, prev.s)), -0.5);

    // rating: 1=Again, 2=Hard, 3=Good, 4=Easy
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

    state.cards[cardId] = {
      s: nextS,
      d: nextD,
      r: Number(r.toFixed(3)),
      reps: prev.reps + 1,
      lastAt: Date.now()
    };
    state.stats.reviewed += 1;
    if (rating >= 3) {
      state.stats.correct += 1;
      state.stats.streak += 1;
    } else {
      state.stats.streak = 0;
    }
    saveState(state);
    return { card: state.cards[cardId], stats: state.stats };
  }

  /* WebAudio 声触微交互 (未交互前静音，延迟 <= 25ms) */
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
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (durationSec || 0.022));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (durationSec || 0.022));
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
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.20);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.21);
      });
    } catch (err) {
      console.warn('[LinguaCore] 声景轮廓音播放受限：', err);
    }
  }

  /* Z-02 智能避让下拉菜单控制器 (全局互斥 + 边界翻转 + 8px 间隙) */
  function initDropdowns() {
    const wraps = document.querySelectorAll('[data-dropdown]');
    function closeAll() {
      wraps.forEach(function (w) {
        const menu = w.querySelector('.optic-dropdown-menu');
        const btn = w.querySelector('[data-dropdown-trigger]');
        if (menu) {
          menu.classList.remove('open', 'flip-up', 'flip-left');
        }
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }

    wraps.forEach(function (wrap) {
      const trigger = wrap.querySelector('[data-dropdown-trigger]');
      const menu = wrap.querySelector('.optic-dropdown-menu');
      if (!trigger || !menu) return;

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        closeAll();
        if (!isOpen) {
          const rect = trigger.getBoundingClientRect();
          if (global.innerHeight - rect.bottom < 220) menu.classList.add('flip-up');
          if (rect.right < 220) menu.classList.add('flip-left');
          menu.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
          playTone(540, 0.018, 'sine');
        }
      });
    });

    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  /* Z-01 用户唤醒侧边抽屉控制器 */
  function initDrawers() {
    const scrim = document.getElementById('optic-scrim');
    const triggers = document.querySelectorAll('[data-drawer-open]');
    const closers = document.querySelectorAll('[data-drawer-close]');

    function closeDrawers() {
      document.querySelectorAll('.optic-drawer.open').forEach(function (d) {
        d.classList.remove('open');
        d.setAttribute('aria-hidden', 'true');
      });
      if (scrim) scrim.classList.remove('open');
    }

    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.getAttribute('data-drawer-open');
        const drawer = document.getElementById(targetId);
        if (!drawer) return;
        closeDrawers();
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        if (scrim) scrim.classList.add('open');
        playTone(460, 0.02, 'sine');
      });
    });

    closers.forEach(function (btn) {
      btn.addEventListener('click', closeDrawers);
    });
    if (scrim) scrim.addEventListener('click', closeDrawers);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawers();
    });
  }

  global.LinguaCore = {
    LANG_META: LANG_META,
    CORPORA: CORPORA,
    escapeHtml: escapeHtml,
    loadState: loadState,
    saveState: saveState,
    scheduleFSRS: scheduleFSRS,
    playTone: playTone,
    playContour: playContour,
    initDropdowns: initDropdowns,
    initDrawers: initDrawers
  };
})(window);
