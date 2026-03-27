// =============================================
// KMC Thai Learning App - app.js
// Application logic
// =============================================

// ================================
// AUDIO: Google Cloud TTS → OpenAI TTS → Web Speech API
// ================================
const ttsCache = new Map(); // メモリキャッシュ（同じ単語を何度も呼ばない）

async function playAudioTTS(text) {
  if (!text || text === '–' || text.includes('🎉')) return;

  if (ttsCache.has(text)) {
    new Audio(ttsCache.get(text)).play();
    return;
  }

  const googleKey = getGoogleTTSKey();

  // 1. Google Cloud TTS（ネイティブ品質のタイ語）
  if (googleKey) {
    try {
      const res = await fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + googleKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'th-TH', name: 'th-TH-Neural2-C' },
            audioConfig: { audioEncoding: 'MP3', speakingRate: speechRate }
          })
        }
      );
      if (!res.ok) throw new Error('Google TTS error: ' + res.status);
      const data = await res.json();
      const url = 'data:audio/mp3;base64,' + data.audioContent;
      ttsCache.set(text, url);
      new Audio(url).play();
      return;
    } catch (e) {
      console.warn('Google TTS失敗:', e);
    }
  }

  // 2. OpenAI TTS（フォールバック）
  const openaiKey = getOpenAIKey();
  if (openaiKey) {
    try {
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
      if (!res.ok) throw new Error('OpenAI TTS error: ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      ttsCache.set(text, url);
      new Audio(url).play();
      return;
    } catch (e) {
      console.warn('OpenAI TTS失敗、Web Speech APIにフォールバック:', e);
    }
  }

  // 3. Web Speech API（最終フォールバック）
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }
}

// ================================
// CLAUDE API: 共通ヘルパー（iOS PWA対応）
// ================================
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const isPWA = window.navigator.standalone === true;

async function claudeFetch(key, body) {
  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (data.error?.message || JSON.stringify(data)));
  return data;
}

function pwaErrorMsg(e) {
  if (e instanceof TypeError && isPWA) {
    return 'ホーム画面アプリではAI機能が制限されます。SafariブラウザでURLを直接開いてご利用ください。';
  }
  return e.message || e.toString();
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
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `タイ語単語「${word.thai}」（読み：${word.romaji}、意味：${word.jp}）の覚え方を日本語で教えてください。以下を簡潔に（合計5行以内）：\n・発音・語感のコツ（日本語の音に近いものがあれば）\n・語呂合わせや記憶の引っかかり\n・製造業・職場での短い例文（タイ語と日本語訳）`
      }]
    });
    tipText.textContent = data.content[0].text;
  } catch (e) {
    tipText.textContent = '⚠️ ' + pwaErrorMsg(e);
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
  const inputMap = { openai: 'openaiKeyInput', claude: 'claudeKeyInput', google: 'googleKeyInput' };
  const statusMap = { openai: 'openaiKeyStatus', claude: 'claudeKeyStatus', google: 'googleKeyStatus' };
  const storageMap = { openai: 'openaiApiKey', claude: 'claudeApiKey', google: 'googleTTSApiKey' };
  const inputId = inputMap[type];
  const statusId = statusMap[type];
  const storageKey = storageMap[type];
  const val = document.getElementById(inputId).value.trim();
  if (!val) {
    document.getElementById(statusId).textContent = '⚠️ キーを入力してください';
    return;
  }
  localStorage.setItem(storageKey, val);
  document.getElementById(statusId).textContent = '✅ 保存しました';
  document.getElementById(inputId).value = '●'.repeat(Math.min(val.length, 20));
  setTimeout(() => { document.getElementById(statusId).textContent = '✅ 設定済み'; }, 3000);
}

function loadApiKeyStatus() {
  const googleKey = localStorage.getItem('googleTTSApiKey');
  const openaiKey = localStorage.getItem('openaiApiKey');
  const claudeKey = localStorage.getItem('claudeApiKey');
  const googleStatus = document.getElementById('googleKeyStatus');
  const openaiStatus = document.getElementById('openaiKeyStatus');
  const claudeStatus = document.getElementById('claudeKeyStatus');
  if (googleStatus) googleStatus.textContent = googleKey ? '✅ 設定済み' : '未設定';
  if (openaiStatus) openaiStatus.textContent = openaiKey ? '✅ 設定済み' : '未設定';
  if (claudeStatus) claudeStatus.textContent = claudeKey ? '✅ 設定済み' : '未設定';
}

let apiKeysVisible = false;
function showApiKeys() {
  apiKeysVisible = !apiKeysVisible;
  const googleKey = localStorage.getItem('googleTTSApiKey') || '';
  const openaiKey = localStorage.getItem('openaiApiKey') || '';
  const claudeKey = localStorage.getItem('claudeApiKey') || '';
  const googleInput = document.getElementById('googleKeyInput');
  const openaiInput = document.getElementById('openaiKeyInput');
  const claudeInput = document.getElementById('claudeKeyInput');
  if (googleInput) {
    googleInput.type = apiKeysVisible ? 'text' : 'password';
    googleInput.value = apiKeysVisible ? googleKey : (googleKey ? '●'.repeat(Math.min(googleKey.length, 20)) : '');
  }
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
  localStorage.removeItem('googleTTSApiKey');
  localStorage.removeItem('openaiApiKey');
  localStorage.removeItem('claudeApiKey');
  const googleInput = document.getElementById('googleKeyInput');
  const openaiInput = document.getElementById('openaiKeyInput');
  const claudeInput = document.getElementById('claudeKeyInput');
  if (googleInput) googleInput.value = '';
  if (openaiInput) openaiInput.value = '';
  if (claudeInput) claudeInput.value = '';
  loadApiKeyStatus();
}

