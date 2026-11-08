/**
 * Firestore data for Beam extras (rules in firestore.rules):
 *   stats/global   {messages}                                  +1 per message (api.sendMessage)
 *   announcements/{id} {title, body, closable, createdAt}     admin writes, everyone signed in reads
 *   games/{id}     {members[2], white, black, names, fen, moves[], status, winner?, updatedAt}
 */
import { Chess } from 'chess.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore';

import { currentUser, fbDb } from './fb';

async function me() {
  const u = await currentUser();
  if (!u) throw new Error('Sign in first.');
  return u;
}
async function nameOf(uid: string): Promise<string> {
  return ((await getDoc(doc(fbDb(), 'users', uid))).data()?.username as string | undefined) ?? '';
}
async function uidOf(username: string): Promise<string> {
  const s = await getDoc(doc(fbDb(), 'usernames', username.trim().toLowerCase()));
  if (!s.exists()) throw new Error('No one with that username.');
  return s.data().uid as string;
}

/* ---------- live message counter ---------- */
export function watchMessageCount(cb: (n: number) => void): () => void {
  try {
    return onSnapshot(
      doc(fbDb(), 'stats', 'global'),
      (s) => cb(Number(s.data()?.messages ?? 0)),
      () => {}
    );
  } catch {
    return () => {};
  }
}

/* ---------- totals (admin) ---------- */
/** Accounts ever made (the id counter) and messages ever sent. Counts only. */
export async function totals(): Promise<{ accounts: number; messages: number }> {
  const db = fbDb();
  const [c, s] = await Promise.all([getDoc(doc(db, 'counters', 'users')), getDoc(doc(db, 'stats', 'global'))]);
  return { accounts: Math.max(0, Number(c.data()?.next ?? 1) - 1), messages: Number(s.data()?.messages ?? 0) };
}

/* ---------- announcements ---------- */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** false = stays on screen until the admin takes it down */
  closable: boolean;
  createdAt: number;
}
export function watchAnnouncements(cb: (a: Announcement[]) => void): () => void {
  try {
    return onSnapshot(
      query(collection(fbDb(), 'announcements'), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))),
      () => cb([])
    );
  } catch {
    return () => {};
  }
}
export async function postAnnouncement(title: string, body: string, closable: boolean): Promise<void> {
  await me();
  await addDoc(collection(fbDb(), 'announcements'), { title: title.trim().slice(0, 80), body: body.trim().slice(0, 600), closable, createdAt: Date.now() });
}
export const takeDown = (id: string) => deleteDoc(doc(fbDb(), 'announcements', id));

/* ---------- multiplayer chess ---------- */
export interface Game {
  id: string;
  members: string[];
  white: string;
  black: string;
  names: Record<string, string>;
  fen: string;
  moves: string[];
  status: 'playing' | 'checkmate' | 'draw' | 'resigned';
  winner?: string;
  updatedAt: number;
}

/** Start a game against `username`; the inviter plays white. Returns the game id. */
export async function newGame(username: string): Promise<string> {
  const u = await me();
  const other = await uidOf(username);
  const g = { members: [u.uid, other].sort(), white: u.uid, black: other, names: { [u.uid]: await nameOf(u.uid), [other]: username.trim().toLowerCase() }, fen: new Chess().fen(), moves: [], status: 'playing', updatedAt: Date.now() };
  return (await addDoc(collection(fbDb(), 'games'), g)).id;
}

