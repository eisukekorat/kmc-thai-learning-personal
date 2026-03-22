// =============================================
// KMC Thai Learning App - app.js
// Application logic
// =============================================

// ================================
// AUDIO: OpenAI TTS（フォールバック: Web Speech API）
// ================================
const ttsCache = new Map(); // メモリキャッシュ（同じ単語を何度も呼ばない）

async function playAudioTTS(text) {
  if (!text || text === '–' || text.includes('🎉')) return;

  const openaiKey = getOpenAIKey();

  // OpenAI TTS が使える場合
  if (openaiKey) {
    try {
      if (ttsCache.has(text)) {
        const url = ttsCache.get(text);
        new Audio(url).play();
        return;
      }
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + openaiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'nova',
          speed: speechRate
        })
      });
      if (!res.ok) throw new Error('TTS API error: ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      ttsCache.set(text, url);
      new Audio(url).play();
      return;
    } catch (e) {
      console.warn('OpenAI TTS失敗、Web Speech APIにフォールバック:', e);
    }
  }

  // フォールバック: Web Speech API
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }
}

function playAudio(type) {
  const text = type === 'phrase' ?
    document.getElementById('phraseThai').textContent :
    document.getElementById('fcThai').textContent;
  playAudioTTS(text);
}

// ================================
// CLAUDE: 覚え方ヒント生成
// ================================
async function fetchClaudeTip(word) {
  const key = getClaudeKey();
  const tipArea = document.getElementById('claudeTipArea');
  const tipText = document.getElementById('claudeTipText');
  if (!key || !tipArea || !tipText) return;

  tipArea.style.display = 'block';
  tipText.textContent = '考え中...';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `タイ語単語「${word.thai}」（読み：${word.romaji}、意味：${word.jp}）の覚え方を日本語で教えてください。以下を簡潔に（合計5行以内）：\n・発音・語感のコツ（日本語の音に近いものがあれば）\n・語呂合わせや記憶の引っかかり\n・製造業・職場での短い例文（タイ語と日本語訳）`
        }]
      })
    });
    if (!res.ok) throw new Error('Claude API error: ' + res.status);
    const data = await res.json();
    tipText.textContent = data.content[0].text;
  } catch (e) {
    tipText.textContent = '⚠️ ヒントの取得に失敗しました（APIキーを設定画面で確認してください）';
    console.error('Claude tip error:', e);
  }
}

// ================================
// SETTINGS: AUTO PLAY & SPEECH RATE
// ================================
let autoPlayAudio = localStorage.getItem('autoPlayAudio') === 'true';
let speechRate = parseFloat(localStorage.getItem('speechRate') || '0.8');

function setSpeechRate(rate, btn) {
  speechRate = rate;
  localStorage.setItem('speechRate', rate);
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleAutoPlay(val) {
  autoPlayAudio = val;
  localStorage.setItem('autoPlayAudio', val);
}

// ================================
// API KEY MANAGEMENT
// ================================
function saveApiKey(type) {
  const inputId = type === 'openai' ? 'openaiKeyInput' : 'claudeKeyInput';
  const statusId = type === 'openai' ? 'openaiKeyStatus' : 'claudeKeyStatus';
  const storageKey = type === 'openai' ? 'openaiApiKey' : 'claudeApiKey';
  const val = document.getElementById(inputId).value.trim();
  if (!val) {
    document.getElementById(statusId).textContent = '⚠️ キーを入力してください';
    return;
  }
  localStorage.setItem(storageKey, val);
  document.getElementById(statusId).textContent = '✅ 保存しました';
  document.getElementById(inputId).value = '●'.repeat(Math.min(val.length, 20));
  setTimeout(() => { document.getElementById(statusId).textContent = ''; }, 3000);
}

function loadApiKeyStatus() {
  const openaiKey = localStorage.getItem('openaiApiKey');
  const claudeKey = localStorage.getItem('claudeApiKey');
  const openaiStatus = document.getElementById('openaiKeyStatus');
  const claudeStatus = document.getElementById('claudeKeyStatus');
  if (openaiStatus) openaiStatus.textContent = openaiKey ? '✅ 設定済み' : '未設定';
  if (claudeStatus) claudeStatus.textContent = claudeKey ? '✅ 設定済み' : '未設定';
}

let apiKeysVisible = false;
function showApiKeys() {
  apiKeysVisible = !apiKeysVisible;
  const openaiKey = localStorage.getItem('openaiApiKey') || '';
  const claudeKey = localStorage.getItem('claudeApiKey') || '';
  const openaiInput = document.getElementById('openaiKeyInput');
  const claudeInput = document.getElementById('claudeKeyInput');
  if (openaiInput) {
    openaiInput.type = apiKeysVisible ? 'text' : 'password';
    openaiInput.value = apiKeysVisible ? openaiKey : (openaiKey ? '●'.repeat(Math.min(openaiKey.length, 20)) : '');
  }
  if (claudeInput) {
    claudeInput.type = apiKeysVisible ? 'text' : 'password';
    claudeInput.value = apiKeysVisible ? claudeKey : (claudeKey ? '●'.repeat(Math.min(claudeKey.length, 20)) : '');
  }
}

function clearApiKeys() {
  if (!confirm('APIキーを全て削除しますか？')) return;
  localStorage.removeItem('openaiApiKey');
  localStorage.removeItem('claudeApiKey');
  const openaiInput = document.getElementById('openaiKeyInput');
  const claudeInput = document.getElementById('claudeKeyInput');
  if (openaiInput) openaiInput.value = '';
  if (claudeInput) claudeInput.value = '';
  loadApiKeyStatus();
}

// Helper: get saved API keys (for use in other modules)
function getOpenAIKey() { return localStorage.getItem('openaiApiKey') || ''; }
function getClaudeKey() { return localStorage.getItem('claudeApiKey') || ''; }

// Init settings UI on load
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('autoPlayToggle');
  if (toggle) toggle.checked = autoPlayAudio;
  // Init speed buttons
  const rateMap = { 0.5: 0, 0.8: 1, 1.0: 2 };
  const btns = document.querySelectorAll('.speed-btn');
  btns.forEach(b => b.classList.remove('active'));
  const idx = rateMap[speechRate] ?? 1;
  if (btns[idx]) btns[idx].classList.add('active');
  // Init filter buttons
  document.querySelectorAll('.freq-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + freqFilter + "'")) b.classList.add('active');
  });
  document.querySelectorAll('.scene-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + sceneFilter + "'")) b.classList.add('active');
  });
  // Init API key status
  loadApiKeyStatus();
});

