/**
 * Race Track: a pixel race car laps a thin oval while the period runs. One lap = one period;
 * the part of the lap already driven is tinted in the accent, so the ring doubles as a
 * progress bar. The countdown sits inside the oval on the theme's own background.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { TYPE } from '@/lib/fonts';
import { alpha, mix } from '@/lib/themes';

import type { BoardProps } from './boards';

/* Centre line of the lane: a rounded rectangle, t in [0,1) clockwise from the start line (top middle). */
function trackPoint(t: number, w: number, h: number, r: number): { x: number; y: number; a: number } {
  'worklet';
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = (((t % 1) + 1) % 1) * total + sw / 2;
  d %= total;
  const lens = [sw, arc, sh, arc, sw, arc, sh, arc];
  for (let i = 0; i < 8; i++) {
    const len = lens[i];
    if (d <= len) {
      const f = len ? d / len : 0;
      const q = (f * Math.PI) / 2;
      switch (i) {
        case 0:
          return { x: r + f * sw, y: 0, a: 0 };
        case 1:
          return { x: w - r + r * Math.sin(q), y: r - r * Math.cos(q), a: 90 * f };
        case 2:
          return { x: w, y: r + f * sh, a: 90 };
        case 3:
          return { x: w - r + r * Math.cos(q), y: h - r + r * Math.sin(q), a: 90 + 90 * f };
        case 4:
          return { x: w - r - f * sw, y: h, a: 180 };
        case 5:
          return { x: r - r * Math.sin(q), y: h - r + r * Math.cos(q), a: 180 + 90 * f };
        case 6:
          return { x: 0, y: h - r - f * sh, a: 270 };
        default:
          return { x: r - r * Math.cos(q), y: r - r * Math.sin(q), a: 270 + 90 * f };
      }
    }
    d -= len;
  }
  return { x: r, y: 0, a: 0 };
}

/** SVG path of the same centre line, starting at the start line and running clockwise. */
function trackPath(w: number, h: number, r: number): string {
  return [`M ${w / 2} 0`, `H ${w - r}`, `A ${r} ${r} 0 0 1 ${w} ${r}`, `V ${h - r}`, `A ${r} ${r} 0 0 1 ${w - r} ${h}`, `H ${r}`, `A ${r} ${r} 0 0 1 0 ${h - r}`, `V ${r}`, `A ${r} ${r} 0 0 1 ${r} 0`, 'Z'].join(' ');
}

/* Top-down F1 car as crisp vector shapes, nose to the right. 48 x 20 box. */
const CAR_W = 58;
const CAR_H = 20;

const TYRE = '#121316';
const RIM = '#3a3c42';
function Tyre({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={1.5} fill={TYRE} />
      <Rect x={x + w * 0.3} y={y + h * 0.3} width={w * 0.4} height={h * 0.4} rx={0.7} fill={RIM} />
    </>
  );
}

function RaceCar({ accent, width }: { accent: string; width: number }) {
  const dark = '#1c1d21';
  const body = accent;
  const pod = mix(accent, '#000000', 0.22);
  const stripe = mix(accent, '#ffffff', 0.55);
  return (
    <Svg width={width} height={(width * CAR_H) / CAR_W} viewBox="-10 0 58 20">
      {/* speed trail */}
      <Rect x={-9} y={7.6} width={9} height={1.1} rx={0.55} fill={accent} opacity={0.18} />
      <Rect x={-6} y={11.3} width={6} height={1.1} rx={0.55} fill={accent} opacity={0.14} />
      {/* ground shadow */}
      <Path d="M6 7.2 H26 L30.5 5.6 H36.5 L47.5 10.1 V11.9 L36.5 16.4 H30.5 L26 14.8 H6 Z" fill="#000000" opacity={0.28} />
      {/* rear wing */}
      <Rect x={1} y={2.5} width={4.5} height={15} rx={1.2} fill={dark} />
      <Rect x={1.8} y={3.3} width={1.2} height={13.4} rx={0.6} fill="#2c2e34" />
      {/* tyres */}
      <Tyre x={7} y={0.5} w={9} h={5} />
      <Tyre x={7} y={14.5} w={9} h={5} />
      <Tyre x={33} y={1.5} w={7.5} h={4.4} />
      <Tyre x={33} y={14.1} w={7.5} h={4.4} />
      {/* body: engine cover to nose */}
      <Path d="M5.5 6.2 H25 L29.5 4.6 H35.5 L46.5 9.1 V10.9 L35.5 15.4 H29.5 L25 13.8 H5.5 Z" fill={body} />
      {/* light catch on the upper half */}
      <Path d="M5.5 6.2 H25 L29.5 4.6 H35.5 L46.5 9.1 V10 H5.5 Z" fill="#ffffff" opacity={0.12} />
      {/* sidepods */}
      <Rect x={13} y={4.2} width={13} height={11.6} rx={3.2} fill={pod} />
      {/* centre stripe */}
      <Rect x={8} y={9.35} width={32} height={1.3} rx={0.6} fill={stripe} opacity={0.9} />
      {/* cockpit, helmet, halo */}
      <Path d="M20.5 10 a4.2 2.7 0 1 0 8.4 0 a4.2 2.7 0 1 0 -8.4 0 Z" fill="#202126" />
      <Path d="M22.9 10 a1.9 1.9 0 1 0 3.8 0 a1.9 1.9 0 1 0 -3.8 0 Z" fill="#f5f5f5" />
      <Path d="M27.2 7.6 a3 3 0 0 1 0 4.8" fill="none" stroke="#0f1013" strokeWidth={0.8} strokeLinecap="round" />
      {/* front wing */}
      <Rect x={40.5} y={3.2} width={2.6} height={13.6} rx={0.9} fill={dark} />
      <Rect x={41.1} y={3.9} width={0.9} height={12.2} rx={0.45} fill="#2c2e34" />
    </Svg>
  );
}

