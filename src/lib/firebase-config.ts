import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCUE2xrgPTITXBkLLr_2fX8cnfT2KGMAfA",
  authDomain: "reel-insights-editor.firebaseapp.com",
  projectId: "reel-insights-editor",
  storageBucket: "reel-insights-editor.firebasestorage.app",
  messagingSenderId: "1047892762200",
  appId: "1:1047892762200:web:fef26b854b3e3dfc01742d",
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return _app;
}

export function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getFirebaseApp());
  return _db;
}
