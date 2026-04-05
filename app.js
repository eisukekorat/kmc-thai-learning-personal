// =============================================
// KMC Thai Learning App - app.js (v2: Full Rewrite)
// New UI + 5 New Features + Daily Missions
// =============================================

// ================================
// AUDIO: Google Cloud TTS → OpenAI TTS → Web Speech API
// ================================
const ttsCache = new Map();

async function playAudioTTS(text) {
  if (!text || text === '–' || text.includes('🎉')) return;
  if (ttsCache.has(text)) { new Audio(ttsCache.get(text)).play(); return; }

  const googleKey = getGoogleTTSKey();
  if (googleKey) {
    try {
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + googleKey, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'th-TH', name: 'th-TH-Neural2-C' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: speechRate }
        })
      });
      if (!res.ok) throw new Error('Google TTS error: ' + res.status);
      const data = await res.json();
      const url = 'data:audio/mp3;base64,' + data.audioContent;
      ttsCache.set(text, url); new Audio(url).play(); return;
    } catch (e) { console.warn('Google TTS失敗:', e); }
  }

  const openaiKey = getOpenAIKey();
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', speed: speechRate })
      });
      if (!res.ok) throw new Error('OpenAI TTS error: ' + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      ttsCache.set(text, url); new Audio(url).play(); return;
    } catch (e) { console.warn('OpenAI TTS失敗:', e); }
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH'; u.rate = speechRate;
    window.speechSynthesis.speak(u);
  }
}

function playAudio(type) {
  const text = type === 'phrase'
    ? document.getElementById('phraseThai').textContent
    : document.getElementById('fcThai').textContent;
  playAudioTTS(text);
}

// ================================
// CLAUDE API
// ================================
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const isPWA = window.navigator.standalone === true;

async function claudeFetch(key, body) {
  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST', mode: 'cors', credentials: 'omit',
    headers: {
      'x-api-key': key, 'anthropic-version': '2023-06-01',
      'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error('API ' + res.status + ': ' + (data.error?.message || JSON.stringify(data)));
  return data;
}

function pwaErrorMsg(e) {
  if (e instanceof TypeError && isPWA) return 'ホーム画面アプリではAI機能が制限されます。SafariブラウザでURLを直接開いてご利用ください。';
  return e.message || e.toString();
}

// ================================
// WHISPER ASR
// ================================
async function sendToWhisper(audioBlob) {
  const key = getOpenAIKey();
  if (!key) return null;
  const form = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', audioBlob, `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'th');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: form
  });
  if (!res.ok) throw new Error('Whisper error: ' + res.status);
  const data = await res.json();
  return data.text;
}

// ================================
// MEDIA RECORDER
// ================================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function getSupportedMimeType() {
  const types = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
  for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
  return '';
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
  if (mediaRecorder && isRecording) { mediaRecorder.stop(); isRecording = false; }
}

// ================================
// API KEY MANAGEMENT
// ================================
function getGoogleTTSKey() { return localStorage.getItem('googleTTSApiKey') || ''; }
function getOpenAIKey() { return localStorage.getItem('openaiApiKey') || ''; }
function getClaudeKey() { return localStorage.getItem('claudeApiKey') || ''; }

function saveApiKey(type) {
  const inputMap = { openai: 'openaiKeyInput', claude: 'claudeKeyInput', google: 'googleKeyInput' };
  const statusMap = { openai: 'openaiKeyStatus', claude: 'claudeKeyStatus', google: 'googleKeyStatus' };
  const storageMap = { openai: 'openaiApiKey', claude: 'claudeApiKey', google: 'googleTTSApiKey' };
  const val = document.getElementById(inputMap[type]).value.trim();
  if (!val) { document.getElementById(statusMap[type]).textContent = '⚠️ キーを入力してください'; return; }
  localStorage.setItem(storageMap[type], val);
  document.getElementById(statusMap[type]).textContent = '✅ 保存しました';
  document.getElementById(inputMap[type]).value = '●'.repeat(Math.min(val.length, 20));
  setTimeout(() => { document.getElementById(statusMap[type]).textContent = '✅ 設定済み'; }, 3000);
}

function loadApiKeyStatus() {
  const g = localStorage.getItem('googleTTSApiKey'), o = localStorage.getItem('openaiApiKey'), c = localStorage.getItem('claudeApiKey');
  const ge = document.getElementById('googleKeyStatus'), oe = document.getElementById('openaiKeyStatus'), ce = document.getElementById('claudeKeyStatus');
  if (ge) ge.textContent = g ? '✅ 設定済み' : '未設定';
  if (oe) oe.textContent = o ? '✅ 設定済み' : '未設定';
  if (ce) ce.textContent = c ? '✅ 設定済み' : '未設定';
}

let apiKeysVisible = false;
function showApiKeys() {
  apiKeysVisible = !apiKeysVisible;
  ['google', 'openai', 'claude'].forEach(t => {
    const storageMap = { google: 'googleTTSApiKey', openai: 'openaiApiKey', claude: 'claudeApiKey' };
    const inputMap = { google: 'googleKeyInput', openai: 'openaiKeyInput', claude: 'claudeKeyInput' };
    const key = localStorage.getItem(storageMap[t]) || '';
    const el = document.getElementById(inputMap[t]);
    if (el) {
      el.type = apiKeysVisible ? 'text' : 'password';
      el.value = apiKeysVisible ? key : (key ? '●'.repeat(Math.min(key.length, 20)) : '');
    }
  });
}

function clearApiKeys() {
  if (!confirm('APIキーを全て削除しますか？')) return;
  ['googleTTSApiKey', 'openaiApiKey', 'claudeApiKey'].forEach(k => localStorage.removeItem(k));
  ['googleKeyInput', 'openaiKeyInput', 'claudeKeyInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadApiKeyStatus();
}

// ================================
// SETTINGS: AUDIO
// ================================
let autoPlayAudio = localStorage.getItem('autoPlayAudio') === 'true';
let speechRate = parseFloat(localStorage.getItem('speechRate') || '0.8');

function setSpeechRate(rate, btn) {
  speechRate = rate;
  localStorage.setItem('speechRate', rate);
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function toggleAutoPlay(val) {
  autoPlayAudio = val;
  localStorage.setItem('autoPlayAudio', val);
}

// ================================
// DARK MODE
// ================================
function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true') {
    document.body.classList.add('dark-mode');
  } else if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
  }
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.checked = document.body.classList.contains('dark-mode');
}

function toggleDarkMode(val) {
  document.body.classList.toggle('dark-mode', val);
  localStorage.setItem('darkMode', val);
}

// ================================
// PROGRESS TRACKING
// ================================
function loadProgress() {
  const saved = localStorage.getItem('thaiLearningProgress');
  if (saved) return JSON.parse(saved);
  return { vocabLearned: {}, phrasesLearned: {}, grammarLearned: {} };
}

function saveProgress() { localStorage.setItem('thaiLearningProgress', JSON.stringify(progress)); }

let progress = loadProgress();
let weakWords = JSON.parse(localStorage.getItem('weakWords') || '{}');
function saveWeakWords() { localStorage.setItem('weakWords', JSON.stringify(weakWords)); }
let grammarQuizScores = JSON.parse(localStorage.getItem('grammarQuizScores') || '{}');
function saveGrammarQuizScores() { localStorage.setItem('grammarQuizScores', JSON.stringify(grammarQuizScores)); }

// ================================
// SRS
// ================================
function loadSrsData() { const s = localStorage.getItem('srsData'); return s ? JSON.parse(s) : {}; }
function saveSrsData() { localStorage.setItem('srsData', JSON.stringify(srsData)); }
let srsData = loadSrsData();

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

function getSrsIntervalDays(reviewCount) {
  const intervals = [1, 3, 7, 14, 30];
  return intervals[reviewCount] ?? null;
}

function recordSrs(category, index) {
  const key = category + '_' + index;
  const today = getTodayStr();
  const existing = srsData[key] || { reviewCount: 0 };
  const newCount = existing.reviewCount + 1;
  const intervalDays = getSrsIntervalDays(newCount - 1);
  srsData[key] = { lastReviewed: today, reviewCount: newCount, nextReview: intervalDays !== null ? addDays(today, intervalDays) : null };
  saveSrsData();
}

function recordSrsFuzzy(category, index) {
  const key = category + '_' + index;
  const today = getTodayStr();
  const existing = srsData[key] || { reviewCount: 0 };
  srsData[key] = { lastReviewed: today, reviewCount: existing.reviewCount, nextReview: addDays(today, 1) };
  saveSrsData();
}

function getTodayReviewWords() {
  const today = getTodayStr();
  const words = [];
  Object.entries(srsData).forEach(([key, data]) => {
    if (data.nextReview && data.nextReview <= today) {
      const parts = key.split('_');
      const cat = parts[0];
      const idx = parseInt(parts[1]);
      const word = vocabData[cat]?.[idx];
      if (word) words.push({ key, word, data, cat, idx });
    }
  });
  return words;
}

// ================================
// LEARNING LOG
// ================================
function logLearningEvent(event) {
  const LOG_KEY = 'learningLog_v1';
  const MAX_DAYS = 14;
  const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  const now = Date.now();
  log.push({ ...event, ts: now });
  const cutoff = now - MAX_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(LOG_KEY, JSON.stringify(log.filter(e => e.ts >= cutoff)));
}

// ================================
// NAVIGATION
// ================================
let lastMainPage = 'home';
const mainPages = ['home', 'library', 'practice', 'progress', 'settings'];

function switchPage(pageId) {
  const update = () => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');
    document.getElementById('bottomNav').style.display = '';
    if (mainPages.includes(pageId)) lastMainPage = pageId;
    if (pageId === 'home') renderHomeScreen();
    if (pageId === 'progress') renderProgressPage();
  };
  if (document.startViewTransition) document.startViewTransition(update);
  else update();
}

function openSubPage(subPageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + subPageId).classList.add('active');
  // Initialize sub-page content on open
  if (subPageId === 'vocab') startCards();
  if (subPageId === 'phrases') { currentPhrases = getPhraseList(); phraseIndex = 0; phraseRevealed = false; showPhrase(); }
  if (subPageId === 'grammar') renderGrammarCards();
  if (subPageId === 'listening') { document.getElementById('listeningSetup').style.display = ''; document.getElementById('listeningQuiz').style.display = 'none'; document.getElementById('listeningResult').style.display = 'none'; }
  if (subPageId === 'matching') { document.getElementById('matchingSetup').style.display = ''; document.getElementById('matchingGame').style.display = 'none'; document.getElementById('matchingResult').style.display = 'none'; }
  if (subPageId === 'diary') { renderDiaryHistory(); }
  if (subPageId === 'shadowing') { renderShadowHistory(); }
  if (subPageId === 'scanner') { renderScanGallery(); }
  if (subPageId === 'ai-generator') updateAigenSavedCount();
}

function goBack() { switchPage(lastMainPage); }

// ================================
// STREAK (with freeze)
// ================================
function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function updateStreak() {
  const today = getTodayStr();
  const last = localStorage.getItem('lastAccessDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0');
  if (last === today) return streak;
  const yesterday = addDays(today, -1);
  if (last === yesterday) {
    streak += 1;
  } else {
    const freezeUsed = localStorage.getItem('streakFreezeUsed') || '';
    const freezeWeekStart = getWeekStart(today);
    if (freezeUsed < freezeWeekStart) {
      localStorage.setItem('streakFreezeUsed', today);
      streak += 1;
    } else {
      streak = 1;
    }
  }
  localStorage.setItem('lastAccessDate', today);
  localStorage.setItem('streakCount', String(streak));
  return streak;
}

