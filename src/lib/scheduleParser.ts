/**
 * Reads a student's schedule from plain text, entirely on the phone: the lines that
 * on-device text recognition pulled out of a photo, or what the student typed.
 * No server, no AI. Understands the common shapes:
 *
 *   Period 1  Algebra  8:00-8:41  Room 112      P3 Biology Lab B
 *   1 Math 204                                   3rd period: Spanish rm 204
 *   Advisory  Homeroom  115                      Lunch 10:12-10:53
 *   Wednesday            (a day header: rows after it apply to that day only)
 *   Math / English / Bio (a plain list with no numbers: periods 1, 2, 3...)
 *
 * Photos often come out of OCR one column at a time ("Period 3" on one line, "Spanish"
 * on the next, "204" on the one after), so a period marker with no class name waits for
 * the next line, and a line that is only a time or only a room joins the row before it.
 */
import { parseTime } from './timeinput';

export interface AiRow {
  period: string;
  name: string;
  start: string;
  end: string;
  room: string;
}
export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
export interface AiSchedule {
  name: string;
  days: Record<DayKey, AiRow[]>;
  /** Period id -> class, even when the schedule shows no times. */
  classes?: Record<string, string>;
  rooms?: Record<string, string>;
  hasTimes?: boolean;
}

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_HEADER = /^(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday)\s*[:.-]?\s*$/i;
const TIME = String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?`;
const RANGE = new RegExp(String.raw`(${TIME})\s*(?:-|–|—|to)\s*(${TIME})`, 'i');
const PERIOD_AT_START = /^(?:period|per\.?|pd\.?|p)\s*#?\s*(\d{1,2})\b[\s:.)-]*/i;
const NUMBER_AT_START = /^(\d{1,2})(?:st|nd|rd|th)?\s*(?:period|per\.?|pd\.?)?\b[\s:.)-]*/i;
const PERIOD_ANYWHERE = /\b(?:period|per\.?|pd\.?)\s*#?\s*(\d{1,2})\b/i;
const ADVISORY = /^(?:advisory|homeroom|home\s*room|hr|adv)\b[\s:.)-]*/i;
const LUNCH = /^lunch\b[\s:.)-]*/i;
const ROOM = /\b(?:rm\.?|room)\s*#?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\b/i;
const ROOM_WORD = /\b(lab\s*[A-Za-z0-9]{1,3}|gym|library|cafeteria|auditorium|cafe)\b/i;
const ROOM_TAIL = /(?:^|\s)([A-Z]?\d{3}[A-Z]?)\s*$/;
const HEADER_WORDS = /^(?:student|schedule|name|grade|teacher|room|rooms|period|periods|time|times|class|classes|course|courses|day|days|semester|year|fall|spring)\b[\s:]*$/i;
/** "Name: Sam", "Grade: 10", "Teacher: Ms. Lee": a label with a value, never a class. */
const LABELLED = /^(?:name|student|teacher|grade|school|date|year|semester|term|id|counselor|homeroom teacher)\s*[:：]\s*\S/i;
/** A line that is nothing but a room: "204", "B12", "Rm 118", "Lab B". */
const ROOM_ONLY = /^(?:(?:rm\.?|room)\s*#?\s*)?[A-Za-z]?\d{3}[A-Za-z]?$|^(?:rm\.?|room)\s*#?\s*[A-Za-z]?\d{1,4}[A-Za-z]?$|^lab\s*[A-Za-z0-9]{1,3}$/i;
const JUNK = /^[\s|•·*_=~\-–—.]*$/;

function cleanName(s: string): string {
  return s
    .replace(/\b(?:teacher|mr|mrs|ms|dr)\.?\s*[A-Z][a-z]+\b/g, ' ')
    .replace(/[|•·*_=~]+/g, ' ')
    .replace(/^[\s:.)\-–—]+|[\s:.)\-–—,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanRoom(s: string): string {
  return s.replace(/^(?:rm\.?|room)\s*#?\s*/i, '').trim().slice(0, 20);
}

interface Draft {
  period: string | null;
  name: string;
  start: string;
  end: string;
  room: string;
}

/** Pull period, times, room and name out of one line. */
function parseLine(raw: string): Draft | null {
  let s = raw.replace(/\t/g, ' ').replace(/[–—]/g, '-').trim();
  if (!s || JUNK.test(s) || HEADER_WORDS.test(s) || LABELLED.test(s)) return null;
  const d: Draft = { period: null, name: '', start: '', end: '', room: '' };
  // A whole line that is only a room (OCR often puts the room column on its own line).
  if (ROOM_ONLY.test(s)) {
    d.room = cleanRoom(s);
    return d;
  }

  const m = s.match(RANGE);
  if (m) {
    const a = parseTime(m[1].replace(/\s+/g, ''));
    const b = parseTime(m[2].replace(/\s+/g, ''));
    if (a && b) {
      d.start = a;
      d.end = b;
    }
    s = s.replace(m[0], ' ');
  }

  let p = s.match(PERIOD_AT_START) || s.match(NUMBER_AT_START);
  if (p) {
    d.period = String(Number(p[1]));
    s = s.slice(p[0].length);
  } else if ((p = s.match(ADVISORY))) {
    d.period = 'advisory';
    s = s.slice(p[0].length);
  } else if ((p = s.match(LUNCH))) {
    d.period = 'lunch';
    s = s.slice(p[0].length);
  } else if ((p = s.match(PERIOD_ANYWHERE))) {
    d.period = String(Number(p[1]));
    s = s.replace(p[0], ' ');
  }

  let r = s.match(ROOM);
  if (r) {
    d.room = cleanRoom(r[1]);
    s = s.replace(r[0], ' ');
  } else if ((r = s.match(ROOM_WORD)) && cleanName(s.replace(r[0], '')).length > 0) {
    // "Biology Lab B" -> room "Lab B"; but "Gym" alone is the class, not a room.
    d.room = r[1].replace(/\s+/g, ' ');
    s = s.replace(r[0], ' ');
  } else if ((r = s.match(ROOM_TAIL)) && cleanName(s.replace(r[0], '')).length > 0) {
    d.room = r[1];
    s = s.replace(r[0], ' ');
  }

  d.name = cleanName(s);
  if (d.period === 'lunch' && !d.name) d.name = 'Lunch';
  if (d.period === 'advisory' && !d.name) d.name = 'Advisory';
  return d;
}

/** Parse the whole text into the same shape the old server returned. */
export function parseScheduleText(text: string): AiSchedule {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const regular: Draft[] = [];
  const perDay: Partial<Record<DayKey, Draft[]>> = {};
  let bucket: Draft[] = regular;
  let pending: Draft | null = null; // a period marker waiting for its class name (OCR columns)

  const flush = () => {
    if (pending && (pending.name || pending.start)) bucket.push(pending);
    pending = null;
  };

  for (const line of lines) {
    const h = line.match(DAY_HEADER);
    if (h) {
      flush();
      const key = (h[1].slice(0, 3).charAt(0).toUpperCase() + h[1].slice(1, 3).toLowerCase()) as DayKey;
      if (DAYS.includes(key)) {
        perDay[key] = perDay[key] ?? [];
        bucket = perDay[key]!;
      }
      continue;
    }
    const d = parseLine(line);
    if (!d) continue;
    const timeOnly = d.start && !d.name && d.period === null && !d.room;
    const roomOnly = d.room && !d.name && d.period === null && !d.start;
    const nameOnly = d.name && d.period === null && !d.start && !d.room;
    const last = pending ?? bucket[bucket.length - 1];

    if (timeOnly && last && !last.start) {
      last.start = d.start;
      last.end = d.end;
      continue;
    }
    if (roomOnly && last && !last.room) {
      last.room = d.room;
      continue;
    }
    if (nameOnly && pending && !pending.name) {
      pending.name = d.name;
      continue;
    }
    flush();
    if (d.period !== null && !d.name) {
      pending = d; // wait for the class name on the next line
      continue;
    }
    if (d.period === null && !d.name) continue;
    bucket.push(d);
  }
  flush();

  // A plain list with no period numbers at all: number the classes in order.
  const anyMarker = [regular, ...Object.values(perDay)].some((rows) => rows!.some((r) => r.period !== null));
  const finish = (rows: Draft[]): AiRow[] => {
    let n = 0;
    return rows
      .filter((r) => r.name || r.start)
      .map((r) => {
        const period = r.period ?? (anyMarker ? '' : String(++n));
        return { period, name: r.name.slice(0, 60), start: r.start, end: r.end, room: r.room.slice(0, 20) };
      })
      .filter((r) => r.period || r.name);
  };

  const baseRows = finish(regular);
  const days = {} as Record<DayKey, AiRow[]>;
  for (const k of DAYS) days[k] = perDay[k] ? finish(perDay[k]!) : baseRows;
  // Only rows with real times go into the per-day timetable; classes/rooms come from everything.
  for (const k of DAYS) days[k] = days[k].filter((r) => r.start && r.end && r.end > r.start).sort((a, b) => a.start.localeCompare(b.start));

  const classes: Record<string, string> = {};
  const rooms: Record<string, string> = {};
  for (const rows of [baseRows, ...DAYS.map((k) => (perDay[k] ? finish(perDay[k]!) : []))]) {
    for (const r of rows) {
      if (!r.period || !r.name || /^period \d+$/i.test(r.name)) continue;
      if (!classes[r.period]) classes[r.period] = r.name;
      if (r.room && !rooms[r.period]) rooms[r.period] = r.room;
    }
  }
  const hasTimes = DAYS.some((k) => days[k].length > 0);
  return { name: 'My schedule', days, classes, rooms, hasTimes };
}

/** True when the text gave us at least one usable class or timed row. */
export function parsedSomething(s: AiSchedule): boolean {
  return Object.keys(s.classes ?? {}).length > 0 || !!s.hasTimes;
}
