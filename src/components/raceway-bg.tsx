/**
 * Raceway for the Race Track themes: the night circuit image (full stands, floodlights)
 * full-bleed, with the race car driving on the image's own lane. One lap = one period; the
 * part of the lane already driven is tinted in the accent. The lane was measured on the
 * 1400x788 image: for each angle from the image centre, the distance to the middle of the
 * asphalt. The image is drawn with "cover" scaling, so the same mapping is applied here.
 */
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Polyline, Rect } from 'react-native-svg';

import { alpha, mix, type Theme } from '@/lib/themes';

const RACEWAY = require('../../assets/themes/raceway.jpg');
const IMG_W = 1400;
const IMG_H = 788;
const IMG_CX = 700;
const IMG_CY = 394;
/* Lane centre radius (image px) every 15 degrees, angle measured with y down, 0 = right. */
const LANE_R = [587, 529, 394, 285, 248, 220, 210, 208, 232, 305, 394, 525, 588, 545, 424, 336, 274, 263, 228, 246, 287, 322, 422, 549];
const LANE_W = 44; // image px, roughly the asphalt width on the straights

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
function RaceCar({ accent, width }: { accent: string; width: number }) {
  const dark = '#1c1d21';
  const tyre = '#121316';
  const rim = '#3a3c42';
  const pod = mix(accent, '#000000', 0.22);
  const stripe = mix(accent, '#ffffff', 0.55);
  const tyres = [
    [7, 0.5, 9, 5],
    [7, 14.5, 9, 5],
    [33, 1.5, 7.5, 4.4],
    [33, 14.1, 7.5, 4.4],
  ];
  return (
    <Svg width={width} height={(width * 20) / 58} viewBox="-10 0 58 20">
      <Rect x={-9} y={7.6} width={9} height={1.1} rx={0.55} fill={accent} opacity={0.18} />
      <Rect x={-6} y={11.3} width={6} height={1.1} rx={0.55} fill={accent} opacity={0.14} />
      <Path d="M6 7.2 H26 L30.5 5.6 H36.5 L47.5 10.1 V11.9 L36.5 16.4 H30.5 L26 14.8 H6 Z" fill="#000000" opacity={0.3} />
      <Rect x={1} y={2.5} width={4.5} height={15} rx={1.2} fill={dark} />
      {tyres.map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} rx={1.5} fill={tyre} />
      ))}
      {tyres.map(([x, y, w, h], i) => (
        <Rect key={`r${i}`} x={x + w * 0.3} y={y + h * 0.3} width={w * 0.4} height={h * 0.4} rx={0.7} fill={rim} />
      ))}
      <Path d="M5.5 6.2 H25 L29.5 4.6 H35.5 L46.5 9.1 V10.9 L35.5 15.4 H29.5 L25 13.8 H5.5 Z" fill={accent} />
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

export function RacewayBackdrop({ theme, progress, motion }: { theme: Theme; progress: number; motion: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  // "cover" mapping of the image onto the window.
  const scale = Math.max(W / IMG_W, H / IMG_H);
  const ox = (W - IMG_W * scale) / 2;
  const oy = (H - IMG_H * scale) / 2;

  const target = Math.min(1, Math.max(0, progress));
  const prog = useSharedValue(target);
  useEffect(() => {
    prog.value = motion ? withTiming(target, { duration: 1000, easing: Easing.linear }) : target;
  }, [target, motion, prog]);

  const carW = Math.max(34, LANE_W * 1.5 * scale);
  const carH = (carW * 20) / 58;
  const carStyle = useAnimatedStyle(() => {
    const p = lanePoint(prog.value);
    const q = lanePoint(prog.value + 0.004);
    const heading = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    return { transform: [{ translateX: ox + p.x * scale - carW / 2 }, { translateY: oy + p.y * scale - carH / 2 }, { rotate: `${heading}deg` }] };
  });

  // Driven part of the lap as a polyline along the lane.
  const pts: string[] = [];
  const steps = Math.max(2, Math.round(target * 360));
  for (let i = 0; i <= steps; i++) {
    const p = lanePoint((i / steps) * target);
    pts.push(`${(ox + p.x * scale).toFixed(1)},${(oy + p.y * scale).toFixed(1)}`);
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={RACEWAY} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" transition={0} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.bg, theme.light ? 0.15 : 0.3) }]} />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        {target > 0.003 ? <Polyline points={pts.join(' ')} fill="none" stroke={alpha(theme.accent, 0.55)} strokeWidth={LANE_W * 0.55 * scale} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: carW, height: carH }, carStyle]}>
        <RaceCar accent={theme.accent} width={carW} />
      </Animated.View>
    </View>
  );
}
