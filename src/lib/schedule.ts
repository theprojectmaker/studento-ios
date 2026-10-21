/**
 * Studento's bell schedules (copied from tests/period-notify/src/schedule.js)
 * and the logic that picks the schedule for a day and works out "right now".
 * All times are New York wall-clock "HH:MM", 24h.
 */
import { addDays, fmtTime, nyParts, nyWallToMs, toMin, weekdayOf, type Weekday } from './nytime';

export interface Period {
  period: string;
  label: string;
  start: string;
  end: string;
  /** Room, for personal schedules (shared ones keep rooms in classDetails). */
  room?: string;
}

export type SchoolDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

/** A student's own schedule (read by the AI or typed in), kept on their phone. */
export interface PersonalSchedule {
  name: string;
  /**
   * 'north' = keep Great Neck North's real bells (Regular, Wednesday Advisory,
   * assemblies, custom days) and just use this student's classes and rooms.
   * 'own' (default for older saves) = the student's own times in `days`.
   */
  bells?: 'north' | 'own';
  days: Record<SchoolDay, Period[]>;
  /** Period id -> class name (north mode). */
  classNames?: Record<string, string>;
  /** Period id -> room (north mode). */
  rooms?: Record<string, string>;
}

export interface CustomDay {
  id: string;
  date: string;
  label: string;
  periods: Period[];
}

export type OverrideType = 'assembly' | 'custom';
/** A shared "today only" switch; ignored on any other date. */
export interface Override {
  date: string;
  type: OverrideType;
}

export interface ScheduleData {
  customDays: CustomDay[];
  override: Override | null;
  /** When set, this replaces the built-in bell schedules entirely. */
  personal?: PersonalSchedule | null;
}

export const REGULAR_SCHEDULE: Period[] = [
  { period: '1', label: 'Period 1', start: '08:00', end: '08:41' },
  { period: '2', label: 'Period 2', start: '08:44', end: '09:25' },
  { period: '3', label: 'Period 3', start: '09:28', end: '10:09' },
  { period: '4', label: 'Period 4', start: '10:12', end: '10:53' },
  { period: '5', label: 'Period 5', start: '10:56', end: '11:37' },
  { period: '6', label: 'Period 6', start: '11:40', end: '12:21' },
  { period: '7', label: 'Period 7', start: '12:24', end: '13:05' },
  { period: '8', label: 'Period 8', start: '13:08', end: '13:49' },
  { period: '9', label: 'Period 9', start: '13:52', end: '14:33' },
];

export const WEDNESDAY_SCHEDULE: Period[] = [
  { period: 'advisory', label: 'Advisory', start: '08:00', end: '08:33' },
  { period: '1', label: 'Period 1', start: '08:36', end: '09:13' },
  { period: '2', label: 'Period 2', start: '09:16', end: '09:53' },
  { period: '3', label: 'Period 3', start: '09:56', end: '10:33' },
  { period: '4', label: 'Period 4', start: '10:36', end: '11:13' },
  { period: '5', label: 'Period 5', start: '11:16', end: '11:53' },
  { period: '6', label: 'Period 6', start: '11:56', end: '12:33' },
  { period: '7', label: 'Period 7', start: '12:36', end: '13:13' },
  { period: '8', label: 'Period 8', start: '13:16', end: '13:53' },
  { period: '9', label: 'Period 9', start: '13:56', end: '14:33' },
];

export const ASSEMBLY_SCHEDULE: Period[] = [
  { period: '1', label: 'Period 1', start: '08:00', end: '08:36' },
  { period: '2', label: 'Period 2', start: '08:39', end: '09:15' },
  { period: '3', label: 'Period 3', start: '09:18', end: '09:57' },
  { period: '3', label: 'Period 3', start: '10:00', end: '10:39' },
  { period: '4', label: 'Period 4', start: '10:42', end: '11:18' },
  { period: '5', label: 'Period 5', start: '11:21', end: '11:57' },
  { period: '6', label: 'Period 6', start: '12:00', end: '12:36' },
  { period: '7', label: 'Period 7', start: '12:39', end: '13:15' },
  { period: '8', label: 'Period 8', start: '13:18', end: '13:54' },
  { period: '9', label: 'Period 9', start: '13:57', end: '14:33' },
];

