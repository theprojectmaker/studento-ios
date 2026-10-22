/**
 * Pure data for the widget and Live Activity: what to show at each moment.
 * The widget gets a timeline (one entry per bell, for the next couple of days)
 * so it keeps switching periods on its own; the countdown inside each entry
 * ticks natively from start/end. No app code runs in the widget.
 */
import type { ClassDetail } from './alerts';
import { addDays, fmtDate, fmtTime, nyParts, nyWallToMs, toMin } from './nytime';
import { nameFor, nowState, periodTitle, roomOf, scheduleFor, type NowState, type ScheduleData } from './schedule';
import type { Theme } from './themes';
import type { BellProps } from '../widgets/layouts';

export interface WidgetEntry {
  at: number;
  props: BellProps;
}

const colors = (t: Theme) => ({ bg: t.bg, bg2: mixHex(t.bg, t.accent, t.light ? 0.16 : 0.24), onAccent: onColor(t.accent), ink: t.ink, muted: t.muted, accent: t.accent });

function hexRgb(c: string): [number, number, number] {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/** Mixes two hex colors (kept local: the themes module pulls in font files). */
function mixHex(a: string, b: string, t: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

const onColor = (c: string) => {
  const [r, g, b] = hexRgb(c).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#111111' : '#ffffff';
};

/** Props for the Focus timer Live Activity (same layout as the class countdown). */
export function focusProps(theme: Theme, mode: 'focus' | 'break', start: number, end: number): BellProps {
  const base = bellProps(nowState(Date.now(), { customDays: [], override: null, personal: null }), {}, {}, theme, false, Date.now(), Date.now());
  return {
    ...base,
    mode: 'class',
    title: mode === 'focus' ? 'Focus' : 'Break',
    label: mode === 'focus' ? 'Stay with one thing' : 'Stretch, drink water',
    short: mode === 'focus' ? 'Focus' : 'Break',
    start,
    end,
    next: '',
    ends: '',
  };
}

/** Number style for the Lock Screen / Dynamic Island: monospaced for sign-style themes, serif for the fancy ones. */
function designFor(t: Theme): string {
  if (t.engine === 'led' || t.engine === 'lcd' || t.engine === 'nixie') return 'monospaced';
  if (t.engine === 'deco' || t.font === 'serif') return 'serif';
  return 'rounded';
}

/** The Dynamic Island is always black: light themes use white ink, dark themes keep theirs. */
const island = (t: Theme) => ({ islandInk: t.light ? '#ffffff' : t.ink, islandMuted: t.light ? 'rgba(255,255,255,0.6)' : t.muted });

function shortName(p: { period: string }, name: string): string {
  if (p.period === 'advisory') return 'Adv';
  if (/^\d+$/.test(p.period)) return 'P' + p.period;
  return name.slice(0, 6);
}

/** Props for one moment. `realNow` maps the (possibly test-mode) clock onto real time for the timers. */
export function bellProps(st: NowState, names: Record<string, string>, details: Record<string, ClassDetail>, theme: Theme, h24: boolean, realNow: number, clockNow: number): BellProps {
  const shift = realNow - clockNow;
  const day = `${st.day.weekday} · ${st.day.isSchoolDay ? st.day.kind.replace(' schedule', '').replace('Wednesday Advisory', 'Advisory') : 'No school'}`;
  const later = st.day.periods.filter((p) => toMin(p.start) * 60 > st.secOfDay);
  const upcoming = later.map((p) => `${fmtTime(p.start, h24)} ${nameFor(p, names)}`);
  // A live clock is always available (the off-hours widget and the Clock widget use it): a timer
  // counting up from midnight/noon shows the time of day, and ticks natively.
  const np = nyParts(clockNow);
  let clockFrom = nyWallToMs(np.date, h24 ? '00:00' : np.hour >= 12 ? '12:00' : '00:00') + shift;
  if (!h24 && np.hour % 12 === 0) clockFrom -= 12 * 3600_000; // 12:xx reads 12, not 0
  const rows = st.day.periods.map((p) => `${fmtTime(p.start, h24)}  ${nameFor(p, names)}`);
  const nxtIdx = st.next ? st.day.periods.indexOf(st.next) : -1;
  const base = {
    ...colors(theme),
    ...island(theme),
    design: designFor(theme),
    day,
    upcoming,
    clockFrom,
    ampm: h24 ? '' : np.hour < 12 ? 'AM' : 'PM',
    short: '',
    ends: '',
    rows,
    cur: st.phase === 'class' ? st.currentIndex : -1,
    nxt: nxtIdx,
    date: fmtDate(st.date),
  };

  if (st.phase === 'class' && st.current) {
    const p = st.current;
    const room = roomOf(p, details);
    const after = st.day.periods[st.currentIndex + 1];
    return {
      ...base,
      mode: 'class',
      short: shortName(p, nameFor(p, names)),
      ends: `Ends ${fmtTime(p.end, h24)}`,
      title: nameFor(p, names),
      label: [periodTitle(p), room ? `Room ${room}` : null].filter(Boolean).join(' · '),
      start: nyWallToMs(st.date, p.start) + shift,
      end: nyWallToMs(st.date, p.end) + shift,
      next: after ? `Next: ${nameFor(after, names)} ${fmtTime(after.start, h24)}` : 'Last class today',
    };
  }
  if ((st.phase === 'passing' || st.phase === 'before') && st.next) {
    const p = st.next;
    const prev = [...st.day.periods].reverse().find((x) => toMin(x.end) * 60 <= st.secOfDay);
    return {
      ...base,
      mode: st.phase,
      short: shortName(p, nameFor(p, names)),
      title: nameFor(p, names),
      label: st.phase === 'passing' ? `Passing · ${periodTitle(p)} next` : `School starts · ${periodTitle(p)}`,
      start: prev ? nyWallToMs(st.date, prev.end) + shift : realNow,
      end: nyWallToMs(st.date, p.start) + shift,
      next: `Starts ${fmtTime(p.start, h24)}`,
    };
  }
  const nd = st.nextSchoolDay;
  return {
    ...base,
    mode: 'off',
    title: st.phase === 'after' ? 'Done for today' : 'No school today',
    label: nd ? `Next: ${fmtDate(nd.date).replace(/,.*$/, '')}` : 'Studento',
    start: 0,
    end: 0,
    next: nd && nd.periods[0] ? `First bell ${fmtTime(nd.periods[0].start, h24)}` : '',
  };
}

/**
 * A widget timeline: an entry now, then one at every bell for the next `days`
 * days (at most `max` entries, which keeps the shared storage small).
 */
export function widgetTimeline(nowMs: number, data: ScheduleData, names: Record<string, string>, details: Record<string, ClassDetail>, theme: Theme, h24: boolean, days = 3, max = 90): WidgetEntry[] {
  const at = new Set<number>([nowMs]);
  const today = nyParts(nowMs).date;
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const d = scheduleFor(date, data);
    for (const p of d.periods) {
      for (const t of [nyWallToMs(date, p.start), nyWallToMs(date, p.end)]) if (t > nowMs) at.add(t);
    }
    // The off-hours clock changes its anchor at midnight, 1 AM, noon and 1 PM.
    for (const hm of ['00:00', '01:00', '12:00', '13:00']) {
      const t = nyWallToMs(date, hm);
      if (t > nowMs) at.add(t);
    }
    // A morning entry so "Done for today" turns into the new day's view.
    const morning = nyWallToMs(date, '05:00');
    if (morning > nowMs) at.add(morning);
  }
  return [...at]
    .sort((a, b) => a - b)
    .slice(0, max)
    .map((t) => ({ at: t, props: bellProps(nowState(t + 500, data), names, details, theme, h24, t, t) }));
}