// ================================
// PROGRESS TRACKING
// ================================
function loadProgress() {
  const saved = localStorage.getItem('thaiLearningProgress');
  if (saved) return JSON.parse(saved);
  return { vocabLearned: {}, phrasesLearned: {}, grammarLearned: {} };
}

function saveProgress() {
  localStorage.setItem('thaiLearningProgress', JSON.stringify(progress));
  updateProgressDisplay();
}

let progress = loadProgress();

// 苦手単語
let weakWords = JSON.parse(localStorage.getItem('weakWords') || '{}');
function saveWeakWords() { localStorage.setItem('weakWords', JSON.stringify(weakWords)); }

// 文法クイズスコア
let grammarQuizScores = JSON.parse(localStorage.getItem('grammarQuizScores') || '{}');
function saveGrammarQuizScores() { localStorage.setItem('grammarQuizScores', JSON.stringify(grammarQuizScores)); }

function updateProgressDisplay() {
  const vocabCount = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length;
  const phraseCount = Object.keys(progress.phrasesLearned).filter(k => progress.phrasesLearned[k]).length;
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;

  document.getElementById('homeVocabProg').textContent = vocabCount + '/200';
  document.getElementById('homePhraseProg').textContent = phraseCount + '/200';
  document.getElementById('homeGrammarProg').textContent = grammarCount + '/20';
}

// ---- Tabs ----
function switchTab(tab, fromCode) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  if (!fromCode && event && event.target) {
    event.target.classList.add('active');
  } else {
    // コードから呼ばれた場合、対応するタブボタンをアクティブに
    document.querySelectorAll('.tab').forEach(t => {
      if (t.getAttribute('onclick') && t.getAttribute('onclick').includes("'" + tab + "'")) {
        t.classList.add('active');
      }
    });
  }
  if (tab === 'home') renderHomeScreen();
}

function updateProgress() {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  if (!progressBar || !progressText) return;
  const items = document.querySelectorAll('.check-item');
  if (items.length === 0) return;
  const done = document.querySelectorAll('.check-item.done').length;
  const pct = Math.round((done / items.length) * 100);
  progressBar.style.width = pct + '%';
  progressText.textContent = done + ' / ' + items.length;
}

// ---- Streak ----
(function() {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem('lastAccessDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0', 10);
  if (last === today) {
    // 同じ日 → 変更なし
  } else if (last) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (last === yesterdayStr) {
      streak += 1;
    } else {
      streak = 1;
    }
  } else {
    streak = 1;
  }
  localStorage.setItem('lastAccessDate', today);
  localStorage.setItem('streakCount', String(streak));
  document.getElementById('streakCount').textContent = String(streak);
})();

// ---- Phrases ----
let currentPhraseCategory = 'meeting';
let currentPhrases = [];
let phraseIndex = 0;
let phraseMode = 'learn';

function setPhraseMode(mode) {
  phraseMode = mode;
  const btns = document.querySelectorAll('#phrases .mode-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  if (mode === 'learn') {
    document.getElementById('phraseButtons').innerHTML = `
      <button class="fc-btn skip" onclick="prevPhrase()">← 前</button>
      <button class="fc-btn again" onclick="markPhrase(false)">もう一度</button>
      <button class="fc-btn good" onclick="markPhrase(true)">覚えた ✓</button>
      <button class="fc-btn skip" onclick="nextPhrase()">次 →</button>
    `;
  } else {
    document.getElementById('phraseButtons').innerHTML = `
      <button class="fc-btn skip" onclick="prevPhrase()">← 前</button>
      <button class="fc-btn skip" onclick="nextPhrase()">次 →</button>
    `;
  }

  currentPhrases = getPhraseList();
  phraseIndex = 0;
  showPhrase();
}

