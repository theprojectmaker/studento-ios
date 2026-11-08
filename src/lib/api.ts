/**
 * Studento's data layer, on Firebase (see fb.ts). Same function names and shapes as when this
 * talked to the old Cloudflare server, so screens didn't change. `token` arguments are kept for
 * that reason; the real credential is the Firebase session.
 *
 * Firestore layout (rules in firestore.rules):
 *   config/flags                 kill switches {signup, sharing, ai, messaging}
 *   counters/{users|schools|schedules|reports}  next numeric id
 *   users/{uid}                  {username, num, admin, data, updatedAt}
 *   usernames/{name}             {uid, num}
 *   schools/{id}                 {name, nameLc, createdBy, createdAt, hidden}
 *   schedules/{id}               {schoolId, name, nameLc, days, createdBy, createdByNum, createdAt, hidden}
 *   reports/{id}                 {kind, targetId, targetName, chat?, reason, note, uid, status, createdAt}
 *   shares/{code}                {data, createdAt, expiresAt}
 *   blocks/{uid}                 {ids: uid[]}
 *   chats/{uidA_uidB}            {members, names, nums, lastAt, lastBody, unread: {uid: n}}
 *   chats/{key}/msgs/{id}        {id, from, body, createdAt}
 *   calls/{id}                   {from, to, members, fromName, toName, video, status, createdAt, answeredAt, endedAt}
 *   calls/{id}/signals/{auto}    {n, from, kind, data}
 */
import * as FA from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { preview, RICH } from './beam-msg';
import { currentUser, emailFor, fbAuth, fbDb, SCRIPT_URL } from './fb';
import type { Period, SchoolDay } from './schedule';

/** Only used as the https base URL for the bundled call page now. */
export const API_BASE = 'https://studento-app.pages.dev';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

const DAYS: SchoolDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as SchoolDay[];
const RING_MS = 40_000;

/** Turn Firebase errors into the plain messages the screens already show. */
function friendly(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email')) return new ApiError('Wrong username or password.', 401);
  if (code.includes('email-already-in-use')) return new ApiError('That username is taken.', 409);
  if (code.includes('weak-password')) return new ApiError('Password: at least 8 characters.', 400);
  if (code.includes('too-many-requests')) return new ApiError('Too many tries. Wait a bit and try again.', 429);
  if (code.includes('permission-denied')) return new ApiError("You can't do that.", 403);
  if (code.includes('network') || code.includes('unavailable')) return new ApiError("Can't reach Studento's server. Check your internet.", 0);
  if (code.includes('requires-recent-login')) return new ApiError('Sign in again first.', 401);
  return new ApiError(e instanceof Error ? e.message : 'Something went wrong.', 500);
}
async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw friendly(e);
  }
}
async function me_(): Promise<FA.User> {
  const u = await currentUser();
  if (!u) throw new ApiError('Sign in first.', 401);
  return u;
}
async function nextId(kind: 'users' | 'schools' | 'schedules' | 'reports'): Promise<number> {
  const ref = doc(fbDb(), 'counters', kind);
  return runTransaction(fbDb(), async (tx) => {
    const s = await tx.get(ref);
    const n = Math.max(1, Number(s.data()?.next ?? 1));
    tx.set(ref, { next: n + 1 });
    return n;
  });
}
/** Numeric id from the clock, for messages and calls (unique enough, sortable, fits a JS number). */
const clockId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

/* ---------------- types ---------------- */
export interface ServerConfig {
  signup: boolean;
  sharing: boolean;
  ai: boolean;
  messaging: boolean;
}
export interface AccountUser {
  id: number;
  username: string;
  admin: boolean;
}
/** What an account stores for the student (kept small). */
export interface AccountData {
  schoolId?: number | null;
  scheduleId?: number | null;
  personal?: unknown;
  prefs?: Record<string, unknown>;
}
export interface SchoolHit {
  id: number;
  name: string;
  schedules: number;
}
export interface BellSet {
  id: number;
  name: string;
  days: Record<SchoolDay, Period[]>;
  createdBy?: number | null;
}
export interface AiRow {
  period: string;
  name: string;
  start: string;
  end: string;
  room: string;
  teacher?: string;
  confidence?: number;
}
export interface AiSchedule {
  name: string;
  days: Record<SchoolDay, AiRow[]>;
  classes?: Record<string, string>;
  rooms?: Record<string, string>;
  teachers?: Record<string, string>;
  hasTimes?: boolean;
}
export interface AiResult {
  schedule: AiSchedule;
  /** Period id -> ['unsure' | 'time']: show these rows highlighted on the review screen. */
  flags: Record<string, string[]>;
  warnings: string[];
  provider: string;
}