// Helper: get saved API keys (for use in other modules)
function getGoogleTTSKey() { return localStorage.getItem('googleTTSApiKey') || ''; }
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
  // ホームが表示されている時だけ renderHomeScreen() で更新する
  // （IDが変わったため、ここでは文法カウントのみ安全に更新）
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;
  const grammarEl = document.getElementById('homeGrammarProg');
  if (grammarEl) grammarEl.textContent = grammarCount + '/20';
  const grammarBar = document.getElementById('grammarProgBar');
  if (grammarBar) grammarBar.style.width = Math.round(grammarCount / 20 * 100) + '%';
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
  if (tab === 'aigen') updateAigenSavedCount();
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

function getBaseVocab(category) {
  if (category === 'custom') return getCustomVocab();
  if (category === 'focus') return Object.values(vocabData).flat();
  // 全カテゴリ80語
  const limit = 80;
  return (vocabData[category] || []).slice(0, limit);
}

function getVocabList() {
  const baseVocab = getBaseVocab(currentCategory);
  let allVocab = baseVocab;
  // 苦手フィルター
  if (freqFilter === 'weak') {
    const allV = baseVocab;
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
      const origIdx = baseVocab.indexOf(v);
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
  currentCards = (vocabMode === 'learn') ? shuffle(list) : list;
  cardIndex = 0;
  revealed = false;
  document.getElementById('fcButtons').style.display = 'none';
  document.getElementById('fcNext').style.display = 'none';

  const flashcard = document.getElementById('flashcard');
  if (flashcard) flashcard.style.display = '';
  showCard();
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
  const allVocab = getBaseVocab(currentCategory);
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
  const allVocab = getBaseVocab(currentCategory);
  const realIndex = allVocab.indexOf(c);

  // Claudeヒントエリアをリセット
  const tipArea = document.getElementById('claudeTipArea');
  if (tipArea) tipArea.style.display = 'none';

  // 学習ログ記録
  logLearningEvent({ type: 'vocab', word: c.thai, jp: c.jp, category: currentCategory, rating });

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
  // --- メトリクス ---
  const srsCount = Object.keys(srsData).length;
  const reviewWords = getTodayReviewWords();
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;

  document.getElementById('homeSrsCount').textContent = srsCount + '語';
  document.getElementById('homeTodayPractice').textContent = reviewWords.length + '枚';
  document.getElementById('homeGrammarProg').textContent = grammarCount + '/20';

  // SRSプログレスバー（最大320語基準）
  const srsBar = document.getElementById('vocabProgBar');
  if (srsBar) srsBar.style.width = Math.min(100, Math.round(srsCount / 320 * 100)) + '%';
  // 今日の練習バー（最大20枚基準）
  const todayBar = document.getElementById('phraseProgBar');
  if (todayBar) todayBar.style.width = Math.min(100, Math.round(reviewWords.length / 20 * 100)) + '%';
  // 文法バー
  const grammarBar = document.getElementById('grammarProgBar');
  if (grammarBar) grammarBar.style.width = Math.round(grammarCount / 20 * 100) + '%';

  // --- 学習履歴チャート（データがある時だけ表示）---
  const chartSection = document.getElementById('chartSection');
  const storedLog = JSON.parse(localStorage.getItem('learningLog_v1') || '[]');
  const hasHistory = storedLog.length > 0;
  if (chartSection) chartSection.style.display = hasHistory ? 'block' : 'none';

  // --- 今日の復習ボックス ---
  const srsBox = document.getElementById('srsReviewBox');
  const listEl = document.getElementById('srsReviewList');
  const startBtn = document.getElementById('srsStartBtn');

  if (reviewWords.length === 0) {
    // 復習なし：SRS登録済みなら小さく「全部クリア」表示、未登録なら非表示
    if (srsCount > 0) {
      if (srsBox) srsBox.style.display = 'block';
      listEl.innerHTML = '<div class="srs-empty">今日の復習はありません 🎉</div>';
      startBtn.style.display = 'none';
    } else {
      if (srsBox) srsBox.style.display = 'none';
    }
  } else {
    if (srsBox) srsBox.style.display = 'block';
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
    if (activeSection.id === 'vocab') return document.getElementById('flashcard');
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
    } else if (activeSection.id === 'vocab') {
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
  } else if (activeSection.id === 'vocab') {
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

// =============================================
// PHASE 4: 文法ドリル（Claude生成）
// =============================================

let grammarDrillMode = 'ref'; // 'ref' | 'drill'
let selectedGrammarPattern = null;
let grammarDrillQuestions = [];
let grammarDrillIndex = 0;
let grammarDrillRecording = false;

function switchGrammarMode(mode, btn) {
  grammarDrillMode = mode;
  document.querySelectorAll('#grammar .mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('grammarRefPanel').style.display = mode === 'ref' ? '' : 'none';
  document.getElementById('grammarDrillPanel').style.display = mode === 'drill' ? '' : 'none';
  if (mode === 'drill') renderGrammarDrillSelector();
}

function renderGrammarDrillSelector() {
  const el = document.getElementById('grammarDrillSelector');
  if (!el || !grammarData) return;
  el.innerHTML = grammarData.map((g, i) =>
    `<button onclick="selectGrammarPattern(${i}, this)" style="background:var(--surface2); border:1px solid var(--border); border-radius:20px; padding:6px 14px; color:var(--text-dim); cursor:pointer; font-size:0.8rem; transition:all 0.2s;">${g.tag || g.title}</button>`
  ).join('');
}

function selectGrammarPattern(idx, btn) {
  selectedGrammarPattern = idx;
  document.querySelectorAll('#grammarDrillSelector button').forEach(b => {
    b.style.background = 'var(--surface2)';
    b.style.color = 'var(--text-dim)';
    b.style.borderColor = 'var(--border)';
  });
  btn.style.background = 'var(--accent)';
  btn.style.color = '#fff';
  btn.style.borderColor = 'var(--accent)';

  const g = grammarData[idx];
  document.getElementById('grammarDrillInfo').style.display = '';
  document.getElementById('grammarDrillPatternName').textContent = g.title;
  document.getElementById('grammarDrillPatternDesc').textContent = g.pattern || '';
  document.getElementById('grammarDrillStartBtn').disabled = false;
}

async function startGrammarDrill() {
  if (selectedGrammarPattern === null) return;
  const key = getClaudeKey();
  if (!key) {
    alert('設定画面でClaude APIキーを入力してください');
    return;
  }

  const g = grammarData[selectedGrammarPattern];
  document.getElementById('grammarDrillStartArea').style.display = 'none';
  document.getElementById('grammarDrillQuestionArea').style.display = 'flex';
  document.getElementById('grammarDrillResult').style.display = 'none';
  document.getElementById('grammarDrillQ').textContent = '問題を生成中...';
  document.getElementById('grammarDrillHint').textContent = '';
  document.getElementById('grammarDrillCounter').textContent = '';

  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `タイ語学習用の文法ドリルを作ってください。
文法パターン：「${g.title}」（${g.pattern || ''}）
学習者のプロフィール：日本人、製造業・品質管理、タイ人部下への指示・会議でのやりとりが目標

以下の形式でJSONのみを返してください（説明文不要）：
[
  {"question": "日本語のお題（タイ語に訳してください）", "hint": "使うべきパターンのヒント", "model": "タイ語のお手本"},
  {"question": "...", "hint": "...", "model": "..."},
  {"question": "...", "hint": "...", "model": "..."}
]

業務に関連した3問を作成してください。`
      }]
    });
    const text = data.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    grammarDrillQuestions = JSON.parse(jsonMatch[0]);
    grammarDrillIndex = 0;
    showGrammarDrillQuestion();
  } catch(e) {
    document.getElementById('grammarDrillQ').textContent = '⚠️ ' + pwaErrorMsg(e);
  }
}

