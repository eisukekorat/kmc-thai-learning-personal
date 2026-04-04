# タイ語学習アプリ 完全リニューアル実装ガイド

> **目的**: UIを完全刷新 + 5つの新機能 + デイリーミッションシステムの実装
> **実装者**: Claude Sonnet
> **方針**: 全ファイルを読み込んでから実装を開始すること。既存の学習データ（localStorage）を破壊しないこと。

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [ファイル構成と変更方針](#2-ファイル構成と変更方針)
3. [保護すべきデータ・キー一覧](#3-保護すべきデータキー一覧)
4. [既存の共通関数（再利用すること）](#4-既存の共通関数再利用すること)
5. [デザインシステム（CSS完全書き換え）](#5-デザインシステムcss完全書き換え)
6. [HTML構造（advanced.html完全書き換え）](#6-html構造advancedhtml完全書き換え)
7. [ナビゲーション設計](#7-ナビゲーション設計)
8. [ホーム画面 + デイリーミッションシステム](#8-ホーム画面--デイリーミッションシステム)
9. [レベルシステム](#9-レベルシステム)
10. [新機能1: リスニングチャレンジ](#10-新機能1-リスニングチャレンジ)
11. [新機能2: 単語マッチングゲーム](#11-新機能2-単語マッチングゲーム)
12. [新機能3: 一言日記](#12-新機能3-一言日記)
13. [新機能4: シャドーイング](#13-新機能4-シャドーイング)
14. [新機能5: 身の回りスキャン](#14-新機能5-身の回りスキャン)
15. [既存機能の移行チェックリスト](#15-既存機能の移行チェックリスト)
16. [実装順序](#16-実装順序)
17. [テスト項目](#17-テスト項目)

---

## 1. プロジェクト概要

### 技術スタック（変更なし）
- Vanilla HTML/CSS/JS（フレームワークなし、ビルドツールなし）
- PWA（Service Worker + manifest.json）
- API: Claude API, Google Cloud TTS, OpenAI Whisper
- Storage: localStorage + Firebase Firestore同期

### ユーザープロフィール
- 日本人、製造業（品質管理）、タイ人スタッフと日常的に連携
- タイ語学習中（業務・日常会話レベルを目指している）
- **最大の課題**: アプリを毎日使う習慣がない → デイリーミッションで解決する

---

## 2. ファイル構成と変更方針

| ファイル | 方針 | 説明 |
|---------|------|------|
| `advanced.html` | **完全書き換え** | ボトムナビ + 新ページ構成 |
| `styles.css` | **完全書き換え** | 新デザインシステム「Thai Sunset」 |
| `app.js` | **完全書き換え** | 新UI構造に合わせて全関数をリライト + 新機能追加 |
| `data.js` | **変更なし** | そのまま使う（vocabData, phrasesData, grammarData） |
| `firebase-sync.js` | **最小限の変更** | SYNC_KEYS配列に新しいキーを追加するだけ |
| `sw.js` | **キャッシュバージョン更新のみ** | CACHE名を `'thai-study-v7'` に変更 |
| `manifest.json` | **theme_color変更** | `#0a0e14` → `#1C1917` に変更 |
| `index.html` | **デザイン合わせ** | スプラッシュの色を新テーマに合わせる |

---

## 3. 保護すべきデータ・キー一覧

以下のlocalStorageキーは既存ユーザーのデータが入っている。**絶対にキー名を変えないこと。フォーマットも維持すること。**

```javascript
// === 既存キー（変更禁止） ===
'thaiLearningProgress'  // JSON: { vocabLearned: {}, phrasesLearned: {}, grammarLearned: {} }
'weakWords'             // JSON: { "category_index": true, ... }
'grammarQuizScores'     // JSON: { "gidx_qi": true, ... }
'srsData'               // JSON: { "category_index": { lastReviewed, reviewCount, nextReview }, ... }
'learningLog_v1'        // JSON配列: [{ type, word, jp, category, rating, ts }, ...]
'learningHistory'       // JSON: { "YYYY-MM-DD": count, ... }
'customVocab_v1'        // JSON配列: [{ thai, romaji, jp, example, frequency, scenes, ts }, ...]
'streakCount'           // 数値文字列: "14"
'lastAccessDate'        // 日付文字列: "2026-04-04"
'autoPlayAudio'         // "true" / "false"
'speechRate'            // "0.5" / "0.8" / "1.0"
'vocabFreqFilter'       // "all" / "high" / "medium" / "weak"
'vocabSceneFilter'      // "all" / "朝礼" / "QC" / ...
'openaiApiKey'          // APIキー文字列
'claudeApiKey'          // APIキー文字列
'googleTTSApiKey'       // APIキー文字列

// === 新規追加キー ===
'dailyMissions'         // JSON: { date: "YYYY-MM-DD", missions: [...], completed: [...] }
'missionHistory'        // JSON: { "YYYY-MM-DD": { completed: 3, total: 3 }, ... }
'listeningScores'       // JSON: { totalPlayed: N, totalCorrect: N, history: [...] }
'matchingBestTimes'     // JSON: { "category_difficulty": timeMs, ... }
'diaryEntries'          // JSON配列: [{ date, text, corrected, feedback, prompt }, ...]
'shadowingHistory'      // JSON配列: [{ date, phrase, matchPercent }, ...]
'scanHistory'           // JSON配列: [{ date, imageData, result }, ...]
'userLevel'             // JSON: { level: N, xp: N }
'streakFreezeUsed'      // 日付文字列: "YYYY-MM-DD" （今週フリーズを使った日）
```

### firebase-sync.js への追加

SYNC_KEYS配列に以下を追加：
```javascript
'dailyMissions',
'missionHistory',
'listeningScores',
'matchingBestTimes',
'diaryEntries',
'shadowingHistory',
'scanHistory',
'userLevel',
'streakFreezeUsed',
```

---

## 4. 既存の共通関数（再利用すること）

以下の関数は新しいapp.jsでも同じロジックで再実装すること。

### 音声再生: `playAudioTTS(text)`
```
Google Cloud TTS → OpenAI TTS → Web Speech API のカスケード
ttsCache（Map）でメモリキャッシュ
speechRate変数を参照
```

### Claude API: `claudeFetch(key, body)`
```
endpoint: 'https://api.anthropic.com/v1/messages'
headers:
  'x-api-key': key
  'anthropic-version': '2023-06-01'
  'content-type': 'application/json'
  'anthropic-dangerous-direct-browser-access': 'true'
mode: 'cors', credentials: 'omit'
```

### Whisper ASR: `sendToWhisper(audioBlob)`
```
endpoint: 'https://api.openai.com/v1/audio/transcriptions'
model: 'whisper-1', language: 'th'
MIMEタイプ判定: mp4→m4a, ogg→ogg, else→webm
```

### MediaRecorder: `startMediaRecorder(onStop)`, `stopMediaRecorder()`
```
getSupportedMimeType(): audio/webm → mp4 → aac → ogg のフォールバック
iOS Safariはwebm非対応のためmp4自動切替が必要
```

### APIキー取得
```javascript
getGoogleTTSKey()  → localStorage.getItem('googleTTSApiKey')
getOpenAIKey()     → localStorage.getItem('openaiApiKey')
getClaudeKey()     → localStorage.getItem('claudeApiKey')
```

### SRS関連
```javascript
getSrsIntervalDays(reviewCount) → [1, 3, 7, 14, 30][reviewCount] ?? null
recordSrs(category, index)      → srsData[key].reviewCount++, nextReview計算
recordSrsFuzzy(category, index) → nextReview = 翌日固定, reviewCountそのまま
getTodayReviewWords()           → srsData内のnextReview <= todayのエントリ一覧
```

### 学習ログ
```javascript
logLearningEvent(event) → learningLog_v1に追加（14日以上古いものは自動削除）
```

### PWAエラーメッセージ
```javascript
pwaErrorMsg(e) → window.navigator.standalone時は「SafariブラウザでURLを直接開いて...」メッセージ
```

---

## 5. デザインシステム（CSS完全書き換え）

### カラーパレット「Thai Sunset」

```css
:root {
  /* === Light Mode (デフォルト) === */
  --primary: #FF6B35;
  --primary-hover: #E85D2C;
  --primary-soft: #FFF4EE;
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --accent-soft: #EFF6FF;
  --gold: #F59E0B;
  --gold-soft: #FFFBEB;
  --success: #10B981;
  --success-soft: #ECFDF5;
  --error: #EF4444;
  --error-soft: #FEF2F2;
  --bg: #FAF9F7;
  --surface: #FFFFFF;
  --surface-dim: #F5F5F3;
  --border: #E7E5E4;
  --border-strong: #D6D3D1;
  --text: #1C1917;
  --text-secondary: #57534E;
  --text-muted: #A8A29E;
  --thai: #FF6B35;           /* タイ語テキストの色 = primary */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 9999px;
}

/* === Dark Mode === */
body.dark-mode {
  --primary: #FF8C5A;
  --primary-hover: #FF6B35;
  --primary-soft: rgba(255,107,53,0.12);
  --accent: #60A5FA;
  --accent-hover: #3B82F6;
  --accent-soft: rgba(96,165,250,0.12);
  --gold: #FBBF24;
  --gold-soft: rgba(251,191,36,0.12);
  --success: #34D399;
  --success-soft: rgba(52,211,153,0.12);
  --error: #F87171;
  --error-soft: rgba(248,113,113,0.12);
  --bg: #0C0A09;
  --surface: #1C1917;
  --surface-dim: #292524;
  --border: #292524;
  --border-strong: #44403C;
  --text: #FAFAF9;
  --text-secondary: #D6D3D1;
  --text-muted: #78716C;
  --thai: #FF8C5A;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.4);
}
```

**重要**: 現在のアプリはダークモードがデフォルト（`body.light-mode`で切替）。新デザインでは**ライトモードをデフォルト**にし、`body.dark-mode`で切替にする。ただし、ユーザーのOSのプリファレンスに合わせる:

```css
@media (prefers-color-scheme: dark) {
  :root { /* ダークモードの値に上書き */ }
}
```

### タイポグラフィ
```css
/* Google Fontsは現在と同じURLを使う（変更なし） */
/* Sarabun: タイ語テキスト */
/* Noto Sans JP: 日本語テキスト */
/* IBM Plex Mono: 数値・コード */

body {
  font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}

.thai-text {
  font-family: 'Sarabun', sans-serif;
}

.mono {
  font-family: 'IBM Plex Mono', monospace;
}
```

### レイアウトの基本ルール
- `max-width: 480px` + `margin: 0 auto` でモバイルファースト
- カードの角丸: `16px`
- カード影: `var(--shadow-md)`
- セクション間の余白: `24px`
- カード内の余白: `20px`
- ボタンの角丸: `12px`（通常）、`9999px`（ピル型）

### アニメーション

```css
/* View Transitions API（対応ブラウザ） */
@view-transition {
  navigation: auto;
}

/* タブ切替時のフェード */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* カードフリップ（マッチングゲーム用） */
@keyframes flipIn {
  from { transform: rotateY(90deg); }
  to { transform: rotateY(0deg); }
}

/* 正解バウンス */
@keyframes bounceIn {
  0% { transform: scale(0.9); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* 不正解シェイク */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

/* Confetti（Canvas描画） - ミッション完了時 */
/* app.jsのconfetti()関数で実装。CSSではなくCanvas APIで描画する */
```

### ボトムナビバー

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-around;
  padding: 8px 0 env(safe-area-inset-bottom, 8px);
  z-index: 1000;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  color: var(--text-muted);
  font-size: 0.65rem;
  cursor: pointer;
  transition: color 0.2s;
  background: none;
  border: none;
}

.nav-item.active {
  color: var(--primary);
}

.nav-item .nav-icon {
  font-size: 1.4rem;
}
```

**body padding-bottom**: `env(safe-area-inset-bottom, 0px) + 70px` でボトムナビに被らないように。

---

## 6. HTML構造（advanced.html完全書き換え）

### 全体構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- 既存のmetaタグを維持（viewport, theme-color, PWA関連） -->
  <!-- theme-colorを #FAF9F7 に変更 -->
  <!-- Google Fontsのリンクは変更なし -->
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- オフラインバナー（既存維持） -->
  <div id="offlineBanner">...</div>

  <!-- インストールバナー（既存維持、デザインだけ新テーマに） -->
  <div id="installBanner">...</div>

  <!-- ===== メインコンテンツ ===== -->
  <div class="app-container">

    <!-- PAGE: ホーム -->
    <div class="page active" id="page-home">...</div>

    <!-- PAGE: ライブラリ -->
    <div class="page" id="page-library">...</div>

    <!-- PAGE: 練習（トップレベル: モード一覧） -->
    <div class="page" id="page-practice">...</div>

    <!-- PAGE: 進捗 -->
    <div class="page" id="page-progress">...</div>

    <!-- PAGE: 設定 -->
    <div class="page" id="page-settings">...</div>

    <!-- ===== サブページ（各機能の詳細画面） ===== -->
    <!-- 練習モードのサブページ群 -->
    <div class="page sub-page" id="page-listening">...</div>
    <div class="page sub-page" id="page-matching">...</div>
    <div class="page sub-page" id="page-diary">...</div>
    <div class="page sub-page" id="page-shadowing">...</div>
    <div class="page sub-page" id="page-scanner">...</div>
    <div class="page sub-page" id="page-speaking-drill">...</div>
    <div class="page sub-page" id="page-meeting-sim">...</div>
    <div class="page sub-page" id="page-ai-generator">...</div>
    <div class="page sub-page" id="page-grammar-drill">...</div>

    <!-- ライブラリのサブページ群 -->
    <div class="page sub-page" id="page-vocab">...</div>
    <div class="page sub-page" id="page-phrases">...</div>
    <div class="page sub-page" id="page-grammar">...</div>

  </div>

  <!-- ===== ボトムナビ ===== -->
  <nav class="bottom-nav" id="bottomNav">
    <button class="nav-item active" data-page="home">
      <span class="nav-icon">🏠</span>
      <span>ホーム</span>
    </button>
    <button class="nav-item" data-page="library">
      <span class="nav-icon">📚</span>
      <span>ライブラリ</span>
    </button>
    <button class="nav-item" data-page="practice">
      <span class="nav-icon">🎯</span>
      <span>練習</span>
    </button>
    <button class="nav-item" data-page="progress">
      <span class="nav-icon">📊</span>
      <span>進捗</span>
    </button>
    <button class="nav-item" data-page="settings">
      <span class="nav-icon">⚙️</span>
      <span>設定</span>
    </button>
  </nav>

  <!-- Confetti用Canvas（全画面オーバーレイ） -->
  <canvas id="confettiCanvas" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;"></canvas>

  <script src="data.js"></script>
  <script src="app.js"></script>
  <script type="module">
    // firebase-sync.jsのインポート（既存コードと同じ）
    import { loginWithGoogle, logoutFirebase, onAuthChange, uploadToFirestore, downloadFromFirestore }
      from './firebase-sync.js';
    // ... （既存の window.firebaseLogin 等の定義をそのまま維持）
  </script>
</body>
</html>
```

### ページ遷移の仕組み

```javascript
// メインページ（ボトムナビ連動）
function switchPage(pageId) {
  // View Transitions APIが使えれば使う
  const update = () => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
    // サブページから戻ったらボトムナビを表示
    document.getElementById('bottomNav').style.display = '';
  };

  if (document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

// サブページ（戻るボタン付き）
function openSubPage(subPageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + subPageId).classList.add('active');
  // ボトムナビは非表示にしない（表示したままでOK）
}

function goBack() {
  // 直前のメインページに戻る（履歴スタックを使う）
  switchPage(lastMainPage);
}
```

**各サブページの上部に共通ヘッダーを置く:**
```html
<div class="sub-page-header">
  <button class="back-btn" onclick="goBack()">← 戻る</button>
  <h2 class="sub-page-title">👂 リスニングチャレンジ</h2>
</div>
```

---

## 7. ナビゲーション設計

### メインページ（ボトムナビの5タブ）

| タブ | ページID | 内容 |
|------|---------|------|
| 🏠 ホーム | `page-home` | デイリーミッション + ストリーク + レベル |
| 📚 ライブラリ | `page-library` | 単語/フレーズ/文法/マイ単語のカード一覧 |
| 🎯 練習 | `page-practice` | 全練習モードのカード一覧 |
| 📊 進捗 | `page-progress` | レベル + 7日チャート + AI弱点分析 |
| ⚙️ 設定 | `page-settings` | API設定 + Firebase同期 + 音声設定 |

### サブページ（タップで遷移、戻るボタンで戻る）

**ライブラリから:**
- `page-vocab` — 単語フラッシュカード（既存機能）
- `page-phrases` — 職場フレーズ（既存機能）
- `page-grammar` — 文法リファレンス（既存機能）

**練習から:**
- `page-listening` — リスニングチャレンジ [NEW]
- `page-matching` — 単語マッチング [NEW]
- `page-diary` — 一言日記 [NEW]
- `page-shadowing` — シャドーイング [NEW]
- `page-scanner` — 身の回りスキャン [NEW]
- `page-speaking-drill` — スピーキングドリル（既存）
- `page-meeting-sim` — 会議シミュレーション（既存）
- `page-ai-generator` — AIフレーズ生成（既存）
- `page-grammar-drill` — 文法AIドリル（既存）

---

## 8. ホーム画面 + デイリーミッションシステム

### ホーム画面の構成

```html
<div class="page active" id="page-home">
  <!-- 挨拶 + ストリーク -->
  <div class="home-greeting">
    <div class="greeting-text" id="greetingText">สวัสดีตอนเช้า！おはよう</div>
    <div class="streak-badge" id="streakBadge">
      <span class="streak-fire">🔥</span>
      <span class="streak-number" id="streakNumber">14</span>
      <span class="streak-label">日連続</span>
    </div>
  </div>

  <!-- レベル表示 -->
  <div class="level-card" id="levelCard">
    <div class="level-name">Level 3: 指示出し見習い</div>
    <div class="level-progress-bar">
      <div class="level-progress-fill" style="width: 65%"></div>
    </div>
    <div class="level-progress-text">65% → Level 4</div>
  </div>

  <!-- デイリーミッション -->
  <div class="mission-section">
    <div class="mission-header">
      <h2>今日のミッション</h2>
      <span class="mission-time">約5分</span>
    </div>
    <div class="mission-progress-dots" id="missionDots">
      <!-- ○●○ のような進捗ドット -->
    </div>
    <div class="mission-list" id="missionList">
      <!-- ミッションカードがここに動的生成される -->
    </div>
  </div>

  <!-- もっとやる？セクション -->
  <div class="more-section">
    <h3>もっとやる？</h3>
    <div class="quick-actions" id="quickActions">
      <!-- 練習モードへのクイックリンク -->
    </div>
  </div>

  <!-- 今週の成果（ミニ統計） -->
  <div class="weekly-stats" id="weeklyStats">
    <!-- 📗 12語習得  ⏱ 23分  🎯 85% -->
  </div>
</div>
```

### デイリーミッション生成ロジック

```javascript
const MISSION_TYPES = [
  {
    id: 'srs_review',
    name: 'SRS復習',
    icon: '🔄',
    time: 2,           // 目安分数
    description: '復習カードをチェック',
    condition: () => getTodayReviewWords().length > 0,
    action: () => startMissionSrsReview(),
    checkComplete: () => /* 5枚以上レビューしたらtrue */
  },
  {
    id: 'listening',
    name: 'リスニング',
    icon: '👂',
    time: 1,
    description: '3問のリスニングクイズ',
    condition: () => true, // 常に利用可能
    action: () => startMissionListening(3),
    checkComplete: () => /* 3問回答したらtrue */
  },
  {
    id: 'matching',
    name: 'マッチング',
    icon: '🎮',
    time: 2,
    description: '単語の神経衰弱1回',
    condition: () => true,
    action: () => startMissionMatching(),
    checkComplete: () => /* 1ゲーム完了したらtrue */
  },
  {
    id: 'diary',
    name: '一言日記',
    icon: '📝',
    time: 2,
    description: 'タイ語で1文書く',
    condition: () => !!getClaudeKey(),
    action: () => startMissionDiary(),
    checkComplete: () => /* 今日の日記を書いたらtrue */
  },
  {
    id: 'shadowing',
    name: 'シャドーイング',
    icon: '🔊',
    time: 2,
    description: 'お手本を3回真似する',
    condition: () => !!getGoogleTTSKey(),
    action: () => startMissionShadowing(3),
    checkComplete: () => /* 3回シャドーイングしたらtrue */
  },
  {
    id: 'grammar_quiz',
    name: '文法クイズ',
    icon: '📖',
    time: 1,
    description: '文法問題を2問',
    condition: () => true,
    action: () => startMissionGrammarQuiz(2),
    checkComplete: () => /* 2問回答したらtrue */
  },
  {
    id: 'new_vocab',
    name: '新単語',
    icon: '📚',
    time: 2,
    description: '新しい単語を5つ覚える',
    condition: () => true,
    action: () => startMissionNewVocab(5),
    checkComplete: () => /* 5枚カードをめくったらtrue */
  }
];

function generateDailyMissions() {
  const today = getTodayStr();
  const saved = JSON.parse(localStorage.getItem('dailyMissions') || '{}');

  // 今日のミッションが既にあればそれを返す
  if (saved.date === today) return saved;

  // 昨日のミッションを取得（同じものを避ける）
  const yesterday = addDays(today, -1);
  const yesterdayMissions = JSON.parse(localStorage.getItem('missionHistory') || '{}')[yesterday];
  const yesterdayIds = yesterdayMissions?.missionIds || [];

  // 利用可能なミッションタイプをフィルタ
  let available = MISSION_TYPES.filter(m => m.condition());

  // ルール1: SRS復習カードがあれば必ず1枠目
  const missions = [];
  const srs = available.find(m => m.id === 'srs_review');
  if (srs) {
    missions.push(srs.id);
    available = available.filter(m => m.id !== 'srs_review');
  }

  // ルール2: 残り枠をランダム選択（昨日と被らないように）
  const remaining = available.filter(m => !yesterdayIds.includes(m.id) && !missions.includes(m.id));
  const shuffled = remaining.sort(() => Math.random() - 0.5);
  while (missions.length < 3 && shuffled.length > 0) {
    missions.push(shuffled.shift().id);
  }
  // それでも足りなければ昨日と被ってもOK
  if (missions.length < 3) {
    const extra = available.filter(m => !missions.includes(m.id)).sort(() => Math.random() - 0.5);
    while (missions.length < 3 && extra.length > 0) {
      missions.push(extra.shift().id);
    }
  }

  const data = { date: today, missionIds: missions, completed: [] };
  localStorage.setItem('dailyMissions', JSON.stringify(data));
  return data;
}
```

### ミッション完了時の処理

```javascript
function completeMission(missionId) {
  const data = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  if (!data.completed) data.completed = [];
  if (!data.completed.includes(missionId)) {
    data.completed.push(missionId);
    localStorage.setItem('dailyMissions', JSON.stringify(data));

    // Vibration API
    if (navigator.vibrate) navigator.vibrate(50);

    // 全ミッション完了チェック
    if (data.completed.length >= data.missionIds.length) {
      triggerConfetti();
      // ストリーク更新
      updateStreak();
      // ミッション履歴保存
      saveMissionHistory(data);
    }
  }
  renderMissions(); // UI更新
}
```

### ストリーク + フリーズ機能

```javascript
function updateStreak() {
  const today = getTodayStr();
  const last = localStorage.getItem('lastAccessDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0');

  if (last === today) return; // 同じ日は何もしない

  const yesterday = addDays(today, -1);

  if (last === yesterday) {
    streak += 1;
  } else {
    // ストリーク切れ？フリーズ判定
    const freezeUsed = localStorage.getItem('streakFreezeUsed') || '';
    const freezeWeekStart = getWeekStart(today);

    if (freezeUsed < freezeWeekStart) {
      // 今週まだフリーズ使ってない → フリーズ発動
      localStorage.setItem('streakFreezeUsed', today);
      streak += 1; // ストリーク維持
    } else {
      // フリーズ使用済み → リセット（ただし温かく迎える）
      streak = 1;
    }
  }

  localStorage.setItem('lastAccessDate', today);
  localStorage.setItem('streakCount', String(streak));
}

// 「おかえりモード」: 3日以上空いた場合、温かいメッセージを表示
function getGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const last = localStorage.getItem('lastAccessDate');
  const daysSinceLast = last ? Math.floor((new Date(getTodayStr()) - new Date(last)) / 86400000) : 0;

  // 時間帯の挨拶（タイ語 + 日本語）
  let greetingThai, greetingJP;
  if (hour < 12) {
    greetingThai = 'สวัสดีตอนเช้า';
    greetingJP = 'おはよう';
  } else if (hour < 17) {
    greetingThai = 'สวัสดีตอนบ่าย';
    greetingJP = 'こんにちは';
  } else {
    greetingThai = 'สวัสดีตอนเย็น';
    greetingJP = 'こんばんは';
  }

  if (daysSinceLast >= 3) {
    return `${greetingThai}！おかえり！また始めよう 💪`;
  }

  return `${greetingThai}！${greetingJP}`;
}
```

### Confetti実装（Canvas API）

```javascript
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#FF6B35', '#F59E0B', '#10B981', '#2563EB', '#EF4444', '#8B5CF6'];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 100,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      life: 1
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3; // 重力
      p.life -= 0.015;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    if (alive) requestAnimationFrame(animate);
  }
  animate();
}
```

### Badging API（PWAアイコンバッジ）

```javascript
function updateBadge() {
  if (!navigator.setAppBadge) return;
  const data = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  const remaining = (data.missionIds?.length || 0) - (data.completed?.length || 0);
  if (remaining > 0) {
    navigator.setAppBadge(remaining);
  } else {
    navigator.clearAppBadge();
  }
}
```

---

## 9. レベルシステム

```javascript
const LEVELS = [
  { level: 1, name: '挨拶マスター', xpRequired: 0, description: '基本の挨拶・自己紹介ができる' },
  { level: 2, name: '工場の新人', xpRequired: 100, description: '基本の仕事単語がわかる' },
  { level: 3, name: '指示出し見習い', xpRequired: 300, description: '簡単な指示・質問ができる' },
  { level: 4, name: '品質管理の仲間', xpRequired: 600, description: '品質の議論に参加できる' },
  { level: 5, name: '会議の参加者', xpRequired: 1000, description: '会議で意見を述べられる' },
  { level: 6, name: 'タイ語のプロ', xpRequired: 1500, description: 'ビジネス全般に対応できる' },
];

// XPの計算（既存データから）
function calculateXP() {
  const srsCount = Object.keys(loadSrsData()).length;
  const vocabLearned = Object.keys(loadProgress().vocabLearned).filter(k => loadProgress().vocabLearned[k]).length;
  const phrasesLearned = Object.keys(loadProgress().phrasesLearned).filter(k => loadProgress().phrasesLearned[k]).length;
  const grammarLearned = Object.keys(loadProgress().grammarLearned).filter(k => loadProgress().grammarLearned[k]).length;
  const diaryCount = (JSON.parse(localStorage.getItem('diaryEntries') || '[]')).length;
  const missionHistory = JSON.parse(localStorage.getItem('missionHistory') || '{}');
  const missionDays = Object.keys(missionHistory).length;

  return (
    srsCount * 2 +           // SRS登録語×2
    vocabLearned * 1 +        // 学習済み単語×1
    phrasesLearned * 1 +      // 学習済みフレーズ×1
    grammarLearned * 5 +      // 文法パターン×5
    diaryCount * 10 +         // 日記×10
    missionDays * 5            // ミッション完了日数×5
  );
}

function getCurrentLevel() {
  const xp = calculateXP();
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xpRequired) current = level;
    else break;
  }
  return { ...current, xp, nextLevel: LEVELS[current.level] || null };
}
```

---

## 10. 新機能1: リスニングチャレンジ

### 画面構成

```html
<div class="page sub-page" id="page-listening">
  <div class="sub-page-header">
    <button class="back-btn" onclick="goBack()">← 戻る</button>
    <h2>👂 リスニングチャレンジ</h2>
  </div>

  <!-- 難易度選択（初回表示） -->
  <div id="listeningSetup">
    <div class="difficulty-cards">
      <button class="diff-card" onclick="startListening('beginner')">
        <span class="diff-icon">🟢</span>
        <span class="diff-name">初級</span>
        <span class="diff-desc">単語を聞いて4択</span>
      </button>
      <button class="diff-card" onclick="startListening('intermediate')">
        <span class="diff-icon">🟡</span>
        <span class="diff-name">中級</span>
        <span class="diff-desc">フレーズを聞いて意味を選ぶ</span>
      </button>
      <button class="diff-card" onclick="startListening('advanced')">
        <span class="diff-icon">🔴</span>
        <span class="diff-name">上級</span>
        <span class="diff-desc">聞いてローマ字で書き取る</span>
      </button>
    </div>
  </div>

  <!-- クイズ画面 -->
  <div id="listeningQuiz" style="display:none">
    <div class="listening-card">
      <div class="listening-icon">🔊</div>
      <button class="listening-play-btn" id="listeningPlayBtn" onclick="playListeningAudio()">
        もう一度聞く
      </button>
      <div id="listeningSpeedControl">
        <button onclick="setListeningSpeed('slow')">🐢 ゆっくり</button>
        <button onclick="setListeningSpeed('normal')">▶ 普通</button>
      </div>
    </div>

    <!-- 初級・中級: 4択 -->
    <div id="listeningChoices" class="quiz-choices">
      <!-- 動的生成 -->
    </div>

    <!-- 上級: テキスト入力 -->
    <div id="listeningInput" style="display:none">
      <input type="text" id="listeningAnswer" placeholder="ローマ字で入力...">
      <button onclick="submitListeningAnswer()">回答 →</button>
    </div>

    <!-- フィードバック -->
    <div id="listeningFeedback" style="display:none">
      <!-- 正解/不正解 + 正しい答え -->
    </div>

    <div class="listening-counter" id="listeningCounter">1 / 10</div>
    <button id="listeningNextBtn" style="display:none" onclick="nextListeningQuestion()">次へ →</button>
  </div>

  <!-- 結果画面 -->
  <div id="listeningResult" style="display:none">
    <div class="result-score">8 / 10</div>
    <div class="result-message">いい調子！</div>
    <div class="result-mistakes" id="listeningMistakes">
      <!-- 間違えた問題のリスト -->
    </div>
    <button onclick="retryListening()">もう一度</button>
    <button onclick="goBack()">戻る</button>
  </div>
</div>
```

### ロジック

```javascript
// 問題生成
function generateListeningQuestions(difficulty, count = 10) {
  let pool = [];

  if (difficulty === 'beginner') {
    // data.jsのvocabDataから全単語を取得
    pool = Object.values(vocabData).flat().map(w => ({
      audio: w.thai,      // TTS再生するテキスト
      answer: w.jp,       // 正解
      type: 'choice'
    }));
  } else if (difficulty === 'intermediate') {
    // phrasesDataから全フレーズ
    pool = Object.values(phrasesData).flat().map(p => ({
      audio: p.thai,
      answer: p.jp,
      type: 'choice'
    }));
  } else {
    // 上級: vocabDataから（ローマ字で回答）
    pool = Object.values(vocabData).flat().map(w => ({
      audio: w.thai,
      answer: w.romaji,   // ローマ字が正解
      answerThai: w.thai,
      answerJP: w.jp,
      type: 'dictation'
    }));
  }

  // ランダムにcount問選択
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count);

  // 4択の選択肢生成（choice型の場合）
  return shuffled.map(q => {
    if (q.type === 'choice') {
      const wrongAnswers = pool
        .filter(p => p.answer !== q.answer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(p => p.answer);
      const choices = [q.answer, ...wrongAnswers].sort(() => Math.random() - 0.5);
      return { ...q, choices };
    }
    return q;
  });
}

// 回答チェック
function checkListeningAnswer(selected) {
  const q = listeningQuestions[listeningIndex];
  const isCorrect = selected === q.answer;

  // Vibration
  if (navigator.vibrate) {
    navigator.vibrate(isCorrect ? 50 : [100, 50, 100]);
  }

  // 視覚フィードバック
  // 正解: bounceInアニメ + success色
  // 不正解: shakeアニメ + error色

  // スコア記録
  if (isCorrect) listeningCorrectCount++;
  else listeningMistakes.push(q);

  // 次へボタン表示
}
```

---

## 11. 新機能2: 単語マッチングゲーム

### 画面構成

```html
<div class="page sub-page" id="page-matching">
  <div class="sub-page-header">
    <button class="back-btn" onclick="goBack()">← 戻る</button>
    <h2>🎮 単語マッチング</h2>
  </div>

  <!-- 設定画面 -->
  <div id="matchingSetup">
    <!-- カテゴリ選択 -->
    <div class="category-select">
      <button onclick="setMatchCategory('work')">🏭 職場</button>
      <button onclick="setMatchCategory('quality')">🔍 品質</button>
      <button onclick="setMatchCategory('daily')">☀️ 日常</button>
      <button onclick="setMatchCategory('polite')">🙏 敬語</button>
    </div>
    <!-- 難易度選択 -->
    <div class="difficulty-cards">
      <button onclick="startMatching(4)">🟢 初級（4ペア）</button>
      <button onclick="startMatching(6)">🟡 中級（6ペア）</button>
      <button onclick="startMatching(8)">🔴 上級（8ペア）</button>
    </div>
  </div>

  <!-- ゲーム画面 -->
  <div id="matchingGame" style="display:none">
    <div class="matching-header">
      <div class="matching-timer" id="matchingTimer">0:00</div>
      <div class="matching-attempts" id="matchingAttempts">0回</div>
    </div>
    <div class="matching-grid" id="matchingGrid">
      <!-- カードが動的生成される -->
    </div>
  </div>

  <!-- 結果画面 -->
  <div id="matchingResult" style="display:none">
    <div class="result-time">1:23</div>
    <div class="result-attempts">12回</div>
    <div class="result-best">ベスト: 0:58</div>
    <button onclick="retryMatching()">もう一度</button>
    <button onclick="goBack()">戻る</button>
  </div>
</div>
```

### ロジック

```javascript
let matchingCards = [];
let matchingFirst = null;
let matchingSecond = null;
let matchingLocked = false;
let matchingTimer = null;
let matchingStartTime = null;
let matchingAttempts = 0;

function startMatching(pairCount) {
  // data.jsからカテゴリの単語をランダム選択
  const words = vocabData[matchCategory].sort(() => Math.random() - 0.5).slice(0, pairCount);

  // カード生成: タイ語カード + 日本語カード
  matchingCards = [];
  words.forEach((w, i) => {
    matchingCards.push({ id: 'th_' + i, text: w.thai, type: 'thai', pairId: i, matched: false });
    matchingCards.push({ id: 'jp_' + i, text: w.jp, type: 'jp', pairId: i, matched: false });
  });

  // シャッフル
  matchingCards.sort(() => Math.random() - 0.5);

  // グリッド描画
  renderMatchingGrid(pairCount);

  // タイマー開始
  matchingStartTime = Date.now();
  matchingAttempts = 0;
  matchingTimer = setInterval(updateMatchingTimer, 100);
}

function renderMatchingGrid(pairCount) {
  const grid = document.getElementById('matchingGrid');
  // pairCount=4 → 2×4, pairCount=6 → 3×4, pairCount=8 → 4×4
  const cols = pairCount <= 4 ? 4 : 4;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  grid.innerHTML = matchingCards.map((card, i) => `
    <div class="match-card face-down" data-index="${i}" onclick="flipMatchCard(${i})">
      <div class="match-card-inner">
        <div class="match-card-front">?</div>
        <div class="match-card-back ${card.type === 'thai' ? 'card-thai' : 'card-jp'}">
          ${card.text}
        </div>
      </div>
    </div>
  `).join('');
}

function flipMatchCard(index) {
  if (matchingLocked) return;
  const card = matchingCards[index];
  if (card.matched) return;

  const el = document.querySelector(`[data-index="${index}"]`);
  el.classList.add('flipped');

  if (!matchingFirst) {
    matchingFirst = index;
  } else if (matchingFirst !== index) {
    matchingSecond = index;
    matchingLocked = true;
    matchingAttempts++;

    // ペア判定
    const first = matchingCards[matchingFirst];
    const second = matchingCards[matchingSecond];

    if (first.pairId === second.pairId && first.type !== second.type) {
      // マッチ！
      first.matched = true;
      second.matched = true;
      if (navigator.vibrate) navigator.vibrate(50);

      setTimeout(() => {
        document.querySelector(`[data-index="${matchingFirst}"]`).classList.add('matched');
        document.querySelector(`[data-index="${matchingSecond}"]`).classList.add('matched');
        matchingFirst = null;
        matchingSecond = null;
        matchingLocked = false;

        // 全クリアチェック
        if (matchingCards.every(c => c.matched)) {
          clearInterval(matchingTimer);
          showMatchingResult();
        }
      }, 500);
    } else {
      // 不一致
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setTimeout(() => {
        document.querySelector(`[data-index="${matchingFirst}"]`).classList.remove('flipped');
        document.querySelector(`[data-index="${matchingSecond}"]`).classList.remove('flipped');
        matchingFirst = null;
        matchingSecond = null;
        matchingLocked = false;
      }, 800);
    }
  }
}
```

### カードのCSS（3Dフリップ）

```css
.match-card {
  aspect-ratio: 1;
  perspective: 600px;
  cursor: pointer;
}

.match-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.4s;
  transform-style: preserve-3d;
}

.match-card.flipped .match-card-inner {
  transform: rotateY(180deg);
}

.match-card-front, .match-card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  padding: 8px;
  text-align: center;
  word-break: break-all;
}

.match-card-front {
  background: var(--surface-dim);
  border: 2px solid var(--border);
  color: var(--text-muted);
  font-size: 1.5rem;
}

.match-card-back.card-thai {
  background: var(--primary-soft);
  border: 2px solid var(--primary);
  color: var(--primary);
  font-family: 'Sarabun', sans-serif;
  font-size: 0.9rem;
  transform: rotateY(180deg);
}

.match-card-back.card-jp {
  background: var(--accent-soft);
  border: 2px solid var(--accent);
  color: var(--accent);
  font-size: 0.85rem;
  transform: rotateY(180deg);
}

.match-card.matched {
  opacity: 0.3;
  pointer-events: none;
  transform: scale(0.9);
  transition: all 0.5s;
}
```

---

## 12. 新機能3: 一言日記

### ロジック

```javascript
const DIARY_PROMPTS = [
  '今日の仕事で一番大変だったことは？',
  'お昼に何を食べましたか？',
  '明日の予定は？',
  '今日タイ人スタッフと話したことは？',
  '週末に何をしますか？',
  '最近嬉しかったことは？',
  '今日学んだタイ語は？',
  '工場で気づいたことは？',
  '天気はどうでしたか？',
  '今の気持ちは？',
];

async function submitDiary() {
  const text = document.getElementById('diaryInput').value.trim();
  if (!text) return;
  const key = getClaudeKey();
  if (!key) { alert('Claude APIキーを設定してください'); return; }

  // ステータス表示
  showDiaryStatus('添削中...');

  try {
    const data = await claudeFetch(key, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `タイ語学習者の日記を添削してください。
学習者: 日本人、製造業の管理職、タイ語初〜中級
学習者が書いた文: 「${text}」

以下のJSON形式のみで返してください（説明文不要）：
{
  "corrected": "自然なタイ語に修正した文",
  "romaji": "修正文のローマ字読み",
  "jp": "修正文の日本語訳",
  "point": "今日のポイント（文法や語彙の1行アドバイス）",
  "rating": "great/good/keep_going のいずれか"
}`
      }]
    });

    const rawText = data.content[0].text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch[0]);

    // 結果を表示
    renderDiaryResult(text, result);

    // 保存
    const entries = JSON.parse(localStorage.getItem('diaryEntries') || '[]');
    entries.push({
      date: getTodayStr(),
      text: text,
      corrected: result.corrected,
      feedback: result.point,
      prompt: currentDiaryPrompt
    });
    localStorage.setItem('diaryEntries', JSON.stringify(entries));

    // ミッション完了チェック
    completeMission('diary');
  } catch(e) {
    showDiaryStatus('⚠️ エラー: ' + pwaErrorMsg(e));
  }
}
```

---

## 13. 新機能4: シャドーイング

### ロジック

```javascript
async function startShadowingRound() {
  // フレーズを選択（難易度に応じて）
  const phrase = selectShadowingPhrase();
  currentShadowPhrase = phrase;

  // 表示
  document.getElementById('shadowText').textContent = phrase.thai;
  document.getElementById('shadowRomaji').textContent = phrase.romaji;
  document.getElementById('shadowJP').textContent = phrase.jp;

  // Step 1: お手本再生
  await playAudioTTS(phrase.thai);

  // Step 2: カウントダウン 3-2-1
  await countdown(3);

  // Step 3: 録音開始
  startShadowRecording();
}

async function finishShadowRecording(blob) {
  // Whisperで文字起こし
  const userText = await sendToWhisper(blob);
  document.getElementById('shadowUserText').textContent = userText || '（認識できませんでした）';

  // 一致度計算
  const matchPercent = calculateMatchPercent(currentShadowPhrase.thai, userText);
  document.getElementById('shadowMatchPercent').textContent = matchPercent + '%';

  // 差分ハイライト（簡易版: 文字レベル比較）
  highlightDifferences(currentShadowPhrase.thai, userText);

  // Vibration
  if (navigator.vibrate) {
    navigator.vibrate(matchPercent >= 80 ? 50 : [100, 50, 100]);
  }

  // 保存
  const history = JSON.parse(localStorage.getItem('shadowingHistory') || '[]');
  history.push({ date: getTodayStr(), phrase: currentShadowPhrase.thai, matchPercent });
  localStorage.setItem('shadowingHistory', JSON.stringify(history));
}

function calculateMatchPercent(original, userText) {
  if (!userText) return 0;
  // 簡易レーベンシュタイン距離ベースの一致度
  const maxLen = Math.max(original.length, userText.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(original, userText);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

// レーベンシュタイン距離
function levenshteinDistance(a, b) {
  const matrix = Array.from({length: b.length + 1}, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i-1] === a[j-1]
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
    }
  }
  return matrix[b.length][a.length];
}
```

### Screen Wake Lock（ドリル/シャドーイング中）

```javascript
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch(e) { /* 無視 */ }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
```

---

## 14. 新機能5: 身の回りスキャン

### HTML

```html
<div class="page sub-page" id="page-scanner">
  <div class="sub-page-header">
    <button class="back-btn" onclick="goBack()">← 戻る</button>
    <h2>📸 身の回りスキャン</h2>
  </div>

  <!-- モード切替 -->
  <div class="scanner-mode-switch">
    <button class="active" onclick="setScanMode('work')">🏭 職場モード</button>
    <button onclick="setScanMode('daily')">🏠 日常モード</button>
  </div>

  <!-- 撮影ボタン -->
  <div class="scanner-capture">
    <label class="capture-btn">
      📸 写真を撮る
      <input type="file" accept="image/*" capture="environment"
             onchange="handleScanPhoto(this)" style="display:none">
    </label>
    <label class="capture-btn secondary">
      🖼 ライブラリから選ぶ
      <input type="file" accept="image/*"
             onchange="handleScanPhoto(this)" style="display:none">
    </label>
  </div>

  <!-- 結果表示 -->
  <div id="scanResult" style="display:none">
    <img id="scanPreview" class="scan-preview">
    <div class="scan-result-card">
      <div class="scan-thai" id="scanThai"></div>
      <div class="scan-romaji" id="scanRomaji"></div>
      <div class="scan-jp" id="scanJP"></div>
      <div class="scan-example" id="scanExample"></div>
      <div class="scan-actions">
        <button onclick="playScanAudio()">🔊 発音</button>
        <button onclick="saveScanWord()">💾 マイ単語に保存</button>
      </div>
    </div>
  </div>

  <!-- 履歴ギャラリー -->
  <div class="scan-history">
    <h3>📷 スキャン履歴</h3>
    <div class="scan-gallery" id="scanGallery">
      <!-- サムネイル一覧 -->
    </div>
  </div>
</div>
```

### ロジック

```javascript
async function handleScanPhoto(input) {
  const file = input.files[0];
  if (!file) return;

  const key = getClaudeKey();
  if (!key) { alert('Claude APIキーを設定してください'); return; }

  // プレビュー表示
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    document.getElementById('scanPreview').src = base64;
    document.getElementById('scanResult').style.display = 'block';

    // Claude Vision APIに送信
    showScanStatus('認識中...');

    try {
      const modeContext = scanMode === 'work'
        ? '製造業・品質管理の現場で使う語彙を優先してください'
        : '日常生活で使う語彙を優先してください';

      const data = await claudeFetch(key, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type,
                data: base64.split(',')[1]  // data:image/...;base64, を除去
              }
            },
            {
              type: 'text',
              text: `この写真に写っている主要な物体を1つ特定し、そのタイ語名を教えてください。
${modeContext}

以下のJSON形式のみで返してください：
{
  "thai": "タイ語",
  "romaji": "ローマ字読み",
  "katakana": "カタカナ読み",
  "jp": "日本語の意味",
  "example": "この単語を使ったタイ語の例文（日本語訳付き）"
}`
            }
          ]
        }]
      });

      const rawText = data.content[0].text;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch[0]);

      renderScanResult(result, base64);

      // 履歴保存（画像はサムネイルサイズにリサイズしてから保存）
      saveScanHistory(result, base64);
    } catch(e) {
      showScanStatus('⚠️ エラー: ' + pwaErrorMsg(e));
    }
  };
  reader.readAsDataURL(file);
}
```

**注意**: `scanHistory`に保存する画像はサイズが大きくなるため、Canvasでリサイズ（200x200程度）してから保存すること。localStorageの容量制限（5MB）に注意。

---

## 15. 既存機能の移行チェックリスト

以下の既存機能は新UIに合わせてリファクタリングするが、**ロジックは変更しない**:

### ☐ 単語フラッシュカード（page-vocab）
- カテゴリ選択（work/quality/daily/polite/custom）
- 頻度フィルタ（all/high/medium/weak）
- シーンフィルタ（全て/朝礼/QC/不良対応/指示/会議/日常）
- 学習モード / 復習モード
- タップで意味表示
- 😕知らない / 🤔あやしい / ✅知ってる の3段階評価
- SRS登録（know→通常SRS, fuzzy→翌日固定, unknown→再キュー+Claudeヒント）
- スワイプ対応
- Claude覚え方ヒント
- 自動再生

### ☐ 職場フレーズ（page-phrases）
- カテゴリ選択（meeting/instruction/question/polite）
- 学習モード / 復習モード
- 音声再生
- 覚えた/もう一度

### ☐ 文法リファレンス（page-grammar内）
- grammarDataの20パターン表示
- アコーディオン開閉
- 練習問題（3択 × 3問）

### ☐ 文法AIドリル（page-grammar-drill）
- パターン選択 → Claude生成 → テキスト/音声入力 → 添削

### ☐ スピーキングドリル（page-speaking-drill）
- シーン選択（朝礼/不良対応/作業指示/安全）
- 録音 → Whisper → Claude添削 → お手本表示
- **drillScenarios配列はapp.js内にハードコードされている（data.jsではない）→ そのまま移行**

### ☐ 会議シミュレーション（page-meeting-sim）
- 4シーン（朝礼/不良対応/納期確認/安全指示）
- NPC開始 → ユーザー録音 → Claude応答 → 繰り返し
- **simSystemPrompts, simOpenersもapp.js内 → そのまま移行**

### ☐ AIフレーズ生成（page-ai-generator）
- テキスト入力 → Claude生成 → 3レベル（丁寧/普通/カジュアル）
- 保存 → customVocab_v1 に追加

### ☐ 弱点分析（page-progress内）
- learningLog_v1を集計 → Claude分析 → 集中ドリル

### ☐ 設定（page-settings）
- Firebase同期（Google OAuth）
- 音声自動再生トグル
- 音声速度（0.5x/0.8x/1.0x）
- APIキー管理（Google TTS / OpenAI / Claude）
- ダークモード切替（**新規追加**）

---

## 16. 実装順序

**この順番で実装すること。各ステップ完了後にプレビューで動作確認すること。**

### Step 1: CSS + HTML基盤 + ナビゲーション
1. `styles.css` を完全書き換え（デザインシステム + ボトムナビ + ページレイアウト）
2. `advanced.html` の骨組みを作る（全ページのHTML構造 + ボトムナビ）
3. `app.js` にページ切替ロジック（switchPage, openSubPage, goBack）
4. **動作確認**: ボトムナビでページ切替ができること

### Step 2: 既存機能の移行
1. 設定ページ（APIキー、Firebase同期、音声設定、ダークモード）
2. 共通関数の移植（playAudioTTS, claudeFetch, sendToWhisper, MediaRecorder, SRS関連）
3. ホーム画面（ストリーク、レベル表示、週間チャート — ミッション以外）
4. 単語フラッシュカード
5. 職場フレーズ
6. 文法リファレンス + 文法AIドリル
7. スピーキングドリル + 会議シミュレーション
8. AIフレーズ生成
9. 進捗ページ（弱点分析含む）
10. **動作確認**: 全既存機能が新UIで動作すること

### Step 3: デイリーミッションシステム
1. ミッション生成ロジック
2. ホーム画面にミッションUI
3. ミッション→各機能への接続
4. ミッション完了判定
5. Confetti演出
6. Badging API
7. **動作確認**: ミッションが生成され、完了でConfettiが出ること

### Step 4: 新機能（リスニング + マッチング）
1. リスニングチャレンジ（既存データ + TTS、API不要）
2. 単語マッチングゲーム（API不要、オフライン対応）
3. **動作確認**: 両方がオフラインでも動くこと

### Step 5: 新機能（日記 + シャドーイング + スキャン）
1. 一言日記（Claude API）
2. シャドーイング（TTS + Whisper）
3. 身の回りスキャン（Claude Vision）
4. **動作確認**: API連携が正しく動くこと

### Step 6: レベルシステム + 仕上げ
1. レベル計算ロジック
2. レベル表示UI（ホーム + 進捗）
3. ストリークフリーズ機能
4. おかえりモード
5. Screen Wake Lock（ドリル/シャドーイング中）
6. Vibration API（正解/不正解フィードバック）
7. `sw.js` のキャッシュバージョン更新
8. `manifest.json` のtheme_color更新
9. `index.html` のスプラッシュを新テーマに
10. `firebase-sync.js` のSYNC_KEYS追加
11. **最終動作確認**: 全機能の通し確認

---

## 17. テスト項目

### 基本動作
- [ ] ボトムナビで5ページ切替
- [ ] サブページの遷移と戻る操作
- [ ] ダークモード/ライトモード切替
- [ ] PWAとしてインストール可能
- [ ] オフラインでの基本動作

### データ互換性
- [ ] 既存のlocalStorageデータが新アプリで正しく表示される
- [ ] SRS復習キューが正常に動作
- [ ] ストリークが引き継がれる
- [ ] Firebase同期が正常に動作（アップロード/ダウンロード）

### 新機能
- [ ] デイリーミッションが毎日3つ生成される
- [ ] ミッション完了でConfettiが表示される
- [ ] リスニング: 3難易度で問題生成 + 音声再生 + 回答判定
- [ ] マッチング: カードフリップ + ペア判定 + タイマー + スコア
- [ ] 日記: テキスト入力 → Claude添削 → Before/After表示
- [ ] シャドーイング: TTS再生 → 録音 → Whisper → 一致度表示
- [ ] スキャン: カメラ撮影 → Claude Vision → タイ語表示

### レスポンシブ
- [ ] iPhone SE（375px）で全画面が正常表示
- [ ] iPad（768px）で余白が適切
- [ ] ボトムナビが safe-area-inset-bottom に対応

---

## 補足: data.jsのデータ構造（参照用）

### vocabData
```javascript
vocabData = {
  work: [{ thai, romaji, jp, example, frequency: 'high'|'medium'|'low', scenes: [...] }, ...],  // 80語
  quality: [...],  // 80語
  daily: [...],    // 80語
  polite: [...]    // 80語
}
```

### phrasesData
```javascript
phrasesData = {
  meeting: [{ thai, romaji, jp }, ...],      // 50フレーズ
  instruction: [{ thai, romaji, jp }, ...],  // 50フレーズ
  question: [{ thai, romaji, jp }, ...],     // 50フレーズ
  polite: [{ thai, romaji, jp }, ...]        // 50フレーズ
}
```

### grammarData
```javascript
grammarData = [
  {
    tag: '使役',
    title: 'ให้（〜させる）',
    pattern: 'HTML文字列',
    examples: [{ thai, romaji, jp }],
    practice: [{ question, choices: [3つ], correct: index, explanation }]
  },
  // ... 20パターン
]
```

---

## 最終注意事項

1. **app.jsの末尾で必ず全関数をwindowに公開すること**（HTMLのonclick等で使うため）
2. **Claude APIモデルは `claude-haiku-4-5-20251001` を使う**（コスト効率のため）
3. **タイ語テキストのフォントは必ず `'Sarabun', sans-serif` にする**
4. **全てのfetch呼び出しにtry-catchを入れ、pwaErrorMsg()でエラー表示する**
5. **data.jsは一切変更しない**（読み込み順: data.js → app.js）
6. **View Transitions APIは `if (document.startViewTransition)` でフィーチャーチェックすること**
7. **ミッションからの遷移時は、ミッション用パラメータ（問題数など）を渡すこと**
8. **全ての操作完了後、git commit → git pushまで行うこと**