/* ---------------- config ---------------- */
const DEFAULT_CONFIG: ServerConfig = { signup: true, sharing: true, ai: true, messaging: true };
let configCache: { at: number; cfg: ServerConfig } | null = null;
export const getConfig = () =>
  wrap(async () => {
    if (configCache && Date.now() - configCache.at < 60_000) return configCache.cfg;
    const s = await getDoc(doc(fbDb(), 'config', 'flags'));
    const cfg = { ...DEFAULT_CONFIG, ...((s.data() as Partial<ServerConfig>) ?? {}) };
    configCache = { at: Date.now(), cfg };
    return cfg;
  });
export const setConfig = (_t: string, patch: Partial<ServerConfig>) =>
  wrap(async () => {
    await setDoc(doc(fbDb(), 'config', 'flags'), patch, { merge: true });
    configCache = null;
    return getConfig();
  });
async function requireFlag(k: keyof ServerConfig, msg: string) {
  const cfg = await getConfig().catch(() => DEFAULT_CONFIG);
  if (!cfg[k]) throw new ApiError(msg, 503);
}

/* ---------------- accounts ---------------- */
type AuthReply = { token: string; user: AccountUser; data: { data: AccountData; updatedAt: number } | null; owner?: boolean };
interface UserDoc {
  username: string;
  num: number;
  admin?: boolean;
  data?: AccountData | null;
  updatedAt?: number;
}
const toUser = (d: UserDoc): AccountUser => ({ id: d.num, username: d.username, admin: !!d.admin });
const toData = (d: UserDoc) => (d.data ? { data: d.data, updatedAt: d.updatedAt ?? 0 } : null);

async function myDoc(uid: string): Promise<UserDoc> {
  const s = await getDoc(doc(fbDb(), 'users', uid));
  if (!s.exists()) throw new ApiError('Account not found.', 404);
  return s.data() as UserDoc;
}

export const signup = (username: string, password: string) =>
  wrap<AuthReply>(async () => {
    await requireFlag('signup', 'Sign-ups are paused right now.');
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,24}$/.test(name)) throw new ApiError('Username: 3 to 24 letters, numbers, dots, dashes or underscores.', 400);
    if (password.length < 8 || password.length > 200) throw new ApiError('Password: at least 8 characters.', 400);
    // Firebase Auth owns uniqueness: the email is made from the username.
    const cred = await FA.createUserWithEmailAndPassword(fbAuth(), emailFor(name), password);
    try {
      const num = await nextId('users');
      const d: UserDoc = { username: name, num, admin: false, data: null, updatedAt: 0 };
      const b = writeBatch(fbDb());
      b.set(doc(fbDb(), 'users', cred.user.uid), d);
      b.set(doc(fbDb(), 'usernames', name), { uid: cred.user.uid, num });
      await b.commit();
      return { token: cred.user.uid, user: toUser(d), data: null, owner: false };
    } catch (e) {
      await cred.user.delete().catch(() => {});
      throw e;
    }
  });

export const login = (username: string, password: string) =>
  wrap<AuthReply>(async () => {
    const cred = await FA.signInWithEmailAndPassword(fbAuth(), emailFor(username), password);
    const d = await myDoc(cred.user.uid);
    return { token: cred.user.uid, user: toUser(d), data: toData(d) };
  });

export const logout = (_t: string) => FA.signOut(fbAuth()).catch(() => undefined);

export const deleteAccount = (_t: string, password: string) =>
  wrap(async () => {
    const u = await me_();
    await FA.reauthenticateWithCredential(u, FA.EmailAuthProvider.credential(u.email ?? '', password)).catch(() => {
      throw new ApiError('Wrong password.', 401);
    });
    const d = await myDoc(u.uid);
    const db = fbDb();
    // Their chats and blocks go too; schools and bell schedules they added stay for everyone.
    const chats = await getDocs(query(collection(db, 'chats'), where('members', 'array-contains', u.uid)));
    for (const c of chats.docs) {
      const msgs = await getDocs(collection(db, 'chats', c.id, 'msgs'));
      for (const m of msgs.docs) await deleteDoc(m.ref).catch(() => {});
      await deleteDoc(c.ref).catch(() => {});
    }
    await deleteDoc(doc(db, 'blocks', u.uid)).catch(() => {});
    await deleteDoc(doc(db, 'usernames', d.username)).catch(() => {});
    await deleteDoc(doc(db, 'users', u.uid));
    await u.delete();
    return {};
  });