function showGrammarDrillQuestion() {
  if (grammarDrillIndex >= grammarDrillQuestions.length) {
    document.getElementById('grammarDrillQ').textContent = '🎉 全問完了！お疲れさまでした';
    document.getElementById('grammarDrillHint').textContent = '';
    document.getElementById('grammarDrillResult').style.display = 'none';
    document.getElementById('grammarDrillCounter').textContent = '';
    document.getElementById('grammarDrillAnswer').style.display = 'none';
    document.querySelector('#grammarDrillQuestionArea button[onclick="submitGrammarDrill()"]').style.display = 'none';
    return;
  }
  const q = grammarDrillQuestions[grammarDrillIndex];
  document.getElementById('grammarDrillQ').textContent = q.question;
  document.getElementById('grammarDrillHint').textContent = '💡 ' + q.hint;
  document.getElementById('grammarDrillResult').style.display = 'none';
  document.getElementById('grammarDrillAnswer').value = '';
  document.getElementById('grammarDrillAnswer').style.display = '';
  document.querySelector('#grammarDrillQuestionArea button[onclick="submitGrammarDrill()"]').style.display = '';
  document.getElementById('grammarDrillCounter').textContent = (grammarDrillIndex + 1) + ' / ' + grammarDrillQuestions.length;
}

async function submitGrammarDrill() {
  const userAnswer = document.getElementById('grammarDrillAnswer').value.trim();
  if (!userAnswer) return;
  const key = getClaudeKey();
  const q = grammarDrillQuestions[grammarDrillIndex];
  const g = grammarData[selectedGrammarPattern];

  document.getElementById('grammarDrillFeedback').textContent = '添削中...';
  document.getElementById('grammarDrillModel').textContent = q.model;
  document.getElementById('grammarDrillResult').style.display = 'flex';

  if (key) {
    try {
      const data = await claudeFetch(key, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `タイ語文法ドリルの添削をしてください。
文法パターン：「${g.title}」
お題：「${q.question}」
お手本：「${q.model}」
学習者の回答：「${userAnswer}」

日本語で3行以内で添削してください：
・正しいか、意味は通じるか
・お手本との主な違い（あれば）
・一言アドバイス`
          }]
      });
      document.getElementById('grammarDrillFeedback').textContent = data.content[0].text;
    } catch(e) {
      document.getElementById('grammarDrillFeedback').textContent = '（添削の取得に失敗しました）';
    }
  } else {
    document.getElementById('grammarDrillFeedback').textContent = '（Claude APIキーを設定すると添削が受けられます）';
  }
  // 学習ログ記録
  logLearningEvent({ type: 'grammar', pattern: g.tag || g.title });
}

function nextGrammarDrill() {
  grammarDrillIndex++;
  showGrammarDrillQuestion();
}

function playGrammarModel() {
  const text = document.getElementById('grammarDrillModel').textContent;
  if (text) playAudioTTS(text);
}

async function toggleGrammarVoice() {
  if (!getOpenAIKey()) {
    document.getElementById('grammarVoiceBtn').textContent = '⚠️ OpenAI APIキーが必要です';
    return;
  }
  if (!grammarDrillRecording) {
    grammarDrillRecording = true;
    document.getElementById('grammarVoiceBtn').textContent = '⏹ 停止して送信';
    document.getElementById('grammarVoiceBtn').style.borderColor = 'var(--red)';
    await startMediaRecorder(async (blob) => {
      grammarDrillRecording = false;
      document.getElementById('grammarVoiceBtn').textContent = '🎙 音声で答える';
      document.getElementById('grammarVoiceBtn').style.borderColor = 'var(--border)';
      const text = await sendToWhisper(blob);
      if (text) {
        document.getElementById('grammarDrillAnswer').value = text;
        submitGrammarDrill();
      }
    });
  } else {
    grammarDrillRecording = false;
    stopMediaRecorder();
    document.getElementById('grammarVoiceBtn').textContent = '🎙 音声で答える';
    document.getElementById('grammarVoiceBtn').style.borderColor = 'var(--border)';
  }
}

