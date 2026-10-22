/**
 * App state: device prefs (this phone only) + the shared schedule data
 * (cached here, source of truth on the Studento server).
 * A tiny external store read with useSyncExternalStore.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { AlertPrefs, ClassDetail } from './alerts';
import * as api from './api';
import { nyParts } from './nytime';
import { classifyStorage } from './storageKind';
import { PERIOD_IDS, type CustomDay, type Override, type OverrideType, type Period, type PersonalSchedule, type ScheduleData } from './schedule';
import { DEFAULT_THEME } from './themes';

export type WidgetId = 'progress' | 'homework' | 'countdown' | 'next' | 'date' | 'weekend' | 'focus' | 'quote';
export const WIDGET_IDS: WidgetId[] = ['progress', 'homework', 'focus', 'countdown', 'next', 'quote', 'date', 'weekend'];

export type Layout = 'classic' | 'minimal' | 'glass';
/** Animated background behind the clock. 'theme' = whatever the theme looks best with. */
export type Background = 'theme' | 'sky' | 'aurora' | 'stars' | 'off';

export interface Prefs extends AlertPrefs {
  theme: string;
  layout: Layout;
  /** Widgets shown on the clock screen, in order (max 4). */
  widgets: WidgetId[];
  background: Background;
  /** Rolling digits and moving backgrounds. Off = everything stays still. */
  motion: boolean;
  /** Pretend it is the middle of Period 3 on a school day (for trying the app on a weekend). Bell alerts ignore it. */
  testPeriod3: boolean;
  seconds: boolean;
  /** From the real Studento's display options. */
  focus: boolean;
  periodNum: boolean;
  endTime: boolean;
  showDate: boolean;
  night: boolean;
  burnin: boolean;
  shuffle: boolean;
  daily: boolean;
  dailyDate: string;
  flashWarn: boolean;
  blinkLast: boolean;
  speak: boolean;
  warnBuzz: boolean;
  /** Sub-second readout next to the clock and the countdown. */
  millis: Millis;
  /** Size of the big countdown. */
  digitSize: 'small' | 'normal' | 'large';
  h24: boolean;
  showNext: boolean;
  /** Clock-screen pieces the student can hide (long-press the clock to edit). */
  showEyebrow: boolean;
  showTimes: boolean;
  showUnit: boolean;
  showDay: boolean;
  showTimeline: boolean;
  showClock: boolean;
  keepAwake: boolean;
  haptics: boolean;
  /** Master switch for bell alerts on this phone. */
  alerts: boolean;
  /** The one-time "turn on alerts" card was answered. */
  alertsAsked: boolean;
  /** The first-launch "whose schedule?" screen was answered. */
  onboarded: boolean;
  /** Lock Screen / Dynamic Island countdown (installed app only). */
  liveActivity: boolean;
  prefsVersion: number;
  /** Lock mode: only the clock, hold the red button to unlock. */
  locked: boolean;
  /** Tap the countdown to flip between m:ss and whole minutes. */
  tapToggle: boolean;
  /** Dim the clock a little while idle (like the corner buttons). */
  idleDim: boolean;
  /** Corner buttons never fade. */
  corners: boolean;
}

export interface Shared {
  classNames: Record<string, string>;
  classDetails: Record<string, ClassDetail>;
  customDays: CustomDay[];
  override: Override | null;
}

