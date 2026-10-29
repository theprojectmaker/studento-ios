/**
 * Plans Studento's bell alerts as plain data, so the timing can be unit-tested
 * without a phone. src/lib/notify.ts hands the plan to expo-notifications.
 *
 * Only two kinds, both automatic: "Welcome to Period N" 3 minutes after a
 * period starts, and "Period N ends in 5 min" 5 minutes before it ends.
 * There is deliberately no broadcast, repeat or admin alert of any kind.
 */
import { addDays, fmtTime, nyParts, nyWallToMs, toMin } from './nytime';
import { nameFor, periodTitle, roomOf, scheduleFor, type Period, type ScheduleData } from './schedule';

export const START_DELAY_MIN = 3;
export const END_WARNING_MIN = 5;
/** iOS keeps at most 64 pending local notifications per app; leave room for the reminder. */
export const MAX_ALERTS = 48;

export interface AlertPrefs {
  welcome: boolean;
  endWarning: boolean;
  /** Minutes before the bell for the end warning (default 5). */
  warnMin?: number;
}

export interface ClassDetail {
  room?: string;
  note?: string;
}

export interface PlannedAlert {
  id: string;
  at: number;
  title: string;
  body: string;
  kind: 'start' | 'end' | 'reminder';
}

function addMin(hhmm: string, delta: number): string {
  const t = toMin(hhmm) + delta;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function planAlerts(
  nowMs: number,
  data: ScheduleData,
  names: Record<string, string>,
  details: Record<string, ClassDetail>,
  prefs: AlertPrefs,
  opts: { h24?: boolean; days?: number; max?: number } = {}
): PlannedAlert[] {
  const max = opts.max ?? MAX_ALERTS;
  const days = opts.days ?? 21;
  const out: PlannedAlert[] = [];
  if (!prefs.welcome && !prefs.endWarning) return out;

  const warn = prefs.warnMin && prefs.warnMin > 0 ? Math.round(prefs.warnMin) : END_WARNING_MIN;
  const today = nyParts(nowMs).date;
  let lastCoveredDay: string | null = null;
  let truncated = false;

  for (let i = 0; i < days && !truncated; i++) {
    const date = addDays(today, i);
    const day = scheduleFor(date, data);
    if (!day.isSchoolDay) continue;
    const list = day.periods;
    const dayAlerts: PlannedAlert[] = [];
    list.forEach((p, idx) => {
      const next: Period | undefined = list[idx + 1];
      const name = nameFor(p, names);
      const title = periodTitle(p);
      const room = roomOf(p, details);
      const range = `${fmtTime(p.start, opts.h24)} – ${fmtTime(p.end, opts.h24)}`;
      if (prefs.welcome) {
        const at = nyWallToMs(date, addMin(p.start, START_DELAY_MIN));
        const bits = [name !== title ? name : null, range, room ? `Room ${room}` : null].filter(Boolean);
        dayAlerts.push({ id: `bell-${date}-${idx}-start`, at, kind: 'start', title: `Welcome to ${title}`, body: bits.join(' · ') });
      }
      if (prefs.endWarning) {
        const at = nyWallToMs(date, addMin(p.end, -warn));
        const body = next
          ? `Bell at ${fmtTime(p.end, opts.h24)} · Next: ${nameFor(next, names)}`
          : `Last bell at ${fmtTime(p.end, opts.h24)}. Almost done for the day.`;
        dayAlerts.push({ id: `bell-${date}-${idx}-end`, at, kind: 'end', title: `${title} ends in ${warn} min`, body });
      }
    });
    dayAlerts.sort((a, b) => a.at - b.at);
    const future = dayAlerts.filter((a) => a.at > nowMs);
    // Only whole days, so a day is never half-covered.
    if (out.length + future.length > max) {
      truncated = true;
      break;
    }
    out.push(...future);
    lastCoveredDay = date;
  }

  // One quiet note on the first school morning we could not cover, so the
  // student knows to open the app. It is replaced every time the app plans again.
  if (truncated && lastCoveredDay) {
    for (let i = 1; i <= 14; i++) {
      const date = addDays(lastCoveredDay, i);
      const day = scheduleFor(date, data);
      if (!day.isSchoolDay || !day.periods.length) continue;
      const at = nyWallToMs(date, addMin(day.periods[0].start, -15));
      out.push({
        id: `bell-${date}-reminder`,
        at,
        kind: 'reminder',
        title: 'Open Studento to keep bell alerts on',
        body: 'Alerts are set a few days ahead. Opening the app sets the next ones.',
      });
      break;
    }
  }
  return out;
}