function initStreak() {
  const today = getTodayStr();
  const last = localStorage.getItem('lastAccessDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0');
  if (last === today) {
    // same day
  } else if (last) {
    const yesterday = addDays(today, -1);
    if (last === yesterday) { streak += 1; }
    else {
      const freezeUsed = localStorage.getItem('streakFreezeUsed') || '';
      const freezeWeekStart = getWeekStart(today);
      if (freezeUsed < freezeWeekStart) {
        localStorage.setItem('streakFreezeUsed', today);
      } else {
        streak = 1;
      }
    }
  } else { streak = 1; }
  localStorage.setItem('lastAccessDate', today);
  localStorage.setItem('streakCount', String(streak));
  const el = document.getElementById('streakNumber');
  if (el) el.textContent = String(streak);
  return streak;
}

function getGreeting() {
  const hour = new Date().getHours();
  const last = localStorage.getItem('lastAccessDate');
  const today = getTodayStr();
  const daysSinceLast = last ? Math.floor((new Date(today) - new Date(last)) / 86400000) : 0;
  let thai, jp;
  if (hour < 12) { thai = 'สวัสดีตอนเช้า'; jp = 'おはよう'; }
  else if (hour < 17) { thai = 'สวัสดีตอนบ่าย'; jp = 'こんにちは'; }
  else { thai = 'สวัสดีตอนเย็น'; jp = 'こんばんは'; }
  if (daysSinceLast >= 3) return `${thai}！おかえり！また始めよう 💪`;
  return `${thai}！${jp}`;
}

// ================================
// LEVEL SYSTEM
// ================================
const LEVELS = [
  { level: 1, name: '挨拶マスター', xpRequired: 0, description: '基本の挨拶・自己紹介ができる' },
  { level: 2, name: '工場の新人', xpRequired: 100, description: '基本の仕事単語がわかる' },
  { level: 3, name: '指示出し見習い', xpRequired: 300, description: '簡単な指示・質問ができる' },
  { level: 4, name: '品質管理の仲間', xpRequired: 600, description: '品質の議論に参加できる' },
  { level: 5, name: '会議の参加者', xpRequired: 1000, description: '会議で意見を述べられる' },
  { level: 6, name: 'タイ語のプロ', xpRequired: 1500, description: 'ビジネス全般に対応できる' },
];

function calculateXP() {
  const srsCount = Object.keys(srsData).length;
  const vocabLearned = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length;
  const phrasesLearned = Object.keys(progress.phrasesLearned).filter(k => progress.phrasesLearned[k]).length;
  const grammarLearned = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;
  const diaryCount = JSON.parse(localStorage.getItem('diaryEntries') || '[]').length;
  const missionHistory = JSON.parse(localStorage.getItem('missionHistory') || '{}');
  const missionDays = Object.keys(missionHistory).length;
  return srsCount * 2 + vocabLearned + phrasesLearned + grammarLearned * 5 + diaryCount * 10 + missionDays * 5;
}

function getCurrentLevel() {
  const xp = calculateXP();
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xpRequired) current = level;
    else break;
  }
  const next = LEVELS[current.level] || null;
  return { ...current, xp, nextLevel: next };
}

function renderLevelUI(nameId, fillId, textId, descId) {
  const lv = getCurrentLevel();
  const nameEl = document.getElementById(nameId);
  if (nameEl) nameEl.textContent = `Level ${lv.level}: ${lv.name}`;
  if (descId) { const d = document.getElementById(descId); if (d) d.textContent = lv.description; }
  const fillEl = document.getElementById(fillId);
  const textEl = document.getElementById(textId);
  if (lv.nextLevel) {
    const range = lv.nextLevel.xpRequired - lv.xpRequired;
    const current = lv.xp - lv.xpRequired;
    const pct = Math.min(100, Math.round(current / range * 100));
    if (fillEl) fillEl.style.width = pct + '%';
    if (textEl) textEl.textContent = `${lv.xp} XP → 次のレベルまで ${lv.nextLevel.xpRequired - lv.xp} XP`;
  } else {
    if (fillEl) fillEl.style.width = '100%';
    if (textEl) textEl.textContent = `${lv.xp} XP — MAX LEVEL!`;
  }
}

// ================================
// DAILY MISSIONS
// ================================
const MISSION_TYPES = [
  { id: 'srs_review', name: 'SRS復習', icon: '🔄', time: 2, description: '復習カードを5枚チェック', threshold: 5, condition: () => getTodayReviewWords().length > 0 },
  { id: 'listening', name: 'リスニング', icon: '👂', time: 1, description: '3問のリスニングクイズ', threshold: 3, condition: () => true },
  { id: 'matching', name: 'マッチング', icon: '🎮', time: 2, description: '神経衰弱を1回クリア', threshold: 1, condition: () => true },
  { id: 'diary', name: '一言日記', icon: '📝', time: 2, description: 'タイ語で1文書く', threshold: 1, condition: () => !!getClaudeKey() },
  { id: 'shadowing', name: 'シャドーイング', icon: '🔊', time: 2, description: 'お手本を3回真似する', threshold: 3, condition: () => !!getGoogleTTSKey() || !!getOpenAIKey() },
  { id: 'grammar_quiz', name: '文法クイズ', icon: '📖', time: 1, description: '文法問題を2問', threshold: 2, condition: () => true },
  { id: 'new_vocab', name: '新単語', icon: '📚', time: 2, description: '新しい単語を5つ覚える', threshold: 5, condition: () => true },
];

function generateDailyMissions() {
  const today = getTodayStr();
  const saved = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  if (saved.date === today) return saved;

  const yesterdayMissions = JSON.parse(localStorage.getItem('missionHistory') || '{}');
  const yesterday = addDays(today, -1);
  const yesterdayIds = yesterdayMissions[yesterday]?.missionIds || [];

  let available = MISSION_TYPES.filter(m => m.condition());
  const missions = [];

  const srs = available.find(m => m.id === 'srs_review');
  if (srs) { missions.push(srs.id); available = available.filter(m => m.id !== 'srs_review'); }

  const remaining = available.filter(m => !yesterdayIds.includes(m.id) && !missions.includes(m.id));
  const shuffled = remaining.sort(() => Math.random() - 0.5);
  while (missions.length < 3 && shuffled.length > 0) missions.push(shuffled.shift().id);
  if (missions.length < 3) {
    const extra = available.filter(m => !missions.includes(m.id)).sort(() => Math.random() - 0.5);
    while (missions.length < 3 && extra.length > 0) missions.push(extra.shift().id);
  }

  const data = { date: today, missionIds: missions, completed: [], progress: {} };
  missions.forEach(id => { data.progress[id] = 0; });
  localStorage.setItem('dailyMissions', JSON.stringify(data));
  return data;
}

function trackMissionProgress(missionId, amount) {
  const data = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  if (data.date !== getTodayStr()) return;
  if (!data.missionIds?.includes(missionId)) return;
  if (data.completed?.includes(missionId)) return;
  if (!data.progress) data.progress = {};
  data.progress[missionId] = (data.progress[missionId] || 0) + (amount || 1);
  const type = MISSION_TYPES.find(m => m.id === missionId);
  if (type && data.progress[missionId] >= type.threshold) {
    completeMission(missionId, data);
  } else {
    localStorage.setItem('dailyMissions', JSON.stringify(data));
  }
}

function completeMission(missionId, data) {
  if (!data) data = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  if (!data.completed) data.completed = [];
  if (data.completed.includes(missionId)) return;
  data.completed.push(missionId);
  localStorage.setItem('dailyMissions', JSON.stringify(data));
  if (navigator.vibrate) navigator.vibrate(50);

  if (data.completed.length >= data.missionIds.length) {
    triggerConfetti();
    saveMissionHistory(data);
  }
  updateBadge();
  if (document.querySelector('#page-home.active')) renderMissions();
}

function saveMissionHistory(data) {
  const history = JSON.parse(localStorage.getItem('missionHistory') || '{}');
  history[data.date] = { completed: data.completed.length, total: data.missionIds.length, missionIds: data.missionIds };
  localStorage.setItem('missionHistory', JSON.stringify(history));
}

function startMission(missionId) {
  switch (missionId) {
    case 'srs_review': openSubPage('vocab'); setTimeout(() => startSrsReview(), 100); break;
    case 'listening': openSubPage('listening'); break;
    case 'matching': openSubPage('matching'); break;
    case 'diary': openSubPage('diary'); break;
    case 'shadowing': openSubPage('shadowing'); break;
    case 'grammar_quiz': openSubPage('grammar'); setTimeout(() => switchGrammarMode('drill', null), 100); break;
    case 'new_vocab': openSubPage('vocab'); break;
  }
}

function renderMissions() {
  const data = generateDailyMissions();
  const dotsEl = document.getElementById('missionDots');
  const listEl = document.getElementById('missionList');
  if (!dotsEl || !listEl) return;

  dotsEl.innerHTML = data.missionIds.map(id => {
    const done = data.completed.includes(id);
    return `<span class="mission-dot${done ? ' done' : ''}">${done ? '●' : '○'}</span>`;
  }).join(' ');

  listEl.innerHTML = data.missionIds.map(id => {
    const type = MISSION_TYPES.find(m => m.id === id);
    if (!type) return '';
    const done = data.completed.includes(id);
    const prog = data.progress?.[id] || 0;
    return `<div class="mission-card${done ? ' done' : ''}" onclick="${done ? '' : `startMission('${id}')`}" style="cursor:${done ? 'default' : 'pointer'}">
      <span class="mission-icon">${type.icon}</span>
      <div class="mission-info">
        <div class="mission-name">${type.name}</div>
        <div class="mission-desc">${type.description}${!done && prog > 0 ? ` (${prog}/${type.threshold})` : ''}</div>
      </div>
      <span class="mission-check">${done ? '✅' : ''}</span>
    </div>`;
  }).join('');
}

function updateBadge() {
  if (!navigator.setAppBadge) return;
  const data = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  const remaining = (data.missionIds?.length || 0) - (data.completed?.length || 0);
  if (remaining > 0) navigator.setAppBadge(remaining);
  else navigator.clearAppBadge?.();
}

// ================================
// HOME SCREEN
// ================================
function renderHomeScreen() {
  const greetEl = document.getElementById('greetingText');
  if (greetEl) greetEl.textContent = getGreeting();
  const streakEl = document.getElementById('streakNumber');
  if (streakEl) streakEl.textContent = localStorage.getItem('streakCount') || '0';
  renderLevelUI('levelName', 'levelProgressFill', 'levelProgressText');
  renderMissions();
  renderWeeklyStats();
}

function renderWeeklyStats() {
  const vocabCount = Object.keys(progress.vocabLearned).filter(k => progress.vocabLearned[k]).length;
  const streak = parseInt(localStorage.getItem('streakCount') || '0');
  const history = JSON.parse(localStorage.getItem('missionHistory') || '{}');
  const today = new Date();
  let weekMissions = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (history[ds]) weekMissions += history[ds].completed;
  }
  const we = document.getElementById('weeklyVocab'); if (we) we.textContent = vocabCount;
  const ws = document.getElementById('weeklyStreak'); if (ws) ws.textContent = streak;
  const wm = document.getElementById('weeklyMissions'); if (wm) wm.textContent = weekMissions;
}

// ================================
// PROGRESS PAGE
// ================================
function renderProgressPage() {
  renderLevelUI('progressLevelName', 'progressLevelFill', 'progressLevelText', 'progressLevelDesc');
  const srsCount = Object.keys(srsData).length;
  const streak = parseInt(localStorage.getItem('streakCount') || '0');
  const grammarCount = Object.keys(progress.grammarLearned).filter(k => progress.grammarLearned[k]).length;
  const sc = document.getElementById('statSrsCount'); if (sc) sc.textContent = srsCount;
  const sk = document.getElementById('statStreakCount'); if (sk) sk.textContent = streak;
  const sg = document.getElementById('statGrammarCount'); if (sg) sg.textContent = grammarCount + '/20';

  renderLearningChart();
  renderSrsReview();
}