function setPhraseCategory(cat, btn) {
  currentPhraseCategory = cat;
  document.querySelectorAll('#phrases .cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPhrases = getPhraseList();
  phraseIndex = 0;
  showPhrase();
}

function getPhraseList() {
  const allPhrases = phrasesData[currentPhraseCategory].slice(0, 50); // 最初の50個のみ
  if (phraseMode === 'learn') {
    return allPhrases.filter((p, i) => !progress.phrasesLearned[currentPhraseCategory + '_' + i]);
  }
  return allPhrases;
}

function showPhrase() {
  if (currentPhrases.length === 0) {
    document.getElementById('phraseThai').textContent = '🎉 全て学習済み！';
    document.getElementById('phraseRomaji').textContent = 'おつかれさまでした';
    document.getElementById('phraseJP').textContent = '復習モードで見直せます';
    document.getElementById('phraseCounter').textContent = '完了';
    return;
  }

  const p = currentPhrases[phraseIndex];
  document.getElementById('phraseThai').textContent = p.thai;
  document.getElementById('phraseRomaji').textContent = p.romaji;
  document.getElementById('phraseJP').textContent = p.jp;
  document.getElementById('phraseCounter').textContent = (phraseIndex + 1) + ' / ' + currentPhrases.length;
}

function nextPhrase() {
  phraseIndex = (phraseIndex + 1) % currentPhrases.length;
  showPhrase();
}

function prevPhrase() {
  phraseIndex = (phraseIndex - 1 + currentPhrases.length) % currentPhrases.length;
  showPhrase();
}

function markPhrase(learned) {
  const p = currentPhrases[phraseIndex];
  const allPhrases = phrasesData[currentPhraseCategory].slice(0, 50);
  const realIndex = allPhrases.indexOf(p);
  progress.phrasesLearned[currentPhraseCategory + '_' + realIndex] = learned;
  saveProgress();

  if (learned && phraseMode === 'learn') {
    currentPhrases = getPhraseList();
    if (phraseIndex >= currentPhrases.length) phraseIndex = 0;
  }
  showPhrase();
}

// ---- Vocab ----
let currentCategory = 'work';
let currentCards = [];
let cardIndex = 0;
let revealed = false;
let vocabMode = 'learn';
let freqFilter = localStorage.getItem('vocabFreqFilter') || 'all';
let sceneFilter = localStorage.getItem('vocabSceneFilter') || 'all';

function setVocabMode(mode) {
  vocabMode = mode;
  const btns = document.querySelectorAll('#vocab .mode-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  startCards();
}

function setCategory(cat, btn) {
  currentCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  startCards();
}

function getVocabList() {
  let allVocab = vocabData[currentCategory].slice(0, 50);
  // 苦手フィルター
  if (freqFilter === 'weak') {
    const allV = vocabData[currentCategory].slice(0, 50);
    allVocab = allVocab.filter(v => {
      const idx = allV.indexOf(v);
      return weakWords[currentCategory + '_' + idx];
    });
  } else if (freqFilter !== 'all') {
    allVocab = allVocab.filter(v => v.frequency === freqFilter);
  }
  // シーンフィルター
  if (sceneFilter !== 'all') {
    allVocab = allVocab.filter(v => v.scenes && v.scenes.includes(sceneFilter));
  }
  if (vocabMode === 'learn') {
    return allVocab.filter((v) => {
      const origIdx = vocabData[currentCategory].slice(0, 50).indexOf(v);
      return !progress.vocabLearned[currentCategory + '_' + origIdx];
    });
  }
  return allVocab;
}

function setFreqFilter(val, btn) {
  freqFilter = val;
  localStorage.setItem('vocabFreqFilter', val);
  document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  startCards();
}

function setSceneFilter(val, btn) {
  sceneFilter = val;
  localStorage.setItem('vocabSceneFilter', val);
  document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  startCards();
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function startCards() {
  const list = getVocabList();
  currentCards = (vocabMode === 'learn' || vocabMode === 'quiz') ? shuffle(list) : list;
  cardIndex = 0;
  revealed = false;
  document.getElementById('fcButtons').style.display = 'none';
  document.getElementById('fcNext').style.display = 'none';

  // クイズモードの切り替え
  const flashcard = document.getElementById('flashcard');
  const quizArea = document.getElementById('quizArea');
  if (vocabMode === 'quiz') {
    flashcard.style.display = 'none';
    document.getElementById('tapHint').style.display = 'none';
    quizArea.style.display = 'flex';
    quizCorrect = 0;
    quizTotal = 0;
    document.getElementById('quizScoreArea').style.display = 'none';
    document.getElementById('quizNextBtn').style.display = 'none';
    showQuizCard();
  } else {
    flashcard.style.display = '';
    quizArea.style.display = 'none';
    showCard();
  }
}

function showCard() {
  if (currentCards.length === 0 || cardIndex >= currentCards.length) {
    document.getElementById('fcThai').textContent = '🎉 完了！';
    document.getElementById('fcRomaji').textContent = vocabMode === 'learn' ? '全て学習済み' : 'おつかれさまでした';
    document.getElementById('fcMeaning').textContent = '';
    document.getElementById('fcMeaning').classList.remove('show');
    document.getElementById('fcExample').textContent = '';
    document.getElementById('fcExample').classList.remove('show');
    document.getElementById('cardCounter').textContent = '完了';
    document.getElementById('fcButtons').style.display = 'none';
    document.getElementById('tapHint').style.display = 'none';
    document.getElementById('fcNext').style.display = vocabMode === 'review' ? 'block' : 'none';
    return;
  }

  const c = currentCards[cardIndex];
  const allVocab = vocabData[currentCategory].slice(0, 50);
  const realIndex = allVocab.indexOf(c);

  document.getElementById('fcThai').textContent = c.thai;
  document.getElementById('fcRomaji').textContent = c.romaji;
  document.getElementById('fcMeaning').textContent = c.jp;
  document.getElementById('fcMeaning').classList.remove('show');
  document.getElementById('fcExample').textContent = c.example || '';
  document.getElementById('fcExample').classList.remove('show');
  document.getElementById('cardCounter').textContent = (cardIndex + 1) + ' / ' + currentCards.length;
  document.getElementById('fcButtons').style.display = 'none';
  document.getElementById('tapHint').style.display = '';
  // Claudeヒントエリアをリセット
  const tipArea = document.getElementById('claudeTipArea');
  if (tipArea) tipArea.style.display = 'none';
  revealed = false;
  // 自動再生
  if (autoPlayAudio) {
    setTimeout(() => playAudio('vocab'), 300);
  }
}

function showMeaning() {
  if (!revealed) {
    document.getElementById('fcMeaning').classList.add('show');
    document.getElementById('fcExample').classList.add('show');
    document.getElementById('tapHint').style.display = 'none';
    // 学習モードの時だけボタンを表示
    if (vocabMode === 'learn') {
      document.getElementById('fcButtons').style.display = 'flex';
    }
    revealed = true;
  }
}

// rating: 'know' | 'fuzzy' | 'unknown'（後方互換のため true/false も受け付ける）
function nextCard(rating) {
  // 後方互換
  if (rating === true) rating = 'know';
  if (rating === false) rating = 'unknown';

  const c = currentCards[cardIndex];
  const allVocab = vocabData[currentCategory].slice(0, 50);
  const realIndex = allVocab.indexOf(c);

  // Claudeヒントエリアをリセット
  const tipArea = document.getElementById('claudeTipArea');
  if (tipArea) tipArea.style.display = 'none';

  if (vocabMode === 'learn') {
    progress.vocabLearned[currentCategory + '_' + realIndex] = (rating === 'know');
    saveProgress();

    if (rating === 'know') {
      recordSrs(currentCategory, realIndex);
    } else if (rating === 'fuzzy') {
      recordSrsFuzzy(currentCategory, realIndex);
    } else {
      // 知らない: すぐ後ろに再キュー
      currentCards.push(currentCards[cardIndex]);
      // Claudeにヒントを依頼
      fetchClaudeTip(c);
    }
  } else if (vocabMode === 'review') {
    if (rating === 'know') {
      recordSrs(currentCategory, realIndex);
    } else if (rating === 'fuzzy') {
      recordSrsFuzzy(currentCategory, realIndex);
    } else {
      currentCards.push(currentCards[cardIndex]);
      fetchClaudeTip(c);
    }
  }

  cardIndex++;
  revealed = false;
  document.getElementById('fcButtons').style.display = 'none';
  showCard();
}

// ---- Quiz ----
let quizCorrect = 0;
let quizTotal = 0;

function showQuizCard() {
  if (currentCards.length === 0 || cardIndex >= currentCards.length) {
    document.getElementById('quizCard').style.display = 'none';
    document.getElementById('quizChoices').innerHTML = '';
    document.getElementById('quizCounter').textContent = '完了';
    document.getElementById('quizNextBtn').style.display = 'none';
    const scoreArea = document.getElementById('quizScoreArea');
    scoreArea.style.display = 'flex';
    document.getElementById('quizScoreText').textContent =
      '結果：' + quizCorrect + ' / ' + quizTotal + ' 正解';
    return;
  }
  const c = currentCards[cardIndex];
  document.getElementById('quizThai').textContent = c.thai;
  document.getElementById('quizRomaji').textContent = c.romaji;
  document.getElementById('quizCounter').textContent = (cardIndex + 1) + ' / ' + currentCards.length;
  document.getElementById('quizNextBtn').style.display = 'none';
  document.getElementById('quizCard').style.display = '';

  // 選択肢を作る（正解1 + ランダム3）
  const allVocab = vocabData[currentCategory].slice(0, 50);
  const wrongPool = shuffle(allVocab.filter(v => v !== c));
  const choices = shuffle([c, ...wrongPool.slice(0, 3)]);

  const container = document.getElementById('quizChoices');
  container.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice';
    btn.textContent = choice.jp;
    btn.onclick = function() { selectQuizChoice(this, choice === c); };
    container.appendChild(btn);
  });
}

function selectQuizChoice(btn, isCorrect) {
  document.querySelectorAll('.quiz-choice').forEach(b => {
    b.disabled = true;
    if (b === btn) {
      b.classList.add(isCorrect ? 'correct' : 'wrong');
    }
  });
  // 正解ボタンを緑にする
  const allChoices = document.querySelectorAll('.quiz-choice');
  const correctCard = currentCards[cardIndex];
  allChoices.forEach(b => {
    if (b.textContent === correctCard.jp) b.classList.add('correct');
  });

  quizTotal++;
  if (isCorrect) {
    quizCorrect++;
    const allVocab = vocabData[currentCategory].slice(0, 50);
    const realIndex = allVocab.indexOf(currentCards[cardIndex]);
    delete weakWords[currentCategory + '_' + realIndex];
    saveWeakWords();
  } else {
    const allVocab = vocabData[currentCategory].slice(0, 50);
    const realIndex = allVocab.indexOf(currentCards[cardIndex]);
    weakWords[currentCategory + '_' + realIndex] = true;
    saveWeakWords();
  }
  document.getElementById('quizNextBtn').style.display = 'block';
}

function quizNext() {
  cardIndex++;
  showQuizCard();
}

// ---- SRS ----
function loadSrsData() {
  const saved = localStorage.getItem('srsData');
  return saved ? JSON.parse(saved) : {};
}

function saveSrsData() {
  localStorage.setItem('srsData', JSON.stringify(srsData));
}

let srsData = loadSrsData();

function getSrsIntervalDays(reviewCount) {
  const intervals = [1, 3, 7, 14, 30];
  return intervals[reviewCount] ?? null;
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function recordSrs(category, index) {
  const key = category + '_' + index;
  const today = getTodayStr();
  const existing = srsData[key] || { reviewCount: 0 };
  const newCount = existing.reviewCount + 1;
  const intervalDays = getSrsIntervalDays(newCount - 1);
  const nextReview = intervalDays !== null ? addDays(today, intervalDays) : null;
  srsData[key] = {
    lastReviewed: today,
    reviewCount: newCount,
    nextReview: nextReview
  };
  saveSrsData();
}

// あやしい → 翌日に固定（reviewCountはそのまま）
function recordSrsFuzzy(category, index) {
  const key = category + '_' + index;
  const today = getTodayStr();
  const existing = srsData[key] || { reviewCount: 0 };
  srsData[key] = {
    lastReviewed: today,
    reviewCount: existing.reviewCount,
    nextReview: addDays(today, 1)
  };
  saveSrsData();
}

function getTodayReviewWords() {
  const today = getTodayStr();
  const words = [];
  Object.entries(srsData).forEach(([key, data]) => {
    if (data.nextReview && data.nextReview <= today) {
      const [cat, idx] = key.split('_');
      const word = vocabData[cat]?.[parseInt(idx)];
      if (word) {
        words.push({ key, word, data, cat, idx: parseInt(idx) });
      }
    }
  });
  return words;
}

function getMotivationMessage() {
  const todayTotal = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length
                    + Object.keys(progress.phrasesLearned).filter(k => progress.phrasesLearned[k]).length
                    + Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;

  const streak = parseInt(localStorage.getItem('streakCount') || '1');

  if (todayTotal === 0) return '今日もタイ語を学習しましょう！ 💪';
  if (streak >= 7) return `🔥 ${streak}日連続！すごい継続力です！`;
  if (streak >= 3) return `✨ ${streak}日連続中！いい調子です！`;

  const weakCount = Object.keys(JSON.parse(localStorage.getItem('weakWords') || '{}')).length;
  if (weakCount > 0) return `⚠️ 苦手単語が${weakCount}個あります。復習してみましょう`;

  return `今日も学習しています！ 継続は力なり 🌟`;
}

function renderHomeScreen() {
  // 進捗
  const vocabCount = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length;
  const phraseCount = Object.keys(progress.phrasesLearned).filter(k => progress.phrasesLearned[k]).length;
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;
  document.getElementById('homeVocabProg').textContent = vocabCount + '/200';
  document.getElementById('homePhraseProg').textContent = phraseCount + '/200';
  document.getElementById('homeGrammarProg').textContent = grammarCount + '/20';

  // 復習リスト
  const reviewWords = getTodayReviewWords();
  const listEl = document.getElementById('srsReviewList');
  const startBtn = document.getElementById('srsStartBtn');

  if (reviewWords.length === 0) {
    listEl.innerHTML = '<div class="srs-empty">復習すべき単語はありません 🎉</div>';
    startBtn.style.display = 'none';
  } else {
    listEl.innerHTML = reviewWords.map(item => {
      const overdueDays = Math.floor((new Date(getTodayStr()) - new Date(item.data.nextReview)) / (1000*60*60*24)) + 1;
      return `<div class="srs-word-row">
        <div>
          <div class="srs-word-thai">${item.word.thai}</div>
          <div class="srs-word-jp">${item.word.jp}</div>
        </div>
        <span class="srs-overdue">${overdueDays > 1 ? overdueDays + '日超過' : '今日'}</span>
      </div>`;
    }).join('');
    startBtn.style.display = 'block';
  }

  // モチベーションメッセージ
  const msgEl = document.getElementById('motivationMsg');
  if (msgEl) msgEl.textContent = getMotivationMessage();
}

let srsReviewQueue = [];

function startSrsReview() {
  const reviewWords = getTodayReviewWords();
  if (reviewWords.length === 0) return;

  srsReviewQueue = reviewWords;

  switchTab('vocab', true);
  currentCategory = reviewWords[0].cat;
  vocabMode = 'review';
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));

  currentCards = reviewWords.map(item => item.word);
  cardIndex = 0;
  revealed = false;
  document.getElementById('fcButtons').style.display = 'flex';
  document.getElementById('fcNext').style.display = 'none';
  showCard();
}

