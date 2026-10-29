/**
 * Things the real Studento does on its countdown page, brought over:
 *  - the 5-minute warning (flash, spoken line, buzz) while the app is open
 *  - blink the countdown in the last minute
 *  - dim at night, burn-in nudge
 *  - a new random theme every period / every day
 * All opt-in from Settings; nothing here schedules a notification.
 */
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { nameFor, type NowState } from '@/lib/schedule';
import { setPref, type Prefs } from '@/lib/store';
import { THEMES } from '@/lib/themes';



function pickTheme(current: string): string {
  const pool = THEMES.filter((t) => t.id !== current);
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** Fires the 5-minute warning once per period; returns the flash value (0..1). */
export function useWarning(st: NowState, countdownSec: number | null, prefs: Prefs, names: Record<string, string>) {
  const flash = useSharedValue(0);
  const prev = useRef<number | null>(null);
  const key = `${st.date}|${st.currentIndex}`;
  const lastKey = useRef('');
  useEffect(() => {
    if (st.phase !== 'class' || countdownSec == null) {
      prev.current = null;
      return;
    }
    if (lastKey.current !== key) {
      lastKey.current = key;
      prev.current = countdownSec;
      return;
    }
    const WARN_SEC = (prefs.warnMin && prefs.warnMin > 0 ? Math.round(prefs.warnMin) : 5) * 60;
    const before = prev.current;
    prev.current = countdownSec;
    // Crossed 5:00 just now (a window, so opening the app at 2:00 left stays quiet).
    if (before == null || !(before > WARN_SEC && countdownSec <= WARN_SEC && before - countdownSec <= 5)) return;
    if (prefs.flashWarn) flash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 700 }), withTiming(0.8, { duration: 120 }), withTiming(0, { duration: 700 }));
    if (prefs.warnBuzz && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (prefs.speak && st.current) {
      const next = st.day.periods[st.currentIndex + 1];
      void Speech.stop();
      Speech.speak(`${nameFor(st.current, names)} ends in ${WARN_SEC === 60 ? "one minute" : `${WARN_SEC / 60} minutes`}.${next ? ` Next up, ${nameFor(next, names)}.` : ''}`);
    }
  }, [countdownSec, st, key, prefs.flashWarn, prefs.warnBuzz, prefs.speak, prefs.warnMin, flash, names]);
  return flash;
}

/** New theme every period / every day, if asked for. */
export function useThemeShuffle(st: NowState, prefs: Prefs) {
  const lastPeriod = useRef<string | null>(null);
  const key = st.phase === 'class' ? `${st.date}|${st.currentIndex}` : null;
  useEffect(() => {
    if (key && lastPeriod.current !== null && lastPeriod.current !== key && prefs.shuffle) setPref('theme', pickTheme(prefs.theme));
    lastPeriod.current = key ?? lastPeriod.current ?? '';
  }, [key, prefs.shuffle, prefs.theme]);
  useEffect(() => {
    if (prefs.daily && prefs.dailyDate !== st.date) {
      setPref('dailyDate', st.date);
      setPref('theme', pickTheme(prefs.theme));
    }
  }, [prefs.daily, prefs.dailyDate, prefs.theme, st.date]);
}

/** Pulses its children (the countdown) in the last minute. */
export function Blink({ on, children }: { on: boolean; children: ReactNode }) {
  const p = useSharedValue(1);
  useEffect(() => {
    if (on) p.value = withRepeat(withSequence(withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) })), -1, false);
    else p.value = withTiming(1, { duration: 150 });
  }, [on, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** White flash across the screen (5-minute warning). */
export function FlashOverlay({ flash }: { flash: { value: number } }) {
  const style = useAnimatedStyle(() => ({ opacity: flash.value * 0.55 }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff' }, style]} />;
}

/** Softens the screen between 9 PM and 6 AM. */
export function NightDim({ hour, on }: { hour: number; on: boolean }) {
  if (!on || !(hour >= 21 || hour < 6)) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: 0.5 }]} />;
}

/** A few pixels of drift each minute so nothing sits still on an OLED screen. */
export function burnInOffset(minute: number, on: boolean) {
  if (!on) return { x: 0, y: 0 };
  return { x: ((minute * 7) % 9) - 4, y: ((minute * 5) % 9) - 4 };
}
