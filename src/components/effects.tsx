/**
 * One quiet live effect per theme (only themes where it fits have one):
 * falling snow / petals / rain, rising embers / bubbles, drifting fireflies /
 * dust, twinkling stars, CRT scanlines. Each particle is a small View animated
 * on the UI thread; positions are seeded so they never reshuffle on re-render.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { alpha, type Effect, type Theme } from '@/lib/themes';

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Kind = Exclude<Effect, 'none' | 'stars' | 'scanlines' | 'glints'>;

interface Spec {
  count: number;
  /** ms for one trip, min and max */
  dur: [number, number];
  dir: 1 | -1 | 0;
  sway: number;
}

const SPECS: Record<Kind, Spec> = {
  snow: { count: 26, dur: [9000, 16000], dir: 1, sway: 22 },
  petals: { count: 14, dur: [10000, 17000], dir: 1, sway: 40 },
  rain: { count: 34, dur: [900, 1400], dir: 1, sway: 0 },
  embers: { count: 18, dur: [6000, 11000], dir: -1, sway: 18 },
  bubbles: { count: 14, dur: [8000, 14000], dir: -1, sway: 14 },
  fireflies: { count: 12, dur: [7000, 12000], dir: 0, sway: 40 },
  dust: { count: 16, dur: [14000, 22000], dir: -1, sway: 26 },
  bokeh: { count: 11, dur: [18000, 28000], dir: -1, sway: 30 },
};

export const LiveEffect = memo(function LiveEffect({ theme, motion }: { theme: Theme; motion: boolean }) {
  if (!motion || theme.effect === 'none') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {theme.effect === 'glints' ? <Glints theme={theme} /> : theme.effect === 'stars' ? <Stars theme={theme} /> : theme.effect === 'scanlines' ? <Scanlines theme={theme} /> : <Particles kind={theme.effect} theme={theme} />}
    </View>
  );
});

/* ---------------- particles ---------------- */

function Particles({ kind, theme }: { kind: Kind; theme: Theme }) {
  const s = SPECS[kind];
  return (
    <>
      {Array.from({ length: s.count }, (_, i) => (
        <Particle key={`${kind}-${i}`} kind={kind} i={i} spec={s} theme={theme} />
      ))}
    </>
  );
}

function Particle({ kind, i, spec, theme }: { kind: Kind; i: number; spec: Spec; theme: Theme }) {
  const { width: w, height: h } = useWindowDimensions();
  const r1 = rand(i + 1);
  const r2 = rand(i + 101);
  const r3 = rand(i + 211);
  const dur = spec.dur[0] + (spec.dur[1] - spec.dur[0]) * r2;
  const p = useSharedValue(0);
  useEffect(() => {
    // Start part-way through the trip so the screen is already populated.
    p.value = r3;
    p.value = withSequence(
      withTiming(1, { duration: dur * (1 - r3), easing: Easing.linear }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: dur, easing: Easing.linear })), -1, false)
    );
  }, [dur, r3, p]);

  const x0 = r1 * w;
  const y0 = r3 * h;
  const sway = spec.sway;
  const dir = spec.dir;
  const phase = r2 * 6.28;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const fade = Math.min(1, t * 6, (1 - t) * 6);
    if (dir === 0) {
      // Wanders in a slow loop and pulses (fireflies).
      return {
        opacity: fade * (0.35 + 0.65 * Math.abs(Math.sin(t * 6.28 * 2 + phase))),
        transform: [{ translateX: x0 + Math.sin(t * 6.28 + phase) * sway }, { translateY: y0 + Math.cos(t * 6.28 * 0.7 + phase) * sway }],
      };
    }
    const y = dir === 1 ? -30 + t * (h + 60) : h + 30 - t * (h + 60);
    return {
      opacity: fade,
      transform: [{ translateX: x0 + Math.sin(t * 6.28 * 1.5 + phase) * sway }, { translateY: y }, { rotate: `${(t * 360 + phase * 57) % 360}deg` }],
    };
  });

  let dot: React.ReactNode;
  const sz = 2 + r2 * 3;
  switch (kind) {
    case 'snow':
      dot = <View style={{ width: sz + 1, height: sz + 1, borderRadius: 9, backgroundColor: theme.light ? '#9fbcd6' : '#ffffff', opacity: 0.85 }} />;
      break;
    case 'petals':
      dot = <View style={{ width: 9 + r1 * 5, height: 6 + r1 * 3, borderTopLeftRadius: 9, borderBottomRightRadius: 9, backgroundColor: '#ffb3cc', opacity: 0.85 }} />;
      break;
    case 'rain':
      dot = <View style={{ width: 1.2, height: 14 + r1 * 10, borderRadius: 1, backgroundColor: alpha(theme.light ? '#2b3a55' : '#cfe1ff', 0.35), transform: [{ rotate: '12deg' }] }} />;
      break;
    case 'embers':
      dot = <View style={{ width: sz, height: sz, borderRadius: 9, backgroundColor: theme.accent, shadowColor: theme.accent, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />;
      break;
    case 'bubbles':
      dot = <View style={{ width: 5 + r1 * 9, height: 5 + r1 * 9, borderRadius: 99, borderWidth: 1, borderColor: alpha('#ffffff', 0.35) }} />;
      break;
    case 'fireflies':
      dot = <View style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: '#eaff8f', shadowColor: '#eaff8f', shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }} />;
      break;
    case 'bokeh': {
      const d = 26 + r1 * 46;
      dot = <View style={{ width: d, height: d, borderRadius: d, backgroundColor: alpha(theme.accent, 0.07 + r2 * 0.08), borderWidth: 1, borderColor: alpha(theme.accent, 0.12) }} />;
      break;
    }
    default:
      dot = <View style={{ width: 2.5, height: 2.5, borderRadius: 3, backgroundColor: alpha(theme.light ? theme.accent : '#fff3d6', 0.6) }} />;
  }
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>{dot}</Animated.View>;
}

