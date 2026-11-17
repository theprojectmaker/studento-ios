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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { nameFor, type NowState } from '@/lib/schedule';
import { setPref, type Prefs } from '@/lib/store';
import { THEMES } from '@/lib/themes';



/** "Announce out loud" voices: the same speech engine with a different pitch and speed. */
export const VOICES: Record<Prefs['voice'], { pitch: number; rate: number }> = {
  normal: { pitch: 1, rate: 1 },
  robot: { pitch: 0.6, rate: 0.85 },
  chipmunk: { pitch: 1.9, rate: 1.15 },
  deep: { pitch: 0.5, rate: 0.9 },
};

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
    // The last 10 seconds: a light tick each second, if asked for.
    if (prefs.finalTicks && Platform.OS !== 'web' && countdownSec > 0 && countdownSec <= 10 && before !== countdownSec) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Crossed a warning mark just now (a window, so opening the app at 2:00 left stays quiet).
    const crossed = (mark: number) => before != null && before > mark && countdownSec <= mark && before - countdownSec <= 5;
    const mark = crossed(WARN_SEC) ? WARN_SEC : prefs.warn1 && WARN_SEC !== 60 && crossed(60) ? 60 : null;
    if (mark == null) return;
    if (prefs.flashWarn) flash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 700 }), withTiming(0.8, { duration: 120 }), withTiming(0, { duration: 700 }));
    if (prefs.warnBuzz && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (prefs.speak && st.current) {
      const next = st.day.periods[st.currentIndex + 1];
      void Speech.stop();
      Speech.speak(`${nameFor(st.current, names)} ends in ${mark === 60 ? 'one minute' : `${mark / 60} minutes`}.${next ? ` Next up, ${nameFor(next, names)}.` : ''}`, VOICES[prefs.voice] ?? VOICES.normal);
    }
  }, [countdownSec, st, key, prefs.flashWarn, prefs.warnBuzz, prefs.speak, prefs.warnMin, prefs.warn1, prefs.finalTicks, prefs.voice, flash, names]);
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

/** Softens the screen on the chosen auto-dim schedule (default 9 PM to 6 AM). */
export function NightDim({ hour, on, from = 21, to = 6, level = 'medium' }: { hour: number; on: boolean; from?: number; to?: number; level?: Prefs['nightLevel'] }) {
  const inside = from > to ? hour >= from || hour < to : hour >= from && hour < to;
  if (!on || !inside) return null;
  const opacity = level === 'light' ? 0.3 : level === 'dark' ? 0.7 : 0.5;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity }]} />;
}

/** The clock slowly grows and shrinks a hair while idle. */
export function Breathe({ on, children }: { on: boolean; children: ReactNode }) {
  const p = useSharedValue(1);
  useEffect(() => {
    if (on) p.set(withRepeat(withSequence(withTiming(1.025, { duration: 3000, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) })), -1, false));
    else p.set(withTiming(1, { duration: 300 }));
  }, [on, p]);
  const style = useAnimatedStyle(() => ({ flex: 1, transform: [{ scale: p.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const CONFETTI_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff2d55'];

function ConfettiPiece({ i, width, height }: { i: number; width: number; height: number }) {
  const t = useSharedValue(0);
  // Fixed pseudo-random spread per piece so renders are stable.
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const x0 = r(1) * width;
  const drift = (r(2) - 0.5) * 120;
  const spin = (r(3) - 0.5) * 1440;
  const delay = r(4) * 900;
  const dur = 2600 + r(5) * 1600;
  useEffect(() => {
    const id = setTimeout(() => t.set(withTiming(1, { duration: dur, easing: Easing.in(Easing.quad) })), delay);
    return () => clearTimeout(id);
  }, [t, dur, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0.92 ? (1 - t.value) / 0.08 : t.value > 0 ? 1 : 0,
    transform: [{ translateX: x0 + drift * t.value }, { translateY: -20 + (height + 40) * t.value }, { rotate: `${spin * t.value}deg` }],
  }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 8, height: 14, borderRadius: 2, backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }, style]} />;
}

/** Confetti falling once when the last bell of the day rings (Fridays only, or every day). */
export function LastBellConfetti({ st, mode, width, height }: { st: NowState; mode: Prefs['celebrate']; width: number; height: number }) {
  const [burst, setBurst] = useState(0);
  const [done, setDone] = useState(0);
  // Track the phase during render (React's "previous value" pattern): class -> after = last bell.
  const phaseKey = `${st.date}|${st.phase}`;
  const [was, setWas] = useState(phaseKey);
  if (was !== phaseKey) {
    setWas(phaseKey);
    if (mode !== 'off' && st.phase === 'after' && was === `${st.date}|class` && (mode === 'always' || st.day.weekday === 'Fri')) setBurst((b) => b + 1);
  }
  useEffect(() => {
    if (burst && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [burst]);
  useEffect(() => {
    if (!burst) return;
    const id = setTimeout(() => setDone(burst), 5000);
    return () => clearTimeout(id);
  }, [burst]);
  if (burst <= done) return null;
  return (
    <View key={burst} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 70 }, (_, i) => <ConfettiPiece key={i} i={i} width={width} height={height} />)}
    </View>
  );
}

/** A few pixels of drift each minute so nothing sits still on an OLED screen. */
export function burnInOffset(minute: number, on: boolean) {
  if (!on) return { x: 0, y: 0 };
  return { x: ((minute * 7) % 9) - 4, y: ((minute * 5) % 9) - 4 };
}