// =============================================
// PHASE 3: 指示出しドリル＋会議シミュレーション
// =============================================

// ---- ドリルシナリオデータ ----
const drillScenarios = [
  // 朝礼
  { scene: 'morning', jp: '今日の生産目標は500個です', thai: 'เป้าหมายการผลิตวันนี้คือ 500 ชิ้นครับ', romaji: 'pâo-mǎai gaan-pà-lìt wan-níi khue 500 chín khráp' },
  { scene: 'morning', jp: '安全に気をつけて作業してください', thai: 'กรุณาทำงานด้วยความระมัดระวังครับ', romaji: 'gà-rú-naa tam-ngaan dûay khwaam-rá-mát-rá-wang khráp' },
  { scene: 'morning', jp: '全員揃いましたか？', thai: 'ครบทุกคนแล้วหรือครับ', romaji: 'khróp túk khon láew rʉ̌e khráp' },
  { scene: 'morning', jp: '今日は残業があります', thai: 'วันนี้มีทำงานล่วงเวลาครับ', romaji: 'wan-níi mii tam-ngaan lûang-wee-laa khráp' },
  // 不良対応
  { scene: 'defect', jp: 'この部品を検査してください', thai: 'กรุณาตรวจสอบชิ้นส่วนนี้ครับ', romaji: 'gà-rú-naa trùat-sòp chín-sùan níi khráp' },
  { scene: 'defect', jp: '不良品を別にしておいてください', thai: 'กรุณาแยกของเสียออกไว้ก่อนครับ', romaji: 'gà-rú-naa yâek khǎawng-sǐa àwk wái gàwn khráp' },
  { scene: 'defect', jp: '原因は何ですか？', thai: 'สาเหตุคืออะไรครับ', romaji: 'sǎa-hèet khue à-rai khráp' },
  { scene: 'defect', jp: '何個不良がありましたか？', thai: 'มีของเสียกี่ชิ้นครับ', romaji: 'mii khǎawng-sǐa gìi chín khráp' },
  { scene: 'defect', jp: 'ラインを止めてください', thai: 'กรุณาหยุดสายการผลิตครับ', romaji: 'gà-rú-naa yùt sǎai-gaan-pà-lìt khráp' },
  // 作業指示
  { scene: 'instruction', jp: 'ゆっくり丁寧にやってください', thai: 'กรุณาทำอย่างช้าๆ และระมัดระวังครับ', romaji: 'gà-rú-naa tam yàang cháa-cháa láe rá-mát-rá-wang khráp' },
  { scene: 'instruction', jp: 'この手順に従ってください', thai: 'กรุณาทำตามขั้นตอนนี้ครับ', romaji: 'gà-rú-naa tam taam khân-tàawn níi khráp' },
  { scene: 'instruction', jp: '終わったら報告してください', thai: 'เสร็จแล้วกรุณาแจ้งให้ทราบครับ', romaji: 'sèt láew gà-rú-naa jâeng hâi sâap khráp' },
  { scene: 'instruction', jp: 'こっちを先にやってください', thai: 'กรุณาทำอันนี้ก่อนครับ', romaji: 'gà-rú-naa tam an-níi gàwn khráp' },
  // 安全
  { scene: 'safety', jp: 'ヘルメットをかぶってください', thai: 'กรุณาสวมหมวกนิรภัยครับ', romaji: 'gà-rú-naa sùam mùak-ní-rá-phai khráp' },
  { scene: 'safety', jp: '手袋をつけてください', thai: 'กรุณาสวมถุงมือครับ', romaji: 'gà-rú-naa sùam tǔng-mue khráp' },
  { scene: 'safety', jp: '走らないでください', thai: 'กรุณาอย่าวิ่งครับ', romaji: 'gà-rú-naa yàa wîng khráp' },
  { scene: 'safety', jp: '危険ですので近づかないでください', thai: 'อันตราย กรุณาอย่าเข้าใกล้ครับ', romaji: 'an-tà-raai gà-rú-naa yàa khâo glâi khráp' },
  { scene: 'safety', jp: '消火器はどこにありますか？', thai: 'ถังดับเพลิงอยู่ที่ไหนครับ', romaji: 'tǎng-dàp-phloeng yùu thîi-nǎi khráp' },
];

// 会議シミュレーション用のシステムプロンプト
const simSystemPrompts = {
  morning: `あなたはタイの製造工場で働く従業員（ソムチャイ）です。日本人マネージャーが朝礼で指示を出しています。
マネージャーのタイ語の発話に対して、タイ人従業員として自然に返答してください。
返答は必ずタイ語でしてください（最初はシンプルな質問か確認の返事）。
返答の後に（）内に日本語訳を付けてください。形式：[タイ語]（日本語訳）`,
  defect: `あなたはタイの製造工場の品質担当スタッフ（プリーヤー）です。不良品が発生し、日本人マネージャーが確認しています。
マネージャーのタイ語の発話に対して、不良の状況を説明するタイ人スタッフとして返答してください。
返答は必ずタイ語でしてください。返答の後に（）内に日本語訳を付けてください。形式：[タイ語]（日本語訳）`,
  delivery: `あなたはタイのサプライヤー担当（チャナポン）です。納期について日本人バイヤーと話し合っています。
マネージャーのタイ語の発話に対して、納期・在庫について答えるタイ人スタッフとして返答してください。
返答は必ずタイ語でしてください。返答の後に（）内に日本語訳を付けてください。形式：[タイ語]（日本語訳）`,
  safety: `あなたはタイの製造工場のスタッフ（ナッタウット）です。日本人マネージャーが安全指示を出しています。
マネージャーのタイ語の発話に対して、指示を受けたスタッフとして自然に返答してください。
返答は必ずタイ語でしてください。返答の後に（）内に日本語訳を付けてください。形式：[タイ語]（日本語訳）`,
};