export function watchGame(id: string, cb: (g: Game | null, myUid: string) => void): () => void {
  let stop = () => {};
  let dead = false;
  void currentUser().then((u) => {
    if (!u || dead) return;
    stop = onSnapshot(
      doc(fbDb(), 'games', id),
      (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Game) : null, u.uid),
      () => cb(null, u.uid)
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

/** Play a move like {from:'e2', to:'e4'}; checked on this device and inside a transaction. */
export async function playMove(id: string, from: string, to: string): Promise<void> {
  const u = await me();
  const ref = doc(fbDb(), 'games', id);
  await runTransaction(fbDb(), async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Game not found.');
    const g = s.data() as Game;
    if (g.status !== 'playing') throw new Error('This game is over.');
    const c = new Chess(g.fen);
    if ((c.turn() === 'w' ? g.white : g.black) !== u.uid) throw new Error("It's not your turn.");
    const m = c.move({ from, to, promotion: 'q' });
    const status: Game['status'] = c.isCheckmate() ? 'checkmate' : c.isDraw() || c.isStalemate() ? 'draw' : 'playing';
    tx.update(ref, { fen: c.fen(), moves: [...g.moves, m.san], status, ...(status === 'checkmate' ? { winner: u.uid } : {}), updatedAt: Date.now() });
  });
}

export async function resign(id: string): Promise<void> {
  const u = await me();
  const ref = doc(fbDb(), 'games', id);
  await runTransaction(fbDb(), async (tx) => {
    const g = (await tx.get(ref)).data() as Game | undefined;
    if (!g || g.status !== 'playing') return;
    tx.update(ref, { status: 'resigned', winner: g.members.find((m) => m !== u.uid), updatedAt: Date.now() });
  });
}

/* ---------- live kill switches ---------- */
/** config/flags, live. A missing flag counts as on. */
export function watchFlags(cb: (f: Record<string, boolean>) => void): () => void {
  try {
    return onSnapshot(
      doc(fbDb(), 'config', 'flags'),
      (s) => cb((s.data() as Record<string, boolean> | undefined) ?? {}),
      () => {}
    );
  } catch {
    return () => {};
  }
}

/* ---------- waiting list ---------- */
export type AccessStatus = 'none' | 'waiting' | 'approved' | 'denied';
export interface AccessRequest {
  uid: string;
  username: string;
  status: AccessStatus;
  at: number;
  /** place in line, given when they ask */
  num?: number;
}

export function watchMyAccess(cb: (s: AccessStatus, num?: number) => void): () => void {
  let stop = () => {};
  let dead = false;
  void currentUser().then((u) => {
    if (!u || dead) return;
    stop = onSnapshot(
      doc(fbDb(), 'access', u.uid),
      (s) => cb(s.exists() ? (s.data().status as AccessStatus) : 'none', s.exists() ? (s.data().num as number | undefined) : undefined),
      () => cb('none')
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

export async function requestAccess(): Promise<void> {
  const u = await me();
  // Place in line from a +1 counter, so everyone gets their own number.
  const ref = doc(fbDb(), 'counters', 'waitlist');
  const num = await runTransaction(fbDb(), async (tx) => {
    const n = Math.max(1, Number((await tx.get(ref)).data()?.next ?? 1));
    tx.set(ref, { next: n + 1 });
    return n;
  });
  await setDoc(doc(fbDb(), 'access', u.uid), { username: await nameOf(u.uid), status: 'waiting', at: Date.now(), num });
}

/** Admin: everyone on the list, waiting first. */
export function watchAccessList(cb: (l: AccessRequest[]) => void): () => void {
  try {
    return onSnapshot(
      query(collection(fbDb(), 'access'), orderBy('at', 'desc'), limit(200)),
      (snap) => {
        const rank = { waiting: 0, approved: 1, denied: 2, none: 3 };
        cb(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AccessRequest, 'uid'>) })).sort((a, b) => rank[a.status] - rank[b.status]));
      },
      () => cb([])
    );
  } catch {
    return () => {};
  }
}
export const decide = (uid: string, status: 'approved' | 'denied') => updateDoc(doc(fbDb(), 'access', uid), { status, at: Date.now() });
/** Admin: switch a flag (e.g. waitlist) on or off for everyone. */
export const setFlag = (k: string, v: boolean) => setDoc(doc(fbDb(), 'config', 'flags'), { [k]: v }, { merge: true });

/* ---------- seen + typing (fields on chats/{key}) ---------- */
async function chatRef(username: string) {
  const u = await me();
  const other = await uidOf(username);
  return { ref: doc(fbDb(), 'chats', [u.uid, other].sort().join('_')), mine: u.uid, other };
}

/** Live: has the other person read everything I sent, and are they typing right now? */
export function watchChatMeta(username: string, cb: (m: { seen: boolean; typingAt: number }) => void): () => void {
  let stop = () => {};
  let dead = false;
  void chatRef(username)
    .then(({ ref, other }) => {
      if (dead) return;
      stop = onSnapshot(
        ref,
        (s) => {
          const d = s.data() ?? {};
          cb({ seen: Number((d.unread as Record<string, number> | undefined)?.[other] ?? 0) === 0, typingAt: Number((d.typing as Record<string, number> | undefined)?.[other] ?? 0) });
        },
        () => {}
      );
    })
    .catch(() => {});
  return () => {
    dead = true;
    stop();
  };
}

let lastTyping = 0;
/** Tell the other person I'm typing (at most every 3 seconds; only once the chat exists). */
export async function sendTyping(username: string): Promise<void> {
  if (Date.now() - lastTyping < 3000) return;
  lastTyping = Date.now();
  const { ref, mine } = await chatRef(username);
  await updateDoc(ref, { [`typing.${mine}`]: Date.now() }).catch(() => {});
}

/* ---------- accounts, bans, personal pop-ups (admin) ---------- */
export interface Account {
  uid: string;
  num: number;
  username: string;
  admin: boolean;
}
/** Admin: every account (username and number only). */
export async function listAccounts(): Promise<Account[]> {
  const s = await getDocs(query(collection(fbDb(), 'users'), limit(500)));
  return s.docs.map((d) => ({ uid: d.id, num: Number(d.data().num ?? 0), username: String(d.data().username ?? ''), admin: !!d.data().admin })).sort((a, b) => a.num - b.num);
}

/** 'chat' = can't message or call; 'full' = the app shows a blocked screen. */
export type BanLevel = 'chat' | 'full';
export interface Ban {
  uid: string;
  level: BanLevel;
  reason: string;
  at: number;
}
export function watchBans(cb: (b: Record<string, Ban>) => void): () => void {
  try {
    return onSnapshot(
      collection(fbDb(), 'bans'),
      (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, { uid: d.id, ...(d.data() as Omit<Ban, 'uid'>) }]))),
      () => cb({})
    );
  } catch {
    return () => {};
  }
}
export const setBan = (uid: string, level: BanLevel | null, reason = '') =>
  level ? setDoc(doc(fbDb(), 'bans', uid), { level, reason: reason.slice(0, 200), at: Date.now() }) : deleteDoc(doc(fbDb(), 'bans', uid));

