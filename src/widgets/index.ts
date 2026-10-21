/**
 * App side of the widget + Live Activity. Everything here is guarded: in Expo
 * Go, on web, or on Android the native module is missing and every function
 * quietly does nothing.
 *
 * Calm by design: at most ONE Live Activity, only for the period happening
 * right now, started while the app is open, never by a server, no sounds.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { clockNow } from '@/lib/hooks';
import { nowState } from '@/lib/schedule';
import { detailsFor, getState, namesFor, scheduleData } from '@/lib/store';
import { themeById } from '@/lib/themes';
import { bellProps, widgetTimeline } from '@/lib/widgetData';

import type { BellProps } from './layouts';

type WidgetsLib = typeof import('expo-widgets');

const WIDGET_NAME = 'StudentoBell';
const ACTIVITY_NAME = 'StudentoBell';

let lib: WidgetsLib | null | undefined;
let widget: ReturnType<WidgetsLib['createWidget']> | null = null;
let activities: ReturnType<WidgetsLib['createLiveActivity']> | null = null;

function load(): WidgetsLib | null {
  if (lib !== undefined) return lib;
  lib = null;
  // Only real installed iOS builds have the widget extension.
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return lib;
  try {
    // Lazy on purpose: importing it at the top would load the native module in Expo Go and crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('expo-widgets') as WidgetsLib;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BellActivity, BellWidget } = require('./layouts') as typeof import('./layouts');
    widget = lib.createWidget<BellProps>(WIDGET_NAME, BellWidget);
    activities = lib.createLiveActivity<BellProps>(ACTIVITY_NAME, BellActivity);
  } catch {
    lib = null;
    widget = null;
    activities = null;
  }
  return lib;
}

/** Push the next few days of bells to the home-screen widget. */
export function refreshWidget() {
  try {
    if (!load() || !widget) return;
    const s = getState();
    const theme = themeById(s.prefs.theme);
    const now = Date.now();
    if (s.prefs.testPeriod3) {
      // Test mode: one snapshot of the pretend Period 3, timed against the real clock.
      const fake = clockNow(true);
      widget.updateSnapshot(bellProps(nowState(fake, scheduleData(s)), namesFor(s), detailsFor(s), theme, s.prefs.h24, now, fake));
      return;
    }
    const entries = widgetTimeline(now, scheduleData(s), namesFor(s), detailsFor(s), theme, s.prefs.h24);
    widget.updateTimeline(entries.map((e) => ({ date: new Date(e.at), props: e.props })));
  } catch {
    // Never let the widget break the app.
  }
}

/**
 * Keep exactly one Live Activity for the period happening now (or the passing
 * time before the next one); end it when school is out. Call on launch, on
 * returning to the app, and at each bell while the app is open.
 */
export async function syncLiveActivity() {
  try {
    if (!load() || !activities) return;
    const s = getState();
    const running = activities.getInstances();
    const now = Date.now();
    const fake = s.prefs.testPeriod3 ? clockNow(true) : now;
    const st = nowState(fake, scheduleData(s));
    const props = bellProps(st, namesFor(s), detailsFor(s), themeById(s.prefs.theme), s.prefs.h24, now, fake);
    const wanted = s.prefs.liveActivity && props.mode !== 'off' && props.end > now;

    if (!wanted) {
      await Promise.all(running.map((a) => a.end('immediate').catch(() => {})));
      return;
    }
    // Same bell already showing: just refresh the text.
    const [first, ...extra] = running;
    await Promise.all(extra.map((a) => a.end('immediate').catch(() => {})));
    if (first) {
      await first.update(props, new Date(props.end)).catch(() => {});
      return;
    }
    activities.start(props, 'studento://', new Date(props.end));
  } catch {
    // Live Activities off, not allowed, or unsupported: ignore.
  }
}

/** Ends everything (e.g. when the student turns the Live Activity off). */
export async function endLiveActivities() {
  try {
    if (!load() || !activities) return;
    await Promise.all(activities.getInstances().map((a) => a.end('immediate').catch(() => {})));
  } catch {
    // ignore
  }
}