export const CUSTOM_SCHEDULE: Period[] = [
  { period: 'advisory', label: 'Advisory', start: '08:00', end: '08:30' },
  { period: '1', label: 'Period 1', start: '08:33', end: '09:05' },
  { period: '2', label: 'Period 2', start: '09:08', end: '09:40' },
  { period: '3', label: 'Period 3', start: '09:43', end: '10:15' },
  { period: '4', label: 'Period 4', start: '10:18', end: '10:54' },
  { period: '5', label: 'Period 5', start: '10:57', end: '11:33' },
  { period: '6', label: 'Period 6', start: '11:36', end: '12:12' },
  { period: '7', label: 'Period 7', start: '12:15', end: '12:51' },
  { period: '8', label: 'Period 8', start: '12:54', end: '13:24' },
  { period: '8', label: 'Period 8', start: '13:27', end: '13:57' },
  { period: '9', label: 'Period 9', start: '14:00', end: '14:33' },
];

/** Period ids a student can name, in display order. */
export const PERIOD_IDS = ['advisory', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface DaySchedule {
  date: string;
  weekday: Weekday;
  periods: Period[];
  /** "Regular", "Wednesday Advisory", "Assembly", "Custom", a custom day's label, or "Weekend". */
  kind: string;
  isSchoolDay: boolean;
}

/** Which schedule runs on `date`. A dated custom day wins, then today's override, then the weekday. */
export function scheduleFor(date: string, data: ScheduleData): DaySchedule {
  const weekday = weekdayOf(date);
  if (data.personal) {
    const list = weekday === 'Sat' || weekday === 'Sun' ? [] : (data.personal.days[weekday as SchoolDay] ?? []);
    return { date, weekday, periods: sortPeriods(list), kind: list.length ? data.personal.name || 'My schedule' : 'Weekend', isSchoolDay: list.length > 0 };
  }
  const dated = data.customDays.find((d) => d.date === date);
  if (dated && dated.periods.length) {
    return { date, weekday, periods: sortPeriods(dated.periods), kind: dated.label || 'Custom day', isSchoolDay: true };
  }
  if (weekday === 'Sat' || weekday === 'Sun') {
    return { date, weekday, periods: [], kind: 'Weekend', isSchoolDay: false };
  }
  const ov = data.override && data.override.date === date ? data.override.type : null;
  if (ov === 'assembly') return { date, weekday, periods: ASSEMBLY_SCHEDULE, kind: 'Assembly', isSchoolDay: true };
  if (ov === 'custom') return { date, weekday, periods: CUSTOM_SCHEDULE, kind: 'Custom', isSchoolDay: true };
  if (weekday === 'Wed') return { date, weekday, periods: WEDNESDAY_SCHEDULE, kind: 'Wednesday Advisory', isSchoolDay: true };
  return { date, weekday, periods: REGULAR_SCHEDULE, kind: 'Regular', isSchoolDay: true };
}

export function sortPeriods(list: Period[]): Period[] {
  return [...list].sort((a, b) => toMin(a.start) - toMin(b.start));
}

export type Phase = 'class' | 'passing' | 'before' | 'after' | 'off';

export interface NowState {
  phase: Phase;
  date: string;
  /** Seconds since NY midnight. */
  secOfDay: number;
  day: DaySchedule;
  current: Period | null;
  next: Period | null;
  /** Index of `current` in day.periods, else -1. */
  currentIndex: number;
  /** Seconds until the next bell (end of class, or start of the next one). 0 when nothing is ahead today. */
  secondsLeft: number;
  /** 0..1 through the current period (class) or the gap (passing). */
  progress: number;
  /** For off/after: the next school day (looks up to 14 days ahead). */
  nextSchoolDay: DaySchedule | null;
}

export function nowState(ms: number, data: ScheduleData): NowState {
  const p = nyParts(ms);
  const day = scheduleFor(p.date, data);
  const sec = p.secOfDay;
  const list = day.periods;
  let currentIndex = -1;
  for (let i = 0; i < list.length; i++) {
    if (sec >= toMin(list[i].start) * 60 && sec < toMin(list[i].end) * 60) currentIndex = i;
  }
  const current = currentIndex >= 0 ? list[currentIndex] : null;
  const next = list.find((x) => toMin(x.start) * 60 > sec) ?? null;
  const base = { date: p.date, secOfDay: sec, day, current, next, currentIndex };

  if (current) {
    const s = toMin(current.start) * 60;
    const e = toMin(current.end) * 60;
    return { ...base, phase: 'class', secondsLeft: e - sec, progress: (sec - s) / (e - s), nextSchoolDay: null };
  }
  if (next) {
    const startNext = toMin(next.start) * 60;
    const prev = [...list].reverse().find((x) => toMin(x.end) * 60 <= sec);
    if (!prev) return { ...base, phase: 'before', secondsLeft: startNext - sec, progress: 0, nextSchoolDay: null };
    const prevEnd = toMin(prev.end) * 60;
    return {
      ...base,
      phase: 'passing',
      secondsLeft: startNext - sec,
      progress: (sec - prevEnd) / Math.max(1, startNext - prevEnd),
      nextSchoolDay: null,
    };
  }
  let nextSchoolDay: DaySchedule | null = null;
  for (let i = 1; i <= 14 && !nextSchoolDay; i++) {
    const d = scheduleFor(addDays(p.date, i), data);
    if (d.isSchoolDay && d.periods.length) nextSchoolDay = d;
  }
  return {
    ...base,
    phase: day.isSchoolDay && list.length ? 'after' : 'off',
    secondsLeft: 0,
    progress: 1,
    nextSchoolDay,
  };
}

/** Room for a period: its own (personal schedules) or the shared class details. */
export function roomOf(p: Period, details: Record<string, { room?: string }>): string {
  return (p.room || details[p.period]?.room || '').trim();
}

/** Class name for a period, falling back to its label. */
export function nameFor(p: Period, names: Record<string, string>): string {
  return (names[p.period] || '').trim() || p.label;
}

/** "Period 3" / "Advisory" — the period's own label, independent of class names. */
export function periodTitle(p: Period): string {
  if (p.period === 'advisory') return 'Advisory';
  return /^\d+$/.test(p.period) ? `Period ${p.period}` : p.label || p.period;
}

/** "12:05" (m:ss) or "1:02:05" for long gaps. */
export function fmtCountdown(totalSec: number, withSeconds = true): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (!withSeconds) {
    const mins = Math.ceil(s / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}`;
  }
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function rangeText(p: Period, h24 = false): string {
  return `${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}`;
}

/** Real instant of a period boundary. */
export function bellMs(date: string, hhmm: string): number {
  return nyWallToMs(date, hhmm);
}

/** Validate an edited period list; returns an error message or null. */
export function validatePeriods(list: Period[]): string | null {
  if (!list.length) return 'Add at least one period.';
  for (const p of list) {
    if (!p.period.trim()) return 'Every row needs a period.';
    if (!/^\d{2}:\d{2}$/.test(p.start) || !/^\d{2}:\d{2}$/.test(p.end)) return 'Times must look like 08:00.';
    if (toMin(p.end) <= toMin(p.start)) return `${periodTitle(p)} ends before it starts.`;
  }
  const sorted = sortPeriods(list);
  for (let i = 1; i < sorted.length; i++) {
    if (toMin(sorted[i].start) < toMin(sorted[i - 1].end)) return `${periodTitle(sorted[i - 1])} and ${periodTitle(sorted[i])} overlap.`;
  }
  return null;
}