const simOpeners = {
  morning: { thai: 'สวัสดีครับ วันนี้มีอะไรพิเศษไหมครับ', jp: 'おはようございます。今日は何か特別なことありますか？', name: 'ソムチャイ' },
  defect: { thai: 'คุณผู้จัดการครับ มีปัญหาเรื่องของเสียครับ', jp: 'マネージャー、不良品の問題があります', name: 'プリーヤー' },
  delivery: { thai: 'สวัสดีครับ โทรมาเรื่องอะไรครับ', jp: 'こんにちは。どのようなご用件でしょうか？', name: 'チャナポン' },
  safety: { thai: 'สวัสดีครับ มีอะไรให้ช่วยครับ', jp: 'こんにちは。何かお手伝いできますか？', name: 'ナッタウット' },
};

// ---- ドリル状態 ----
let drillList = [...drillScenarios];
let drillIndex = 0;
let drillSceneFilter = 'all';
let drillMode = 'drill'; // 'drill' | 'sim'
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let simHistory = [];
let currentSimScene = null;

function switchDrillMode(mode, btn) {
  drillMode = mode;
  document.querySelectorAll('#drill .mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('drillPanel').style.display = mode === 'drill' ? '' : 'none';
  document.getElementById('simPanel').style.display = mode === 'sim' ? '' : 'none';
}

function setDrillScene(scene, btn) {
  drillSceneFilter = scene;
  document.querySelectorAll('#drill .scene-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  drillList = scene === 'all' ? [...drillScenarios] : drillScenarios.filter(s => s.scene === scene);
  drillList = shuffle(drillList);
  drillIndex = 0;
  renderDrillCard();
}

function renderDrillCard() {
  if (drillList.length === 0) return;
  const s = drillList[drillIndex % drillList.length];
  document.getElementById('drillPromptJP').textContent = s.jp;
  const sceneNames = { morning: '☀️ 朝礼', defect: '⚠️ 不良対応', instruction: '📢 作業指示', safety: '⛑ 安全' };
  document.getElementById('drillSceneTag').textContent = sceneNames[s.scene] || '';
  document.getElementById('drillCounter').textContent = (drillIndex % drillList.length + 1) + ' / ' + drillList.length;
  // 結果エリアをリセット
  document.getElementById('drillResultArea').style.display = 'none';
  document.getElementById('drillUserText').textContent = '–';
  document.getElementById('drillFeedback').textContent = '–';
  document.getElementById('drillModelThai').textContent = '–';
  document.getElementById('drillModelRomaji').textContent = '–';
  document.getElementById('drillModelJP').textContent = '–';
  // 録音ボタンをリセット
  resetRecordBtn('drillRecordBtn', 'drillRecordStatus', 'ボタンを押してタイ語で話す');
}

function nextDrill() { drillIndex++; renderDrillCard(); }
function prevDrill() { drillIndex = Math.max(0, drillIndex - 1); renderDrillCard(); }

function resetRecordBtn(btnId, statusId, msg) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = '🎙'; btn.style.borderColor = 'var(--red)'; btn.style.background = 'var(--surface2)'; }
  const st = document.getElementById(statusId);
  if (st) st.textContent = msg;
}