export interface Pending {
  names?: boolean;
  details?: boolean;
  override?: boolean;
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline';

export interface State {
  loaded: boolean;
  prefs: Prefs;
  shared: Shared;
  pending: Pending;
  /** A student's own schedule on this phone; null = the shared default. */
  personal: PersonalSchedule | null;
  sync: { status: SyncStatus; at: number | null; error: string | null };
}

export type Millis = 'off' | 'tenths' | 'centis' | 'millis';

export const DEFAULT_PREFS: Prefs = {
  theme: DEFAULT_THEME,
  layout: 'classic',
  widgets: ['progress', 'homework'],
  background: 'theme',
  motion: true,
  testPeriod3: false,
  seconds: true,
  millis: 'off',
  focus: false,
  periodNum: false,
  endTime: false,
  showDate: false,
  night: false,
  burnin: false,
  shuffle: false,
  daily: false,
  dailyDate: '',
  flashWarn: true,
  blinkLast: false,
  speak: false,
  warnBuzz: true,
  digitSize: 'normal',
  h24: false,
  showNext: true,
  showEyebrow: true,
  showTimes: true,
  showUnit: true,
  showDay: true,
  showTimeline: true,
  showClock: true,
  keepAwake: true,
  haptics: true,
  alerts: true,
  welcome: true,
  endWarning: true,
  alertsAsked: false,
  onboarded: false,
  liveActivity: true,
  /** Bumped when defaults change so existing installs pick them up once. */
  prefsVersion: 2,
  locked: false,
  tapToggle: true,
  idleDim: false,
  corners: false,
};

const EMPTY_SHARED: Shared = { classNames: {}, classDetails: {}, customDays: [], override: null };

const K_PREFS = 'studento:prefs';
const K_SHARED = 'studento:shared';
const K_PENDING = 'studento:pending';
const K_PERSONAL = 'studento:personal';
/** A second copy of everything, used to recover if the main keys are ever empty or unreadable. */
const K_BACKUP = 'studento:backup';
/** Written by every save: its presence proves the app has stored data before. */
const K_INIT = 'studento:init';

/**
 * True only when what is in memory came from a successful read of the saved copy (or the store
 * is genuinely new). While false, nothing is ever written, so a failed read can never wipe
 * the student's saved settings.
 */
let trusted = false;

let state: State = {
  loaded: false,
  prefs: DEFAULT_PREFS,
  shared: EMPTY_SHARED,
  pending: {},
  personal: null,
  sync: { status: 'idle', at: null, error: null },
};

const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

/**
 * Which bells, class names and rooms apply. Three cases:
 * - no personal schedule: the shared Great Neck schedule + shared class names
 * - personal 'north': the same real bells, but this student's classes and rooms
 * - personal 'own': the student's own times (no shared custom days or switches)
 */
export function resolveSchedule(shared: Shared, personal: PersonalSchedule | null): { data: ScheduleData; names: Record<string, string>; details: Record<string, ClassDetail> } {
  const sharedData = { customDays: shared.customDays, override: shared.override, personal: null };
  if (!personal) return { data: sharedData, names: shared.classNames, details: shared.classDetails };
  if (personal.bells === 'north') {
    const details: Record<string, ClassDetail> = {};
    for (const [k, room] of Object.entries(personal.rooms ?? {})) if (room) details[k] = { room };
    return { data: sharedData, names: personal.classNames ?? {}, details };
  }
  return { data: { customDays: [], override: null, personal }, names: {}, details: {} };
}

export function scheduleData(s: State = state): ScheduleData {
  return resolveSchedule(s.shared, s.personal).data;
}

/** Class names and details that apply right now. */
export function namesFor(s: State = state): Record<string, string> {
  return resolveSchedule(s.shared, s.personal).names;
}
export function detailsFor(s: State = state): Record<string, ClassDetail> {
  return resolveSchedule(s.shared, s.personal).details;
}

/** Use (or clear) a personal schedule on this phone. */
export async function setPersonal(p: PersonalSchedule | null) {
  set({ personal: p, prefs: { ...state.prefs, onboarded: true } });
  await persist();
}

/** The schedule pieces a screen needs, read from stable store slices. */
export function useSchedule() {
  const shared = useStore((st) => st.shared);
  const personal = useStore((st) => st.personal);
  return { personal, ...resolveSchedule(shared, personal) };
}

async function persist() {
  if (!trusted) return; // never overwrite saved data with defaults we could not check
  try {
    await AsyncStorage.multiSet([
      [K_INIT, '1'],
      [K_PREFS, JSON.stringify(state.prefs)],
      [K_SHARED, JSON.stringify(state.shared)],
      [K_PENDING, JSON.stringify(state.pending)],
      [K_PERSONAL, JSON.stringify(state.personal)],
      [K_BACKUP, JSON.stringify({ prefs: state.prefs, shared: state.shared, personal: state.personal, at: Date.now() })],
    ]);
  } catch {
    // Storage full or unavailable: the app still runs from memory.
  }
}

/** Parse JSON, or null when it is missing/corrupt. */
function readJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Read everything saved on this phone. Returns true when the data is trustworthy (read fine, or a
 * brand-new install); false when the storage could not be read (for example a background task
 * while the phone is locked). In that case the app may run with defaults but nothing is saved.
 * Calling it again retries.
 */
export async function load(): Promise<boolean> {
  if (state.loaded && trusted) return true;
  for (let attempt = 0; attempt < 6; attempt++) {
    let m: Record<string, string | null> | null = null;
    try {
      m = Object.fromEntries(await AsyncStorage.multiGet([K_PREFS, K_SHARED, K_PENDING, K_PERSONAL, K_BACKUP, K_INIT]));
    } catch {
      m = null;
    }
    const kind = m ? classifyStorage(m, { prefs: K_PREFS, backup: K_BACKUP, init: K_INIT }) : 'unreadable';
    if (kind === 'unreadable') {
      if (attempt < 5) await sleep(400);
      continue;
    }
    const rows = m ?? {};
    const backup = readJson<{ prefs?: Partial<Prefs>; shared?: Shared; personal?: PersonalSchedule | null }>(rows[K_BACKUP]);
    // Prefer the main copy; fall back to the backup if it is missing or unreadable.
    const savedPrefs = readJson<Partial<Prefs>>(rows[K_PREFS]) ?? backup?.prefs ?? {};
    const savedShared = readJson<Shared>(rows[K_SHARED]) ?? backup?.shared ?? null;
    const savedPersonal = rows[K_PERSONAL] !== undefined && rows[K_PERSONAL] !== null ? readJson<PersonalSchedule | null>(rows[K_PERSONAL]) : (backup?.personal ?? null);
    const prefs: Prefs = { ...DEFAULT_PREFS, ...savedPrefs };
    // One-time default changes for installs saved before this version.
    const migrate = kind === 'ok' && (savedPrefs.prefsVersion ?? 1) < 2;
    if (migrate) {
      prefs.flashWarn = true;
      prefs.warnBuzz = true;
      prefs.prefsVersion = 2;
    }
    trusted = true;
    set({
      loaded: true,
      prefs,
      shared: { ...EMPTY_SHARED, ...(savedShared ?? {}) },
      pending: readJson<Record<string, unknown>>(rows[K_PENDING]) ?? {},
      personal: savedPersonal,
    } as Partial<State>);
    if (migrate) void persist();
    return true;
  }
  // Could not read the saved copy. Run with defaults so the app opens, but never save over it.
  trusted = false;
  set({ loaded: true });
  return false;
}

/** Write everything now (called when the app goes to the background). */
export function flushStore(): Promise<void> {
  return persist();
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  set({ prefs: { ...state.prefs, [key]: value } });
  void persist();
}

function today() {
  return nyParts(Date.now()).date;
}

let syncing: Promise<void> | null = null;

/** Push any unsent edits, then pull the latest shared data. Safe to call often. */
export function refresh(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    set({ sync: { ...state.sync, status: 'syncing' } });
    try {
      const p = state.pending;
      if (p.names) await api.saveClassNames(state.shared.classNames);
      if (p.details) await api.saveClassDetails(state.shared.classDetails);
      if (p.override) {
        const ov = state.shared.override;
        await api.saveOverride(ov && ov.date === today() ? ov.type : null);
      }
      const remote = await api.fetchAll();
      set({
        pending: {},
        shared: {
          classNames: remote.classNames,
          classDetails: remote.classDetails,
          customDays: remote.customDays,
          override: remote.overrideType ? { date: today(), type: remote.overrideType } : null,
        },
        sync: { status: 'ok', at: Date.now(), error: null },
      });
    } catch (e) {
      set({ sync: { status: 'offline', at: state.sync.at, error: e instanceof Error ? e.message : String(e) } });
    } finally {
      await persist();
      syncing = null;
    }
  })();
  return syncing;
}

