// =============================================
// Firebase Sync Module
// Googleログイン + Firestoreでデータを端末間同期
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAp9QYvLOmpwK2LrdpqDPBJjuwj0OtP3VQ",
  authDomain: "kmc-thai-learning-ed955.firebaseapp.com",
  projectId: "kmc-thai-learning-ed955",
  storageBucket: "kmc-thai-learning-ed955.firebasestorage.app",
  messagingSenderId: "236235637893",
  appId: "1:236235637893:web:14fd59e789ba8b8f25d5ec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 同期対象のlocalStorageキー
const SYNC_KEYS = [
  'thaiLearningProgress',
  'weakWords',
  'grammarQuizScores',
  'srsData',
  'learningLog_v1',
  'learningHistory',
  'customVocab_v1',
  'streakCount',
  'lastAccessDate',
];

// ========== Auth ==========

export function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export function logoutFirebase() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ========== Sync ==========

// localStorageのデータをFirestoreにアップロード
export async function uploadToFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  const data = {};
  SYNC_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val !== null) data[key] = val;
  });
  data.updatedAt = serverTimestamp();
  data.updatedFrom = navigator.userAgent.slice(0, 80);

  await setDoc(doc(db, 'users', user.uid), data, { merge: true });
}

// FirestoreからlocalStorageにダウンロード
export async function downloadFromFirestore() {
  const user = auth.currentUser;
  if (!user) return false;

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) return false;

  const data = snap.data();
  SYNC_KEYS.forEach(key => {
    if (data[key] !== undefined) {
      localStorage.setItem(key, data[key]);
    }
  });
  return true;
}