export const me = (_t: string) =>
  wrap(async () => {
    const u = await me_();
    const d = await myDoc(u.uid);
    return { user: toUser(d), data: toData(d) };
  });

export const putData = (_t: string, data: AccountData) =>
  wrap(async () => {
    const u = await me_();
    const text = JSON.stringify(data);
    if (text.length > 64 * 1024) throw new ApiError('Too much data to save (64 KB max).', 413);
    const now = Date.now();
    // JSON round trip drops undefined values, which Firestore refuses.
    await updateDoc(doc(fbDb(), 'users', u.uid), { data: JSON.parse(text), updatedAt: now });
    return now;
  });

/* ---------------- schools ---------------- */
interface SchoolDoc {
  name: string;
  nameLc: string;
  createdBy?: string | null;
  createdAt: number;
  hidden?: boolean;
}
interface ScheduleDoc {
  schoolId: number;
  name: string;
  nameLc: string;
  days: Record<SchoolDay, Period[]>;
  createdBy?: string | null;
  createdByNum?: number | null;
  createdAt: number;
  hidden?: boolean;
}
/** The whole school list is small, so it is fetched once (cached 10 min) and searched here. */
let schoolsCache: { at: number; list: SchoolHit[] } | null = null;
async function allSchools(): Promise<SchoolHit[]> {
  if (schoolsCache && Date.now() - schoolsCache.at < 600_000) return schoolsCache.list;
  const db = fbDb();
  const [schools, schedules] = await Promise.all([getDocs(collection(db, 'schools')), getDocs(collection(db, 'schedules'))]);
  const counts: Record<number, number> = {};
  for (const s of schedules.docs) {
    const d = s.data() as ScheduleDoc;
    if (!d.hidden) counts[d.schoolId] = (counts[d.schoolId] ?? 0) + 1;
  }
  const list = schools.docs
    .map((s) => ({ id: Number(s.id), d: s.data() as SchoolDoc }))
    .filter((x) => !x.d.hidden)
    .map((x) => ({ id: x.id, name: x.d.name, schedules: counts[x.id] ?? 0 }));
  schoolsCache = { at: Date.now(), list };
  return list;
}

export const searchSchools = (q: string) =>
  wrap(async () => {
    const needle = q.trim().toLowerCase().slice(0, 60);
    return (await allSchools())
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => b.schedules - a.schedules || a.name.localeCompare(b.name))
      .slice(0, 25);
  });

export const getSchool = (id: number) =>
  wrap(async () => {
    const db = fbDb();
    const s = await getDoc(doc(db, 'schools', String(id)));
    const d = s.data() as SchoolDoc | undefined;
    if (!d || d.hidden) throw new ApiError('School not found.', 404);
    const rows = await getDocs(query(collection(db, 'schedules'), where('schoolId', '==', id)));
    const schedules: BellSet[] = rows.docs
      .map((r) => ({ id: Number(r.id), x: r.data() as ScheduleDoc }))
      .filter((r) => !r.x.hidden)
      .sort((a, b) => a.id - b.id)
      .map((r) => ({ id: r.id, name: r.x.name, days: r.x.days, createdBy: r.x.createdByNum ?? null }));
    return { school: { id, name: d.name }, schedules };
  });

