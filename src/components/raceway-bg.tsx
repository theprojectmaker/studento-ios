/**
 * Raceway for the Race Track themes (iPad). The night circuit image is shown whole, with
 * four cars racing on the image's own lane. Every minute of the period is one lap. Each
 * period is a different race: car speeds, surges and slumps are seeded from the period, so
 * the order keeps changing and the winner is anyone's. When the period ends the cars park
 * on the start straight in finishing order. A small pill shows the lap and the running order.
 *
 * The lane was measured on the 1536x1024 image: for each angle from the image centre, the
 * distance to the middle of the asphalt.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { TYPE } from '@/lib/fonts';
import { sz } from '@/lib/scale';
import { alpha, mix, type Theme } from '@/lib/themes';

const RACEWAY = require('../../assets/themes/raceway.jpg');
const IMG_W = 1536;
const IMG_H = 1024;
const IMG_CX = 768;
const IMG_CY = 512;
const EDGE = '#0b0e0c'; // the image's own top/bottom edge tone
/* Lane centre radius (image px) every 15 degrees, angle measured with y down, 0 = right. */
const LANE_R = [696, 663, 567, 431, 361, 321, 305, 321, 361, 431, 568, 663, 697, 689, 591, 458, 379, 337, 320, 337, 379, 459, 584, 674];
const LANE_W = 70;
const LAP_SEC = 24; // 2.5 laps a minute
const RIVAL_COLORS = ['#3b82f6', '#facc15', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#06b6d4'];
/* Events: 0 = tangle/spin, 1 = wipeout onto the grass, 2 = pit stop. Duration in laps. */
const EV_DUR = [0.08, 0.2, 0.3];
const EV_MAX = 6;

function laneRadius(deg: number): number {
  'worklet';
  const a = ((deg % 360) + 360) % 360;
  const i = Math.floor(a / 15);
  const f = a / 15 - i;
  const r0 = LANE_R[i % 24];
  const r1 = LANE_R[(i + 1) % 24];
  return r0 + (r1 - r0) * f;
}

/* Point on the lane for lap fraction t (0 at the start line, top middle, clockwise on screen). */
function lanePoint(t: number, off = 0): { x: number; y: number } {
  'worklet';
  const deg = 270 + t * 360;
  const r = laneRadius(deg) + off;
  const rad = (deg * Math.PI) / 180;
  return { x: IMG_CX + r * Math.cos(rad), y: IMG_CY + r * Math.sin(rad) };
}

/* Deterministic noise. */
function rnd(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A car's race profile for this period: pace plus three overlapping surges. */
interface Profile {
  color: string;
  grid: number; // starting gap behind the line (laps)
  pace: number; // laps per lap of race time (0.94 .. 1.06)
  a1: number;
  f1: number;
  p1: number;
  a2: number;
  f2: number;
  p2: number;
  a3: number;
  f3: number;
  p3: number;
  /** Events this race: start time (laps, -1 = unused) and kind, EV_MAX slots. */
  evAt: number[];
  evKind: number[];
  /** Base line across the lane (image px off the centre) and how it wanders. */
  line: number;
  wander: number;
  wf: number;
}

function profiles(seed: number, accent: string, laps: number): Profile[] {
  const colors = [accent, ...RIVAL_COLORS];
  const span = Math.max(0.5, laps - 1.5);
  // Tangles: pairs of cars (k, k+1) spin at the same moment, up to 3 times a race.
  const tangle = (pair: number, n: number) => {
    const b = seed * 31 + pair * 977 + n * 7;
    if (rnd(b) < 0.25 || laps < 2) return -1;
    return 0.4 + rnd(b + 1) * span;
  };
  return colors.map((color, k) => {
    const b = seed * 7919 + k * 104729;
    const pair = Math.floor(k / 2);
    const evAt: number[] = [];
    const evKind: number[] = [];
    for (let n = 0; n < 3; n++) {
      evAt.push(tangle(pair, n));
      evKind.push(0);
    }
    // Solo wipeouts (one or two) and one pit stop, each with its own odds.
    evAt.push(rnd(b + 20) < 0.55 && laps > 3 ? 0.6 + rnd(b + 21) * span : -1);
    evKind.push(1);
    evAt.push(rnd(b + 22) < 0.3 && laps > 6 ? 0.6 + rnd(b + 23) * span : -1);
    evKind.push(1);
    evAt.push(rnd(b + 24) < 0.7 && laps > 4 ? 1 + rnd(b + 25) * span : -1);
    evKind.push(2);
    return {
      color,
      grid: k * 0.004,
      evAt,
      evKind,
      pace: 0.9 + rnd(b + 1) * 0.2,
      a1: 0.1 + rnd(b + 2) * 0.16,
      f1: 0.15 + rnd(b + 3) * 0.3,
      p1: rnd(b + 4) * 6.28,
      a2: 0.04 + rnd(b + 5) * 0.08,
      f2: 0.6 + rnd(b + 6) * 1.2,
      p2: rnd(b + 7) * 6.28,
      a3: 0.15 + rnd(b + 8) * 0.35,
      f3: 0.03 + rnd(b + 9) * 0.06,
      p3: rnd(b + 10) * 6.28,
      line: ((k - (colors.length - 1) / 2) / ((colors.length - 1) / 2)) * LANE_W * 0.3,
      wander: 4 + rnd(b + 11) * 6,
      wf: 0.5 + rnd(b + 12) * 1.5,
    };
  });
}

function pace(p: Profile, l: number): number {
  'worklet';
  const w = (t: number) => p.a1 * Math.sin(t * p.f1 * 6.28 + p.p1) + p.a2 * Math.sin(t * p.f2 * 6.28 + p.p2) + p.a3 * Math.sin(t * p.f3 * 6.28 + p.p3);
  return l * p.pace - p.grid + w(l) - w(0);
}

/* Race position (in laps) at race time l: the pace curve minus the ground lost in each spin. Runs on the UI thread. */
function position(p: Profile, l: number): number {
  'worklet';
  let x = pace(p, l);
  for (let i = 0; i < EV_MAX; i++) {
    const at = p.evAt[i];
    if (at >= 0 && l > at) x -= pace(p, Math.min(l, at + EV_DUR[p.evKind[i]])) - pace(p, at);
  }
  return x;
}

/* The event in progress at race time l: its kind and 0..1 phase, or kind -1. */
function eventAt(p: Profile, l: number): { kind: number; phase: number } {
  'worklet';
  for (let i = 0; i < EV_MAX; i++) {
    const at = p.evAt[i];
    if (at >= 0 && l > at && l < at + EV_DUR[p.evKind[i]]) return { kind: p.evKind[i], phase: (l - at) / EV_DUR[p.evKind[i]] };
  }
  return { kind: -1, phase: 0 };
}

/* Top-down race car built for small sizes: fat tyres that stick out, a wide body, a big rear wing. 40 x 20 box, nose right. */
function RaceCar({ color, width }: { color: string; width: number }) {
  const tyre = '#0f1013';
  const wing = '#17181c';
  const shade = mix(color, '#000000', 0.3);
  const light = mix(color, '#ffffff', 0.4);
  return (
    <Svg width={width} height={width / 2} viewBox="0 0 40 20">
      {/* shadow */}
      <Path d="M7 7.5 H30 L37.5 10 L30 12.5 H7 Z" fill="#000000" opacity={0.35} transform="translate(0.8 1.2)" />
      {/* tyres */}
      <Rect x={7} y={0.5} width={8} height={5.5} rx={1.8} fill={tyre} />
      <Rect x={7} y={14} width={8} height={5.5} rx={1.8} fill={tyre} />
      <Rect x={26} y={1.5} width={7} height={5} rx={1.6} fill={tyre} />
      <Rect x={26} y={13.5} width={7} height={5} rx={1.6} fill={tyre} />
      {/* rear wing */}
      <Rect x={1.5} y={2.5} width={4} height={15} rx={1} fill={wing} />
      {/* body */}
      <Path d="M5.5 6 H28 L37.5 9.2 V10.8 L28 14 H5.5 Z" fill={color} />
      <Path d="M5.5 6 H28 L37.5 9.2 V10 H5.5 Z" fill={light} opacity={0.35} />
      {/* sidepods */}
      <Rect x={11} y={4.6} width={12} height={10.8} rx={3} fill={shade} />
      {/* front wing */}
      <Rect x={34.5} y={3.5} width={2.6} height={13} rx={0.9} fill={wing} />
      {/* cockpit + helmet */}
      <Path d="M17 10 a4 3 0 1 0 8 0 a4 3 0 1 0 -8 0 Z" fill="#1a1b1f" />
      <Path d="M19 10 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z" fill="#ffffff" />
    </Svg>
  );
}

interface Frame {
  scale: number;
  ox: number;
  oy: number;
  carW: number;
  carH: number;
}

/** One car, placed from the shared race clock through its own profile; parked when the race is over. */
function Car({ race, profile, parkAt, frame, leader }: { race: SharedValue<number>; profile: Profile; parkAt: number | null; frame: Frame; leader: boolean }) {
  const { scale, ox, oy, carW, carH } = frame;
  const style = useAnimatedStyle(() => {
    const l = race.value;
    const t = parkAt != null ? parkAt : position(profile, l);
    const ev = parkAt != null ? { kind: -1, phase: 0 } : eventAt(profile, l);
    // Where across the lane: own line, a little wander; a wipeout slides out to the grass, a pit stop pulls to the inside.
    let off = parkAt != null ? profile.line : profile.line + profile.wander * Math.sin(l * profile.wf * 6.28);
    if (ev.kind === 1) off += Math.sin(Math.min(1, ev.phase * 1.6) * 1.5708) * LANE_W * 0.9;
    if (ev.kind === 2) off -= Math.sin(Math.min(1, ev.phase * 3) * 1.5708) * (ev.phase > 0.75 ? (1 - ev.phase) * 4 : 1) * LANE_W * 0.75;
    const p = lanePoint(t, off);
    const q = lanePoint(t + 0.004, off);
    // Tangle: two turns. Wipeout: three turns, then sits sideways. Pit: no spin.
    const spin = ev.kind === 0 ? 720 * ev.phase * (1 - ev.phase * 0.3) : ev.kind === 1 ? 1080 * Math.min(1, ev.phase * 1.4) + 90 : 0;
    const heading = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + spin;
    return { transform: [{ translateX: ox + p.x * scale - carW / 2 }, { translateY: oy + p.y * scale - carH / 2 }, { rotate: `${heading}deg` }] };
  });
  const halo = carW * 1.5;
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: carW, height: carH }, style]}>
      {leader ? (
        <Svg width={halo} height={halo} style={{ position: 'absolute', left: carW / 2 - halo / 2, top: carH / 2 - halo / 2 }}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={profile.color} stopOpacity={0.55} />
              <Stop offset="0.6" stopColor={profile.color} stopOpacity={0.18} />
              <Stop offset="1" stopColor={profile.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={halo} height={halo} fill="url(#halo)" />
        </Svg>
      ) : null}
      <RaceCar color={profile.color} width={carW} />
    </Animated.View>
  );
}

