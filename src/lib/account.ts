/**
 * Accounts: username + password, optional. Signing in restores your classes, school and
 * settings from the server; after that, changes on this phone are saved up (debounced).
 * The token lives in SecureStore (Keychain). Everything here fails soft: offline just
 * means "not saved yet".
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import * as api from './api';
import type { PersonalSchedule } from './schedule';
import { getState, setAccount, setPersonal, setPref, setSchool, subscribe, type Prefs } from './store';

const TOKEN_KEY = 'studento_token';
let token: string | null | undefined;

async function readToken(): Promise<string | null> {
  if (token !== undefined) return token;
  try {
    token = Platform.OS === 'web' ? (globalThis.localStorage?.getItem(TOKEN_KEY) ?? null) : await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}
async function writeToken(t: string | null) {
  token = t;
  try {
    if (Platform.OS === 'web') {
      if (t) globalThis.localStorage?.setItem(TOKEN_KEY, t);
      else globalThis.localStorage?.removeItem(TOKEN_KEY);
    } else if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Keychain unavailable: the session just won't survive a relaunch.
  }
}

export const getToken = readToken;

/** Which settings travel with the account (theme and clock options, not device-only ones). */
const SYNCED_PREFS: (keyof Prefs)[] = ['theme', 'layout', 'seconds', 'h24', 'millis', 'digitSize', 'focus', 'periodNum', 'endTime', 'showDate', 'welcome', 'endWarning', 'tapToggle'];

function snapshot(): api.AccountData {
  const s = getState();
  const prefs: Record<string, unknown> = {};
  for (const k of SYNCED_PREFS) prefs[k] = s.prefs[k];
  return { schoolId: s.school?.id ?? null, scheduleId: s.bellSet?.id ?? null, personal: s.personal, prefs };
}

/** Apply what the server has for this account (on sign-in / restore). */
async function applyServerData(data: api.AccountData | null | undefined) {
  if (!data) return;
  if (data.personal && typeof data.personal === 'object') await setPersonal(data.personal as PersonalSchedule);
  if (data.prefs) for (const k of SYNCED_PREFS) if (k in data.prefs) setPref(k, data.prefs[k] as never);
  if (data.schoolId) {
    try {
      const { school, schedules } = await api.getSchool(data.schoolId);
      const bellSet = schedules.find((x) => x.id === data.scheduleId) ?? schedules[0] ?? null;
      await setSchool(school, bellSet, schedules);
    } catch {
      // Offline: keep whatever school is cached on this phone.
    }
  }
}

export async function signUp(username: string, password: string): Promise<{ owner: boolean }> {
  const r = await api.signup(username, password);
  await writeToken(r.token);
  await setAccount({ user: r.user, syncedAt: null });
  if (r.data?.data) await applyServerData(r.data.data);
  else await pushNow();
  return { owner: !!r.owner };
}

export async function signIn(username: string, password: string): Promise<void> {
  const r = await api.login(username, password);
  await writeToken(r.token);
  await setAccount({ user: r.user, syncedAt: r.data?.updatedAt ?? null });
  if (r.data?.data) await applyServerData(r.data.data);
  else await pushNow();
}

export async function signOut(): Promise<void> {
  const t = await readToken();
  if (t) void api.logout(t);
  await writeToken(null);
  await setAccount(null);
}

export async function deleteMyAccount(password: string): Promise<void> {
  const t = await readToken();
  if (!t) throw new api.ApiError('Sign in first.', 401);
  await api.deleteAccount(t, password);
  await writeToken(null);
  await setAccount(null);
}

/** Save this phone's data to the account now. Returns false when signed out or offline. */
export async function pushNow(): Promise<boolean> {
  const t = await readToken();
  const acc = getState().account;
  if (!t || !acc) return false;
  try {
    const at = await api.putData(t, snapshot());
    await setAccount({ ...acc, syncedAt: at });
    return true;
  } catch (e) {
    if (e instanceof api.ApiError && e.status === 401) {
      await writeToken(null);
      await setAccount(null);
    }
    return false;
  }
}

/** Debounced auto-save of personal/school/synced prefs while signed in. Returns the unsubscribe. */
export function watchForSync(): () => void {
  let key = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = subscribe(() => {
    const s = getState();
    if (!s.loaded || !s.account) return;
    const next = JSON.stringify(snapshot());
    if (next === key) return;
    const first = key === '';
    key = next;
    if (first) return; // the first value is just the loaded state
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void pushNow(), 2500);
  });
  return () => {
    stop();
    if (timer) clearTimeout(timer);
  };
}
