import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCUE2xrgPTITXBkLLr_2fX8cnfT2KGMAfA",
  authDomain: "reel-insights-editor.firebaseapp.com",
  projectId: "reel-insights-editor",
  storageBucket: "reel-insights-editor.firebasestorage.app",
  messagingSenderId: "1047892762200",
  appId: "1:1047892762200:web:fef26b854b3e3dfc01742d",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