export const addSchool = (_t: string, name: string) =>
  wrap(async () => {
    const u = await me_();
    await requireFlag('sharing', 'Adding schools is paused right now.');
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (clean.length < 3) throw new ApiError('School name: at least 3 characters.', 400);
    const existing = await getDocs(query(collection(fbDb(), 'schools'), where('nameLc', '==', clean.toLowerCase()), qLimit(1)));
    if (!existing.empty) return { school: { id: Number(existing.docs[0].id), name: (existing.docs[0].data() as SchoolDoc).name }, existed: true };
    const id = await nextId('schools');
    await setDoc(doc(fbDb(), 'schools', String(id)), { name: clean, nameLc: clean.toLowerCase(), createdBy: u.uid, createdAt: Date.now(), hidden: false } satisfies SchoolDoc);
    schoolsCache = null;
    return { school: { id, name: clean }, existed: false };
  });

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
function cleanDays(days: Record<SchoolDay, Period[]>): Record<SchoolDay, Period[]> {
  const out = {} as Record<SchoolDay, Period[]>;
  let any = false;
  for (const d of DAYS) {
    const list = Array.isArray(days?.[d]) ? days[d] : [];
    if (list.length > 16) throw new ApiError(`${d}: at most 16 periods`, 400);
    const rows = list.map((p, i) => {
      const period = String(p?.period ?? '').trim().toLowerCase().slice(0, 12);
      const label = String(p?.label ?? '').trim().slice(0, 40) || (/^\d+$/.test(period) ? `Period ${period}` : period);
      const start = String(p?.start ?? '');
      const end = String(p?.end ?? '');
      if (!period) throw new ApiError(`${d}: row ${i + 1} needs a period id`, 400);
      if (!TIME.test(start) || !TIME.test(end)) throw new ApiError(`${d}: row ${i + 1} times must be HH:MM`, 400);
      if (toMin(end) <= toMin(start)) throw new ApiError(`${d}: ${label} ends before it starts`, 400);
      return { period, label, start, end } as Period;
    });
    rows.sort((a, b) => toMin(a.start) - toMin(b.start));
    for (let i = 1; i < rows.length; i++) if (toMin(rows[i].start) < toMin(rows[i - 1].end)) throw new ApiError(`${d}: ${rows[i].label} overlaps ${rows[i - 1].label}`, 400);
    out[d] = rows;
    if (rows.length) any = true;
  }
  if (!any) throw new ApiError('Add at least one period', 400);
  return out;
}

export const publishSchedule = (_t: string, schoolId: number, name: string, days: Record<SchoolDay, Period[]>) =>
  wrap<BellSet>(async () => {
    const u = await me_();
    await requireFlag('sharing', 'Sharing schedules is paused right now.');
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (clean.length < 2) throw new ApiError('Give the schedule a name, like "Regular day".', 400);
    const cd = cleanDays(days);
    const { schedules } = await getSchool(schoolId);
    if (schedules.some((s) => s.name.toLowerCase() === clean.toLowerCase())) throw new ApiError('This school already has a schedule with that name.', 409);
    const mine = await myDoc(u.uid);
    const id = await nextId('schedules');
    await setDoc(doc(fbDb(), 'schedules', String(id)), { schoolId, name: clean, nameLc: clean.toLowerCase(), days: cd, createdBy: u.uid, createdByNum: mine.num, createdAt: Date.now(), hidden: false } satisfies ScheduleDoc);
    schoolsCache = null;
    return { id, name: clean, days: cd, createdBy: mine.num };
  });

export const renameSchool = (_t: string, id: number, name: string) =>
  wrap(async () => {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (clean.length >= 3) await updateDoc(doc(fbDb(), 'schools', String(id)), { name: clean, nameLc: clean.toLowerCase() });
    schoolsCache = null;
    return {};
  });
export const deleteSchool = (_t: string, id: number) =>
  wrap(async () => {
    const rows = await getDocs(query(collection(fbDb(), 'schedules'), where('schoolId', '==', id)));
    for (const r of rows.docs) await deleteDoc(r.ref);
    await deleteDoc(doc(fbDb(), 'schools', String(id)));
    schoolsCache = null;
    return {};
  });
export const renameSchedule = (_t: string, id: number, name: string) =>
  wrap(async () => {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (clean.length >= 2) await updateDoc(doc(fbDb(), 'schedules', String(id)), { name: clean, nameLc: clean.toLowerCase() });
    return {};
  });
export const deleteSchedule = (_t: string, id: number) =>
  wrap(async () => {
    await deleteDoc(doc(fbDb(), 'schedules', String(id)));
    schoolsCache = null;
    return {};
  });

/* ---------------- reports on shared content ---------------- */
export interface Report {
  id: number;
  kind: 'school' | 'schedule' | 'message';
  targetId: number;
  targetName: string;
  reason: string;
  note: string;
  status: 'open' | 'dismissed';
  createdAt: number;
}
/** Message id -> chat key, filled as chats are opened, so a reported message can be found again. */
const msgChat = new Map<number, string>();

