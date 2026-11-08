/**
 * Raceway for the Race Track themes: the night circuit image (full stands, floodlights),
 * shown whole ("contain"), with four cars racing on the image's own lane. Every minute of
 * the period is one lap; the accent car leads, the others run in loose formation behind it.
 * When the period ends (or outside school) the cars park on the start line.
 *
 * The lane was measured on the 1536x1024 image: for each angle from the image centre, the
 * distance to the middle of the asphalt.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path, Polyline, Rect } from 'react-native-svg';

import { alpha, mix, type Theme } from '@/lib/themes';

const RACEWAY = require('../../assets/themes/raceway.jpg');
const IMG_W = 1536;
const IMG_H = 1024;
const IMG_CX = 768;
const IMG_CY = 512;
/* Lane centre radius (image px) every 15 degrees, angle measured with y down, 0 = right. */
const LANE_R = [696, 663, 567, 431, 361, 321, 305, 321, 361, 431, 568, 663, 697, 689, 591, 458, 379, 337, 320, 337, 379, 459, 584, 674];
const LANE_W = 70;
const LAP_SEC = 60;
/* Rivals: gap behind the leader (laps) and a wobble so they trade places a little. */
const RIVALS = [
  { gap: 0.055, wobble: 0.018, phase: 0.9, color: '#3b82f6' },
  { gap: 0.105, wobble: 0.022, phase: 2.1, color: '#facc15' },
  { gap: 0.16, wobble: 0.016, phase: 4.2, color: '#22c55e' },
];

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

/** One car, placed from the shared lap counter plus its own gap and wobble. */
function Car({ laps, gap, wobble, phase, color, frame }: { laps: SharedValue<number>; gap: number; wobble: number; phase: number; color: string; frame: Frame }) {
  const { scale, ox, oy, carW, carH } = frame;
  const style = useAnimatedStyle(() => {
    const l = laps.value;
    const t = l - gap + wobble * Math.sin(l * 2.3 + phase);
    const p = lanePoint(t);
    const q = lanePoint(t + 0.004);
    const heading = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    return { transform: [{ translateX: ox + p.x * scale - carW / 2 }, { translateY: oy + p.y * scale - carH / 2 }, { rotate: `${heading}deg` }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: carW, height: carH }, style]}>
      <RaceCar color={color} width={carW} />
    </Animated.View>
  );
}

export function RacewayBackdrop({ theme, elapsedSec, motion }: { theme: Theme; elapsedSec: number | null; motion: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  // "contain": the whole circuit is always on screen.
  const scale = Math.min(W / IMG_W, H / IMG_H);
  const ox = (W - IMG_W * scale) / 2;
  const oy = (H - IMG_H * scale) / 2;

  // Laps completed so far in this period (fractional). Parked at the start line when the race is over.
  const racing = elapsedSec != null && elapsedSec >= 0;
  const target = racing ? elapsedSec / LAP_SEC : 0;
  const laps = useSharedValue(target);
  useEffect(() => {
    // Jumps (new period, app reopened) snap; the normal 1 s tick glides.
    const jump = Math.abs(target - laps.value) > 0.1;
    laps.value = motion && !jump ? withTiming(target, { duration: 1000, easing: Easing.linear }) : target;
  }, [target, motion, laps]);

  const carW = Math.max(30, LANE_W * 1.45 * scale);
  const frame: Frame = { scale, ox, oy, carW, carH: (carW * 20) / 58 };

  // Driven part of the current lap.
  const lapFrac = racing ? target % 1 : 0;
  const steps = Math.max(2, Math.round(lapFrac * 360));
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = lanePoint((i / steps) * lapFrac);
    pts.push(`${(ox + p.x * scale).toFixed(1)},${(oy + p.y * scale).toFixed(1)}`);
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={RACEWAY} style={StyleSheet.absoluteFill} contentFit="contain" contentPosition="center" transition={0} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.bg, theme.light ? 0.12 : 0.26) }]} />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {lapFrac > 0.003 ? <Polyline points={pts.join(' ')} fill="none" stroke={alpha(theme.accent, 0.5)} strokeWidth={LANE_W * 0.5 * scale} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
      {RIVALS.map((r) => (
        <Car key={r.color} laps={laps} gap={racing ? r.gap : r.gap * 0.5} wobble={racing ? r.wobble : 0} phase={r.phase} color={r.color} frame={frame} />
      ))}
      <Car laps={laps} gap={0} wobble={0} phase={0} color={theme.accent} frame={frame} />
    </View>
  );
}
