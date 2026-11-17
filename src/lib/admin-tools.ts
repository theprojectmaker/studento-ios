/**
 * Admin back office: one-time promo codes, audit log, private account notes, app config values
 * and app-area switches. Nothing here reads messages or who talks to whom.
 *
 * Firestore layout (rules in firestore.rules):
 *   promoCodes/{sha256(code)}  { hint, unlock, batch, createdAt, used, usedBy?, usedName?, usedAt?, revoked }
 *                              only the hash is stored; the admin device keeps the plain text locally
 *   auditLog/{auto}            { at, by, action, detail }   admin create/read only, never edited
 *   adminNotes/{uid}           { text, at }                 admin only
 *   config/app                 { remoteText, defaultTheme, rollout }   public read, admin write
 *   config/flags               area_<key> = false turns that part of the app off (admins pass)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { currentUser, fbDb } from './fb';
import { sha256 } from './sha256';
import { getState, setPref } from './store';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Failed');

/* ---------- audit log ---------- */
export interface AuditEntry {
  id: string;
  at: number;
  by: string;
  action: string;
  detail: string;
}
/** Records an admin action. Never throws: logging must not block the action itself. */
export async function audit(action: string, detail = ''): Promise<void> {
  try {
    const u = await currentUser();
    if (!u) return;
    await addDoc(collection(fbDb(), 'auditLog'), { at: Date.now(), by: getState().account?.user.username ?? u.uid, action: action.slice(0, 80), detail: detail.slice(0, 300) });
  } catch {
    /* ignore */
  }
}
/** Runs an admin action, then logs it. */
export async function logged<T>(action: string, detail: string, fn: () => Promise<T>): Promise<T> {
  const r = await fn();
  void audit(action, detail);
  return r;
}
export function watchAudit(cb: (l: AuditEntry[]) => void, n = 150): () => void {
  try {
    return onSnapshot(
      query(collection(fbDb(), 'auditLog'), orderBy('at', 'desc'), limit(n)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) }))),
      () => cb([])
    );
  } catch {
    return () => {};
  }
}

/* ---------- private notes on an account ---------- */
export async function getNote(uid: string): Promise<string> {
  return String((await getDoc(doc(fbDb(), 'adminNotes', uid))).data()?.text ?? '');
}
export const saveNote = (uid: string, username: string, text: string) =>
  logged('note', username, () => setDoc(doc(fbDb(), 'adminNotes', uid), { text: text.slice(0, 2000), at: Date.now() }));

/* ---------- app config values ---------- */
export interface AppConfig {
  /** short text shown at the bottom of Settings (empty = nothing) */
  remoteText: string;
  /** theme id new installs start on (empty = app default) */
  defaultTheme: string;
  /** feature rollout percentages, by key: a user is in if bucket(uid,key) < pct */
  rollout: Record<string, number>;
}
const EMPTY: AppConfig = { remoteText: '', defaultTheme: '', rollout: {} };
export function watchAppConfig(cb: (c: AppConfig) => void): () => void {
  try {
    return onSnapshot(
      doc(fbDb(), 'config', 'app'),
      (s) => cb({ ...EMPTY, ...(s.data() as Partial<AppConfig> | undefined) }),
      () => cb(EMPTY)
    );
  } catch {
    return () => {};
  }
}
export function useAppConfig(): AppConfig {
  const [c, setC] = useState<AppConfig>(EMPTY);
  useEffect(() => watchAppConfig(setC), []);
  return c;
}
export const saveAppConfig = (patch: Partial<AppConfig>) => logged('config', Object.keys(patch).join(', '), () => setDoc(doc(fbDb(), 'config', 'app'), patch, { merge: true }));
/** Stable 0-99 bucket for a user and a feature. */
export function bucket(uid: string, key: string): number {
  return parseInt(sha256(`${key}:${uid}`).slice(0, 8), 16) % 100;
}
export function inRollout(cfg: AppConfig, key: string, uid: string | undefined): boolean {
  const pct = cfg.rollout[key];
  if (pct === undefined) return true;
  if (!uid) return pct >= 100;
  return bucket(uid, key) < pct;
}