function renderSrsReview() {
  const reviewWords = getTodayReviewWords();
  const srsCount = Object.keys(srsData).length;
  const srsBox = document.getElementById('srsBox');
  const listEl = document.getElementById('srsReviewList');
  const startBtn = document.getElementById('srsStartBtn');
  if (!srsBox) return;

  if (reviewWords.length === 0) {
    if (srsCount > 0) {
      srsBox.style.display = 'block';
      listEl.innerHTML = '<div class="srs-empty">復習すべき単語はありません 🎉</div>';
      startBtn.style.display = 'none';
    } else {
      srsBox.style.display = 'none';
    }
  } else {
    srsBox.style.display = 'block';
    listEl.innerHTML = reviewWords.map(item => {
      const overdue = Math.floor((new Date(getTodayStr()) - new Date(item.data.nextReview)) / 86400000) + 1;
      return `<div class="srs-word-row"><div><div class="srs-word-thai">${item.word.thai}</div><div class="srs-word-jp">${item.word.jp}</div></div><span class="srs-overdue">${overdue > 1 ? overdue + '日超過' : '今日'}</span></div>`;
    }).join('');
    startBtn.style.display = 'block';
  }

  // Chart
  const chartSection = document.getElementById('chartSection');
  const storedLog = JSON.parse(localStorage.getItem('learningLog_v1') || '[]');
  if (chartSection) chartSection.style.display = storedLog.length > 0 ? 'block' : 'none';
}

let srsReviewQueue = [];
function startSrsReview() {
  const reviewWords = getTodayReviewWords();
  if (reviewWords.length === 0) return;
  srsReviewQueue = reviewWords;
  openSubPage('vocab');
  currentCategory = reviewWords[0].cat;
  vocabMode = 'review';
  currentCards = reviewWords.map(item => item.word);
  cardIndex = 0; revealed = false;
  document.getElementById('fcButtons').style.display = 'flex';
  document.getElementById('fcNext').style.display = 'none';
  showCard();
}

// ================================
// VOCAB FLASHCARDS
// ================================
let currentCategory = 'work';
let currentCards = [];
let cardIndex = 0;
let revealed = false;
let vocabMode = 'learn';
let freqFilter = localStorage.getItem('vocabFreqFilter') || 'all';
let sceneFilter = localStorage.getItem('vocabSceneFilter') || 'all';

function setVocabMode(mode, btn) {
  vocabMode = mode;
  if (btn) {
    btn.parentElement.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  startCards();
}

function setCategory(cat, btn) {
  currentCategory = cat;
  if (btn) {
    btn.parentElement.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  startCards();
}

function getBaseVocab(category) {
  if (category === 'custom') return getCustomVocab();
  if (category === 'focus') return Object.values(vocabData).flat();
  return (vocabData[category] || []).slice(0, 80);
}

function getVocabList() {
  const baseVocab = getBaseVocab(currentCategory);
  let allVocab = baseVocab;
  if (freqFilter === 'weak') {
    allVocab = allVocab.filter((v, idx) => weakWords[currentCategory + '_' + baseVocab.indexOf(v)]);
  } else if (freqFilter !== 'all') {
    allVocab = allVocab.filter(v => v.frequency === freqFilter);
  }
  if (sceneFilter !== 'all') {
    allVocab = allVocab.filter(v => v.scenes && v.scenes.includes(sceneFilter));
  }
  if (vocabMode === 'learn') {
    return allVocab.filter(v => { const i = baseVocab.indexOf(v); return !progress.vocabLearned[currentCategory + '_' + i]; });
  }
  return allVocab;
}

function setFreqFilter(val, btn) {
  freqFilter = val;
  localStorage.setItem('vocabFreqFilter', val);
  if (btn) { btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  startCards();
}

function setSceneFilter(val, btn) {
  sceneFilter = val;
  localStorage.setItem('vocabSceneFilter', val);
  if (btn) { btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  startCards();
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function startCards() {
  const list = getVocabList();
  currentCards = vocabMode === 'learn' ? shuffle(list) : list;
  cardIndex = 0; revealed = false;
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
  document.getElementById('fcThai').textContent = c.thai;
  document.getElementById('fcRomaji').textContent = c.romaji;
  document.getElementById('fcMeaning').textContent = c.jp;
  document.getElementById('fcMeaning').classList.remove('show');
  document.getElementById('fcExample').textContent = c.example || '';
  document.getElementById('fcExample').classList.remove('show');
  document.getElementById('cardCounter').textContent = (cardIndex + 1) + ' / ' + currentCards.length;
  document.getElementById('fcButtons').style.display = 'none';
  document.getElementById('tapHint').style.display = '';
  const tipArea = document.getElementById('claudeTipArea');
  if (tipArea) tipArea.style.display = 'none';
  revealed = false;
  if (autoPlayAudio) setTimeout(() => playAudio('vocab'), 300);
}

function showMeaning() {
  if (!revealed) {
    document.getElementById('fcMeaning').classList.add('show');
    document.getElementById('fcExample').classList.add('show');
    document.getElementById('tapHint').style.display = 'none';
    if (vocabMode === 'learn') document.getElementById('fcButtons').style.display = 'flex';
    revealed = true;
  }
}

function nextCard(rating) {
  if (rating === true) rating = 'know';
  if (rating === false) rating = 'unknown';
  const c = currentCards[cardIndex];
  const allVocab = getBaseVocab(currentCategory);
  const realIndex = allVocab.indexOf(c);
  const tipArea = document.getElementById('claudeTipArea');
  if (tipArea) tipArea.style.display = 'none';
  logLearningEvent({ type: 'vocab', word: c.thai, jp: c.jp, category: currentCategory, rating });

  if (vocabMode === 'learn') {
    progress.vocabLearned[currentCategory + '_' + realIndex] = (rating === 'know');
    saveProgress();
    if (rating === 'know') { recordSrs(currentCategory, realIndex); trackMissionProgress('new_vocab'); trackMissionProgress('srs_review'); }
    else if (rating === 'fuzzy') { recordSrsFuzzy(currentCategory, realIndex); trackMissionProgress('srs_review'); }
    else { currentCards.push(c); fetchClaudeTip(c); }
  } else {
    if (rating === 'know') { recordSrs(currentCategory, realIndex); trackMissionProgress('srs_review'); }
    else if (rating === 'fuzzy') { recordSrsFuzzy(currentCategory, realIndex); trackMissionProgress('srs_review'); }
    else { currentCards.push(c); fetchClaudeTip(c); }
  }
  cardIndex++; revealed = false;
  document.getElementById('fcButtons').style.display = 'none';
  showCard();
}

async function fetchClaudeTip(word) {
  const key = getClaudeKey();
  const tipArea = document.getElementById('claudeTipArea');
  const tipText = document.getElementById('claudeTipText');
  if (!key || !tipArea || !tipText) return;
  tipArea.style.display = 'block';
  tipText.textContent = '考え中...';
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `タイ語単語「${word.thai}」（読み：${word.romaji}、意味：${word.jp}）の覚え方を日本語で教えてください。以下を簡潔に（合計5行以内）：\n・発音・語感のコツ（日本語の音に近いものがあれば）\n・語呂合わせや記憶の引っかかり\n・製造業・職場での短い例文（タイ語と日本語訳）` }]
    });
    tipText.textContent = data.content[0].text;
  } catch (e) { tipText.textContent = '⚠️ ' + pwaErrorMsg(e); }
}

// ================================
// PHRASES
// ================================
let currentPhraseCategory = 'meeting';
let currentPhrases = [];
let phraseIndex = 0;
let phraseMode = 'learn';
let phraseRevealed = false;

function setPhraseMode(mode) {
  phraseMode = mode;
  document.querySelectorAll('#page-phrases .mode-btn').forEach((b, i) => {
    b.classList.toggle('active', (mode === 'learn' && i === 0) || (mode === 'review' && i === 0 ? false : mode === 'review' && i === 1));
  });
  currentPhrases = getPhraseList(); phraseIndex = 0; phraseRevealed = false; showPhrase();
}

