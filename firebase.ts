
import { initializeApp, getApps, getApp } from "@firebase/app";
import { getAuth, GoogleAuthProvider } from "@firebase/auth";
import { getDatabase } from "@firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB-n0Y9tpV8se5Z3ykGl6v6LyZUV87HSV0",
  authDomain: "gamewealth-pro-app.firebaseapp.com",
  databaseURL: "https://gamewealth-pro-app-default-rtdb.firebaseio.com",
  projectId: "gamewealth-pro-app",
  storageBucket: "gamewealth-pro-app.firebasestorage.app",
  messagingSenderId: "870646289620",
  appId: "1:870646289620:web:766e261dd24d65591bd741",
  measurementId: "G-D9PKL3EKMH"
};
// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();