/* ---------- app areas (kill switches for whole screens) ---------- */
export const AREAS: { key: string; label: string; sub: string; routes: string[] }[] = [
  { key: 'hub', label: 'Hub', sub: 'The Hub screen', routes: ['/hub'] },
  { key: 'planner', label: 'Countdowns', sub: 'Planner and countdowns', routes: ['/planner'] },
  { key: 'focus', label: 'Focus timer', sub: 'Focus screen', routes: ['/focus'] },
  { key: 'grades', label: 'Grades', sub: 'Grade tracker', routes: ['/grades'] },
  { key: 'week', label: 'This week / Today', sub: 'Week and day views', routes: ['/week', '/today'] },
  { key: 'themes', label: 'Themes and icons', sub: 'Theme picker, app icon, clock options', routes: ['/themes', '/app-icon', '/clock-options'] },
  { key: 'widgets', label: 'Widgets', sub: 'Widget setup screen', routes: ['/widgets'] },
  { key: 'schools', label: 'School picker', sub: 'Shared schools and schedules', routes: ['/school', '/schedules', '/schedule-publish'] },
  { key: 'redeem', label: 'Redeem codes', sub: 'Promo and schedule codes', routes: ['/redeem'] },
  { key: 'backup', label: 'Back up & restore', sub: 'Backup screen', routes: ['/backup'] },
  { key: 'report', label: 'Reporting', sub: 'Report screen', routes: ['/report'] },
  { key: 'beam', label: 'Beam (all of it)', sub: 'Messages, chats, calls, chess', routes: ['/messages', '/chat', '/call', '/chess'] },
];
export const areaFlag = (key: string) => `area_${key}`;
export function areaForPath(path: string): (typeof AREAS)[number] | undefined {
  return AREAS.find((a) => a.routes.some((r) => path === r || path.startsWith(`${r}/`)));
}

/* ---------- one-time promo codes ---------- */
/** What a code unlocks. Ids match prefs.unlocks (see codes.ts). */
export const PROMO_UNLOCKS: { id: string; label: string }[] = [
  { id: 'messages', label: 'Beam (beta)' },
  { id: 'race', label: 'Race Track themes' },
];
const NOUNS = ['Apples', 'Pandas', 'Rockets', 'Pickles', 'Clouds', 'Tacos', 'Robots', 'Otters', 'Comets', 'Waffles', 'Dragons', 'Pencils', 'Llamas', 'Bagels', 'Planets', 'Turtles', 'Donuts', 'Koalas', 'Penguins', 'Mangoes', 'Wizards', 'Lemons', 'Hamsters', 'Pirates', 'Noodles', 'Ferrets', 'Tigers', 'Muffins', 'Owls', 'Cactuses', 'Zebras', 'Pretzels', 'Rainbows', 'Squids', 'Beavers', 'Cookies', 'Moose', 'Walruses', 'Puffins', 'Kittens', 'Gnomes', 'Yetis', 'Sloths', 'Narwhals', 'Peaches', 'Lobsters', 'Unicorns', 'Badgers', 'Crayons', 'Geckos'];
const VERBS = ['Are', 'Look', 'Feel', 'Seem', 'Get', 'Stay'];
const ADJS = ['Funny', 'Sleepy', 'Brave', 'Shiny', 'Fuzzy', 'Spicy', 'Happy', 'Grumpy', 'Sneaky', 'Bouncy', 'Clever', 'Fancy', 'Jolly', 'Lucky', 'Mighty', 'Quiet', 'Silly', 'Speedy', 'Tiny', 'Wobbly', 'Zesty', 'Cosmic', 'Crispy', 'Dizzy', 'Fluffy', 'Gentle', 'Giant', 'Golden', 'Hungry', 'Jumpy', 'Loud', 'Magic', 'Noble', 'Polite', 'Proud', 'Rapid', 'Royal', 'Sparkly', 'Sticky', 'Sunny', 'Swift', 'Wild', 'Witty', 'Zany', 'Cheesy', 'Chilly', 'Frosty', 'Groovy', 'Nimble', 'Rowdy'];