export function RacewayBackdrop({ theme, elapsedSec, totalSec, seed, motion }: { theme: Theme; elapsedSec: number | null; totalSec: number | null; seed: number; motion: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  // "contain": the whole circuit is always on screen; the bars above and below blend into the image's edges.
  const scale = Math.min(W / IMG_W, H / IMG_H);
  const ox = (W - IMG_W * scale) / 2;
  const oy = (H - IMG_H * scale) / 2;

  const laps = totalSec != null ? totalSec / LAP_SEC : 0;
  const cars = profiles(seed, theme.accent, laps);
  const racing = elapsedSec != null && totalSec != null && elapsedSec >= 0 && elapsedSec < totalSec;
  const finished = elapsedSec != null && totalSec != null && elapsedSec >= totalSec;
  const raceTime = racing ? (elapsedSec as number) / LAP_SEC : finished ? laps : 0;

  const race = useSharedValue(raceTime);
  useEffect(() => {
    const jump = Math.abs(raceTime - race.value) > 0.1;
    race.value = motion && !jump ? withTiming(raceTime, { duration: 1000, easing: Easing.linear }) : raceTime;
  }, [raceTime, motion, race]);

  // Standings right now (JS side, once a second), and the finishing order when it is over.
  const order = cars.map((p, k) => ({ k, pos: position(p, raceTime) })).sort((a, b) => b.pos - a.pos);
  const parkSpots = new Map<number, number>();
  if (finished || !racing) order.forEach((o, rank) => parkSpots.set(o.k, -rank * 0.022));
  const lapNow = racing ? Math.min(Math.ceil(laps), Math.floor(raceTime) + 1) : null;

  const carW = Math.max(30, LANE_W * 0.95 * scale);
  const frame: Frame = { scale, ox, oy, carW, carH: carW / 2 };

  // Start / finish: a checkered strip across the lane at the top of the oval.
  const sfX = ox + IMG_CX * scale;
  const sfY = oy + (IMG_CY - laneRadius(270)) * scale;
  const sq = Math.max(4, (LANE_W / 7) * scale);
  const checks: { x: number; y: number; dark: boolean }[] = [];
  for (let r = -3; r < 4; r++) for (let c = 0; c < 2; c++) checks.push({ x: sfX - sq + c * sq, y: sfY + r * sq, dark: (r + c) % 2 === 0 });

  const bar = Math.max(oy, 0) + 36;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: EDGE }]}>
      <Image source={RACEWAY} style={StyleSheet.absoluteFill} contentFit="contain" contentPosition="center" transition={0} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.bg, theme.light ? 0.1 : 0.22) }]} />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={EDGE} stopOpacity={1} />
            <Stop offset="1" stopColor={EDGE} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="bot" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={EDGE} stopOpacity={1} />
            <Stop offset="1" stopColor={EDGE} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={bar} fill="url(#top)" />
        <Rect x={0} y={H - bar} width={W} height={bar} fill="url(#bot)" />
        {checks.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={sq} height={sq} fill={c.dark ? '#111111' : '#f2f2f2'} opacity={0.9} />
        ))}
      </Svg>
      {cars.map((p, k) => (
        <Car key={p.color} race={race} profile={p} parkAt={parkSpots.has(k) ? (parkSpots.get(k) as number) : null} frame={frame} leader={racing && order[0]?.k === k} />
      ))}
      {/* lap + running order */}
      <View style={{ position: 'absolute', left: ox + (IMG_CX - 520) * scale, top: oy + (IMG_CY - 305 + LANE_W * 0.55) * scale + 6, alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: alpha('#000000', 0.45) }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(11), letterSpacing: 1, color: '#f4f4f4' }}>{finished ? 'FINISH' : lapNow != null ? `LAP ${lapNow}/${Math.ceil(laps)}` : 'GRID'}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {order.map((o) => (
              <View key={o.k} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cars[o.k].color, borderWidth: 1, borderColor: alpha('#ffffff', 0.6) }} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