export function watchMyBan(cb: (b: Ban | null) => void): () => void {
  let stop = () => {};
  let dead = false;
  void currentUser().then((u) => {
    if (!u || dead) return;
    stop = onSnapshot(
      doc(fbDb(), 'bans', u.uid),
      (s) => cb(s.exists() ? ({ uid: s.id, ...s.data() } as Ban) : null),
      () => cb(null)
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

export interface Notice extends Announcement {
  to: string;
}
export const sendNotice = (to: string, title: string, body: string, closable: boolean) =>
  addDoc(collection(fbDb(), 'notices'), { to, title: title.trim().slice(0, 80), body: body.trim().slice(0, 600), closable, createdAt: Date.now() });
export const takeDownNotice = (id: string) => deleteDoc(doc(fbDb(), 'notices', id));
export function watchMyNotices(cb: (n: Notice[]) => void): () => void {
  let stop = () => {};
  let dead = false;
  void currentUser().then((u) => {
    if (!u || dead) return;
    stop = onSnapshot(
      query(collection(fbDb(), 'notices'), where('to', '==', u.uid)),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notice, 'id'>) }))),
      () => cb([])
    );
  });
  return () => {
    dead = true;
    stop();
  };
}
/** Admin: personal pop-ups sent to one account. */
export function watchNoticesFor(uid: string, cb: (n: Notice[]) => void): () => void {
  try {
    return onSnapshot(
      query(collection(fbDb(), 'notices'), where('to', '==', uid)),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notice, 'id'>) }))),
      () => cb([])
    );
  } catch {
    return () => {};
  }
}