export const sendReport = (_t: string, kind: 'school' | 'schedule' | 'message', targetId: number, reason: string, note: string) =>
  wrap(async () => {
    const u = await me_();
    const db = fbDb();
    let targetName = '';
    let chat: string | null = null;
    if (kind === 'school') targetName = ((await getDoc(doc(db, 'schools', String(targetId)))).data() as SchoolDoc | undefined)?.name ?? '';
    else if (kind === 'schedule') {
      const s = (await getDoc(doc(db, 'schedules', String(targetId)))).data() as ScheduleDoc | undefined;
      const sc = s ? ((await getDoc(doc(db, 'schools', String(s.schoolId)))).data() as SchoolDoc | undefined) : undefined;
      targetName = s ? `${s.name} · ${sc?.name ?? ''}` : '';
    } else {
      chat = msgChat.get(targetId) ?? null;
      const m = chat ? (await getDoc(doc(db, 'chats', chat, 'msgs', String(targetId)))).data() : undefined;
      const c = chat ? (await getDoc(doc(db, 'chats', chat))).data() : undefined;
      if (m && c) targetName = `${(c.names as Record<string, string>)[m.from as string] ?? ''}: "${String(m.body).slice(0, 120)}"`;
    }
    if (!targetName) throw new ApiError('That item no longer exists.', 404);
    const id = await nextId('reports');
    await setDoc(doc(db, 'reports', String(id)), { kind, targetId, targetName, chat, reason: reason.trim().slice(0, 40), note: note.trim().slice(0, 500), uid: u.uid, status: 'open', createdAt: Date.now() });
    return {};
  });
export const listReports = (_t: string) =>
  wrap(async () => {
    const rows = await getDocs(query(collection(fbDb(), 'reports'), orderBy('createdAt', 'desc'), qLimit(200)));
    const list = rows.docs.map((r) => {
      const d = r.data();
      return { id: Number(r.id), kind: d.kind, targetId: d.targetId, targetName: d.targetName, reason: d.reason, note: d.note ?? '', status: d.status, createdAt: d.createdAt } as Report;
    });
    return list.sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open'));
  });
export const dismissReport = (_t: string, id: number) => wrap(async () => (await updateDoc(doc(fbDb(), 'reports', String(id)), { status: 'dismissed' }), {}));
export const deleteReport = (_t: string, id: number) => wrap(async () => (await deleteDoc(doc(fbDb(), 'reports', String(id))), {}));

/* ---------------- schedule share codes ---------------- */
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const SHARE_DAYS = 30;
export const shareSchedule = (data: unknown) =>
  wrap(async () => {
    if (!data || typeof data !== 'object') throw new ApiError('Nothing to share.', 400);
    const text = JSON.stringify(data);
    if (text.length > 64 * 1024) throw new ApiError('That schedule is too big to share.', 413);
    const now = Date.now();
    const expiresAt = now + SHARE_DAYS * 86400_000;
    for (let tries = 0; tries < 5; tries++) {
      const b = new Uint8Array(6);
      for (let i = 0; i < 6; i++) b[i] = Math.floor(Math.random() * 256);
      const code = [...b].map((x) => SHARE_ALPHABET[x % SHARE_ALPHABET.length]).join('');
      // Rules only allow creating a code that doesn't exist yet, so a clash fails and we try again.
      try {
        await setDoc(doc(fbDb(), 'shares', code), { data: JSON.parse(text), createdAt: now, expiresAt });
        return { code, expiresAt };
      } catch {}
    }
    throw new ApiError('Could not make a code. Try again.', 500);
  });
export const getSharedSchedule = (code: string) =>
  wrap(async () => {
    const s = await getDoc(doc(fbDb(), 'shares', code.trim().toUpperCase()));
    const d = s.data();
    if (!d || d.expiresAt < Date.now()) throw new ApiError('That code did not work. Check it, or ask for a new one.', 404);
    return { data: d.data as unknown, expiresAt: d.expiresAt as number };
  });

/* ---------------- messages ---------------- */
export interface Thread {
  id: number;
  username: string;
  lastAt: number;
  lastBody: string;
  unread: number;
}
export interface ChatMessage {
  id: number;
  mine: boolean;
  body: string;
  createdAt: number;
}
interface ChatDoc {
  members: string[];
  names: Record<string, string>;
  nums: Record<string, number>;
  lastAt: number;
  lastBody: string;
  unread?: Record<string, number>;
}
export const chatKey = (a: string, b: string) => [a, b].sort().join('_');

async function lookup(username: string): Promise<{ uid: string; num: number; username: string }> {
  const name = username.trim().toLowerCase();
  const s = await getDoc(doc(fbDb(), 'usernames', name));
  if (!s.exists()) throw new ApiError('No one with that username.', 404);
  return { ...(s.data() as { uid: string; num: number }), username: name };
}
async function myBlocks(uid: string): Promise<string[]> {
  return ((await getDoc(doc(fbDb(), 'blocks', uid))).data()?.ids as string[] | undefined) ?? [];
}

