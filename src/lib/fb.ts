/**
 * Firebase (project studento-clock): accounts, account sync, schools and bell schedules, share
 * codes, chat and calls all live here now. Everything goes to *.googleapis.com, which school
 * Wi-Fi allows even when other hosts are blocked. The web config is public by design; the
 * Firestore security rules (firestore.rules) are what protect the data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FA from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBfriLiUR2sJo8Y_0_hZDbAXioAUJesLYY',
  authDomain: 'studento-clock.firebaseapp.com',
  projectId: 'studento-clock',
  storageBucket: 'studento-clock.firebasestorage.app',
  messagingSenderId: '425336548360',
  appId: '1:425336548360:web:420a139a23b19f43a6b5bd',
};

/** Apps Script web app (relay/Code.gs): the schedule reader and TURN credentials. */
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXWpruONt3gD9KfNrrMWfap2ivMgy5fkP-SB44xHXpmz1b__tGjboi5sUEjGOosBg/exec';

/** Usernames sign in as a made-up email; nobody ever sees or receives mail at it. */
export const emailFor = (username: string) => `${username.trim().toLowerCase()}@users.studento.app`;

let app: FirebaseApp;
let auth: FA.Auth;
let db: Firestore;
let ready: Promise<FA.User | null>;

function init() {
  if (app) return;
  app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  if (Platform.OS === 'web') auth = FA.getAuth(app);
  else {
    // React Native build of firebase/auth: keep the session in AsyncStorage across launches.
    const rn = FA as unknown as { getReactNativePersistence?: (s: unknown) => FA.Persistence };
    try {
      auth = FA.initializeAuth(app, rn.getReactNativePersistence ? { persistence: rn.getReactNativePersistence(AsyncStorage) } : {});
    } catch {
      auth = FA.getAuth(app);
    }
  }
  // Long-polling auto-detect: works through school proxies that break streaming connections.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  ready = new Promise((resolve) => {
    const off = FA.onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

export function fbAuth(): FA.Auth {
  init();
  return auth;
}
export function fbDb(): Firestore {
  init();
  return db;
}
/** The signed-in Firebase user, after the saved session (if any) has been restored. */
export async function currentUser(): Promise<FA.User | null> {
  init();
  await ready;
  return auth.currentUser;
}
