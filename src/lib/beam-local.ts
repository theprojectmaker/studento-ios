/**
 * Beam things that live only on this phone: starred messages, drafts, archived chats and the
 * "send later" queue. Nothing here goes to the server until a scheduled message actually sends
 * (then it is encrypted like any other message).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { getToken } from './account';
import * as api from './api';

/* ---------- small JSON store with subscribers ---------- */
function makeStore<T>(key: string, empty: T) {
  let state = empty;
  const subs = new Set<() => void>();
  AsyncStorage.getItem(key)
    .then((s) => {
      if (!s) return;
      state = JSON.parse(s) as T;
      subs.forEach((f) => f());
    })
    .catch(() => {});
  const set = (next: T) => {
    state = next;
    subs.forEach((f) => f());
    void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  };
  const sub = (f: () => void) => {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  };
  const get = () => state;
  const use = () => useSyncExternalStore(sub, get, get);
  return { get, set, use };
}

/* ---------- starred: username -> [{id, text, at}] ---------- */
export interface Star {
  id: number;
  text: string;
  at: number;
}
const stars = makeStore<Record<string, Star[]>>('beam.stars', {});
export const useStars = (username: string) => stars.use()[username] ?? [];
export const useAllStars = () => stars.use();
export function toggleStar(username: string, s: Star) {
  const all = stars.get();
  const cur = all[username] ?? [];
  const next = cur.some((x) => x.id === s.id) ? cur.filter((x) => x.id !== s.id) : [s, ...cur].slice(0, 200);
  stars.set({ ...all, [username]: next });
}

/* ---------- archived chats ---------- */
const archived = makeStore<string[]>('beam.archived', []);
export const useArchived = () => archived.use();
export function toggleArchived(username: string) {
  const a = archived.get();
  archived.set(a.includes(username) ? a.filter((x) => x !== username) : [...a, username]);
}

/* ---------- drafts ---------- */
const drafts = makeStore<Record<string, string>>('beam.drafts', {});
export const getDraft = (username: string) => drafts.get()[username] ?? '';
export const useDrafts = () => drafts.use();
let draftTimer: ReturnType<typeof setTimeout> | undefined;
export function saveDraft(username: string, text: string) {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const d = { ...drafts.get() };
    if (text.trim()) d[username] = text;
    else delete d[username];
    drafts.set(d);
  }, 400);
}
/** Drafts load asynchronously; this returns the saved one once it's there. */
export function useDraft(username: string): string | null {
  const d = drafts.use();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 250);
    return () => clearTimeout(t);
  }, []);
  return loaded ? (d[username] ?? '') : null;
}

/* ---------- send later ---------- */
export interface Scheduled {
  key: string;
  to: string;
  body: string;
  at: number;
  preview: string;
}
const queue = makeStore<Scheduled[]>('beam.scheduled', []);
export const useScheduled = (username?: string) => {
  const q = queue.use();
  return username ? q.filter((x) => x.to === username) : q;
};
export function schedule(to: string, body: string, at: number, preview: string) {
  queue.set([...queue.get(), { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, to, body, at, preview }].sort((a, b) => a.at - b.at));
}
export const unschedule = (key: string) => queue.set(queue.get().filter((x) => x.key !== key));

let running = false;
async function flush() {
  if (running) return;
  running = true;
  try {
    const due = queue.get().filter((x) => x.at <= Date.now());
    if (!due.length) return;
    const t = await getToken();
    if (!t) return;
    for (const m of due) {
      try {
        await api.sendMessage(t, m.to, m.body);
        unschedule(m.key);
      } catch {
        // keep it; try again on the next tick
      }
    }
  } finally {
    running = false;
  }
}
/** Sends anything that's due, now and every 15 s while Beam is open. */
export function useScheduledSender() {
  useEffect(() => {
    void flush();
    const id = setInterval(() => void flush(), 15_000);
    return () => clearInterval(id);
  }, []);
}
