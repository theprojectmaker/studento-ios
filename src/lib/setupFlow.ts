/**
 * The first-launch setup wizard, as plain data: which steps exist, which can be skipped,
 * and how to move between them. The screen (src/app/setup.tsx) only draws this.
 */
export type SetupStepId = 'welcome' | 'school' | 'schedule' | 'classes' | 'alerts' | 'theme' | 'account' | 'done';

export interface SetupStep {
  id: SetupStepId;
  title: string;
  /** Can be passed with "Skip". The welcome and the final screen are never "skipped", just advanced. */
  optional: boolean;
}

export const SETUP_STEPS: SetupStep[] = [
  { id: 'welcome', title: 'Welcome', optional: false },
  { id: 'school', title: 'Your school', optional: true },
  { id: 'schedule', title: 'Bell schedule', optional: true },
  { id: 'classes', title: 'Your classes', optional: true },
  { id: 'alerts', title: 'Bell alerts', optional: true },
  { id: 'theme', title: 'Pick a look', optional: true },
  { id: 'account', title: 'Save it', optional: true },
  { id: 'done', title: 'All set', optional: false },
];

export const LAST_STEP = SETUP_STEPS.length - 1;

/** Keeps a saved step inside the list (older saves, or a shorter list later). */
export function clampStep(n: unknown): number {
  const i = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.max(0, Math.min(LAST_STEP, i));
}

export function nextStep(i: number, opts: { hasSchool: boolean }): number {
  let n = clampStep(i) + 1;
  // No school picked -> there is no schedule to choose; go straight to classes.
  if (SETUP_STEPS[n]?.id === 'schedule' && !opts.hasSchool) n++;
  return Math.min(LAST_STEP, n);
}

export function prevStep(i: number, opts: { hasSchool: boolean }): number {
  let n = clampStep(i) - 1;
  if (SETUP_STEPS[n]?.id === 'schedule' && !opts.hasSchool) n--;
  return Math.max(0, n);
}

/** Progress for the dots: which steps are shown (the schedule step hides without a school). */
export function visibleSteps(opts: { hasSchool: boolean }): SetupStep[] {
  return SETUP_STEPS.filter((s) => s.id !== 'schedule' || opts.hasSchool);
}