export const searchUsers = (_t: string, q: string) =>
  wrap(async () => {
    const u = await me_();
    await requireFlag('messaging', 'Messages are paused right now.');
    const needle = q.trim().toLowerCase().slice(0, 24);
    if (needle.length < 2) return [];
    const rows = await getDocs(query(collection(fbDb(), 'usernames'), where(documentId(), '>=', needle), where(documentId(), '<', needle + ''), qLimit(11)));
    return rows.docs
      .map((r) => ({ id: (r.data().num as number) ?? 0, username: r.id, uid: r.data().uid as string }))
      .filter((x) => x.uid !== u.uid)
      .slice(0, 10)
      .map(({ id, username }) => ({ id, username }));
  });

export const listThreads = (_t: string) =>
  wrap(async () => {
    const u = await me_();
    await requireFlag('messaging', 'Messages are paused right now.');
    const [rows, blocked] = await Promise.all([getDocs(query(collection(fbDb(), 'chats'), where('members', 'array-contains', u.uid))), myBlocks(u.uid)]);
    return rows.docs
      .map((r) => r.data() as ChatDoc)
      .sort((x, y) => y.lastAt - x.lastAt)
      .slice(0, 50)
      .map((c) => {
        const other = c.members.find((m) => m !== u.uid) ?? '';
        return { other, t: { id: c.nums[other] ?? 0, username: c.names[other] ?? '', lastAt: c.lastAt, lastBody: c.lastBody, unread: c.unread?.[u.uid] ?? 0 } as Thread };
      })
      .filter((x) => !blocked.includes(x.other))
      .map((x) => x.t);
  });

export const getChat = (_t: string, username: string) =>
  wrap(async () => {
    const u = await me_();
    await requireFlag('messaging', 'Messages are paused right now.');
    const other = await lookup(username);
    const key = chatKey(u.uid, other.uid);
    const db = fbDb();
    const [rows, blocked, chat] = await Promise.all([getDocs(query(collection(db, 'chats', key, 'msgs'), orderBy('createdAt', 'desc'), qLimit(200))), myBlocks(u.uid), getDoc(doc(db, 'chats', key))]);
    if (chat.exists() && ((chat.data() as ChatDoc).unread?.[u.uid] ?? 0) > 0) void updateDoc(chat.ref, { [`unread.${u.uid}`]: 0 }).catch(() => {});
    const messages: ChatMessage[] = rows.docs
      .map((r) => r.data())
      .reverse()
      .map((m) => {
        msgChat.set(m.id as number, key);
        return { id: m.id as number, mine: m.from === u.uid, body: m.body as string, createdAt: m.createdAt as number };
      });
    return { user: { id: other.num, username: other.username }, blocked: blocked.includes(other.uid), messages };
  });

/**
 * Live chat: calls `onChange` with the conversation now and whenever it changes. Firestore bills
 * the first load and then only new or changed messages, unlike re-fetching on a timer.
 */
export function watchChat(username: string, onChange: (r: { user: { id: number; username: string }; blocked: boolean; messages: ChatMessage[] }) => void, onError: (e: ApiError) => void): () => void {
  let stop: (() => void) | null = null;
  let dead = false;
  void (async () => {
    try {
      const u = await me_();
      await requireFlag('messaging', 'Messages are paused right now.');
      const other = await lookup(username);
      const key = chatKey(u.uid, other.uid);
      const db = fbDb();
      const blocked = (await myBlocks(u.uid)).includes(other.uid);
      if (dead) return;
      stop = onSnapshot(
        query(collection(db, 'chats', key, 'msgs'), orderBy('createdAt', 'desc'), qLimit(200)),
        (snap) => {
          const messages = snap.docs
            .map((r) => r.data())
            .reverse()
            .map((m) => {
              msgChat.set(m.id as number, key);
              return { id: m.id as number, mine: m.from === u.uid, body: m.body as string, createdAt: m.createdAt as number };
            });
          onChange({ user: { id: other.num, username: other.username }, blocked, messages });
          // Seen: clear my unread count for this chat.
          if (snap.docs.some((d) => d.data().from !== u.uid)) void updateDoc(doc(db, 'chats', key), { [`unread.${u.uid}`]: 0 }).catch(() => {});
        },
        (e) => onError(friendly(e))
      );
    } catch (e) {
      onError(friendly(e));
    }
  })();
  return () => {
    dead = true;
    stop?.();
  };
}

