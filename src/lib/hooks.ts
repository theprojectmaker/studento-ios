import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { addDays, nyParts, nyWallToMs, weekdayOf } from './nytime';
import { useStore } from './store';
import { themeById } from './themes';

/**
 * Web preview only: `?at=2026-10-19T13:47:22Z` shifts the clock so any time of
 * day can be checked in a browser. Never active in the phone app.
 */
const OFFSET = (() => {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return 0;
  const at = new URLSearchParams(location.search).get('at');
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? t - Date.now() : 0;
})();

/** Test mode loops through 25 minutes of Period 3 (9:28-10:09) on the next Mon/Tue/Thu/Fri. */
const TEST_LOOP_MS = 25 * 60_000;
let testStart: number | null = null;
let testBase = 0;

export function clockNow(test = false): number {
  const real = Date.now() + OFFSET;
  if (!test) {
    testStart = null;
    return real;
  }
  if (testStart == null) {
    testStart = real;
    let d = nyParts(real).date;
    while (!['Mon', 'Tue', 'Thu', 'Fri'].includes(weekdayOf(d))) d = addDays(d, 1);
    testBase = nyWallToMs(d, '09:38');
  }
  return testBase + ((real - testStart) % TEST_LOOP_MS);
}

/** Current time (or the Period 3 test time), re-rendered on each whole second. */
export function useNow(): number {
  const test = useStore((s) => s.prefs.testPeriod3);
  const [now, setNow] = useState(() => clockNow(test));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(clockNow(test));
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [test]);
  return now;
}

export function useTheme() {
  const id = useStore((s) => s.prefs.theme);
  return themeById(id);
}

/** Real wall-clock time (ignores test mode), updated every second. For timers like Focus. */
export function useRealNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