/* ---------------- gold glints ---------------- */

/** Four-point sparkles that bloom and fade in place, like light catching gold. */
function Glint({ i, theme }: { i: number; theme: Theme }) {
  const { width: w, height: h } = useWindowDimensions();
  const p = useSharedValue(0);
  const dur = 1400 + rand(i + 7) * 1200;
  const wait = 1200 + rand(i + 19) * 5200;
  useEffect(() => {
    p.value = withDelay(
      rand(i + 31) * 4000,
      withRepeat(withSequence(withTiming(1, { duration: dur / 2, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: dur / 2, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: wait })), -1, false)
    );
  }, [p, dur, wait, i]);
  const s = 9 + rand(i + 3) * 12;
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.3 + p.value * 0.7 }, { rotate: `${p.value * 45}deg` }] }));
  const c = theme.light ? theme.accent : '#fff3cf';
  return (
    <Animated.View style={[{ position: 'absolute', left: rand(i + 41) * (w - s), top: rand(i + 53) * (h - s), width: s, height: s }, style]}>
      <Svg width={s} height={s} viewBox="0 0 20 20">
        <Path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={c} opacity={0.9} />
      </Svg>
    </Animated.View>
  );
}

function Glints({ theme }: { theme: Theme }) {
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <Glint key={i} i={i} theme={theme} />
      ))}
    </>
  );
}

/* ---------------- stars ---------------- */

function StarLayer({ seed, count, dur, delay }: { seed: number; count: number; dur: number; delay: number }) {
  const { width: w, height: h } = useWindowDimensions();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [dur, delay, p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * p.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={w} height={h}>
        {Array.from({ length: count }, (_, i) => {
          const r = rand(seed * 100 + i);
          return <Circle key={i} cx={rand(seed * 7 + i * 3.1) * w} cy={rand(seed * 13 + i * 1.7) * h} r={0.5 + r * 1.3} fill="#ffffff" opacity={0.45 + r * 0.55} />;
        })}
      </Svg>
    </Animated.View>
  );
}

function Stars({ theme }: { theme: Theme }) {
  if (theme.light) return null;
  return (
    <>
      <StarLayer seed={1} count={30} dur={2800} delay={0} />
      <StarLayer seed={2} count={24} dur={3900} delay={700} />
      <StarLayer seed={3} count={18} dur={5200} delay={1500} />
    </>
  );
}

/* ---------------- CRT scanlines ---------------- */

function Scanlines({ theme }: { theme: Theme }) {
  const { width: w, height: h } = useWindowDimensions();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false);
  }, [p]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateY: -120 + p.value * (h + 240) }] }));
  const lines = Math.ceil(h / 3);
  return (
    <>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {Array.from({ length: lines }, (_, i) => (
          <Line key={i} x1={0} x2={w} y1={i * 3 + 1} y2={i * 3 + 1} stroke="#000000" strokeOpacity={0.22} strokeWidth={1} />
        ))}
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 120, backgroundColor: alpha(theme.accent, 0.04) }, sweep]} />
    </>
  );
}