function setPhraseCategory(cat, btn) {
  currentPhraseCategory = cat;
  if (btn) { btn.parentElement.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  currentPhrases = getPhraseList(); phraseIndex = 0; phraseRevealed = false; showPhrase();
}

function getPhraseList() {
  const allPhrases = phrasesData[currentPhraseCategory].slice(0, 50);
  if (phraseMode === 'learn') return allPhrases.filter((p, i) => !progress.phrasesLearned[currentPhraseCategory + '_' + i]);
  return allPhrases;
}

function showPhrase() {
  phraseRevealed = false;
  const phButtons = document.getElementById('phraseButtons');
  if (phButtons) phButtons.style.display = 'none';
  if (currentPhrases.length === 0) {
    document.getElementById('phraseThai').textContent = '🎉 全て学習済み！';
    document.getElementById('phraseRomaji').textContent = 'おつかれさまでした';
    document.getElementById('phraseJP').textContent = '';
    document.getElementById('phraseJP').classList.remove('show');
    document.getElementById('phraseCounter').textContent = '完了';
    const hint = document.getElementById('phraseTapHint'); if (hint) hint.style.display = 'none';
    return;
  }
  const p = currentPhrases[phraseIndex];
  document.getElementById('phraseThai').textContent = p.thai;
  document.getElementById('phraseRomaji').textContent = p.romaji;
  document.getElementById('phraseJP').textContent = p.jp;
  document.getElementById('phraseJP').classList.remove('show');
  document.getElementById('phraseCounter').textContent = (phraseIndex + 1) + ' / ' + currentPhrases.length;
  const hint = document.getElementById('phraseTapHint'); if (hint) hint.style.display = '';
}

function showPhraseMeaning() {
  if (!phraseRevealed && currentPhrases.length > 0) {
    document.getElementById('phraseJP').classList.add('show');
    const hint = document.getElementById('phraseTapHint'); if (hint) hint.style.display = 'none';
    if (phraseMode === 'learn') { const b = document.getElementById('phraseButtons'); if (b) b.style.display = 'flex'; }
    phraseRevealed = true;
  }
}

function nextPhrase() { if (currentPhrases.length > 0) { phraseIndex = (phraseIndex + 1) % currentPhrases.length; showPhrase(); } }
function prevPhrase() { if (currentPhrases.length > 0) { phraseIndex = (phraseIndex - 1 + currentPhrases.length) % currentPhrases.length; showPhrase(); } }

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

// ================================
// GRAMMAR REFERENCE
// ================================
function renderGrammarCards() {
  const list = document.getElementById('grammarList');
  if (!list || !grammarData) return;
  list.innerHTML = grammarData.map((g, i) => `
    <div class="grammar-card" data-gidx="${i}">
      <div class="grammar-header" onclick="toggleGrammar(this)">
        <span class="grammar-tag">${g.tag}</span>
        <span class="grammar-title">${g.title}</span>
        <span>▾</span>
      </div>
      <div class="grammar-body">
        <div class="pattern-box"><strong>パターン：</strong> ${g.pattern}</div>
        ${g.examples.map(e => `<div class="example-box"><div class="thai">${e.thai}</div><div class="romaji">${e.romaji}</div><div class="jp">${e.jp}</div></div>`).join('')}
        <button class="practice-btn" onclick="togglePractice(${i}, this)">📝 練習問題を開く</button>
        <div class="practice-area" id="practice-${i}">
          ${g.practice.map((q, qi) => `<div class="practice-q" id="pq-${i}-${qi}">
            <div class="practice-q-text">Q${qi + 1}. ${q.question}</div>
            <div class="practice-choices">${q.choices.map((c, ci) => `<button class="practice-choice" onclick="answerPractice(${i},${qi},${ci})" data-ci="${ci}">${c}</button>`).join('')}</div>
            <div class="practice-explanation" id="pexp-${i}-${qi}">${q.explanation}</div>
          </div>`).join('')}
          <div class="practice-perfect" id="pperfect-${i}">🎉 完璧！全問正解です！</div>
          <button class="practice-reset-btn" onclick="resetPractice(${i})">🔄 もう一度</button>
        </div>
      </div>
    </div>`).join('');
}

function toggleGrammar(header) {
  header.nextElementSibling.classList.toggle('open');
  const idx = header.parentElement.dataset.gidx;
  if (idx !== undefined) { progress.grammarLearned['grammar_' + idx] = true; saveProgress(); }
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
  qEl.querySelectorAll('.practice-choice').forEach((b, ci) => {
    b.disabled = true;
    if (ci === q.correct) b.classList.add('correct');
    else if (ci === chosen && ci !== q.correct) b.classList.add('wrong');
  });
  expEl.classList.add('show');
  if (!practiceScore[gidx]) practiceScore[gidx] = {};
  practiceScore[gidx][qi] = (chosen === q.correct);
  if (chosen === q.correct) {
    grammarQuizScores[gidx + '_' + qi] = true;
    saveGrammarQuizScores();
    trackMissionProgress('grammar_quiz');
    if (grammarData[gidx].practice.every((_, qi2) => grammarQuizScores[gidx + '_' + qi2])) {
      progress.grammarLearned['grammar_' + gidx] = true; saveProgress();
    }
  }
  const total = grammarData[gidx].practice.length;
  if (Object.keys(practiceScore[gidx]).length === total && Object.values(practiceScore[gidx]).every(v => v)) {
    document.getElementById('pperfect-' + gidx).classList.add('show');
  }
}

function resetPractice(gidx) {
  delete practiceScore[gidx];
  grammarData[gidx].practice.forEach((q, qi) => {
    document.getElementById('pexp-' + gidx + '-' + qi).classList.remove('show');
    document.getElementById('pq-' + gidx + '-' + qi).querySelectorAll('.practice-choice').forEach(b => { b.disabled = false; b.classList.remove('correct', 'wrong'); });
  });
  document.getElementById('pperfect-' + gidx).classList.remove('show');
}

// ================================
// GRAMMAR AI DRILL
// ================================
let grammarDrillMode = 'ref';
let selectedGrammarPattern = null;
let grammarDrillQuestions = [];
let grammarDrillIndex = 0;
let grammarDrillRecording = false;

function switchGrammarMode(mode, btn) {
  grammarDrillMode = mode;
  if (btn) {
    btn.parentElement.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    document.querySelectorAll('#page-grammar .mode-btn').forEach((b, i) => {
      b.classList.toggle('active', (mode === 'ref' && i === 0) || (mode === 'drill' && i === 1));
    });
  }
  document.getElementById('grammarRefPanel').style.display = mode === 'ref' ? '' : 'none';
  document.getElementById('grammarDrillPanel').style.display = mode === 'drill' ? '' : 'none';
  if (mode === 'drill') renderGrammarDrillSelector();
}

function renderGrammarDrillSelector() {
  const el = document.getElementById('grammarDrillSelector');
  if (!el || !grammarData) return;
  el.innerHTML = grammarData.map((g, i) =>
    `<button class="cat-btn" onclick="selectGrammarPattern(${i}, this)">${g.tag || g.title}</button>`
  ).join('');
}

function selectGrammarPattern(idx, btn) {
  selectedGrammarPattern = idx;
  if (btn) { btn.parentElement.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  const g = grammarData[idx];
  document.getElementById('grammarDrillInfo').style.display = '';
  document.getElementById('grammarDrillPatternName').textContent = g.title;
  document.getElementById('grammarDrillPatternDesc').textContent = g.pattern || '';
  document.getElementById('grammarDrillStartBtn').disabled = false;
}

async function startGrammarDrill() {
  if (selectedGrammarPattern === null) return;
  const key = getClaudeKey();
  if (!key) { alert('設定画面でClaude APIキーを入力してください'); return; }
  const g = grammarData[selectedGrammarPattern];
  document.getElementById('grammarDrillStartArea').style.display = 'none';
  document.getElementById('grammarDrillQuestionArea').style.display = 'flex';
  document.getElementById('grammarDrillResult').style.display = 'none';
  document.getElementById('grammarDrillQ').textContent = '問題を生成中...';
  document.getElementById('grammarDrillHint').textContent = '';
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 600,
      messages: [{ role: 'user', content: `タイ語学習用の文法ドリルを作ってください。\n文法パターン：「${g.title}」（${g.pattern || ''}）\n学習者：日本人、製造業・品質管理\n\nJSON形式のみ：\n[{"question":"日本語のお題","hint":"ヒント","model":"タイ語のお手本"},{"question":"...","hint":"...","model":"..."},{"question":"...","hint":"...","model":"..."}]\n業務関連3問。` }]
    });
    const jsonMatch = data.content[0].text.match(/\[[\s\S]*\]/);
    grammarDrillQuestions = JSON.parse(jsonMatch[0]);
    grammarDrillIndex = 0;
    showGrammarDrillQuestion();
  } catch (e) { document.getElementById('grammarDrillQ').textContent = '⚠️ ' + pwaErrorMsg(e); }
}

function showGrammarDrillQuestion() {
  const answerEl = document.getElementById('grammarDrillAnswer');
  const submitBtnContainer = answerEl?.parentElement;
  if (grammarDrillIndex >= grammarDrillQuestions.length) {
    document.getElementById('grammarDrillQ').textContent = '🎉 全問完了！お疲れさまでした';
    document.getElementById('grammarDrillHint').textContent = '';
    document.getElementById('grammarDrillResult').style.display = 'none';
    document.getElementById('grammarDrillCounter').textContent = '';
    if (answerEl) answerEl.style.display = 'none';
    return;
  }
  const q = grammarDrillQuestions[grammarDrillIndex];
  document.getElementById('grammarDrillQ').textContent = q.question;
  document.getElementById('grammarDrillHint').textContent = '💡 ' + q.hint;
  document.getElementById('grammarDrillResult').style.display = 'none';
  if (answerEl) { answerEl.value = ''; answerEl.style.display = ''; }
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
        model: 'claude-haiku-4-5-20251001', max_tokens: 200,
        messages: [{ role: 'user', content: `タイ語文法ドリル添削。\nパターン：「${g.title}」\nお題：「${q.question}」\nお手本：「${q.model}」\n回答：「${userAnswer}」\n日本語3行以内：正しいか、お手本との違い、アドバイス` }]
      });
      document.getElementById('grammarDrillFeedback').textContent = data.content[0].text;
    } catch (e) { document.getElementById('grammarDrillFeedback').textContent = '（添削取得失敗）'; }
  } else { document.getElementById('grammarDrillFeedback').textContent = '（Claude APIキーを設定すると添削が受けられます）'; }
  logLearningEvent({ type: 'grammar', pattern: g.tag || g.title });
  trackMissionProgress('grammar_quiz');
}

function nextGrammarDrill() { grammarDrillIndex++; showGrammarDrillQuestion(); }
function playGrammarModel() { const t = document.getElementById('grammarDrillModel').textContent; if (t) playAudioTTS(t); }

async function toggleGrammarVoice() {
  if (!getOpenAIKey()) { document.getElementById('grammarVoiceBtn').textContent = '⚠️ OpenAI APIキーが必要'; return; }
  if (!grammarDrillRecording) {
    grammarDrillRecording = true;
    document.getElementById('grammarVoiceBtn').textContent = '⏹ 停止して送信';
    document.getElementById('grammarVoiceBtn').style.borderColor = 'var(--error)';
    await startMediaRecorder(async (blob) => {
      grammarDrillRecording = false;
      document.getElementById('grammarVoiceBtn').textContent = '🎙 音声';
      document.getElementById('grammarVoiceBtn').style.borderColor = '';
      const text = await sendToWhisper(blob);
      if (text) { document.getElementById('grammarDrillAnswer').value = text; submitGrammarDrill(); }
    });
  } else {
    grammarDrillRecording = false; stopMediaRecorder();
    document.getElementById('grammarVoiceBtn').textContent = '🎙 音声';
    document.getElementById('grammarVoiceBtn').style.borderColor = '';
  }
}

// ================================
// SPEAKING DRILL + MEETING SIM
// ================================
const drillScenarios = [
  { scene: 'morning', jp: '今日の生産目標は500個です', thai: 'เป้าหมายการผลิตวันนี้คือ 500 ชิ้นครับ', romaji: 'pâo-mǎai gaan-pà-lìt wan-níi khue 500 chín khráp' },
  { scene: 'morning', jp: '安全に気をつけて作業してください', thai: 'กรุณาทำงานด้วยความระมัดระวังครับ', romaji: 'gà-rú-naa tam-ngaan dûay khwaam-rá-mát-rá-wang khráp' },
  { scene: 'morning', jp: '全員揃いましたか？', thai: 'ครบทุกคนแล้วหรือครับ', romaji: 'khróp túk khon láew rʉ̌e khráp' },
  { scene: 'morning', jp: '今日は残業があります', thai: 'วันนี้มีทำงานล่วงเวลาครับ', romaji: 'wan-níi mii tam-ngaan lûang-wee-laa khráp' },
  { scene: 'defect', jp: 'この部品を検査してください', thai: 'กรุณาตรวจสอบชิ้นส่วนนี้ครับ', romaji: 'gà-rú-naa trùat-sòp chín-sùan níi khráp' },
  { scene: 'defect', jp: '不良品を別にしておいてください', thai: 'กรุณาแยกของเสียออกไว้ก่อนครับ', romaji: 'gà-rú-naa yâek khǎawng-sǐa àwk wái gàwn khráp' },
  { scene: 'defect', jp: '原因は何ですか？', thai: 'สาเหตุคืออะไรครับ', romaji: 'sǎa-hèet khue à-rai khráp' },
  { scene: 'defect', jp: '何個不良がありましたか？', thai: 'มีของเสียกี่ชิ้นครับ', romaji: 'mii khǎawng-sǐa gìi chín khráp' },
  { scene: 'defect', jp: 'ラインを止めてください', thai: 'กรุณาหยุดสายการผลิตครับ', romaji: 'gà-rú-naa yùt sǎai-gaan-pà-lìt khráp' },
  { scene: 'instruction', jp: 'ゆっくり丁寧にやってください', thai: 'กรุณาทำอย่างช้าๆ และระมัดระวังครับ', romaji: 'gà-rú-naa tam yàang cháa-cháa láe rá-mát-rá-wang khráp' },
  { scene: 'instruction', jp: 'この手順に従ってください', thai: 'กรุณาทำตามขั้นตอนนี้ครับ', romaji: 'gà-rú-naa tam taam khân-tàawn níi khráp' },
  { scene: 'instruction', jp: '終わったら報告してください', thai: 'เสร็จแล้วกรุณาแจ้งให้ทราบครับ', romaji: 'sèt láew gà-rú-naa jâeng hâi sâap khráp' },
  { scene: 'instruction', jp: 'こっちを先にやってください', thai: 'กรุณาทำอันนี้ก่อนครับ', romaji: 'gà-rú-naa tam an-níi gàwn khráp' },
  { scene: 'safety', jp: 'ヘルメットをかぶってください', thai: 'กรุณาสวมหมวกนิรภัยครับ', romaji: 'gà-rú-naa sùam mùak-ní-rá-phai khráp' },
  { scene: 'safety', jp: '手袋をつけてください', thai: 'กรุณาสวมถุงมือครับ', romaji: 'gà-rú-naa sùam tǔng-mue khráp' },
  { scene: 'safety', jp: '走らないでください', thai: 'กรุณาอย่าวิ่งครับ', romaji: 'gà-rú-naa yàa wîng khráp' },
  { scene: 'safety', jp: '危険ですので近づかないでください', thai: 'อันตราย กรุณาอย่าเข้าใกล้ครับ', romaji: 'an-tà-raai gà-rú-naa yàa khâo glâi khráp' },
];

