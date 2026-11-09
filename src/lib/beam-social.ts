/**
 * Beam social data (rules in firestore.rules):
 *   friendreqs/{from}_{to}  {from, to, fromName, toName, status: pending|accepted, at}
 *                           one doc per pair; accepted = friends. Either person can delete it.
 *   config/admins           {uids[], names[]}  admins can't be blocked
 */
import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { currentUser, fbDb } from './fb';

async function me() {
  const u = await currentUser();
  if (!u) throw new Error('Sign in first.');
  return u;
}
async function myName(uid: string): Promise<string> {
  return ((await getDoc(doc(fbDb(), 'users', uid))).data()?.username as string | undefined) ?? '';
}
async function uidOf(username: string): Promise<string> {
  const s = await getDoc(doc(fbDb(), 'usernames', username.trim().toLowerCase()));
  if (!s.exists()) throw new Error('No one with that username.');
  return s.data().uid as string;
}

/* ---------- friends ---------- */
export interface FriendReq {
  id: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  status: 'pending' | 'accepted';
  at: number;
}
export interface FriendState {
  friends: string[];
  incoming: FriendReq[];
  outgoing: FriendReq[];
  /** username -> request doc id, for every pair I'm in */
  byName: Record<string, FriendReq>;
}
const EMPTY: FriendState = { friends: [], incoming: [], outgoing: [], byName: {} };

/** Live friends, incoming and outgoing requests. */
export function watchFriends(cb: (s: FriendState) => void): () => void {
  let stops: (() => void)[] = [];
  let dead = false;
  void currentUser().then((u) => {
    if (!u || dead) return;
    let sent: FriendReq[] = [];
    let got: FriendReq[] = [];
    const emit = () => {
      const all = [...sent, ...got];
      const friends = all.filter((r) => r.status === 'accepted').map((r) => (r.from === u.uid ? r.toName : r.fromName));
      const byName: Record<string, FriendReq> = {};
      for (const r of all) byName[r.from === u.uid ? r.toName : r.fromName] = r;
      cb({ friends: [...new Set(friends)].sort(), incoming: got.filter((r) => r.status === 'pending'), outgoing: sent.filter((r) => r.status === 'pending'), byName });
    };
    const col = collection(fbDb(), 'friendreqs');
    const map = (d: { id: string; data: () => unknown }) => ({ id: d.id, ...(d.data() as Omit<FriendReq, 'id'>) });
    stops = [
      onSnapshot(query(col, where('from', '==', u.uid)), (s) => ((sent = s.docs.map(map)), emit()), () => {}),
      onSnapshot(query(col, where('to', '==', u.uid)), (s) => ((got = s.docs.map(map)), emit()), () => {}),
    ];
  });
  return () => {
    dead = true;
    stops.forEach((f) => f());
  };
}

export function useFriends(): FriendState {
  const [s, setS] = useState<FriendState>(EMPTY);
  useEffect(() => watchFriends(setS), []);
  return s;
}

export async function sendFriendRequest(username: string): Promise<void> {
  const u = await me();
  const to = await uidOf(username);
  if (to === u.uid) throw new Error("That's you.");
  // If they already asked me, adding them back accepts it.
  const theirs = await getDoc(doc(fbDb(), 'friendreqs', `${to}_${u.uid}`)).catch(() => null);
  if (theirs?.exists()) return updateDoc(theirs.ref, { status: 'accepted' });
  await setDoc(doc(fbDb(), 'friendreqs', `${u.uid}_${to}`), { from: u.uid, to, fromName: await myName(u.uid), toName: username.trim().toLowerCase(), status: 'pending', at: Date.now() });
}
export const acceptFriend = (id: string) => updateDoc(doc(fbDb(), 'friendreqs', id), { status: 'accepted' });
/** Deny, cancel or unfriend: all just delete the pair's doc. */
export const dropFriend = (id: string) => deleteDoc(doc(fbDb(), 'friendreqs', id));

/** People to suggest: accounts I'm not connected with yet (usernames only). */
export async function friendSuggestions(exclude: string[], max = 6): Promise<string[]> {
  const u = await me();
  const mine = await myName(u.uid);
  const rows = await getDocs(query(collection(fbDb(), 'usernames'), limit(60)));
  const skip = new Set([...exclude, mine]);
  const pool = rows.docs.map((d) => d.id).filter((n) => !skip.has(n));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, max);
}

/* ---------- admins (can't be blocked) ---------- */
let adminNames: string[] = [];
export function watchAdmins(cb: (names: string[]) => void): () => void {
  try {
    return onSnapshot(
      doc(fbDb(), 'config', 'admins'),
      (s) => {
        adminNames = (s.data()?.names as string[] | undefined) ?? [];
        cb(adminNames);
      },
      () => {}
    );
  } catch {
    return () => {};
  }
}
export const isAdminName = (u: string) => adminNames.includes(u);
export function useAdminNames(): string[] {
  const [n, setN] = useState<string[]>(adminNames);
  useEffect(() => watchAdmins(setN), []);
  return n;
}
/** Admin: put my uid + name on the public admin list. */
export async function registerAdmin(): Promise<void> {
  const u = await me();
  const name = await myName(u.uid);
  const ref = doc(fbDb(), 'config', 'admins');
  const cur = (await getDoc(ref)).data() ?? {};
  const uids = new Set<string>((cur.uids as string[] | undefined) ?? []);
  const names = new Set<string>((cur.names as string[] | undefined) ?? []);
  if (uids.has(u.uid) && names.has(name)) return;
  uids.add(u.uid);
  names.add(name);
  await setDoc(ref, { uids: [...uids], names: [...names] });
}