// ---- Grammar ----
function renderGrammarCards() {
  const list = document.getElementById('grammarList');
  list.innerHTML = grammarData.map((g, i) => `
    <div class="grammar-card" data-gidx="${i}">
      <div class="grammar-header" onclick="toggleGrammar(this)">
        <span class="grammar-tag">${g.tag}</span>
        <span class="grammar-title">${g.title}</span>
        <span>▾</span>
      </div>
      <div class="grammar-body">
        <div class="pattern-box"><strong>パターン：</strong> ${g.pattern}</div>
        ${g.examples.map(e => `
        <div class="example-box">
          <div class="thai">${e.thai}</div>
          <div class="romaji">${e.romaji}</div>
          <div class="jp">${e.jp}</div>
        </div>`).join('')}
        <button class="practice-btn" onclick="togglePractice(${i}, this)">📝 練習問題を開く</button>
        <div class="practice-area" id="practice-${i}">
          ${g.practice.map((q, qi) => `
          <div class="practice-q" id="pq-${i}-${qi}">
            <div class="practice-q-text">Q${qi+1}. ${q.question}</div>
            <div class="practice-choices">
              ${q.choices.map((c, ci) => `
              <button class="practice-choice" onclick="answerPractice(${i},${qi},${ci})" data-ci="${ci}">${c}</button>`).join('')}
            </div>
            <div class="practice-explanation" id="pexp-${i}-${qi}">${q.explanation}</div>
          </div>`).join('')}
          <div class="practice-perfect" id="pperfect-${i}">🎉 完璧！全問正解です！</div>
          <button class="practice-reset-btn" onclick="resetPractice(${i})">🔄 もう一度</button>
        </div>
      </div>
    </div>`).join('');
}