const simSystemPrompts = {
  morning: 'あなたはタイの製造工場の従業員（ソムチャイ）です。日本人マネージャーが朝礼で指示を出しています。タイ語で返答し、（）内に日本語訳を付けてください。形式：[タイ語]（日本語訳）',
  defect: 'あなたは品質担当スタッフ（プリーヤー）です。不良品が発生し、日本人マネージャーが確認中。タイ語で返答し、（）内に日本語訳を付けてください。',
  delivery: 'あなたはサプライヤー担当（チャナポン）です。納期について日本人バイヤーと話し合い中。タイ語で返答し、（）内に日本語訳を付けてください。',
  safety: 'あなたは工場スタッフ（ナッタウット）です。日本人マネージャーが安全指示を出しています。タイ語で返答し、（）内に日本語訳を付けてください。',
};

const simOpeners = {
  morning: { thai: 'สวัสดีครับ วันนี้มีอะไรพิเศษไหมครับ', jp: 'おはようございます。今日は何か特別なことありますか？', name: 'ソムチャイ' },
  defect: { thai: 'คุณผู้จัดการครับ มีปัญหาเรื่องของเสียครับ', jp: 'マネージャー、不良品の問題があります', name: 'プリーヤー' },
  delivery: { thai: 'สวัสดีครับ โทรมาเรื่องอะไรครับ', jp: 'こんにちは。どのようなご用件でしょうか？', name: 'チャナポン' },
  safety: { thai: 'สวัสดีครับ มีอะไรให้ช่วยครับ', jp: 'こんにちは。何かお手伝いできますか？', name: 'ナッタウット' },
};

let drillList = [];
let drillIndex = 0;
let drillSceneFilter = 'all';
let drillMode = 'drill';
let simHistory = [];
let currentSimScene = null;

function switchDrillMode(mode, btn) {
  drillMode = mode;
  if (btn) { btn.parentElement.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  else {
    document.querySelectorAll('#page-speaking-drill .mode-btn').forEach((b, i) => {
      b.classList.toggle('active', (mode === 'drill' && i === 0) || (mode === 'sim' && i === 1));
    });
  }
  document.getElementById('drillPanel').style.display = mode === 'drill' ? '' : 'none';
  document.getElementById('simPanel').style.display = mode === 'sim' ? '' : 'none';
}

function setDrillScene(scene, btn) {
  drillSceneFilter = scene;
  if (btn) { btn.parentElement.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  drillList = scene === 'all' ? shuffle([...drillScenarios]) : shuffle(drillScenarios.filter(s => s.scene === scene));
  drillIndex = 0; renderDrillCard();
}

function renderDrillCard() {
  if (drillList.length === 0) return;
  const s = drillList[drillIndex % drillList.length];
  document.getElementById('drillPromptJP').textContent = s.jp;
  const sceneNames = { morning: '☀️ 朝礼', defect: '⚠️ 不良対応', instruction: '📢 作業指示', safety: '⛑ 安全' };
  document.getElementById('drillSceneTag').textContent = sceneNames[s.scene] || '';
  document.getElementById('drillCounter').textContent = (drillIndex % drillList.length + 1) + ' / ' + drillList.length;
  document.getElementById('drillResultArea').style.display = 'none';
  ['drillUserText', 'drillFeedback', 'drillModelThai', 'drillModelRomaji', 'drillModelJP'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '–';
  });
  resetRecordBtn('drillRecordBtn', 'drillRecordStatus', 'ボタンを押してタイ語で話す');
}

function nextDrill() { drillIndex++; renderDrillCard(); }
function prevDrill() { drillIndex = Math.max(0, drillIndex - 1); renderDrillCard(); }

function resetRecordBtn(btnId, statusId, msg) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = '🎙'; btn.style.borderColor = ''; btn.style.background = ''; }
  const st = document.getElementById(statusId); if (st) st.textContent = msg;
}

async function toggleDrillRecord() {
  if (!getOpenAIKey()) { document.getElementById('drillRecordStatus').textContent = '⚠️ OpenAI APIキーを設定してください'; return; }
  if (!isRecording) {
    try {
      const btn = document.getElementById('drillRecordBtn');
      btn.textContent = '⏹'; btn.style.borderColor = 'var(--success)'; btn.style.background = 'var(--success-soft)';
      document.getElementById('drillRecordStatus').textContent = '録音中... もう一度押すと停止';
      await startMediaRecorder(async (blob) => {
        document.getElementById('drillRecordStatus').textContent = '認識中...';
        try {
          const text = await sendToWhisper(blob);
          document.getElementById('drillUserText').textContent = text || '（認識できませんでした）';
          document.getElementById('drillResultArea').style.display = 'flex';
          if (text) await getDrillFeedback(text);
        } catch (e) { document.getElementById('drillRecordStatus').textContent = '⚠️ ' + e.message; }
        resetRecordBtn('drillRecordBtn', 'drillRecordStatus', 'もう一度話す');
      });
    } catch (e) { document.getElementById('drillRecordStatus').textContent = '⚠️ マイクが使えません'; isRecording = false; }
  } else { stopMediaRecorder(); document.getElementById('drillRecordStatus').textContent = '処理中...'; }
}

async function getDrillFeedback(userText) {
  const key = getClaudeKey();
  const scenario = drillList[drillIndex % drillList.length];
  document.getElementById('drillFeedback').textContent = '考え中...';
  document.getElementById('drillModelThai').textContent = scenario.thai;
  document.getElementById('drillModelRomaji').textContent = scenario.romaji;
  document.getElementById('drillModelJP').textContent = scenario.jp;
  if (!key) { document.getElementById('drillFeedback').textContent = '（Claude APIキーを設定するとフィードバックが得られます）'; return; }
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 250,
      messages: [{ role: 'user', content: `タイ語スピーキング練習のフィードバック。\nお題：「${scenario.jp}」\nお手本：「${scenario.thai}」\n学習者：「${userText}」\n日本語3行以内：意味が通じるか、お手本との違い、アドバイス` }]
    });
    document.getElementById('drillFeedback').textContent = data.content[0].text;
    logLearningEvent({ type: 'drill', scene: scenario.scene, jp: scenario.jp });
  } catch (e) { document.getElementById('drillFeedback').textContent = '⚠️ フィードバックエラー'; }
}

function playDrillModel() { const t = document.getElementById('drillModelThai').textContent; if (t && t !== '–') playAudioTTS(t); }

// Meeting Sim
function startSim(scene) {
  currentSimScene = scene; simHistory = [];
  const opener = simOpeners[scene];
  document.getElementById('simConversation').innerHTML = '';
  addSimMessage('staff', opener.thai, opener.jp, opener.name);
  simHistory.push({ role: 'assistant', content: opener.thai + '（' + opener.jp + '）' });
  document.getElementById('simRecordBtn').disabled = false;
  document.getElementById('simRecordStatus').textContent = 'ボタンを押してタイ語で話す';
  playAudioTTS(opener.thai);
}