// ---- Whisper API ----
async function sendToWhisper(audioBlob) {
  const key = getOpenAIKey();
  if (!key) return null;
  const form = new FormData();
  // MIMEタイプに合わせて拡張子を決定（iOS SafariはMP4を使用）
  const ext = audioBlob.type.includes('mp4') ? 'm4a'
             : audioBlob.type.includes('ogg') ? 'ogg'
             : 'webm';
  form.append('file', audioBlob, `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'th');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key },
    body: form
  });
  if (!res.ok) throw new Error('Whisper error: ' + res.status);
  const data = await res.json();
  return data.text;
}

// ---- MediaRecorder 共通 ----
// iOS SafariはaudioWebMに対応しないためMP4に自動切替
function getSupportedMimeType() {
  const types = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ''; // ブラウザのデフォルトに任せる
}

async function startMediaRecorder(onStop) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  const mimeType = getSupportedMimeType();
  mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(audioChunks, { type: actualMime });
    await onStop(blob);
  };
  mediaRecorder.start();
  isRecording = true;
}

function stopMediaRecorder() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
  }
}

// ---- 指示出しドリル 録音 ----
async function toggleDrillRecord() {
  if (!getOpenAIKey()) {
    document.getElementById('drillRecordStatus').textContent = '⚠️ 設定画面でOpenAI APIキーを入力してください';
    return;
  }
  if (!isRecording) {
    try {
      const btn = document.getElementById('drillRecordBtn');
      btn.textContent = '⏹';
      btn.style.borderColor = 'var(--green)';
      btn.style.background = 'rgba(94,184,138,0.15)';
      document.getElementById('drillRecordStatus').textContent = '録音中... もう一度押すと停止';
      await startMediaRecorder(async (blob) => {
        document.getElementById('drillRecordStatus').textContent = '認識中...';
        try {
          const text = await sendToWhisper(blob);
          document.getElementById('drillUserText').textContent = text || '（認識できませんでした）';
          document.getElementById('drillResultArea').style.display = 'flex';
          if (text) await getDrillFeedback(text);
        } catch(e) {
          document.getElementById('drillRecordStatus').textContent = '⚠️ 認識エラー: ' + e.message;
        }
        resetRecordBtn('drillRecordBtn', 'drillRecordStatus', 'もう一度話す');
      });
    } catch(e) {
      document.getElementById('drillRecordStatus').textContent = '⚠️ マイクが使えません: ' + e.message;
      isRecording = false;
    }
  } else {
    stopMediaRecorder();
    document.getElementById('drillRecordStatus').textContent = '処理中...';
  }
}

// ---- Claudeフィードバック ----
async function getDrillFeedback(userText) {
  const key = getClaudeKey();
  const scenario = drillList[drillIndex % drillList.length];
  document.getElementById('drillFeedback').textContent = '考え中...';
  // お手本を先に表示
  document.getElementById('drillModelThai').textContent = scenario.thai;
  document.getElementById('drillModelRomaji').textContent = scenario.romaji;
  document.getElementById('drillModelJP').textContent = scenario.jp;

  if (!key) {
    document.getElementById('drillFeedback').textContent = '（Claude APIキーを設定するとフィードバックが得られます）';
    return;
  }
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `タイ語学習者のスピーキング練習のフィードバックをしてください。\nお題（日本語）：「${scenario.jp}」\nお手本（タイ語）：「${scenario.thai}」\n学習者が言ったこと：「${userText}」\n\n簡潔なフィードバックを日本語で（3行以内）：\n・意味は通じているか\n・お手本との主な違い（あれば）\n・一言アドバイス`
      }]
    });
    document.getElementById('drillFeedback').textContent = data.content[0].text;
    logLearningEvent({ type: 'drill', scene: scenario.scene, jp: scenario.jp });
  } catch(e) {
    document.getElementById('drillFeedback').textContent = '⚠️ フィードバック取得エラー';
  }
}

function playDrillModel() {
  const text = document.getElementById('drillModelThai').textContent;
  if (text && text !== '–') playAudioTTS(text);
}

// ---- Phase 5: 弱点分析 + 集中ドリル ----

function logLearningEvent(event) {
  const LOG_KEY = 'learningLog_v1';
  const MAX_DAYS = 14;
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const now = Date.now();
  log.push({ ...event, ts: now });
  // 14日以上古いものを削除
  const cutoff = now - MAX_DAYS * 24 * 60 * 60 * 1000;
  const trimmed = log.filter(e => e.ts >= cutoff);
  localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
}

async function analyzeWeakness() {
  const LOG_KEY = 'learningLog_v1';
  const key = getClaudeKey();
  const btn = document.getElementById('analyzeBtn');
  const statusEl = document.getElementById('weaknessStatus');
  const resultEl = document.getElementById('weaknessResult');
  const textEl = document.getElementById('weaknessAnalysisText');
  const focusBtn = document.getElementById('focusDrillBtn');

  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentLog = log.filter(e => e.ts >= cutoff);

  if (recentLog.length < 5) {
    statusEl.textContent = '学習データが少なすぎます（5件以上必要）。単語カードや文法ドリルを続けてください。';
    return;
  }

  if (!key) {
    statusEl.textContent = '⚠️ Claude APIキーを設定してください（⚙️設定タブ）';
    return;
  }

  btn.disabled = true;
  btn.textContent = '分析中...';
  resultEl.style.display = 'none';

  // ログを集計
  const vocabUnknown = recentLog.filter(e => e.type === 'vocab' && e.rating === 'unknown').map(e => e.word);
  const vocabFuzzy = recentLog.filter(e => e.type === 'vocab' && e.rating === 'fuzzy').map(e => e.word);
  const vocabKnow = recentLog.filter(e => e.type === 'vocab' && e.rating === 'know').map(e => e.word);
  const grammarAll = recentLog.filter(e => e.type === 'grammar').map(e => e.pattern);
  const drillAll = recentLog.filter(e => e.type === 'drill').map(e => e.jp);

  const summary = `
過去7日間の学習ログ（合計${recentLog.length}件）:
【単語カード】
- 「わからない」: ${[...new Set(vocabUnknown)].join('、') || 'なし'} (${vocabUnknown.length}回)
- 「うろ覚え」: ${[...new Set(vocabFuzzy)].join('、') || 'なし'} (${vocabFuzzy.length}回)
- 「知ってる」: ${vocabKnow.length}回
【文法ドリル】
- 練習したパターン: ${[...new Set(grammarAll)].join('、') || 'なし'}
【スピーキングドリル】
- 練習したお題: ${[...new Set(drillAll)].join('、') || 'なし'}
`.trim();

  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `タイ語学習者の1週間の学習ログを分析してください。\n${summary}\n\n以下を日本語で簡潔に答えてください（合計5〜8行）：\n1. 弱点・苦手なポイント（具体的な単語・文法パターン名を挙げて）\n2. 重点的に練習すべきこと（1〜2点）\n3. 励ましのひとこと`
      }]
    });
    textEl.textContent = data.content[0].text;
    resultEl.style.display = 'flex';

    // 弱点単語が5つ以上あれば集中ドリルボタン表示
    const weakWords = [...new Set([...vocabUnknown, ...vocabFuzzy])];
    if (weakWords.length >= 3) {
      focusBtn.style.display = 'block';
      focusBtn.dataset.weakWords = JSON.stringify(weakWords);
    } else {
      focusBtn.style.display = 'none';
    }
    statusEl.textContent = `分析完了（${recentLog.length}件のログをもとに）`;
  } catch(e) {
    textEl.textContent = '⚠️ 分析エラー: ' + e.message;
    resultEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 1週間の弱点を分析する';
  }
}

function startFocusDrill() {
  const focusBtn = document.getElementById('focusDrillBtn');
  const weakWordsRaw = focusBtn.dataset.weakWords;
  if (!weakWordsRaw) return;
  const weakWords = JSON.parse(weakWordsRaw);

  // vocabDataから弱点単語を検索
  const allVocab = Object.values(vocabData).flat();
  const focusCards = allVocab.filter(c => weakWords.includes(c.thai));

  if (focusCards.length === 0) {
    alert('弱点単語が単語データに見つかりませんでした。');
    return;
  }

  // 集中ドリル用にカードをセット
  currentCards = shuffle([...focusCards]);
  cardIndex = 0;
  currentCategory = 'focus';

  // 単語カードタブに切り替えてカード表示
  switchTab('vocab', true);
  showCard();
}

// ---- Phase 6: AI フレーズ生成 + マイ単語保存 ----

function getCustomVocab() {
  return JSON.parse(localStorage.getItem('customVocab_v1') || '[]');
}

function updateAigenSavedCount() {
  const el = document.getElementById('aigenSavedCount');
  if (el) el.textContent = getCustomVocab().length + ' 件';
}

async function generatePhrases() {
  const key = getClaudeKey();
  if (!key) {
    alert('Claude APIキーを設定してください（⚙️設定タブ）');
    return;
  }
  const input = document.getElementById('aigenInput').value.trim();
  if (!input) {
    alert('場面を入力してください');
    return;
  }

  const btn = document.getElementById('aigenBtn');
  const statusEl = document.getElementById('aigenStatus');
  const resultEl = document.getElementById('aigenResult');

  btn.disabled = true;
  btn.textContent = '生成中...';
  statusEl.style.display = 'block';
  statusEl.textContent = '🤖 Claudeがフレーズを考えています...';
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';

  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `あなたはタイ語の専門家です。製造業の日本人管理職がタイ人スタッフに話しかける場面です。
場面：「${input}」
この場面で使えるタイ語フレーズを3パターン、以下のJSON形式のみで返してください（余分なテキスト不要）：
{
  "polite": { "thai": "...", "romaji": "...", "jp": "...", "note": "..." },
  "normal": { "thai": "...", "romaji": "...", "jp": "...", "note": "..." },
  "casual": { "thai": "...", "romaji": "...", "jp": "...", "note": "..." }
}
- polite: ครับ/ค่ะを使った丁寧表現（初対面・目上向け）
- normal: 普通の表現（普段の指示・報告）
- casual: くだけた表現（気心知れた部下向け）
- noteには使い方ひとことメモ（日本語・1行）`
      }]
    });
    const rawText = data.content[0].text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('レスポンスのフォーマットが不正です');
    const phrases = JSON.parse(jsonMatch[0]);
    renderGeneratedCards(phrases, input);
    statusEl.style.display = 'none';
    resultEl.style.display = 'flex';
  } catch(e) {
    statusEl.textContent = '⚠️ エラー: ' + (e.message || e.toString());
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ タイ語フレーズを生成する';
  }
}

function renderGeneratedCards(phrases, scene) {
  const resultEl = document.getElementById('aigenResult');
  resultEl.innerHTML = '';

  const levels = [
    { key: 'polite', label: '🙏 丁寧', color: 'var(--accent)' },
    { key: 'normal', label: '💬 普通', color: 'var(--green)' },
    { key: 'casual', label: '😄 カジュアル', color: 'var(--accent2)' }
  ];

  levels.forEach(({ key, label, color }) => {
    const p = phrases[key];
    if (!p) return;

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:8px;';

    const ttsId = 'aigen_' + key + '_tts';
    const saveId = 'aigen_' + key + '_save';

    card.innerHTML = `
      <div style="font-size:0.72rem; color:${color}; font-weight:600; letter-spacing:0.05em;">${label}</div>
      <div style="font-size:1.35rem; color:var(--text); font-family:'Sarabun',sans-serif; line-height:1.5;">${p.thai}</div>
      <div style="font-size:0.8rem; color:var(--muted); font-family:'IBM Plex Mono',monospace;">${p.romaji}</div>
      <div style="font-size:0.88rem; color:var(--text-dim);">${p.jp}</div>
      <div style="font-size:0.75rem; color:var(--accent2); background:var(--surface2); border-radius:6px; padding:6px 8px;">💡 ${p.note}</div>
      <div style="display:flex; gap:8px; margin-top:4px;">
        <button id="${ttsId}" style="flex:1; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:10px 8px; cursor:pointer; color:var(--text-dim); font-size:0.82rem;">🔊 発音を聞く</button>
        <button id="${saveId}" style="flex:1; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:10px 8px; cursor:pointer; color:var(--text-dim); font-size:0.82rem;">💾 カードに保存</button>
      </div>
    `;
    resultEl.appendChild(card);

    document.getElementById(ttsId).addEventListener('click', () => {
      playAudioTTS(p.thai, ttsId);
    });

    document.getElementById(saveId).addEventListener('click', function() {
      const cardData = {
        thai: p.thai,
        romaji: p.romaji,
        jp: p.jp,
        example: scene + ' → ' + p.jp,
        frequency: 'high',
        scenes: ['生成']
      };
      saveGeneratedCard(cardData, this);
    });
  });
}

function saveGeneratedCard(card, btn) {
  const cards = getCustomVocab();
  if (cards.some(c => c.thai === card.thai)) {
    btn.textContent = '✅ 保存済み';
    btn.disabled = true;
    return;
  }
  cards.push({ ...card, ts: Date.now() });
  localStorage.setItem('customVocab_v1', JSON.stringify(cards));
  btn.textContent = '✅ 保存しました';
  btn.style.color = 'var(--green)';
  btn.disabled = true;
  updateAigenSavedCount();
}

// ---- 会議シミュレーション ----
function startSim(scene) {
  currentSimScene = scene;
  simHistory = [];
  const opener = simOpeners[scene];
  const convEl = document.getElementById('simConversation');
  convEl.innerHTML = '';
  // シーン開始メッセージ
  addSimMessage('staff', opener.thai, opener.jp, opener.name);
  simHistory.push({ role: 'assistant', content: opener.thai + '（' + opener.jp + '）' });
  document.getElementById('simRecordBtn').disabled = false;
  document.getElementById('simRecordStatus').textContent = 'ボタンを押してタイ語で話す';
  // TTS
  playAudioTTS(opener.thai);
}

function addSimMessage(role, thai, jp, name) {
  const convEl = document.getElementById('simConversation');
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex; flex-direction:column; gap:4px; align-items:${isUser ? 'flex-end' : 'flex-start'};`;
  div.innerHTML = `
    <div style="font-size:0.7rem; color:var(--muted);">${isUser ? '🙋 あなた' : '🤝 ' + (name || 'スタッフ')}</div>
    <div style="background:${isUser ? 'var(--accent)' : 'var(--surface2)'}; color:${isUser ? '#fff' : 'var(--text)'}; border-radius:12px; padding:10px 14px; max-width:85%;">
      <div style="font-family:'Sarabun',sans-serif; font-size:1rem; color:${isUser ? '#fff' : 'var(--thai)'};">${thai}</div>
      ${jp ? `<div style="font-size:0.75rem; color:${isUser ? 'rgba(255,255,255,0.8)' : 'var(--muted)'}; margin-top:4px;">${jp}</div>` : ''}
    </div>`;
  convEl.appendChild(div);
  convEl.scrollTop = convEl.scrollHeight;
}

async function toggleSimRecord() {
  if (!getOpenAIKey()) {
    document.getElementById('simRecordStatus').textContent = '⚠️ 設定画面でOpenAI APIキーを入力してください';
    return;
  }
  if (!isRecording) {
    try {
      const btn = document.getElementById('simRecordBtn');
      btn.textContent = '⏹';
      btn.style.borderColor = 'var(--green)';
      document.getElementById('simRecordStatus').textContent = '録音中... もう一度押すと停止';
      await startMediaRecorder(async (blob) => {
        document.getElementById('simRecordStatus').textContent = '認識中...';
        try {
          const text = await sendToWhisper(blob);
          if (!text) throw new Error('音声を認識できませんでした');
          addSimMessage('user', text, '', '');
          simHistory.push({ role: 'user', content: text });
          document.getElementById('simRecordStatus').textContent = 'スタッフが返答中...';
          await getSimResponse(text);
        } catch(e) {
          document.getElementById('simRecordStatus').textContent = '⚠️ ' + e.message;
        }
        resetRecordBtn('simRecordBtn', 'simRecordStatus', 'ボタンを押してタイ語で話す');
      });
    } catch(e) {
      document.getElementById('simRecordStatus').textContent = '⚠️ マイクが使えません';
      isRecording = false;
    }
  } else {
    stopMediaRecorder();
    document.getElementById('simRecordStatus').textContent = '処理中...';
  }
}

async function getSimResponse(userText) {
  const claudeKey = getClaudeKey();
  const opener = simOpeners[currentSimScene];
  if (!claudeKey) {
    addSimMessage('staff', '（Claude APIキーを設定してください）', '', opener.name);
    return;
  }
  try {
    const sysPrompt = simSystemPrompts[currentSimScene];
    const messages = simHistory.map(h => ({ role: h.role, content: h.content }));
    const data = await claudeFetch(claudeKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: sysPrompt,
      messages
    });
    const reply = data.content[0].text;
    // [タイ語]（日本語訳）のパース
    const match = reply.match(/^(.+?)（(.+?)）/s);
    const thaiPart = match ? match[1].trim() : reply;
    const jpPart = match ? match[2].trim() : '';
    addSimMessage('staff', thaiPart, jpPart, opener.name);
    simHistory.push({ role: 'assistant', content: reply });
    playAudioTTS(thaiPart);
  } catch(e) {
    addSimMessage('staff', '⚠️ エラーが発生しました', e.message, opener.name);
  }
}

