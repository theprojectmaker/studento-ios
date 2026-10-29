/**
 * Planner: homework and countdowns. Kept on this phone only (AsyncStorage);
 * the shared server only holds the schedule.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface Homework {
  id: string;
  title: string;
  /** Period id from the schedule ('3', 'advisory'), or '' for none. */
  period: string;
  /** "YYYY-MM-DD" in New York, or '' for no date. */
  due: string;
  done: boolean;
  createdAt: number;
}

export interface Countdown {
  id: string;
  title: string;
  date: string;
  emoji: string;
}

export interface Planner {
  loaded: boolean;
  homework: Homework[];
  countdowns: Countdown[];
}

const KEY = 'studento:planner';
let state: Planner = { loaded: false, homework: [], countdowns: [] };
const listeners = new Set<() => void>();

function set(next: Partial<Planner>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(KEY, JSON.stringify({ homework: state.homework, countdowns: state.countdowns })).catch(() => {});
}

export async function loadPlanner() {
  if (state.loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    state = { loaded: true, homework: data.homework ?? [], countdowns: data.countdowns ?? [] };
  } catch {
    state = { ...state, loaded: true };
  }
  listeners.forEach((l) => l());
}

export function getPlanner(): Planner {
  return state;
}

export function subscribePlanner(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Replace everything (restore from a backup). */
export function importPlanner(data: { homework?: Homework[]; countdowns?: Countdown[] }) {
  set({ homework: Array.isArray(data.homework) ? data.homework : state.homework, countdowns: Array.isArray(data.countdowns) ? data.countdowns : state.countdowns });
}

export function usePlanner<T>(select: (p: Planner) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
    () => select(state)
  );
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function addHomework(h: Pick<Homework, 'title' | 'period' | 'due'>) {
  set({ homework: [{ ...h, id: newId(), done: false, createdAt: Date.now() }, ...state.homework] });
}

export function toggleHomework(id: string) {
  set({ homework: state.homework.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) });
}

export function deleteHomework(id: string) {
  set({ homework: state.homework.filter((h) => h.id !== id) });
}

export function clearDoneHomework() {
  set({ homework: state.homework.filter((h) => !h.done) });
}

export function addCountdown(c: Pick<Countdown, 'title' | 'date' | 'emoji'>) {
  set({ countdowns: [...state.countdowns, { ...c, id: newId() }].sort((a, b) => a.date.localeCompare(b.date)) });
}

export function deleteCountdown(id: string) {
  set({ countdowns: state.countdowns.filter((c) => c.id !== id) });
}

/** Whole days from `today` to `date` (both "YYYY-MM-DD"). */
export function daysBetween(today: string, date: string): number {
  const [a, b] = [today, date].map((d) => {
    const [y, m, dd] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  });
  return Math.round((b - a) / 86_400_000);
}