function addSimMessage(role, thai, jp, name) {
  const convEl = document.getElementById('simConversation');
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;flex-direction:column;gap:4px;align-items:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:12px;`;
  div.innerHTML = `<div style="font-size:0.7rem;color:var(--text-muted);">${isUser ? '🙋 あなた' : '🤝 ' + (name || 'スタッフ')}</div>
    <div style="background:${isUser ? 'var(--accent)' : 'var(--surface-dim)'};color:${isUser ? '#fff' : 'var(--text)'};border-radius:12px;padding:10px 14px;max-width:85%;">
      <div style="font-family:'Sarabun',sans-serif;font-size:1rem;color:${isUser ? '#fff' : 'var(--thai)'};">${thai}</div>
      ${jp ? `<div style="font-size:0.75rem;color:${isUser ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)'};margin-top:4px;">${jp}</div>` : ''}
    </div>`;
  convEl.appendChild(div);
  convEl.scrollTop = convEl.scrollHeight;
}

async function toggleSimRecord() {
  if (!getOpenAIKey()) { document.getElementById('simRecordStatus').textContent = '⚠️ OpenAI APIキーを設定してください'; return; }
  if (!isRecording) {
    try {
      const btn = document.getElementById('simRecordBtn');
      btn.textContent = '⏹'; btn.style.borderColor = 'var(--success)';
      document.getElementById('simRecordStatus').textContent = '録音中...';
      await startMediaRecorder(async (blob) => {
        document.getElementById('simRecordStatus').textContent = '認識中...';
        try {
          const text = await sendToWhisper(blob);
          if (!text) throw new Error('音声を認識できませんでした');
          addSimMessage('user', text, '', '');
          simHistory.push({ role: 'user', content: text });
          document.getElementById('simRecordStatus').textContent = 'スタッフが返答中...';
          await getSimResponse(text);
        } catch (e) { document.getElementById('simRecordStatus').textContent = '⚠️ ' + e.message; }
        resetRecordBtn('simRecordBtn', 'simRecordStatus', 'ボタンを押してタイ語で話す');
      });
    } catch (e) { document.getElementById('simRecordStatus').textContent = '⚠️ マイクが使えません'; isRecording = false; }
  } else { stopMediaRecorder(); document.getElementById('simRecordStatus').textContent = '処理中...'; }
}

async function getSimResponse(userText) {
  const claudeKey = getClaudeKey();
  const opener = simOpeners[currentSimScene];
  if (!claudeKey) { addSimMessage('staff', '（Claude APIキーを設定してください）', '', opener.name); return; }
  try {
    const data = await claudeFetch(claudeKey, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 150, system: simSystemPrompts[currentSimScene],
      messages: simHistory.map(h => ({ role: h.role, content: h.content }))
    });
    const reply = data.content[0].text;
    const match = reply.match(/^(.+?)（(.+?)）/s);
    const thaiPart = match ? match[1].trim() : reply;
    const jpPart = match ? match[2].trim() : '';
    addSimMessage('staff', thaiPart, jpPart, opener.name);
    simHistory.push({ role: 'assistant', content: reply });
    playAudioTTS(thaiPart);
  } catch (e) { addSimMessage('staff', '⚠️ エラー', e.message, opener.name); }
}

function resetSim() {
  currentSimScene = null; simHistory = [];
  document.getElementById('simConversation').innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:20px 0;">上のシーンを選ぶと会話が始まります</div>';
  document.getElementById('simRecordBtn').disabled = true;
  resetRecordBtn('simRecordBtn', 'simRecordStatus', 'シーンを選んでください');
}

// ================================
// AI PHRASE GENERATOR
// ================================
function getCustomVocab() { return JSON.parse(localStorage.getItem('customVocab_v1') || '[]'); }
function updateAigenSavedCount() { const el = document.getElementById('aigenSavedCount'); if (el) el.textContent = getCustomVocab().length + ' 件'; }

async function generatePhrases() {
  const key = getClaudeKey();
  if (!key) { alert('Claude APIキーを設定してください'); return; }
  const input = document.getElementById('aigenInput').value.trim();
  if (!input) { alert('場面を入力してください'); return; }
  const btn = document.getElementById('aigenBtn');
  const statusEl = document.getElementById('aigenStatus');
  const resultEl = document.getElementById('aigenResult');
  btn.disabled = true; btn.textContent = '生成中...';
  statusEl.style.display = 'block'; statusEl.textContent = '🤖 Claudeがフレーズを考えています...';
  resultEl.style.display = 'none'; resultEl.innerHTML = '';
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 700,
      messages: [{ role: 'user', content: `タイ語の専門家として。製造業の日本人管理職がタイ人スタッフに話す場面：「${input}」\n3パターンのJSON形式のみ：\n{"polite":{"thai":"...","romaji":"...","jp":"...","note":"..."},"normal":{"thai":"...","romaji":"...","jp":"...","note":"..."},"casual":{"thai":"...","romaji":"...","jp":"...","note":"..."}}\npolite:丁寧、normal:普通、casual:くだけた。noteは使い方メモ1行。` }]
    });
    const jsonMatch = data.content[0].text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('レスポンスのフォーマットが不正です');
    renderGeneratedCards(JSON.parse(jsonMatch[0]), input);
    statusEl.style.display = 'none'; resultEl.style.display = 'flex';
  } catch (e) { statusEl.textContent = '⚠️ ' + pwaErrorMsg(e); }
  finally { btn.disabled = false; btn.textContent = '✨ タイ語フレーズを生成する'; }
}

function renderGeneratedCards(phrases, scene) {
  const resultEl = document.getElementById('aigenResult');
  resultEl.innerHTML = '';
  [{ key: 'polite', label: '🙏 丁寧', color: 'var(--accent)' }, { key: 'normal', label: '💬 普通', color: 'var(--success)' }, { key: 'casual', label: '😄 カジュアル', color: 'var(--gold)' }].forEach(({ key, label, color }) => {
    const p = phrases[key]; if (!p) return;
    const card = document.createElement('div');
    card.className = 'aigen-card';
    card.innerHTML = `<div style="font-size:0.72rem;color:${color};font-weight:600;">${label}</div>
      <div style="font-size:1.35rem;color:var(--text);font-family:'Sarabun',sans-serif;line-height:1.5;">${p.thai}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);font-family:'IBM Plex Mono',monospace;">${p.romaji}</div>
      <div style="font-size:0.88rem;color:var(--text-secondary);">${p.jp}</div>
      <div style="font-size:0.75rem;color:var(--gold);background:var(--gold-soft);border-radius:6px;padding:6px 8px;">💡 ${p.note}</div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="btn btn-outline btn-sm" style="flex:1;" data-action="tts">🔊 発音</button>
        <button class="btn btn-outline btn-sm" style="flex:1;" data-action="save">💾 保存</button>
      </div>`;
    resultEl.appendChild(card);
    card.querySelector('[data-action="tts"]').addEventListener('click', () => playAudioTTS(p.thai));
    card.querySelector('[data-action="save"]').addEventListener('click', function () {
      saveGeneratedCard({ thai: p.thai, romaji: p.romaji, jp: p.jp, example: scene + ' → ' + p.jp, frequency: 'high', scenes: ['生成'] }, this);
    });
  });
}

function saveGeneratedCard(card, btn) {
  const cards = getCustomVocab();
  if (cards.some(c => c.thai === card.thai)) { btn.textContent = '✅ 保存済み'; btn.disabled = true; return; }
  cards.push({ ...card, ts: Date.now() });
  localStorage.setItem('customVocab_v1', JSON.stringify(cards));
  btn.textContent = '✅ 保存しました'; btn.style.color = 'var(--success)'; btn.disabled = true;
  updateAigenSavedCount();
}

// ================================
// WEAKNESS ANALYSIS
// ================================
async function analyzeWeakness() {
  const key = getClaudeKey();
  const btn = document.getElementById('analyzeBtn');
  const statusEl = document.getElementById('weaknessStatus');
  const resultEl = document.getElementById('weaknessResult');
  const textEl = document.getElementById('weaknessAnalysisText');
  const focusBtn = document.getElementById('focusDrillBtn');
  const log = JSON.parse(localStorage.getItem('learningLog_v1') || '[]');
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentLog = log.filter(e => e.ts >= cutoff);
  if (recentLog.length < 5) { statusEl.textContent = '学習データが少なすぎます（5件以上必要）'; return; }
  if (!key) { statusEl.textContent = '⚠️ Claude APIキーを設定してください'; return; }
  btn.disabled = true; btn.textContent = '分析中...'; resultEl.style.display = 'none';
  const vocabUnknown = recentLog.filter(e => e.type === 'vocab' && e.rating === 'unknown').map(e => e.word);
  const vocabFuzzy = recentLog.filter(e => e.type === 'vocab' && e.rating === 'fuzzy').map(e => e.word);
  const vocabKnow = recentLog.filter(e => e.type === 'vocab' && e.rating === 'know').map(e => e.word);
  const grammarAll = recentLog.filter(e => e.type === 'grammar').map(e => e.pattern);
  const drillAll = recentLog.filter(e => e.type === 'drill').map(e => e.jp);
  const summary = `過去7日間の学習ログ（${recentLog.length}件）:\n【単語】わからない:${[...new Set(vocabUnknown)].join('、')||'なし'}(${vocabUnknown.length}回) うろ覚え:${[...new Set(vocabFuzzy)].join('、')||'なし'}(${vocabFuzzy.length}回) 知ってる:${vocabKnow.length}回\n【文法】${[...new Set(grammarAll)].join('、')||'なし'}\n【スピーキング】${[...new Set(drillAll)].join('、')||'なし'}`;
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `タイ語学習者の1週間ログを分析。\n${summary}\n日本語で5〜8行：1.弱点 2.重点練習 3.励まし` }]
    });
    textEl.textContent = data.content[0].text;
    resultEl.style.display = 'flex';
    const weakWordsList = [...new Set([...vocabUnknown, ...vocabFuzzy])];
    focusBtn.style.display = weakWordsList.length >= 3 ? 'block' : 'none';
    focusBtn.dataset.weakWords = JSON.stringify(weakWordsList);
    statusEl.textContent = `分析完了（${recentLog.length}件）`;
  } catch (e) { textEl.textContent = '⚠️ ' + e.message; resultEl.style.display = 'flex'; }
  finally { btn.disabled = false; btn.textContent = '🔍 弱点を分析する'; }
}

function startFocusDrill() {
  const raw = document.getElementById('focusDrillBtn').dataset.weakWords;
  if (!raw) return;
  const weakWordsList = JSON.parse(raw);
  const allVocab = Object.values(vocabData).flat();
  const focusCards = allVocab.filter(c => weakWordsList.includes(c.thai));
  if (focusCards.length === 0) { alert('弱点単語が見つかりませんでした'); return; }
  currentCards = shuffle([...focusCards]); cardIndex = 0; currentCategory = 'focus';
  openSubPage('vocab'); showCard();
}

// ================================
// LISTENING CHALLENGE [NEW]
// ================================
let listeningQuestions = [];
let listeningIndex = 0;
let listeningCorrectCount = 0;
let listeningMistakes = [];
let listeningDifficulty = 'beginner';
let listeningSpeedRate = 1.0;

function startListening(difficulty, count) {
  listeningDifficulty = difficulty;
  listeningQuestions = generateListeningQuestions(difficulty, count || 10);
  listeningIndex = 0; listeningCorrectCount = 0; listeningMistakes = [];
  document.getElementById('listeningSetup').style.display = 'none';
  document.getElementById('listeningQuiz').style.display = '';
  document.getElementById('listeningResult').style.display = 'none';
  document.getElementById('listeningFeedback').innerHTML = '';
  document.getElementById('listeningNextBtn').style.display = 'none';
  showListeningQuestion();
}

function generateListeningQuestions(difficulty, count) {
  let pool = [];
  if (difficulty === 'beginner') {
    pool = Object.values(vocabData).flat().map(w => ({ audio: w.thai, answer: w.jp, type: 'choice' }));
  } else if (difficulty === 'intermediate') {
    pool = Object.values(phrasesData).flat().map(p => ({ audio: p.thai, answer: p.jp, type: 'choice' }));
  } else {
    pool = Object.values(vocabData).flat().map(w => ({ audio: w.thai, answer: w.romaji, answerThai: w.thai, answerJP: w.jp, type: 'dictation' }));
  }
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map(q => {
    if (q.type === 'choice') {
      const wrongAnswers = pool.filter(p => p.answer !== q.answer).sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.answer);
      return { ...q, choices: [q.answer, ...wrongAnswers].sort(() => Math.random() - 0.5) };
    }
    return q;
  });
}

function showListeningQuestion() {
  const q = listeningQuestions[listeningIndex];
  document.getElementById('listeningCounter').textContent = (listeningIndex + 1) + ' / ' + listeningQuestions.length;
  document.getElementById('listeningFeedback').innerHTML = '';
  document.getElementById('listeningNextBtn').style.display = 'none';
  if (q.type === 'choice') {
    document.getElementById('listeningChoices').style.display = '';
    document.getElementById('listeningInput').style.display = 'none';
    document.getElementById('listeningChoices').innerHTML = q.choices.map(c =>
      `<button class="quiz-choice-btn" onclick="checkListeningChoice(this, '${c.replace(/'/g, "\\'")}')">${c}</button>`
    ).join('');
  } else {
    document.getElementById('listeningChoices').style.display = 'none';
    document.getElementById('listeningInput').style.display = '';
    document.getElementById('listeningAnswer').value = '';
  }
  playListeningAudio();
}

function playListeningAudio() {
  const q = listeningQuestions[listeningIndex];
  if (q) {
    const oldRate = speechRate;
    speechRate = listeningSpeedRate === 'slow' ? 0.5 : parseFloat(localStorage.getItem('speechRate') || '0.8');
    playAudioTTS(q.audio);
    speechRate = oldRate;
  }
}