function toggleGrammar(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
  const card = header.parentElement;
  const idx = card.dataset.gidx;
  if (idx !== undefined) {
    progress.grammarLearned['grammar_' + idx] = true;
    saveProgress();
  }
}

function togglePractice(gidx, btn) {
  const area = document.getElementById('practice-' + gidx);
  area.classList.toggle('open');
  btn.textContent = area.classList.contains('open') ? '📝 練習問題を閉じる' : '📝 練習問題を開く';
}

const practiceScore = {};

function answerPractice(gidx, qi, chosen) {
  const q = grammarData[gidx].practice[qi];
  const qEl = document.getElementById('pq-' + gidx + '-' + qi);
  const expEl = document.getElementById('pexp-' + gidx + '-' + qi);
  const btns = qEl.querySelectorAll('.practice-choice');

  btns.forEach((b, ci) => {
    b.disabled = true;
    if (ci === q.correct) b.classList.add('correct');
    else if (ci === chosen && ci !== q.correct) b.classList.add('wrong');
  });
  expEl.classList.add('show');

  if (!practiceScore[gidx]) practiceScore[gidx] = {};
  practiceScore[gidx][qi] = (chosen === q.correct);

  const isCorrect = (chosen === q.correct);
  if (isCorrect) {
    grammarQuizScores[gidx + '_' + qi] = true;
    saveGrammarQuizScores();
    const item = grammarData[gidx];
    if (item.practice) {
      const allCorrect = item.practice.every((_, qi2) => grammarQuizScores[gidx + '_' + qi2]);
      if (allCorrect) {
        progress.grammarLearned['grammar_' + gidx] = true;
        saveProgress();
      }
    }
  }

  const total = grammarData[gidx].practice.length;
  const answered = Object.keys(practiceScore[gidx]).length;
  if (answered === total) {
    const allCorrect = Object.values(practiceScore[gidx]).every(v => v);
    if (allCorrect) {
      document.getElementById('pperfect-' + gidx).classList.add('show');
    }
  }
}

