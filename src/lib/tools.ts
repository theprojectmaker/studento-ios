/**
 * Local-only tools: focus timer (Pomodoro), quick notes, grade calculator.
 * One small AsyncStorage-backed store; nothing here touches the shared server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface Focus {
  /** 'idle' | running a focus block | running a break */
  mode: 'idle' | 'focus' | 'break';
  /** When the current block ends (epoch ms), if running. */
  endsAt: number | null;
  /** Remaining ms when paused. */
  pausedLeft: number | null;
  focusMin: number;
  breakMin: number;
  /** Completed focus blocks, keyed by "YYYY-MM-DD". */
  done: Record<string, number>;
}

export interface Note {
  id: string;
  text: string;
  updatedAt: number;
  pinned: boolean;
}

export interface GradeRow {
  id: string;
  name: string;
  /** Percent 0-100 */
  score: number;
  /** Relative weight, e.g. 1 for regular, 1.1 honors */
  weight: number;
}

interface Tools {
  loaded: boolean;
  focus: Focus;
  notes: Note[];
  grades: GradeRow[];
}

const KEY = 'studento:tools';
let state: Tools = {
  loaded: false,
  focus: { mode: 'idle', endsAt: null, pausedLeft: null, focusMin: 25, breakMin: 5, done: {} },
  notes: [],
  grades: [],
};
const listeners = new Set<() => void>();

function set(next: Partial<Tools>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(KEY, JSON.stringify({ focus: state.focus, notes: state.notes, grades: state.grades })).catch(() => {});
}

export async function loadTools() {
  if (state.loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : {};
    state = { loaded: true, focus: { ...state.focus, ...(d.focus ?? {}) }, notes: d.notes ?? [], grades: d.grades ?? [] };
  } catch {
    state = { ...state, loaded: true };
  }
  listeners.forEach((l) => l());
}

/** Replace notes and grades (restore from a backup). The focus timer is left alone. */
export function importTools(data: { notes?: Note[]; grades?: GradeRow[] }) {
  set({ notes: Array.isArray(data.notes) ? data.notes : state.notes, grades: Array.isArray(data.grades) ? data.grades : state.grades });
}

export function getTools(): Tools {
  return state;
}

export function subscribeTools(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTools<T>(select: (t: Tools) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
    () => select(state)
  );
}

const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------------- focus timer ---------------- */

export function focusLeft(f: Focus, now: number): number {
  if (f.pausedLeft != null) return f.pausedLeft;
  if (f.endsAt == null) return f.focusMin * 60_000;
  return Math.max(0, f.endsAt - now);
}

export function startFocus(mode: 'focus' | 'break' = 'focus') {
  const f = state.focus;
  const min = mode === 'focus' ? f.focusMin : f.breakMin;
  set({ focus: { ...f, mode, endsAt: Date.now() + min * 60_000, pausedLeft: null } });
}

export function pauseFocus() {
  const f = state.focus;
  if (f.endsAt == null) return;
  set({ focus: { ...f, pausedLeft: Math.max(0, f.endsAt - Date.now()), endsAt: null } });
}

export function resumeFocus() {
  const f = state.focus;
  if (f.pausedLeft == null) return;
  set({ focus: { ...f, endsAt: Date.now() + f.pausedLeft, pausedLeft: null } });
}

export function stopFocus() {
  set({ focus: { ...state.focus, mode: 'idle', endsAt: null, pausedLeft: null } });
}

/** Called each tick: when a block runs out, count it and roll into the next one. Returns what just finished. */
export function tickFocus(now: number, today: string): 'focus' | 'break' | null {
  const f = state.focus;
  if (f.mode === 'idle' || f.endsAt == null || now < f.endsAt) return null;
  if (f.mode === 'focus') {
    set({ focus: { ...f, mode: 'break', endsAt: now + f.breakMin * 60_000, done: { ...f.done, [today]: (f.done[today] ?? 0) + 1 } } });
    return 'focus';
  }
  set({ focus: { ...f, mode: 'idle', endsAt: null, pausedLeft: null } });
  return 'break';
}

export function setFocusLengths(focusMin: number, breakMin: number) {
  set({ focus: { ...state.focus, focusMin, breakMin } });
}

/* ---------------- notes ---------------- */

export function addNote(text = ''): string {
  const n: Note = { id: id(), text, updatedAt: Date.now(), pinned: false };
  set({ notes: [n, ...state.notes] });
  return n.id;
}

export function updateNote(nid: string, text: string) {
  set({ notes: state.notes.map((n) => (n.id === nid ? { ...n, text, updatedAt: Date.now() } : n)) });
}

export function togglePin(nid: string) {
  set({ notes: state.notes.map((n) => (n.id === nid ? { ...n, pinned: !n.pinned } : n)) });
}

export function deleteNote(nid: string) {
  set({ notes: state.notes.filter((n) => n.id !== nid) });
}

/* ---------------- grades ---------------- */

export function addGrade(name: string, score: number, weight: number) {
  set({ grades: [...state.grades, { id: id(), name, score, weight }] });
}

export function updateGrade(gid: string, patch: Partial<GradeRow>) {
  set({ grades: state.grades.map((g) => (g.id === gid ? { ...g, ...patch } : g)) });
}

export function deleteGrade(gid: string) {
  set({ grades: state.grades.filter((g) => g.id !== gid) });
}

/** Weighted average percent and a 4.0-scale GPA (unweighted letter scale, weight scales the points). */
export function gradeSummary(rows: GradeRow[]): { average: number; gpa: number } | null {
  if (!rows.length) return null;
  const w = rows.reduce((a, r) => a + (r.weight || 1), 0);
  const average = rows.reduce((a, r) => a + r.score * (r.weight || 1), 0) / w;
  const pts = (s: number) => (s >= 93 ? 4 : s >= 90 ? 3.7 : s >= 87 ? 3.3 : s >= 83 ? 3 : s >= 80 ? 2.7 : s >= 77 ? 2.3 : s >= 73 ? 2 : s >= 70 ? 1.7 : s >= 67 ? 1.3 : s >= 65 ? 1 : 0);
  const gpa = rows.reduce((a, r) => a + pts(r.score) * (r.weight || 1), 0) / rows.length;
  return { average, gpa };
}

export function letter(score: number): string {
  return score >= 93 ? 'A' : score >= 90 ? 'A-' : score >= 87 ? 'B+' : score >= 83 ? 'B' : score >= 80 ? 'B-' : score >= 77 ? 'C+' : score >= 73 ? 'C' : score >= 70 ? 'C-' : score >= 67 ? 'D+' : score >= 65 ? 'D' : 'F';
}