/** Saved on this phone right away; sent to the server now or on the next sync. */
export async function setClassInfo(names: Record<string, string>, details: Record<string, ClassDetail>) {
  set({ shared: { ...state.shared, classNames: names, classDetails: details }, pending: { ...state.pending, names: true, details: true } });
  await persist();
  await refresh();
}

export async function setOverride(type: OverrideType | null) {
  set({
    shared: { ...state.shared, override: type ? { date: today(), type } : null },
    pending: { ...state.pending, override: true },
  });
  await persist();
  await refresh();
}

/** Custom days need the server (it assigns the id), so these report failure instead of queueing. */
export async function addCustomDay(day: { date: string; label: string; periods: Period[] }): Promise<string | null> {
  try {
    const res = await api.addCustomDay(day);
    if (!res.ok || !res.entry) return res.error ?? 'The server did not save it.';
    set({ shared: { ...state.shared, customDays: [...state.shared.customDays.filter((d) => d.id !== res.entry!.id), res.entry] } });
    await persist();
    return null;
  } catch (e) {
    return `Couldn't reach Studento's server (${e instanceof Error ? e.message : e}). Try again when you're online.`;
  }
}

export async function deleteCustomDay(id: string): Promise<string | null> {
  try {
    await api.deleteCustomDay(id);
    set({ shared: { ...state.shared, customDays: state.shared.customDays.filter((d) => d.id !== id) } });
    await persist();
    return null;
  } catch (e) {
    return `Couldn't reach Studento's server (${e instanceof Error ? e.message : e}). Try again when you're online.`;
  }
}

/** The student's classes: period ids in order plus their names (shared default or personal). */
export function useClasses(): { ids: string[]; names: Record<string, string> } {
  const shared = useStore((st) => st.shared);
  const personal = useStore((st) => st.personal);
  if (!personal) return { ids: PERIOD_IDS, names: shared.classNames };
  if (personal.bells === 'north') return { ids: PERIOD_IDS, names: personal.classNames ?? {} };
  const ids: string[] = [];
  const names: Record<string, string> = {};
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const) {
    for (const p of personal.days[day] ?? []) {
      if (!ids.includes(p.period)) {
        ids.push(p.period);
        names[p.period] = p.label;
      }
    }
  }
  return { ids, names };
}