/** Calls `onChange` (debounced) now and whenever any of my chats or calls change. */
export function watchInbox(onChange: () => void): () => void {
  const stops: (() => void)[] = [];
  let dead = false;
  let t: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    clearTimeout(t);
    t = setTimeout(onChange, 300);
  };
  void currentUser().then((u) => {
    if (!u || dead) return;
    const db = fbDb();
    stops.push(onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', u.uid)), fire, () => {}));
    stops.push(onSnapshot(query(collection(db, 'calls'), where('members', 'array-contains', u.uid)), fire, () => {}));
  });
  return () => {
    dead = true;
    clearTimeout(t);
    stops.forEach((f) => f());
  };
}

export const sendMessage = (_t: string, to: string, body: string) =>
  wrap(async () => {
    const u = await me_();
    await requireFlag('messaging', 'Messages are paused right now.');
    // Rich Beam messages (photos, polls, ...) are JSON behind a marker and may be bigger;
    // a Firestore document holds up to 1 MB.
    const rich = body.startsWith(RICH);
    const text = rich ? body.slice(0, 900_000) : body.replace(/\s+\n/g, '\n').trim().slice(0, 500);
    if (!text) throw new ApiError('Type a message first.', 400);
    const last = preview(text).slice(0, 200);
    const other = await lookup(to);
    if (other.uid === u.uid) throw new ApiError("You can't message yourself.", 400);
    if ((await myBlocks(u.uid)).includes(other.uid)) throw new ApiError("You can't message this person.", 403);
    const mine = await myDoc(u.uid);
    const key = chatKey(u.uid, other.uid);
    const now = Date.now();
    const id = clockId();
    const db = fbDb();
    const b = writeBatch(db);
    b.set(
      doc(db, 'chats', key),
      { members: [u.uid, other.uid].sort(), names: { [u.uid]: mine.username, [other.uid]: other.username }, nums: { [u.uid]: mine.num, [other.uid]: other.num }, lastAt: now, lastBody: last, unread: { [other.uid]: increment(1) } },
      { merge: true }
    );
    b.set(doc(db, 'chats', key, 'msgs', String(id)), { id, from: u.uid, body: text, createdAt: now });
    b.set(doc(db, 'stats', 'global'), { messages: increment(1) }, { merge: true });
    // Blocked by the other person: the rules refuse the message.
    await b.commit().catch((e) => {
      if ((e as { code?: string })?.code?.includes('permission-denied')) throw new ApiError("You can't message this person.", 403);
      throw e;
    });
    msgChat.set(id, key);
    return { id, mine: true, body: text, createdAt: now } as ChatMessage;
  });

export const setBlocked = (_t: string, username: string, block: boolean) =>
  wrap(async () => {
    const u = await me_();
    const other = await lookup(username);
    await setDoc(doc(fbDb(), 'blocks', u.uid), { ids: block ? arrayUnion(other.uid) : arrayRemove(other.uid) }, { merge: true });
    return { blocked: block };
  });

export const deleteMessage = (_t: string, id: number) =>
  wrap(async () => {
    let key = msgChat.get(id);
    if (!key) {
      const r = await getDocs(query(collection(fbDb(), 'reports'), where('targetId', '==', id), qLimit(5)));
      key = r.docs.map((x) => x.data().chat as string | null).find(Boolean) ?? undefined;
    }
    if (key) await deleteDoc(doc(fbDb(), 'chats', key, 'msgs', String(id)));
    return {};
  });

/* ---------------- calls ---------------- */
export interface RecentCall {
  id: number;
  peer: string;
  video: boolean;
  outgoing: boolean;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  at: number;
  seconds: number;
}
export interface CallDoc {
  from: string;
  to: string;
  members: string[];
  fromName: string;
  toName: string;
  video: boolean;
  status: RecentCall['status'];
  createdAt: number;
  answeredAt?: number | null;
  endedAt?: number | null;
}

export const startCall = (_t: string, to: string, video: boolean) =>
  wrap(async () => {
    const u = await me_();
    await requireFlag('messaging', 'Messages are paused right now.');
    const other = await lookup(to);
    if (other.uid === u.uid) throw new ApiError("You can't call yourself.", 400);
    if ((await myBlocks(u.uid)).includes(other.uid)) throw new ApiError("You can't call this person.", 403);
    const mine = await myDoc(u.uid);
    const id = clockId();
    const c: CallDoc = { from: u.uid, to: other.uid, members: [u.uid, other.uid], fromName: mine.username, toName: other.username, video, status: 'ringing', createdAt: Date.now(), answeredAt: null, endedAt: null };
    await setDoc(doc(fbDb(), 'calls', String(id)), c).catch((e) => {
      if ((e as { code?: string })?.code?.includes('permission-denied')) throw new ApiError("You can't call this person.", 403);
      throw e;
    });
    return { id, video, peer: other.username };
  });