export function RaceBoard({ text, theme, width, maxSize, motion, remaining }: BoardProps) {
  const w = Math.min(width, maxSize * 3.8);
  const h = w * 0.44;
  const lane = Math.max(10, w * 0.055);
  const r = h * 0.42;
  const carW = lane * 4.8;
  const carH = (carW * CAR_H) / CAR_W;

  const target = remaining == null ? 0 : Math.min(1, Math.max(0, 1 - remaining));
  const prog = useSharedValue(target);
  useEffect(() => {
    prog.value = motion ? withTiming(target, { duration: 1000, easing: Easing.linear }) : target;
  }, [target, motion, prog]);

  // Geometry of the centre line (inset by half a lane so the lane stays inside the box).
  const cx = lane / 2;
  const cw = w - lane;
  const ch = h - lane;
  const cr = r - lane / 2;
  const perimeter = 2 * (cw - 2 * cr) + 2 * (ch - 2 * cr) + 2 * Math.PI * cr;

  const carStyle = useAnimatedStyle(() => {
    const p = trackPoint(prog.value, cw, ch, cr);
    return { transform: [{ translateX: cx + p.x - carW / 2 }, { translateY: cx + p.y - carH / 2 }, { rotate: `${p.a}deg` }] };
  });

  const asphalt = theme.light ? '#2c2f36' : '#26272c';
  const edge = theme.light ? alpha('#000000', 0.25) : alpha('#ffffff', 0.14);
  const path = trackPath(cw, ch, cr);
  const digits = Math.min(maxSize, (w - 2 * lane) / 3.4, (h - 2 * lane) * 0.66);
  const checker = lane / 3;

  return (
    <View style={{ width: w, height: h }} accessibilityLabel={text}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Path d={path} transform={`translate(${cx} ${cx})`} fill="none" stroke={asphalt} strokeWidth={lane} />
        {/* lap driven so far */}
        <Path d={path} transform={`translate(${cx} ${cx})`} fill="none" stroke={alpha(theme.accent, 0.35)} strokeWidth={lane} strokeDasharray={`${target * perimeter} ${perimeter}`} />
        {/* edges */}
        <Path d={path} transform={`translate(${cx} ${cx})`} fill="none" stroke={edge} strokeWidth={lane + 2} strokeDasharray="1 0" />
        <Path d={path} transform={`translate(${cx} ${cx})`} fill="none" stroke={asphalt} strokeWidth={lane} />
        <Path d={path} transform={`translate(${cx} ${cx})`} fill="none" stroke={alpha(theme.accent, 0.4)} strokeWidth={lane} strokeDasharray={`${target * perimeter} ${perimeter}`} />
        {/* centre dashes */}
        <Path d={path} transform={`translate(${cx} ${cx})`} fill="none" stroke={alpha('#ffffff', 0.28)} strokeWidth={1.5} strokeDasharray={`${lane * 0.6} ${lane * 0.6}`} />
        {/* checkered start / finish across the lane, top middle */}
        {Array.from({ length: 3 }, (_, i) =>
          Array.from({ length: 2 }, (_, j) => <Rect key={`${i}-${j}`} x={w / 2 - checker + j * checker} y={i * checker} width={checker} height={checker} fill={(i + j) % 2 ? '#111111' : '#f2f2f2'} />)
        )}
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: carW, height: carH }, carStyle]}>
        <RaceCar accent={theme.accent} width={carW} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text allowFontScaling={false} style={{ ...TYPE.heavy, fontSize: digits, lineHeight: digits * 1.1, letterSpacing: -digits * 0.03, color: theme.ink, fontVariant: ['tabular-nums'] }}>
          {text}
        </Text>
      </View>
    </View>
  );
}