function resetPractice(gidx) {
  delete practiceScore[gidx];
  const area = document.getElementById('practice-' + gidx);
  const g = grammarData[gidx];
  g.practice.forEach((q, qi) => {
    const qEl = document.getElementById('pq-' + gidx + '-' + qi);
    const expEl = document.getElementById('pexp-' + gidx + '-' + qi);
    expEl.classList.remove('show');
    qEl.querySelectorAll('.practice-choice').forEach(b => {
      b.disabled = false;
      b.classList.remove('correct', 'wrong');
    });
  });
  document.getElementById('pperfect-' + gidx).classList.remove('show');
}

// ---- Init ----
currentPhrases = phrasesData['meeting'];
showPhrase();
startCards();
updateProgress();
updateProgressDisplay();
renderHomeScreen();
renderGrammarCards();

// ---- PWA: install banner ----
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'flex';
});
document.getElementById('installBtn')?.addEventListener('click', () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      document.getElementById('installBanner').style.display = 'none';
    });
  }
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').style.display = 'none';
});

// ---- Online/Offline status ----
function updateOnlineStatus() {
  const b = document.getElementById('offlineBanner');
  if (b) b.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ---- PWA: Service Worker registration ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ================================
// PHASE 2: UX IMPROVEMENTS
// ================================

// ---- Swipe support for flashcards ----
(function() {
  let startX = 0, startY = 0, swiping = false;
  const THRESHOLD = 60;

  function getActiveCard() {
    const activeSection = document.querySelector('.section.active');
    if (!activeSection) return null;
    if (activeSection.id === 'phrases') return document.getElementById('phraseCard');
    if (activeSection.id === 'vocab' && vocabMode !== 'quiz') return document.getElementById('flashcard');
    return null;
  }

  document.addEventListener('touchstart', (e) => {
    const card = getActiveCard();
    if (!card || !card.contains(e.target)) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    const card = getActiveCard();
    if (!card) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > Math.abs(dx)) return; // vertical scroll
    card.classList.remove('swiping-left', 'swiping-right');
    if (dx > 30) card.classList.add('swiping-right');
    else if (dx < -30) card.classList.add('swiping-left');
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;
    const card = getActiveCard();
    if (!card) return;
    card.classList.remove('swiping-left', 'swiping-right');
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < THRESHOLD) return;

    const activeSection = document.querySelector('.section.active');
    if (activeSection.id === 'phrases') {
      if (dx > 0) prevPhrase();
      else nextPhrase();
    } else if (activeSection.id === 'vocab' && vocabMode !== 'quiz') {
      if (revealed) {
        if (dx > 0) nextCard(true);  // swipe right = knew
        else nextCard(false);         // swipe left = again
      } else {
        showMeaning();
      }
    }
  }, { passive: true });
})();

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
  const activeSection = document.querySelector('.section.active');
  if (!activeSection) return;

  if (activeSection.id === 'phrases') {
    if (e.key === 'ArrowLeft') prevPhrase();
    else if (e.key === 'ArrowRight') nextPhrase();
    else if (e.key === ' ') { e.preventDefault(); playAudio('phrase'); }
  } else if (activeSection.id === 'vocab' && vocabMode !== 'quiz') {
    if (e.key === ' ') { e.preventDefault(); if (!revealed) showMeaning(); }
    else if (e.key === 'ArrowRight' && revealed) nextCard(true);
    else if (e.key === 'ArrowLeft' && revealed) nextCard(false);
  }
});

// ---- Progress bars on home screen ----
function updateHomeProgressBars() {
  const vocabCount = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length;
  const phraseCount = Object.keys(progress.phrasesLearned).filter(k => progress.phrasesLearned[k]).length;
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;

  setProgressBar('vocabProgBar', vocabCount, 200);
  setProgressBar('phraseProgBar', phraseCount, 200);
  setProgressBar('grammarProgBar', grammarCount, 20);
}

function setProgressBar(id, current, total) {
  const bar = document.getElementById(id);
  if (bar) bar.style.width = Math.round((current / total) * 100) + '%';
}

// Override renderHomeScreen to include progress bars
const _origRenderHome = renderHomeScreen;
renderHomeScreen = function() {
  _origRenderHome();
  updateHomeProgressBars();
};

// ---- Card completion animation ----
const _origNextCard = nextCard;
nextCard = function(knew) {
  if (knew) {
    const card = document.getElementById('flashcard');
    if (card) {
      card.classList.add('complete-anim');
      setTimeout(() => card.classList.remove('complete-anim'), 500);
    }
  }
  _origNextCard(knew);
};

const _origMarkPhrase = markPhrase;
markPhrase = function(learned) {
  if (learned) {
    const card = document.getElementById('phraseCard');
    if (card) {
      card.classList.add('complete-anim');
      setTimeout(() => card.classList.remove('complete-anim'), 500);
    }
  }
  _origMarkPhrase(learned);
};

// ================================
// PHASE 3: LEARNING ENHANCEMENTS
// ================================

// ---- Listening Quiz ----
let listeningCorrect = 0, listeningTotal = 0;

function startListeningQuiz() {
  const flashcard = document.getElementById('flashcard');
  const quizArea = document.getElementById('quizArea');
  const listeningArea = document.getElementById('listeningArea');
  flashcard.style.display = 'none';
  quizArea.style.display = 'none';
  listeningArea.style.display = 'flex';
  document.getElementById('tapHint').style.display = 'none';
  listeningCorrect = 0;
  listeningTotal = 0;
  document.getElementById('listeningScoreArea').style.display = 'none';
  document.getElementById('listeningNextBtn').style.display = 'none';
  showListeningCard();
}

function playListeningAudio() {
  if (currentCards.length === 0 || cardIndex >= currentCards.length) return;
  const c = currentCards[cardIndex];
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(c.thai);
    u.lang = 'th-TH';
    u.rate = speechRate;
    window.speechSynthesis.speak(u);
  }
}

