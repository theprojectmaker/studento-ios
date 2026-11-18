/**
 * More admin back office: per-user feature overrides, account tags, ban history, CSV export,
 * and the soft outgoing-message limits (slow mode, daily cap, word filter). Moderation, config
 * and counts only — never message contents or who talks to whom.
 *
 * Firestore (rules in firestore.rules):
 *   userOverrides/{uid}  { flags: {key: bool}, at }   admin write; the owner may read their own
 *   banHistory/{auto}    { uid, username, level|'unban', reason, at, by }   admin only, append-only
 *   adminNotes/{uid}     now also holds { tags: string[] } alongside text (see admin-tools.ts)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { audit, type AppConfig } from './admin-tools';
import { currentUser, fbDb } from './fb';
import { getState } from './store';

/* ---------- per-user feature overrides ---------- */
/** An override forces a feature on or off for one account, beating the global flag and rollout. */
export interface UserOverride {
  flags: Record<string, boolean>;
  at: number;
}
export async function getOverride(uid: string): Promise<UserOverride> {
  const d = (await getDoc(doc(fbDb(), 'userOverrides', uid)).catch(() => null))?.data();
  return { flags: (d?.flags as Record<string, boolean>) ?? {}, at: Number(d?.at ?? 0) };
}
export const setOverride = (uid: string, username: string, flags: Record<string, boolean>) =>
  audit('override', `${username}: ${Object.entries(flags).map(([k, v]) => `${k}=${v ? 'on' : 'off'}`).join(', ') || 'cleared'}`).then(() =>
    setDoc(doc(fbDb(), 'userOverrides', uid), { flags, at: Date.now() })
  );
/** My own overrides, live (used when deciding if a feature is on for me). */
export function watchMyOverride(cb: (o: UserOverride) => void): () => void {
  let stop = () => {};
  let dead = false;
  void currentUser().then((u) => {
    if (!u || dead) return;
    stop = onSnapshot(
      doc(fbDb(), 'userOverrides', u.uid),
      (s) => cb({ flags: (s.data()?.flags as Record<string, boolean>) ?? {}, at: Number(s.data()?.at ?? 0) }),
      () => cb({ flags: {}, at: 0 })
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

/* ---------- ban history ---------- */
export interface BanEvent {
  id: string;
  uid: string;
  username: string;
  level: string;
  reason: string;
  at: number;
  by: string;
}
/** Record a ban / unban. Call alongside setBan. Never throws. */
export async function recordBan(uid: string, username: string, level: string, reason: string): Promise<void> {
  try {
    await addDoc(collection(fbDb(), 'banHistory'), { uid, username, level, reason: reason.slice(0, 200), at: Date.now(), by: getState().account?.user.username ?? 'admin' });
  } catch {
    /* ignore */
  }
}
export function watchBanHistory(uid: string, cb: (l: BanEvent[]) => void): () => void {
  try {
    return onSnapshot(
      query(collection(fbDb(), 'banHistory'), orderBy('at', 'desc'), limit(200)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BanEvent, 'id'>) })).filter((e) => e.uid === uid)),
      () => cb([])
    );
  } catch {
    return () => {};
  }
}

/* ---------- CSV ---------- */
/** Rows (first row = headers) to a CSV string. */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/* ---------- soft outgoing limits (client-side) ---------- */
const K_LOG = 'beam.sendlog';
async function sendLog(): Promise<number[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(K_LOG)) ?? '[]') as number[];
  } catch {
    return [];
  }
}
/**
 * Throws a friendly error if this send breaks slow mode / the daily cap / the word filter.
 * Admins are never limited. Call right before sending a Beam message. Soft (per device).
 */
export async function enforceOutgoing(cfg: AppConfig, text: string): Promise<void> {
  if (getState().account?.user.admin) return;
  const { blockedWord } = await import('./admin-tools');
  const bad = blockedWord(text, cfg.wordFilter ?? []);
  if (bad) throw new Error('That message was blocked. Please keep it kind.');
  const now = Date.now();
  const log = (await sendLog()).filter((t) => now - t < 86400_000);
  if (cfg.slowModeSec > 0 && log.length && now - log[log.length - 1] < cfg.slowModeSec * 1000) {
    const wait = Math.ceil((cfg.slowModeSec * 1000 - (now - log[log.length - 1])) / 1000);
    throw new Error(`Slow mode is on. Wait ${wait}s before sending again.`);
  }
  if (cfg.msgLimitPerDay > 0 && log.length >= cfg.msgLimitPerDay) throw new Error("You've hit today's message limit. Try again tomorrow.");
  log.push(now);
  await AsyncStorage.setItem(K_LOG, JSON.stringify(log.slice(-500))).catch(() => {});
}

/** Fetch config and enforce outgoing limits in one call (for send paths that lack a live cfg). */
export async function enforceOutgoingNow(text: string): Promise<void> {
  const { fetchAppConfig } = await import('./admin-tools');
  await enforceOutgoing(await fetchAppConfig(), text);
}

/** Live app-wide banner for everyone (empty = none). */
export function useRemoteBanner(): { text: string; tone: 'info' | 'warn' } | null {
  const [b, setB] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  useEffect(() => {
    try {
      return onSnapshot(
        doc(fbDb(), 'config', 'app'),
        (s) => {
          const banner = s.data()?.banner as AppConfig['banner'] | undefined;
          setB(banner?.text && (!banner.until || banner.until > Date.now()) ? { text: banner.text, tone: banner.tone ?? 'info' } : null);
        },
        () => setB(null)
      );
    } catch {
      return () => {};
    }
  }, []);
  return b;
}