function rand(n: number): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] % n;
  return Math.floor(Math.random() * n);
}
const pick = <T,>(a: T[]) => a[rand(a.length)];
/** e.g. "ApplesAreFunny27". ~50*6*50*90 = 1.35M combinations. */
export function makePhrase(): string {
  return `${pick(NOUNS)}${pick(VERBS)}${pick(ADJS)}${10 + rand(90)}`;
}
/** Same normalising as codes.ts: case and spaces don't matter. */
export const promoKey = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, '');
export const promoHash = (raw: string) => sha256(`studento-promo:${promoKey(raw)}`);
/** Looks like one of ours: letters then a number, 8-40 chars. */
export const looksLikePromo = (raw: string) => /^[A-Z]{6,36}\d{1,3}$/.test(promoKey(raw));
const hintOf = (code: string) => `${code.slice(0, 4)}…${code.slice(-2)}`;

export interface PromoCode {
  hash: string;
  hint: string;
  unlock: string;
  batch: string;
  createdAt: number;
  used: boolean;
  usedBy?: string;
  usedName?: string;
  usedAt?: number;
  revoked: boolean;
  /** plain text, only if this device made it */
  code?: string;
}

const K_PLAIN = 'admin.promo.plain';
async function plainMap(): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(K_PLAIN)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Admin: make n new codes. Returns them in plain text (shown once; kept on this device). */
export async function generateCodes(n: number, unlock: string, batch: string): Promise<string[]> {
  const count = Math.max(1, Math.min(200, Math.floor(n)));
  const db = fbDb();
  const out: string[] = [];
  const seen = new Set<string>();
  let tries = 0;
  while (out.length < count && tries < count * 20) {
    tries++;
    const c = makePhrase();
    const h = promoHash(c);
    if (seen.has(h)) continue;
    seen.add(h);
    if ((await getDoc(doc(db, 'promoCodes', h))).exists()) continue;
    out.push(c);
  }
  const now = Date.now();
  for (let i = 0; i < out.length; i += 400) {
    const b = writeBatch(db);
    for (const c of out.slice(i, i + 400)) b.set(doc(db, 'promoCodes', promoHash(c)), { hint: hintOf(c), unlock, batch: batch.slice(0, 40), createdAt: now, used: false, revoked: false });
    await b.commit();
  }
  const m = await plainMap();
  for (const c of out) m[promoHash(c)] = c;
  await AsyncStorage.setItem(K_PLAIN, JSON.stringify(m)).catch(() => {});
  void audit('promo.generate', `${out.length} × ${unlock}${batch ? ` (${batch})` : ''}`);
  return out;
}

export async function listCodes(): Promise<PromoCode[]> {
  const [s, m] = await Promise.all([getDocs(query(collection(fbDb(), 'promoCodes'), orderBy('createdAt', 'desc'), limit(1000))), plainMap()]);
  return s.docs.map((d) => ({ hash: d.id, ...(d.data() as Omit<PromoCode, 'hash'>), code: m[d.id] }));
}
export const revokeCode = (p: PromoCode) => logged('promo.revoke', p.hint, () => updateDoc(doc(fbDb(), 'promoCodes', p.hash), { revoked: true }));
export const deleteCode = (p: PromoCode) => logged('promo.delete', p.hint, () => deleteDoc(doc(fbDb(), 'promoCodes', p.hash)));

/**
 * Redeem a one-time code: in one transaction, check it exists, is unused and not revoked,
 * then mark it used by me. Unlocks the feature on this device.
 */
export async function redeemOneTime(raw: string): Promise<string> {
  const u = await currentUser();
  if (!u) throw new Error('Sign in first to use this code (Settings > Account).');
  const flags = (await getDoc(doc(fbDb(), 'config', 'flags')).catch(() => null))?.data();
  if (flags?.promos === false) throw new Error('Promo codes are paused right now. Try again later.');
  const ref = doc(fbDb(), 'promoCodes', promoHash(raw));
  let unlock = '';
  try {
    unlock = await runTransaction(fbDb(), async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error('That code did not work.');
      const d = s.data();
      if (d.revoked) throw new Error('That code was turned off.');
      if (d.used) throw new Error(d.usedBy === u.uid ? 'You already used this code.' : 'That code was already used.');
      tx.update(ref, { used: true, usedBy: u.uid, usedName: (getState().account?.user.username ?? '').slice(0, 24), usedAt: Date.now() });
      return String(d.unlock);
    });
  } catch (e) {
    const m = errMsg(e);
    throw new Error(/permission|insufficient/i.test(m) ? 'That code did not work.' : m);
  }
  const have = getState().prefs.unlocks ?? [];
  if (!have.includes(unlock)) setPref('unlocks', [...have, unlock]);
  return unlock;
}