function showListeningCard() {
  if (currentCards.length === 0 || cardIndex >= currentCards.length) {
    document.getElementById('listeningCard').style.display = 'none';
    document.getElementById('listeningChoices').innerHTML = '';
    document.getElementById('listeningCounter').textContent = '完了';
    document.getElementById('listeningNextBtn').style.display = 'none';
    const scoreArea = document.getElementById('listeningScoreArea');
    scoreArea.style.display = 'flex';
    document.getElementById('listeningScoreText').textContent =
      '結果：' + listeningCorrect + ' / ' + listeningTotal + ' 正解';
    return;
  }

  document.getElementById('listeningCard').style.display = '';
  document.getElementById('listeningCounter').textContent = (cardIndex + 1) + ' / ' + currentCards.length;
  document.getElementById('listeningNextBtn').style.display = 'none';

  // Auto play audio
  setTimeout(() => playListeningAudio(), 400);

  // Create choices
  const c = currentCards[cardIndex];
  const allVocab = vocabData[currentCategory].slice(0, 50);
  const wrongPool = shuffle(allVocab.filter(v => v !== c));
  const choices = shuffle([c, ...wrongPool.slice(0, 3)]);

  const container = document.getElementById('listeningChoices');
  container.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'quiz-choice';
    btn.textContent = choice.jp;
    btn.onclick = function() { selectListeningChoice(this, choice === c); };
    container.appendChild(btn);
  });
}

function selectListeningChoice(btn, isCorrect) {
  document.querySelectorAll('#listeningChoices .quiz-choice').forEach(b => {
    b.disabled = true;
    if (b === btn) b.classList.add(isCorrect ? 'correct' : 'wrong');
  });
  const correctCard = currentCards[cardIndex];
  document.querySelectorAll('#listeningChoices .quiz-choice').forEach(b => {
    if (b.textContent === correctCard.jp) b.classList.add('correct');
  });
  listeningTotal++;
  if (isCorrect) listeningCorrect++;
  document.getElementById('listeningNextBtn').style.display = 'block';
}

function listeningNext() {
  cardIndex++;
  showListeningCard();
}

// Update startCards to handle listening mode
const _origStartCards = startCards;
startCards = function() {
  const listeningArea = document.getElementById('listeningArea');
  if (listeningArea) listeningArea.style.display = 'none';

  if (vocabMode === 'listening') {
    const list = getVocabList();
    currentCards = shuffle(list);
    cardIndex = 0;
    revealed = false;
    document.getElementById('fcButtons').style.display = 'none';
    document.getElementById('fcNext').style.display = 'none';
    document.getElementById('flashcard').style.display = 'none';
    document.getElementById('quizArea').style.display = 'none';
    startListeningQuiz();
  } else {
    _origStartCards();
  }
};

// ---- Auto-retry wrong answers ----
let wrongAnswers = [];

// Override selectQuizChoice to track wrong answers
const _origSelectQuizChoice = selectQuizChoice;
selectQuizChoice = function(btn, isCorrect) {
  if (!isCorrect) {
    wrongAnswers.push(currentCards[cardIndex]);
  }
  _origSelectQuizChoice(btn, isCorrect);
};

// Override quiz completion to show retry button
const _origShowQuizCard = showQuizCard;
showQuizCard = function() {
  if (currentCards.length === 0 || cardIndex >= currentCards.length) {
    _origShowQuizCard();
    // Show retry button if there were wrong answers
    const retryBtn = document.getElementById('retryWrongBtn');
    if (retryBtn) {
      retryBtn.style.display = wrongAnswers.length > 0 ? 'block' : 'none';
    }
    return;
  }
  _origShowQuizCard();
};

function retryWrongAnswers() {
  if (wrongAnswers.length === 0) return;
  currentCards = shuffle([...wrongAnswers]);
  wrongAnswers = [];
  cardIndex = 0;
  quizCorrect = 0;
  quizTotal = 0;
  document.getElementById('quizScoreArea').style.display = 'none';
  document.getElementById('quizNextBtn').style.display = 'none';
  document.getElementById('quizCard').style.display = '';
  showQuizCard();
}

// ---- Learning History (7-day chart) ----
function recordDailyActivity() {
  const today = getTodayStr();
  const history = JSON.parse(localStorage.getItem('learningHistory') || '{}');
  const vocabCount = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length;
  const phraseCount = Object.keys(progress.phrasesLearned).filter(k => progress.phrasesLearned[k]).length;
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;
  history[today] = vocabCount + phraseCount + grammarCount;
  localStorage.setItem('learningHistory', JSON.stringify(history));
}

function renderLearningChart() {
  const chartEl = document.getElementById('learningChart');
  if (!chartEl) return;

  const history = JSON.parse(localStorage.getItem('learningHistory') || '{}');
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = (d.getMonth() + 1) + '/' + d.getDate();
    days.push({ date: dateStr, label: dayLabel, count: history[dateStr] || 0 });
  }

  const maxCount = Math.max(...days.map(d => d.count), 1);

  chartEl.innerHTML = days.map(d => {
    const height = Math.max(2, (d.count / maxCount) * 50);
    const isToday = d.date === getTodayStr();
    return `<div class="chart-bar-col">
      <div class="chart-bar${isToday ? ' today' : ''}" style="height:${height}px" title="${d.count}個"></div>
      <div class="chart-label">${d.label}</div>
    </div>`;
  }).join('');
}

// Hook into renderHomeScreen to include chart
const _origRenderHome2 = renderHomeScreen;
renderHomeScreen = function() {
  _origRenderHome2();
  recordDailyActivity();
  renderLearningChart();
};

// ================================
// PHASE 4: KMC BUSINESS FEATURES
// ================================

let currentRoleplayIndex = 0;
let currentBusinessMode = 'roleplay';