function resetSim() {
  currentSimScene = null;
  simHistory = [];
  document.getElementById('simConversation').innerHTML = '<div style="text-align:center; color:var(--muted); font-size:0.85rem; padding:20px 0;">上のシーンを選ぶと会話が始まります</div>';
  document.getElementById('simRecordBtn').disabled = true;
  resetRecordBtn('simRecordBtn', 'simRecordStatus', 'シーンを選んでください');
}

// ドリル初期化
document.addEventListener('DOMContentLoaded', function() {
  drillList = shuffle([...drillScenarios]);
  renderDrillCard();
});

// ---- Expose all functions to global scope for onclick handlers ----
// Must be at the very end so overridden versions are registered
Object.assign(window, {
  playAudio, setSpeechRate, toggleAutoPlay, switchTab, updateProgress,
  setPhraseMode, setPhraseCategory, showPhrase, nextPhrase, prevPhrase, markPhrase,
  setVocabMode, setCategory, setFreqFilter, setSceneFilter,
  startCards, showMeaning, nextCard,
  startSrsReview, toggleGrammar, togglePractice, answerPractice, resetPractice,
  renderHomeScreen,
  // Phase 4
  switchGrammarMode, selectGrammarPattern, startGrammarDrill,
  submitGrammarDrill, nextGrammarDrill, playGrammarModel, toggleGrammarVoice,
  // Phase 5
  analyzeWeakness, startFocusDrill,
  // Phase 6
  generatePhrases,
  // Phase 3
  switchDrillMode, setDrillScene, nextDrill, prevDrill,
  toggleDrillRecord, playDrillModel,
  startSim, toggleSimRecord, resetSim,
  // Phase 2
  saveApiKey, showApiKeys, clearApiKeys
});
