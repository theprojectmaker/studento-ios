/**
 * America/New_York wall-clock math without Intl, so it behaves the same on
 * Hermes, Node and the web. US rule since 2007: DST starts the second Sunday of
 * March at 02:00 local (EST) and ends the first Sunday of November at 02:00
 * local (EDT).
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** UTC ms of the nth Sunday (1-based) of a month, at 00:00 UTC. */
function nthSundayUtc(year: number, month: number, n: number): number {
  const first = Date.UTC(year, month, 1);
  const dow = new Date(first).getUTCDay();
  return first + (((7 - dow) % 7) + (n - 1) * 7) * DAY;
}

/** True when `ms` (a real instant) is in Eastern Daylight Time. */
export function isNyDst(ms: number): boolean {
  const year = new Date(ms - 5 * HOUR).getUTCFullYear();
  // 02:00 EST = 07:00 UTC; 02:00 EDT = 06:00 UTC.
  const start = nthSundayUtc(year, 2, 2) + 7 * HOUR;
  const end = nthSundayUtc(year, 10, 1) + 6 * HOUR;
  return ms >= start && ms < end;
}

/** Offset of New York from UTC in hours (-4 or -5) at the instant `ms`. */
export function nyOffsetHours(ms: number): number {
  return isNyDst(ms) ? -4 : -5;
}

export interface NyParts {
  /** "YYYY-MM-DD" */
  date: string;
  weekday: Weekday;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  /** Seconds since local midnight (with fraction). */
  secOfDay: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function nyParts(ms: number): NyParts {
  const local = new Date(ms + nyOffsetHours(ms) * HOUR);
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  const second = local.getUTCSeconds();
  const milli = local.getUTCMilliseconds();
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    weekday: WEEKDAYS[local.getUTCDay()],
    hour,
    minute,
    second,
    ms: milli,
    secOfDay: hour * 3600 + minute * 60 + second + milli / 1000,
  };
}

/** "HH:MM" -> minutes since midnight. */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * The real instant for New York wall-clock `hhmm` on `date` ("YYYY-MM-DD").
 * Bell times never fall in the 2-3 AM DST gap, but it is handled anyway
 * (a nonexistent time resolves one hour later, like a phone clock would).
 */
export function nyWallToMs(date: string, hhmm: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, mo - 1, d) + toMin(hhmm) * 60_000;
  const guess = wall + 5 * HOUR; // assume EST first
  const off = nyOffsetHours(guess);
  const ms = wall - off * HOUR;
  // If applying the EDT offset lands us back in EST (spring-forward gap), keep the EST reading.
  return nyOffsetHours(ms) === off ? ms : guess;
}

/** Add whole days to a "YYYY-MM-DD" string. */
export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d) + n * DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(date: string): Weekday {
  const [y, mo, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
}

/** "13:05" -> "1:05 PM" (or "13:05" with 24h). */
export function fmtTime(hhmm: string, h24 = false): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (h24) return `${pad(h)}:${pad(m)}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-10-19" -> "Monday, October 19" */
export function fmtDate(date: string): string {
  const [, mo, d] = date.split('-').map(Number);
  return `${DAY_NAMES[WEEKDAYS.indexOf(weekdayOf(date))]}, ${MONTHS[mo - 1]} ${d}`;
}
