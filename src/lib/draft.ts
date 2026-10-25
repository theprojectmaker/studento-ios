/**
 * The schedule being set up (parsed from a scan or typed text, or the current personal one), handed
 * from the scan/type screen to the review screen without stuffing it in a URL.
 */
import type { AiSchedule } from './scheduleParser';
import type { PersonalSchedule, SchoolDay } from './schedule';

export const SCHOOL_DAYS: SchoolDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** Parsed rows -> the app schedule shape (class name in the label, room on the period). */
export function toPersonal(ai: AiSchedule): PersonalSchedule {
  const days = {} as PersonalSchedule['days'];
  for (const d of SCHOOL_DAYS) {
    days[d] = (ai.days[d] ?? []).map((r) => ({
      period: r.period || r.name.toLowerCase().slice(0, 12),
      label: r.name || (/^\d+$/.test(r.period) ? `Period ${r.period}` : r.period),
      start: r.start,
      end: r.end,
      room: r.room || undefined,
    }));
  }
  // Default to Great Neck North's real bells with these classes; the review
  // screen can switch to the times from the photo when there are any.
  return { name: ai.name || 'My schedule', bells: 'north', days, classNames: ai.classes ?? {}, rooms: ai.rooms ?? {} };
}

let draft: PersonalSchedule | null = null;

export function setDraft(d: PersonalSchedule | null) {
  draft = d;
}

export function getDraft(): PersonalSchedule | null {
  return draft;
}