export const incomingCall = (_t: string) =>
  wrap(async () => {
    const u = await currentUser();
    if (!u) return null;
    const rows = await getDocs(query(collection(fbDb(), 'calls'), where('to', '==', u.uid), where('status', '==', 'ringing'), qLimit(5)));
    const c = rows.docs
      .map((r) => ({ id: Number(r.id), d: r.data() as CallDoc }))
      .filter((x) => Date.now() - x.d.createdAt < RING_MS)
      .sort((a, b) => b.d.createdAt - a.d.createdAt)[0];
    return c ? { id: c.id, video: c.d.video, peer: c.d.fromName } : null;
  });

export const recentCalls = (_t: string) =>
  wrap(async () => {
    const u = await me_();
    const rows = await getDocs(query(collection(fbDb(), 'calls'), where('members', 'array-contains', u.uid)));
    // No composite index needed: sort here (a person's call list is small).
    const docs = rows.docs.sort((x, y) => (y.data() as CallDoc).createdAt - (x.data() as CallDoc).createdAt).slice(0, 30);
    return docs.map((r) => {
      const c = r.data() as CallDoc;
      const outgoing = c.from === u.uid;
      return {
        id: Number(r.id),
        peer: outgoing ? c.toName : c.fromName,
        video: c.video,
        outgoing,
        status: c.status === 'ringing' && Date.now() - c.createdAt > RING_MS ? 'missed' : c.status,
        at: c.createdAt,
        seconds: c.answeredAt && c.endedAt ? Math.round((c.endedAt - c.answeredAt) / 1000) : 0,
      } as RecentCall;
    });
  });

export const callAction = (_t: string, id: number, action: 'answer' | 'decline' | 'end') =>
  wrap(async () => {
    const u = await me_();
    const ref = doc(fbDb(), 'calls', String(id));
    const s = await getDoc(ref);
    const c = s.data() as CallDoc | undefined;
    if (!c) throw new ApiError('No such call.', 404);
    const now = Date.now();
    const ringing = c.status === 'ringing' && now - c.createdAt < RING_MS;
    if (action === 'answer') {
      if (c.to !== u.uid || !ringing) throw new ApiError('That call is over.', 409);
      await updateDoc(ref, { status: 'active', answeredAt: now });
    } else if (action === 'decline') {
      if (c.status === 'ringing') await updateDoc(ref, { status: 'declined', endedAt: now });
    } else if (c.status === 'ringing' || c.status === 'active') {
      await updateDoc(ref, { status: c.status === 'active' ? 'ended' : 'missed', endedAt: now });
    }
    return {};
  });

/* ---------------- Apps Script: reader + TURN ---------------- */
async function script<T>(action: string, payload: Record<string, unknown>, timeoutMs = 90_000): Promise<T> {
  if (!SCRIPT_URL) throw new ApiError('This is not set up yet.', 503);
  const u = await me_();
  const idToken = await u.getIdToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(SCRIPT_URL, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, idToken, ...payload }) });
    const j = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; status?: number } & T) | null;
    if (!j || j.ok === false) throw new ApiError(j?.error || `Server said ${res.status}`, j?.status ?? res.status);
    return j;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('That took too long. Check your internet and try again.', 0);
    throw new ApiError("Can't reach Studento's server. Check your internet.", 0);
  } finally {
    clearTimeout(timer);
  }
}

export const readScheduleAI = (_t: string, input: { image?: { data: string; mimeType: string }; text?: string }, bells?: Record<SchoolDay, Period[]> | null) =>
  script<AiResult>('read', { ...input, bells: bells ?? undefined });

type Ice = { urls: string | string[]; username?: string; credential?: string };
let iceCache: { at: number; list: Ice[] } | null = null;
/** STUN always, plus the TURN relay from Apps Script when it is set up (cached 1 hour). */
export async function iceServers(): Promise<Ice[]> {
  if (iceCache && Date.now() - iceCache.at < 3600_000) return iceCache.list;
  const base: Ice[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  try {
    const r = await script<{ iceServers: Ice[] }>('ice', {}, 15_000);
    iceCache = { at: Date.now(), list: r.iceServers };
    return r.iceServers;
  } catch {
    return base;
  }
}
