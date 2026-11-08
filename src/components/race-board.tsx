/**
 * Race Track: a pixel race car laps an oval while the period runs. One lap = one period
 * (car position = share of the period that is done). The countdown sits in the infield.
 * Outside school the car parks at the start line and the infield shows the clock.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { MONO } from '@/lib/fonts';
import { alpha } from '@/lib/themes';

import type { BoardProps } from './boards';

/* Track geometry: a rounded rectangle. t in [0,1) runs clockwise from the start line (top middle). */
function trackPoint(t: number, w: number, h: number, r: number): { x: number; y: number; a: number } {
  'worklet';
  const sw = w - 2 * r; // straight width
  const sh = h - 2 * r; // straight height
  const arc = (Math.PI * r) / 2;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = ((t % 1) + 1) % 1 * total;
  // Start at the top straight's middle, heading right.
  d += sw / 2;
  d %= total;
  const segs: { len: number; kind: 'top' | 'tr' | 'right' | 'br' | 'bottom' | 'bl' | 'left' | 'tl' }[] = [
    { len: sw, kind: 'top' },
    { len: arc, kind: 'tr' },
    { len: sh, kind: 'right' },
    { len: arc, kind: 'br' },
    { len: sw, kind: 'bottom' },
    { len: arc, kind: 'bl' },
    { len: sh, kind: 'left' },
    { len: arc, kind: 'tl' },
  ];
  for (const s of segs) {
    if (d <= s.len) {
      const f = s.len ? d / s.len : 0;
      switch (s.kind) {
        case 'top':
          return { x: r + f * sw, y: 0, a: 0 };
        case 'tr': {
          const th = -Math.PI / 2 + f * (Math.PI / 2);
          return { x: w - r + r * Math.cos(th), y: r + r * Math.sin(th), a: 90 * f };
        }
        case 'right':
          return { x: w, y: r + f * sh, a: 90 };
        case 'br': {
          const th = f * (Math.PI / 2);
          return { x: w - r + r * Math.cos(th), y: h - r + r * Math.sin(th), a: 90 + 90 * f };
        }
        case 'bottom':
          return { x: w - r - f * sw, y: h, a: 180 };
        case 'bl': {
          const th = Math.PI / 2 + f * (Math.PI / 2);
          return { x: r + r * Math.cos(th), y: h - r + r * Math.sin(th), a: 180 + 90 * f };
        }
        case 'left':
          return { x: 0, y: h - r - f * sh, a: 270 };
        case 'tl': {
          const th = Math.PI + f * (Math.PI / 2);
          return { x: r + r * Math.cos(th), y: r + r * Math.sin(th), a: 270 + 90 * f };
        }
      }
    }
    d -= s.len;
  }
  return { x: r, y: 0, a: 0 };
}

/* A 14x8 pixel car, drawn pointing right. */
const CAR: string[] = [
  '....######....',
  '...#BBBBBB#...',
  '..#BBWWWWBB#..',
  '.##CCCCCCCC##.',
  '#CCCCCCCCCCCC#',
  '#CCCCCCCCCCCC#',
  '.##CCCCCCCC##.',
  '..TT......TT..',
];

function PixelCar({ accent, size }: { accent: string; size: number }) {
  const px = size / 14;
  const cells: { x: number; y: number; c: string }[] = [];
  CAR.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const c = ch === 'C' ? accent : ch === 'B' ? '#1b1b1f' : ch === 'W' ? '#dfe7f5' : ch === 'T' ? '#111111' : '#2a2a2e';
      cells.push({ x, y, c });
    })
  );
  return (
    <Svg width={size} height={px * 8} viewBox={`0 0 14 8`}>
      {cells.map((c, i) => (
        <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.c} />
      ))}
    </Svg>
  );
}

export function RaceBoard({ text, theme, width, maxSize, motion, remaining }: BoardProps) {
  const w = Math.min(width, maxSize * 4.2);
  const h = w * 0.56;
  const lane = Math.max(14, w * 0.085);
  const r = h * 0.36;
  const car = Math.max(22, lane * 1.5);
  // Progress around the lap: 0 at the start line, 1 at the bell.
  const target = remaining == null ? 0 : Math.min(1, Math.max(0, 1 - remaining));
  const prog = useSharedValue(target);
  useEffect(() => {
    prog.value = motion ? withTiming(target, { duration: 1000, easing: Easing.linear }) : target;
  }, [target, motion, prog]);

  // Centre line of the lane (the car drives on it).
  const inner = { x: lane / 2, y: lane / 2, w: w - lane, h: h - lane, r: r - lane / 2 };
  const carStyle = useAnimatedStyle(() => {
    const p = trackPoint(prog.value, inner.w, inner.h, inner.r);
    return { transform: [{ translateX: inner.x + p.x - car / 2 }, { translateY: inner.y + p.y - (car * 8) / 14 / 2 }, { rotate: `${p.a}deg` }] };
  });

  const digits = Math.min(maxSize, (w - 2 * lane) / 3.6, (h - 2 * lane) * 0.62);
  const asphalt = theme.light ? '#3a3a3a' : '#2a2a2c';
  const grass = theme.light ? alpha(theme.accent, 0.1) : alpha('#3ba55d', 0.22);

  return (
    <View style={{ width: w, height: h }} accessibilityLabel={text}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {/* grass */}
        <Rect x={0} y={0} width={w} height={h} rx={r} fill={grass} />
        {/* asphalt lane */}
        <Rect x={lane / 2} y={lane / 2} width={w - lane} height={h - lane} rx={r - lane / 2} fill="none" stroke={asphalt} strokeWidth={lane} />
        {/* kerbs */}
        <Rect x={lane / 2} y={lane / 2} width={w - lane} height={h - lane} rx={r - lane / 2} fill="none" stroke={alpha('#ffffff', 0.5)} strokeWidth={1.5} strokeDasharray={`${lane * 0.5} ${lane * 0.5}`} />
        <Rect x={lane / 2} y={lane / 2} width={w - lane} height={h - lane} rx={r - lane / 2} fill="none" stroke={alpha(theme.accent, 0.8)} strokeWidth={1.5} strokeDasharray={`${lane * 0.5} ${lane * 0.5}`} strokeDashoffset={lane * 0.5} />
        {/* centre dashes */}
        <Rect x={lane / 2} y={lane / 2} width={w - lane} height={h - lane} rx={r - lane / 2} fill="none" stroke={alpha('#ffffff', 0.22)} strokeWidth={1} strokeDasharray={`${lane * 0.4} ${lane * 0.6}`} />
        {/* start / finish line, top middle */}
        <Line x1={w / 2} y1={0} x2={w / 2} y2={lane} stroke="#ffffff" strokeWidth={3} strokeDasharray="3 3" />
        <Line x1={w / 2 + 3} y1={0} x2={w / 2 + 3} y2={lane} stroke="#111111" strokeWidth={3} strokeDasharray="3 3" strokeDashoffset={3} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: car, height: (car * 8) / 14 }, carStyle]}>
        <PixelCar accent={theme.accent} size={car} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text allowFontScaling={false} style={{ fontFamily: MONO, fontWeight: '700', fontSize: digits, lineHeight: digits * 1.1, color: theme.ink, fontVariant: ['tabular-nums'], letterSpacing: digits * 0.02 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}