function setListeningSpeed(speed, btn) {
  listeningSpeedRate = speed === 'slow' ? 0.5 : 1.0;
  if (btn) { btn.parentElement.querySelectorAll('.speed-control-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
}

function checkListeningChoice(btnEl, selected) {
  const q = listeningQuestions[listeningIndex];
  const isCorrect = selected === q.answer;
  document.querySelectorAll('.quiz-choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('correct');
    else if (b === btnEl && !isCorrect) b.classList.add('wrong');
  });
  if (navigator.vibrate) navigator.vibrate(isCorrect ? 50 : [100, 50, 100]);
  if (isCorrect) listeningCorrectCount++;
  else listeningMistakes.push(q);
  document.getElementById('listeningFeedback').innerHTML = isCorrect
    ? '<div class="feedback-correct">✅ 正解！</div>'
    : `<div class="feedback-wrong">❌ 不正解 — 正解: ${q.answer}</div>`;
  document.getElementById('listeningNextBtn').style.display = '';
  trackMissionProgress('listening');
}

function submitListeningAnswer() {
  const q = listeningQuestions[listeningIndex];
  const userAnswer = document.getElementById('listeningAnswer').value.trim().toLowerCase();
  const correctAnswer = q.answer.toLowerCase();
  // Fuzzy match: allow minor differences
  const isCorrect = userAnswer === correctAnswer || levenshteinDistance(userAnswer, correctAnswer) <= Math.max(1, Math.floor(correctAnswer.length * 0.2));
  if (navigator.vibrate) navigator.vibrate(isCorrect ? 50 : [100, 50, 100]);
  if (isCorrect) listeningCorrectCount++;
  else listeningMistakes.push(q);
  document.getElementById('listeningFeedback').innerHTML = isCorrect
    ? '<div class="feedback-correct">✅ 正解！</div>'
    : `<div class="feedback-wrong">❌ 不正解<br>正解: ${q.answer}<br>タイ語: ${q.answerThai || ''} / ${q.answerJP || ''}</div>`;
  document.getElementById('listeningNextBtn').style.display = '';
  trackMissionProgress('listening');
}

function nextListeningQuestion() {
  listeningIndex++;
  if (listeningIndex >= listeningQuestions.length) { showListeningResult(); return; }
  showListeningQuestion();
}

function showListeningResult() {
  document.getElementById('listeningQuiz').style.display = 'none';
  document.getElementById('listeningResult').style.display = '';
  const pct = Math.round(listeningCorrectCount / listeningQuestions.length * 100);
  document.getElementById('listeningScoreText').textContent = `${listeningCorrectCount} / ${listeningQuestions.length}`;
  document.getElementById('listeningResultMsg').textContent = pct >= 80 ? '素晴らしい！🎉' : pct >= 50 ? 'いい調子！💪' : 'もう少し頑張ろう！📚';
  const mistakesEl = document.getElementById('listeningMistakes');
  if (listeningMistakes.length > 0) {
    mistakesEl.style.display = '';
    mistakesEl.innerHTML = '<div style="font-size:0.8rem;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">間違えた問題</div>' +
      listeningMistakes.map(q => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem;"><span style="font-family:'Sarabun',sans-serif;color:var(--thai);">${q.audio}</span> → ${q.answer}</div>`).join('');
  } else { mistakesEl.style.display = 'none'; }
  // Save score
  const scores = JSON.parse(localStorage.getItem('listeningScores') || '{"totalPlayed":0,"totalCorrect":0}');
  scores.totalPlayed += listeningQuestions.length;
  scores.totalCorrect += listeningCorrectCount;
  localStorage.setItem('listeningScores', JSON.stringify(scores));
}

function retryListening() {
  document.getElementById('listeningSetup').style.display = '';
  document.getElementById('listeningQuiz').style.display = 'none';
  document.getElementById('listeningResult').style.display = 'none';
}

// ================================
// MATCHING GAME [NEW]
// ================================
let matchingCards = [];
let matchingFirst = null;
let matchingSecond = null;
let matchingLocked = false;
let matchingTimer = null;
let matchingStartTime = null;
let matchingAttempts = 0;
let matchCategory = 'work';
let matchPairCount = 4;

function setMatchCategory(cat, btn) {
  matchCategory = cat;
  if (btn) { btn.parentElement.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
}

function startMatching(pairCount) {
  matchPairCount = pairCount;
  const words = (vocabData[matchCategory] || []).sort(() => Math.random() - 0.5).slice(0, pairCount);
  matchingCards = [];
  words.forEach((w, i) => {
    matchingCards.push({ id: 'th_' + i, text: w.thai, type: 'thai', pairId: i, matched: false });
    matchingCards.push({ id: 'jp_' + i, text: w.jp, type: 'jp', pairId: i, matched: false });
  });
  matchingCards.sort(() => Math.random() - 0.5);
  matchingFirst = null; matchingSecond = null; matchingLocked = false; matchingAttempts = 0;
  matchingStartTime = Date.now();
  document.getElementById('matchingSetup').style.display = 'none';
  document.getElementById('matchingGame').style.display = '';
  document.getElementById('matchingResult').style.display = 'none';
  renderMatchingGrid(pairCount);
  matchingTimer = setInterval(updateMatchingTimer, 100);
}

function renderMatchingGrid(pairCount) {
  const grid = document.getElementById('matchingGrid');
  grid.style.gridTemplateColumns = `repeat(4, 1fr)`;
  grid.innerHTML = matchingCards.map((card, i) => `
    <div class="match-card" data-index="${i}" onclick="flipMatchCard(${i})">
      <div class="match-card-inner">
        <div class="match-card-front">?</div>
        <div class="match-card-back ${card.type === 'thai' ? 'card-thai' : 'card-jp'}">${card.text}</div>
      </div>
    </div>`).join('');
}

function updateMatchingTimer() {
  const elapsed = Date.now() - matchingStartTime;
  const s = Math.floor(elapsed / 1000);
  const m = Math.floor(s / 60);
  document.getElementById('matchingTimerDisp').textContent = m + ':' + String(s % 60).padStart(2, '0');
}

function flipMatchCard(index) {
  if (matchingLocked) return;
  const card = matchingCards[index];
  if (card.matched) return;
  const el = document.querySelector(`[data-index="${index}"]`);
  if (el.classList.contains('flipped')) return;
  el.classList.add('flipped');

  if (matchingFirst === null) { matchingFirst = index; return; }
  if (matchingFirst === index) return;

  matchingSecond = index;
  matchingLocked = true;
  matchingAttempts++;
  document.getElementById('matchingAttemptsDisp').textContent = matchingAttempts + '回';
  const first = matchingCards[matchingFirst];
  const second = matchingCards[matchingSecond];

  if (first.pairId === second.pairId && first.type !== second.type) {
    first.matched = true; second.matched = true;
    if (navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => {
      document.querySelector(`[data-index="${matchingFirst}"]`).classList.add('matched');
      document.querySelector(`[data-index="${matchingSecond}"]`).classList.add('matched');
      matchingFirst = null; matchingSecond = null; matchingLocked = false;
      if (matchingCards.every(c => c.matched)) { clearInterval(matchingTimer); showMatchingResult(); }
    }, 500);
  } else {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => {
      document.querySelector(`[data-index="${matchingFirst}"]`).classList.remove('flipped');
      document.querySelector(`[data-index="${matchingSecond}"]`).classList.remove('flipped');
      matchingFirst = null; matchingSecond = null; matchingLocked = false;
    }, 800);
  }
}

function showMatchingResult() {
  const elapsed = Date.now() - matchingStartTime;
  const s = Math.floor(elapsed / 1000);
  const timeStr = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  document.getElementById('matchingGame').style.display = 'none';
  document.getElementById('matchingResult').style.display = '';
  document.getElementById('matchingResultTime').textContent = timeStr;
  document.getElementById('matchingResultAttempts').textContent = matchingAttempts + '回';
  // Best time
  const bestKey = matchCategory + '_' + matchPairCount;
  const bests = JSON.parse(localStorage.getItem('matchingBestTimes') || '{}');
  if (!bests[bestKey] || elapsed < bests[bestKey]) { bests[bestKey] = elapsed; localStorage.setItem('matchingBestTimes', JSON.stringify(bests)); }
  const bestMs = bests[bestKey];
  const bs = Math.floor(bestMs / 1000);
  document.getElementById('matchingResultBest').textContent = 'ベスト: ' + Math.floor(bs / 60) + ':' + String(bs % 60).padStart(2, '0');
  trackMissionProgress('matching');
}

function retryMatching() {
  document.getElementById('matchingSetup').style.display = '';
  document.getElementById('matchingGame').style.display = 'none';
  document.getElementById('matchingResult').style.display = 'none';
  if (matchingTimer) clearInterval(matchingTimer);
}

// ================================
// ONE-LINE DIARY [NEW]
// ================================
const DIARY_PROMPTS = [
  '今日の仕事で一番大変だったことは？', 'お昼に何を食べましたか？', '明日の予定は？',
  '今日タイ人スタッフと話したことは？', '週末に何をしますか？', '最近嬉しかったことは？',
  '今日学んだタイ語は？', '工場で気づいたことは？', '天気はどうでしたか？', '今の気持ちは？',
];
let currentDiaryPrompt = DIARY_PROMPTS[Math.floor(Math.random() * DIARY_PROMPTS.length)];

function changeDiaryPrompt() {
  currentDiaryPrompt = DIARY_PROMPTS[Math.floor(Math.random() * DIARY_PROMPTS.length)];
  document.getElementById('diaryPrompt').textContent = currentDiaryPrompt;
}

async function submitDiary() {
  const text = document.getElementById('diaryInput').value.trim();
  if (!text) return;
  const key = getClaudeKey();
  if (!key) { alert('Claude APIキーを設定してください'); return; }
  const statusEl = document.getElementById('diaryStatusMsg');
  const submitBtn = document.getElementById('diarySubmitBtn');
  statusEl.textContent = '添削中...'; statusEl.style.display = 'block';
  submitBtn.disabled = true;
  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `タイ語学習者の日記を添削。\n学習者：日本人、製造業、タイ語初〜中級\n書いた文：「${text}」\nJSON形式のみ：\n{"corrected":"自然なタイ語","romaji":"ローマ字読み","jp":"日本語訳","point":"1行アドバイス","rating":"great/good/keep_going"}` }]
    });
    const jsonMatch = data.content[0].text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch[0]);
    renderDiaryResult(text, result);
    statusEl.style.display = 'none';
    const entries = JSON.parse(localStorage.getItem('diaryEntries') || '[]');
    entries.push({ date: getTodayStr(), text, corrected: result.corrected, feedback: result.point, prompt: currentDiaryPrompt });
    localStorage.setItem('diaryEntries', JSON.stringify(entries));
    trackMissionProgress('diary');
    renderDiaryHistory();
  } catch (e) { statusEl.textContent = '⚠️ ' + pwaErrorMsg(e); }
  finally { submitBtn.disabled = false; }
}

function renderDiaryResult(original, result) {
  const r = document.getElementById('diaryResult');
  r.style.display = '';
  document.getElementById('diaryBefore').innerHTML = `<span style="font-size:0.7rem;color:var(--text-muted);">あなたが書いた文</span><br>${original}`;
  document.getElementById('diaryAfter').innerHTML = `<span style="font-size:0.7rem;color:var(--success);">✅ 修正後</span><br><span style="font-family:'Sarabun',sans-serif;font-size:1.1rem;color:var(--thai);">${result.corrected}</span>`;
  document.getElementById('diaryRomaji').textContent = result.romaji;
  document.getElementById('diaryJP').textContent = result.jp;
  document.getElementById('diaryPoint').textContent = '💡 ' + result.point;
  const ratingMap = { great: '🌟 Great!', good: '👍 Good!', keep_going: '💪 Keep going!' };
  document.getElementById('diaryRating').textContent = ratingMap[result.rating] || '';
}

function playDiaryAudio() {
  const el = document.getElementById('diaryAfter');
  if (!el) return;
  const text = el.querySelector('span[style*="Sarabun"]')?.textContent;
  if (text) playAudioTTS(text);
}

