/** Small pure helpers shared by the Grades and Planner screens (unit-tested, no React Native). */
import { addDays } from './nytime';
import { scheduleFor, type ScheduleData } from './schedule';

/**
 * Percent needed on a final worth `finalPct` of the grade to end at `target`,
 * given the current `average`. 92 now, final worth 20%, want 90 -> 82.
 */
export function neededOnFinal(average: number, finalPct: number, target: number): number {
  const w = Math.min(100, Math.max(1, finalPct)) / 100;
  return Math.round(((target - average * (1 - w)) / w) * 100) / 100;
}

/** School days from tomorrow up to and including `date` (weekends, custom no-school days skipped). */
export function schoolDaysBetween(today: string, date: string, data: ScheduleData, cap = 400): number {
  let n = 0;
  let d = today;
  for (let i = 0; i < cap && d < date; i++) {
    d = addDays(d, 1);
    if (scheduleFor(d, data).isSchoolDay) n++;
  }
  return n;
}