function setBusinessMode(mode) {
  currentBusinessMode = mode;
  const btns = document.querySelectorAll('#business .mode-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  document.getElementById('roleplayArea').style.display = mode === 'roleplay' ? '' : 'none';
  document.getElementById('carArea').style.display = mode === 'car' ? '' : 'none';
  document.getElementById('emailArea').style.display = mode === 'email' ? '' : 'none';
  if (mode === 'roleplay') renderRoleplayScenes();
  if (mode === 'car') renderCarCategories();
  if (mode === 'email') renderEmailCategories();
}

// ---- Roleplay ----
function renderRoleplayScenes() {
  const container = document.getElementById('roleplayScenes');
  if (!container) return;
  container.innerHTML = roleplayData.map((r, i) =>
    `<button class="cat-btn${i === currentRoleplayIndex ? ' active' : ''}" onclick="selectRoleplay(${i}, this)">${r.scene}</button>`
  ).join('');
  showRoleplay();
}

function selectRoleplay(idx, btn) {
  currentRoleplayIndex = idx;
  document.querySelectorAll('#roleplayScenes .cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  showRoleplay();
}

function showRoleplay() {
  const rp = roleplayData[currentRoleplayIndex];
  if (!rp) return;
  document.getElementById('roleplayTitle').textContent = rp.title;
  document.getElementById('roleplayDialogue').innerHTML = rp.dialogue.map(d =>
    `<div class="rp-line">
      <div class="rp-speaker">${d.speaker}</div>
      <div class="rp-bubble">
        <div class="rp-thai">${d.thai}</div>
        <div class="rp-romaji">${d.romaji}</div>
        <div class="rp-jp">${d.jp}</div>
      </div>
    </div>`
  ).join('');
  document.getElementById('roleplayVocab').innerHTML =
    '<div class="rp-vocab-title">Key Vocabulary</div>' +
    rp.vocab.map(v =>
      `<div class="rp-vocab-item"><span class="rp-v-thai">${v.thai}</span> <span class="rp-v-romaji">(${v.romaji})</span> <span class="rp-v-jp">${v.jp}</span></div>`
    ).join('');
  document.getElementById('roleplayCounter').textContent = (currentRoleplayIndex + 1) + ' / ' + roleplayData.length;
}

function nextRoleplay() {
  currentRoleplayIndex = (currentRoleplayIndex + 1) % roleplayData.length;
  renderRoleplayScenes();
}
function prevRoleplay() {
  currentRoleplayIndex = (currentRoleplayIndex - 1 + roleplayData.length) % roleplayData.length;
  renderRoleplayScenes();
}

// ---- CAR Templates ----
function renderCarCategories() {
  const container = document.getElementById('carCategories');
  if (!container) return;
  container.innerHTML = carData.map((c, i) =>
    `<button class="cat-btn${i === 0 ? ' active' : ''}" onclick="showCarTemplate(${i}, this)">${c.category}</button>`
  ).join('');
  showCarTemplate(0, null);
}

function showCarTemplate(idx, btn) {
  if (btn) {
    document.querySelectorAll('#carCategories .cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const car = carData[idx];
  if (!car) return;
  document.getElementById('carTemplate').innerHTML =
    `<div class="car-title">${car.title}</div>` +
    car.sections.map(s =>
      `<div class="car-section">
        <div class="car-label">${s.label}</div>
        <div class="car-thai">${s.thai}</div>
        <div class="car-jp">${s.jp}</div>
      </div>`
    ).join('') +
    `<button class="fc-btn good" onclick="copyCarText(${idx})" style="margin-top:12px">📋 タイ語をコピー</button>`;
}

function copyCarText(idx) {
  const car = carData[idx];
  const text = car.sections.map(s => s.label + '\n' + s.thai).join('\n\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('#carTemplate .fc-btn');
    if (btn) { btn.textContent = '✓ コピーしました！'; setTimeout(() => btn.textContent = '📋 タイ語をコピー', 2000); }
  });
}

// ---- Email Templates ----
function renderEmailCategories() {
  const container = document.getElementById('emailCategories');
  if (!container) return;
  container.innerHTML = emailData.map((e, i) =>
    `<button class="cat-btn${i === 0 ? ' active' : ''}" onclick="showEmailTemplate(${i}, this)">${e.category}</button>`
  ).join('');
  showEmailTemplate(0, null);
}

function showEmailTemplate(idx, btn) {
  if (btn) {
    document.querySelectorAll('#emailCategories .cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const email = emailData[idx];
  if (!email) return;
  document.getElementById('emailTemplate').innerHTML =
    `<div class="email-subject">${email.subject}</div>
    <div class="email-body-section">
      <div class="email-lang-label">🇹🇭 タイ語</div>
      <pre class="email-text thai-text">${email.thai}</pre>
    </div>
    <div class="email-body-section">
      <div class="email-lang-label">🇯🇵 日本語</div>
      <pre class="email-text jp-text">${email.jp}</pre>
    </div>
    <button class="fc-btn good" onclick="copyEmailText(${idx})" style="margin-top:12px">📋 タイ語をコピー</button>`;
}

function copyEmailText(idx) {
  const email = emailData[idx];
  navigator.clipboard.writeText(email.thai).then(() => {
    const btn = document.querySelector('#emailTemplate .fc-btn');
    if (btn) { btn.textContent = '✓ コピーしました！'; setTimeout(() => btn.textContent = '📋 タイ語をコピー', 2000); }
  });
}

// Init business tab
if (typeof roleplayData !== 'undefined') {
  renderRoleplayScenes();
}

// ---- Expose all functions to global scope for onclick handlers ----
// Must be at the very end so overridden versions are registered
Object.assign(window, {
  playAudio, setSpeechRate, toggleAutoPlay, switchTab, updateProgress,
  setPhraseMode, setPhraseCategory, showPhrase, nextPhrase, prevPhrase, markPhrase,
  setVocabMode, setCategory, setFreqFilter, setSceneFilter,
  startCards, showMeaning, nextCard, showQuizCard, selectQuizChoice, quizNext,
  startSrsReview, toggleGrammar, togglePractice, answerPractice, resetPractice,
  retryWrongAnswers, playListeningAudio, listeningNext, selectListeningChoice,
  startListeningQuiz, renderHomeScreen,
  setBusinessMode, selectRoleplay, nextRoleplay, prevRoleplay,
  showCarTemplate, copyCarText, renderCarCategories,
  showEmailTemplate, copyEmailText, renderEmailCategories
});
