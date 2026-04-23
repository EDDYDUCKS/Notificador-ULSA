// ── Firebase Configuration ───────────────────────────────────
// Reemplaza estos valores con los de tu proyecto en Firebase Console
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:            "AIzaSyBpDnPrzXqRDmW1ZbCWMdZ9ifeQUrrDGyk",
  authDomain:        "notificador-maestros.firebaseapp.com",
  databaseURL:       "https://notificador-maestros-default-rtdb.firebaseio.com",
  projectId:         "notificador-maestros",
  storageBucket:     "notificador-maestros.firebasestorage.app",
  messagingSenderId: "285971568327",
  appId:             "1:285971568327:web:e8cdd25c4e4bf89692d0e2",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
