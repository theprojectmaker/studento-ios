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
import Svg, { Defs, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';

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
const LAP_SEC = 60;
const RIVAL_COLORS = ['#3b82f6', '#facc15', '#22c55e'];

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
function lanePoint(t: number): { x: number; y: number } {
  'worklet';
  const deg = 270 + t * 360;
  const r = laneRadius(deg);
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
}

function profiles(seed: number, accent: string): Profile[] {
  const colors = [accent, ...RIVAL_COLORS];
  return colors.map((color, k) => {
    const b = seed * 7919 + k * 104729;
    return {
      color,
      grid: k * 0.035,
      pace: 0.94 + rnd(b + 1) * 0.12,
      a1: 0.08 + rnd(b + 2) * 0.12,
      f1: 0.15 + rnd(b + 3) * 0.25,
      p1: rnd(b + 4) * 6.28,
      a2: 0.03 + rnd(b + 5) * 0.06,
      f2: 0.6 + rnd(b + 6) * 0.9,
      p2: rnd(b + 7) * 6.28,
      a3: 0.1 + rnd(b + 8) * 0.25,
      f3: 0.03 + rnd(b + 9) * 0.05,
      p3: rnd(b + 10) * 6.28,
    };
  });
}

/* Race position (in laps) of a car at race time l (laps). Plain math so it runs on the UI thread. */
function position(p: Profile, l: number): number {
  'worklet';
  return l * p.pace - p.grid + p.a1 * Math.sin(l * p.f1 * 6.28 + p.p1) + p.a2 * Math.sin(l * p.f2 * 6.28 + p.p2) + p.a3 * Math.sin(l * p.f3 * 6.28 + p.p3);
}

/* Top-down F1 car, nose to the right, 58 x 20 box. */
function RaceCar({ color, width }: { color: string; width: number }) {
  const dark = '#1c1d21';
  const tyre = '#121316';
  const rim = '#3a3c42';
  const pod = mix(color, '#000000', 0.22);
  const stripe = mix(color, '#ffffff', 0.55);
  const tyres = [
    [7, 0.5, 9, 5],
    [7, 14.5, 9, 5],
    [33, 1.5, 7.5, 4.4],
    [33, 14.1, 7.5, 4.4],
  ];
  return (
    <Svg width={width} height={(width * 20) / 58} viewBox="-10 0 58 20">
      <Rect x={-9} y={7.6} width={9} height={1.1} rx={0.55} fill={color} opacity={0.18} />
      <Rect x={-6} y={11.3} width={6} height={1.1} rx={0.55} fill={color} opacity={0.14} />
      <Path d="M6 7.2 H26 L30.5 5.6 H36.5 L47.5 10.1 V11.9 L36.5 16.4 H30.5 L26 14.8 H6 Z" fill="#000000" opacity={0.3} />
      <Rect x={1} y={2.5} width={4.5} height={15} rx={1.2} fill={dark} />
      {tyres.map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} rx={1.5} fill={tyre} />
      ))}
      {tyres.map(([x, y, w, h], i) => (
        <Rect key={`r${i}`} x={x + w * 0.3} y={y + h * 0.3} width={w * 0.4} height={h * 0.4} rx={0.7} fill={rim} />
      ))}
      <Path d="M5.5 6.2 H25 L29.5 4.6 H35.5 L46.5 9.1 V10.9 L35.5 15.4 H29.5 L25 13.8 H5.5 Z" fill={color} />
      <Path d="M5.5 6.2 H25 L29.5 4.6 H35.5 L46.5 9.1 V10 H5.5 Z" fill="#ffffff" opacity={0.12} />
      <Rect x={13} y={4.2} width={13} height={11.6} rx={3.2} fill={pod} />
      <Rect x={8} y={9.35} width={32} height={1.3} rx={0.6} fill={stripe} opacity={0.9} />
      <Path d="M20.5 10 a4.2 2.7 0 1 0 8.4 0 a4.2 2.7 0 1 0 -8.4 0 Z" fill="#202126" />
      <Path d="M22.9 10 a1.9 1.9 0 1 0 3.8 0 a1.9 1.9 0 1 0 -3.8 0 Z" fill="#f5f5f5" />
      <Path d="M27.2 7.6 a3 3 0 0 1 0 4.8" fill="none" stroke="#0f1013" strokeWidth={0.8} strokeLinecap="round" />
      <Rect x={40.5} y={3.2} width={2.6} height={13.6} rx={0.9} fill={dark} />
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
function Car({ race, profile, parkAt, frame }: { race: SharedValue<number>; profile: Profile; parkAt: number | null; frame: Frame }) {
  const { scale, ox, oy, carW, carH } = frame;
  const style = useAnimatedStyle(() => {
    const t = parkAt != null ? parkAt : position(profile, race.value);
    const p = lanePoint(t);
    const q = lanePoint(t + 0.004);
    const heading = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    return { transform: [{ translateX: ox + p.x * scale - carW / 2 }, { translateY: oy + p.y * scale - carH / 2 }, { rotate: `${heading}deg` }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: carW, height: carH }, style]}>
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

  const cars = profiles(seed, theme.accent);
  const laps = totalSec != null ? totalSec / LAP_SEC : 0;
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
  if (finished || !racing) order.forEach((o, rank) => parkSpots.set(o.k, -rank * 0.03));
  const lapNow = racing ? Math.min(Math.ceil(laps), Math.floor(raceTime) + 1) : null;

  const carW = Math.max(30, LANE_W * 1.1 * scale);
  const frame: Frame = { scale, ox, oy, carW, carH: (carW * 20) / 58 };

  // Driven part of the leader's current lap.
  const leadPos = racing ? Math.max(0, order[0].pos) % 1 : 0;
  const steps = Math.max(2, Math.round(leadPos * 360));
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = lanePoint((i / steps) * leadPos);
    pts.push(`${(ox + p.x * scale).toFixed(1)},${(oy + p.y * scale).toFixed(1)}`);
  }

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
        {leadPos > 0.003 ? <Polyline points={pts.join(' ')} fill="none" stroke={alpha(order[0] ? cars[order[0].k].color : theme.accent, 0.45)} strokeWidth={LANE_W * 0.45 * scale} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
      {cars.map((p, k) => (
        <Car key={p.color} race={race} profile={p} parkAt={parkSpots.has(k) ? (parkSpots.get(k) as number) : null} frame={frame} />
      ))}
      {/* lap + running order */}
      <View style={{ position: 'absolute', left: ox + IMG_CX * scale - sz(70), top: oy + (IMG_CY - 230) * scale, width: sz(140), alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: alpha('#000000', 0.45) }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(11), letterSpacing: 1, color: '#f4f4f4' }}>{finished ? 'FINISH' : lapNow != null ? `LAP ${lapNow}/${Math.ceil(laps)}` : 'GRID'}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {order.map((o) => (
              <View key={o.k} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cars[o.k].color, borderWidth: 1, borderColor: alpha('#ffffff', 0.6) }} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