function renderDiaryHistory() {
  const entries = JSON.parse(localStorage.getItem('diaryEntries') || '[]');
  const listEl = document.getElementById('diaryEntryList');
  if (!listEl) return;
  if (entries.length === 0) { listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">まだ日記がありません</div>'; return; }
  listEl.innerHTML = entries.slice().reverse().slice(0, 10).map(e =>
    `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.82rem;">
      <div style="color:var(--text-muted);font-size:0.7rem;">${e.date}</div>
      <div style="font-family:'Sarabun',sans-serif;color:var(--thai);">${e.corrected || e.text}</div>
      <div style="color:var(--text-secondary);">${e.feedback || ''}</div>
    </div>`
  ).join('');
}

// ================================
// SHADOWING [NEW]
// ================================
let currentShadowPhrase = null;
let shadowSessionCount = 0;

function selectShadowingPhrase() {
  const all = Object.values(phrasesData).flat();
  return all[Math.floor(Math.random() * all.length)];
}

async function startShadowingRound() {
  const phrase = selectShadowingPhrase();
  currentShadowPhrase = phrase;
  document.getElementById('shadowText').textContent = phrase.thai;
  document.getElementById('shadowRomaji').textContent = phrase.romaji;
  document.getElementById('shadowJP').textContent = phrase.jp;
  document.getElementById('shadowResult').style.display = 'none';
  document.getElementById('shadowStartBtn').style.display = 'none';
  document.getElementById('shadowStopBtn').style.display = 'none';

  // Step 1: play model
  const step1 = document.getElementById('shadowStep1');
  if (step1) step1.style.background = 'var(--primary)'; if (step1) step1.style.color = '#fff';
  await playAudioTTS(phrase.thai);
  await new Promise(r => setTimeout(r, 1500));

  // Step 2: countdown
  const step2 = document.getElementById('shadowStep2');
  if (step1) { step1.style.background = ''; step1.style.color = ''; }
  if (step2) { step2.style.background = 'var(--primary)'; step2.style.color = '#fff'; }
  await countdown(3);
  if (step2) { step2.style.background = ''; step2.style.color = ''; }

  // Step 3: record
  const step3 = document.getElementById('shadowStep3');
  if (step3) { step3.style.background = 'var(--primary)'; step3.style.color = '#fff'; }
  document.getElementById('shadowStopBtn').style.display = '';
  try {
    await startMediaRecorder(async (blob) => {
      document.getElementById('shadowStopBtn').style.display = 'none';
      if (step3) { step3.style.background = ''; step3.style.color = ''; }
      await finishShadowRecording(blob);
    });
  } catch (e) {
    document.getElementById('shadowStartBtn').style.display = '';
    if (step3) { step3.style.background = ''; step3.style.color = ''; }
  }
}

function stopShadowRecording() { stopMediaRecorder(); }

async function finishShadowRecording(blob) {
  const userText = await sendToWhisper(blob);
  document.getElementById('shadowUserText').textContent = userText || '（認識できませんでした）';
  const matchPercent = calculateMatchPercent(currentShadowPhrase.thai, userText);
  document.getElementById('shadowMatchPercent').textContent = matchPercent + '%';
  document.getElementById('shadowResult').style.display = '';
  document.getElementById('shadowStartBtn').style.display = '';
  if (navigator.vibrate) navigator.vibrate(matchPercent >= 80 ? 50 : [100, 50, 100]);
  const history = JSON.parse(localStorage.getItem('shadowingHistory') || '[]');
  history.push({ date: getTodayStr(), phrase: currentShadowPhrase.thai, matchPercent });
  localStorage.setItem('shadowingHistory', JSON.stringify(history));
  shadowSessionCount++;
  trackMissionProgress('shadowing');
  renderShadowHistory();
}

function calculateMatchPercent(original, userText) {
  if (!userText) return 0;
  const maxLen = Math.max(original.length, userText.length);
  if (maxLen === 0) return 100;
  return Math.max(0, Math.round((1 - levenshteinDistance(original, userText) / maxLen) * 100));
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1] ? matrix[i - 1][j - 1] : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

async function countdown(seconds) {
  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  overlay.style.display = 'flex';
  for (let i = seconds; i > 0; i--) {
    numEl.textContent = i;
    await new Promise(r => setTimeout(r, 1000));
  }
  overlay.style.display = 'none';
}

function renderShadowHistory() {
  const history = JSON.parse(localStorage.getItem('shadowingHistory') || '[]');
  const listEl = document.getElementById('shadowHistoryList');
  if (!listEl) return;
  if (history.length === 0) { listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">まだ履歴がありません</div>'; return; }
  listEl.innerHTML = history.slice().reverse().slice(0, 10).map(h =>
    `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:0.82rem;display:flex;justify-content:space-between;">
      <span style="font-family:'Sarabun',sans-serif;color:var(--thai);">${h.phrase}</span>
      <span style="color:${h.matchPercent >= 80 ? 'var(--success)' : 'var(--text-muted)'};">${h.matchPercent}%</span>
    </div>`
  ).join('');
}

// ================================
// SCANNER [NEW]
// ================================
let scanMode = 'work';

function setScanMode(mode, btn) {
  scanMode = mode;
  if (btn) { btn.parentElement.querySelectorAll('.scanner-mode-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
}

async function handleScanPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const key = getClaudeKey();
  if (!key) { alert('Claude APIキーを設定してください'); return; }
  const statusEl = document.getElementById('scanStatusMsg');
  statusEl.textContent = '認識中...'; statusEl.style.display = 'block';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    document.getElementById('scanPreview').src = base64;
    try {
      const modeContext = scanMode === 'work' ? '製造業・品質管理の現場で使う語彙を優先' : '日常生活で使う語彙を優先';
      const data = await claudeFetch(key, {
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: base64.split(',')[1] } },
          { type: 'text', text: `写真の主要な物体を1つ特定し、タイ語名を教えてください。${modeContext}。\nJSON形式のみ：{"thai":"タイ語","romaji":"ローマ字","katakana":"カタカナ","jp":"日本語","example":"タイ語例文（日本語訳付き）"}` }
        ]}]
      });
      const jsonMatch = data.content[0].text.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch[0]);
      renderScanResult(result, base64);
      saveScanHistory(result, base64);
      statusEl.style.display = 'none';
    } catch (e) { statusEl.textContent = '⚠️ ' + pwaErrorMsg(e); }
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function renderScanResult(result) {
  document.getElementById('scanResult').style.display = '';
  document.getElementById('scanThai').textContent = result.thai;
  document.getElementById('scanRomaji').textContent = result.romaji;
  document.getElementById('scanKatakana').textContent = result.katakana || '';
  document.getElementById('scanJP').textContent = result.jp;
  document.getElementById('scanExample').textContent = result.example || '';
}

function playScanAudio() {
  const t = document.getElementById('scanThai').textContent;
  if (t) playAudioTTS(t);
}

function saveScanWord() {
  const thai = document.getElementById('scanThai').textContent;
  const romaji = document.getElementById('scanRomaji').textContent;
  const jp = document.getElementById('scanJP').textContent;
  if (!thai) return;
  const cards = getCustomVocab();
  if (cards.some(c => c.thai === thai)) { alert('既に保存済みです'); return; }
  cards.push({ thai, romaji, jp, example: document.getElementById('scanExample').textContent, frequency: 'high', scenes: ['スキャン'], ts: Date.now() });
  localStorage.setItem('customVocab_v1', JSON.stringify(cards));
  alert('マイ単語に保存しました！');
}

function saveScanHistory(result, base64) {
  const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  // Resize image for thumbnail
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.onload = () => {
    canvas.width = 100; canvas.height = 100;
    canvas.getContext('2d').drawImage(img, 0, 0, 100, 100);
    history.push({ date: getTodayStr(), thumbnail: canvas.toDataURL('image/jpeg', 0.5), result });
    if (history.length > 20) history.shift();
    localStorage.setItem('scanHistory', JSON.stringify(history));
    renderScanGallery();
  };
  img.src = base64;
}

function renderScanGallery() {
  const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  const el = document.getElementById('scanGallery');
  if (!el) return;
  if (history.length === 0) { el.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">まだスキャン履歴がありません</div>'; return; }
  el.innerHTML = history.slice().reverse().map(h =>
    `<div class="scan-thumb" onclick="renderScanResult(${JSON.stringify(h.result).replace(/"/g, '&quot;')})">
      <img src="${h.thumbnail}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">
      <div style="font-size:0.7rem;color:var(--thai);font-family:'Sarabun',sans-serif;">${h.result.thai}</div>
    </div>`
  ).join('');
}

// ================================
// CONFETTI
// ================================
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const particles = [];
  const colors = ['#FF6B35', '#F59E0B', '#10B981', '#2563EB', '#EF4444', '#8B5CF6'];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 100, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12, vy: Math.random() * -12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3, life: 1
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return; alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.015;
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(animate);
  }
  animate();
}

// ================================
// LEARNING HISTORY CHART
// ================================
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
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, label: (d.getMonth() + 1) + '/' + d.getDate(), count: history[dateStr] || 0 });
  }
  const maxCount = Math.max(...days.map(d => d.count), 1);
  chartEl.innerHTML = days.map(d => {
    const height = Math.max(2, (d.count / maxCount) * 50);
    const isToday = d.date === getTodayStr();
    return `<div class="chart-bar-col"><div class="chart-bar${isToday ? ' today' : ''}" style="height:${height}px" title="${d.count}個"></div><div class="chart-label">${d.label}</div></div>`;
  }).join('');
}

// ================================
// WAKE LOCK
// ================================
let wakeLock = null;
async function requestWakeLock() {
  if ('wakeLock' in navigator) { try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } }
}
function releaseWakeLock() { if (wakeLock) { wakeLock.release(); wakeLock = null; } }

// ================================
// PWA
// ================================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  const banner = document.getElementById('installBanner'); if (banner) banner.style.display = 'flex';
});
document.getElementById('installBtn')?.addEventListener('click', () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; document.getElementById('installBanner').style.display = 'none'; });
  }
});
window.addEventListener('appinstalled', () => { document.getElementById('installBanner').style.display = 'none'; });

function updateOnlineStatus() {
  const b = document.getElementById('offlineBanner'); if (b) b.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ================================
// SWIPE SUPPORT
// ================================
(function () {
  let startX = 0, startY = 0, swiping = false;
  const THRESHOLD = 60;
  function getActiveCard() {
    if (document.querySelector('#page-phrases.active')) return document.getElementById('phraseCard');
    if (document.querySelector('#page-vocab.active')) return document.getElementById('flashcard');
    return null;
  }
  document.addEventListener('touchstart', (e) => {
    const card = getActiveCard();
    if (!card || !card.contains(e.target)) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; swiping = true;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    const card = getActiveCard(); if (!card) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > Math.abs(dx)) return;
    card.classList.remove('swiping-left', 'swiping-right');
    if (dx > 30) card.classList.add('swiping-right');
    else if (dx < -30) card.classList.add('swiping-left');
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!swiping) return; swiping = false;
    const card = getActiveCard(); if (!card) return;
    card.classList.remove('swiping-left', 'swiping-right');
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < THRESHOLD) return;
    if (document.querySelector('#page-phrases.active')) {
      if (dx > 0) prevPhrase(); else nextPhrase();
    } else if (document.querySelector('#page-vocab.active')) {
      if (revealed) { if (dx > 0) nextCard('know'); else nextCard('unknown'); }
      else showMeaning();
    }
  }, { passive: true });
})();

// ================================
// KEYBOARD SHORTCUTS
// ================================
document.addEventListener('keydown', (e) => {
  if (document.querySelector('#page-phrases.active')) {
    if (e.key === 'ArrowLeft') prevPhrase();
    else if (e.key === 'ArrowRight') nextPhrase();
    else if (e.key === ' ') { e.preventDefault(); if (!phraseRevealed) showPhraseMeaning(); else playAudio('phrase'); }
  } else if (document.querySelector('#page-vocab.active')) {
    if (e.key === ' ') { e.preventDefault(); if (!revealed) showMeaning(); }
    else if (e.key === 'ArrowRight' && revealed) nextCard('know');
    else if (e.key === 'ArrowLeft' && revealed) nextCard('unknown');
  }
});

// ================================
// INIT
// ================================
document.addEventListener('DOMContentLoaded', function () {
  // Dark mode
  initDarkMode();

  // Auto-play toggle
  const apToggle = document.getElementById('autoPlayToggle');
  if (apToggle) apToggle.checked = autoPlayAudio;

  // Speed buttons
  const rateMap = { 0.5: 0, 0.8: 1, 1.0: 2 };
  const speedBtns = document.querySelectorAll('.speed-btn');
  speedBtns.forEach(b => b.classList.remove('active'));
  const idx = rateMap[speechRate] ?? 1;
  if (speedBtns[idx]) speedBtns[idx].classList.add('active');

  // API keys
  loadApiKeyStatus();

  // Streak
  initStreak();

  // Drill
  drillList = shuffle([...drillScenarios]);
  renderDrillCard();

  // Home screen
  renderHomeScreen();
  recordDailyActivity();

  // Badge
  updateBadge();

  // Library counts
  const libVocab = document.getElementById('libVocabCount');
  if (libVocab) libVocab.textContent = Object.values(vocabData).flat().length + '語';
  const libCustom = document.getElementById('libCustomCount');
  if (libCustom) libCustom.textContent = getCustomVocab().length + '件';
});

// ================================
// WINDOW EXPORTS (for onclick handlers)
// ================================
Object.assign(window, {
  // Navigation
  switchPage, openSubPage, goBack,
  // Settings
  saveApiKey, showApiKeys, clearApiKeys, setSpeechRate, toggleAutoPlay, toggleDarkMode,
  // Vocab
  setVocabMode, setCategory, setFreqFilter, setSceneFilter, showMeaning, nextCard, playAudio,
  // Phrases
  setPhraseMode, setPhraseCategory, showPhraseMeaning, nextPhrase, prevPhrase, markPhrase,
  // Grammar
  renderGrammarCards, toggleGrammar, togglePractice, answerPractice, resetPractice,
  switchGrammarMode, selectGrammarPattern, startGrammarDrill, submitGrammarDrill, nextGrammarDrill, playGrammarModel, toggleGrammarVoice,
  // Drill
  switchDrillMode, setDrillScene, nextDrill, prevDrill, toggleDrillRecord, playDrillModel,
  // Sim
  startSim, toggleSimRecord, resetSim,
  // AI Generator
  generatePhrases,
  // Progress
  analyzeWeakness, startFocusDrill, startSrsReview, renderHomeScreen,
  // Missions
  startMission,
  // Listening
  startListening, playListeningAudio, setListeningSpeed, checkListeningChoice, submitListeningAnswer, nextListeningQuestion, retryListening,
  // Matching
  setMatchCategory, startMatching, flipMatchCard, retryMatching,
  // Diary
  changeDiaryPrompt, submitDiary, playDiaryAudio,
  // Shadowing
  startShadowingRound, stopShadowRecording,
  // Scanner
  setScanMode, handleScanPhoto, playScanAudio, saveScanWord, renderScanResult,
  // Confetti
  triggerConfetti,
});
