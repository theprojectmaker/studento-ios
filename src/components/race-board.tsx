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

/* Top-down F1 car, 16 x 9 pixels, nose to the right. C body, W wings, T tyres, H helmet, X cockpit. */
const CAR = ['...TT.......TT..', '...TT.......TT..', 'WW..CCCCCCCC..WW', 'WWCCCCCXXCCCCCWW', 'WWCCCCCHHCCCCCCC', 'WWCCCCCXXCCCCCWW', 'WW..CCCCCCCC..WW', '...TT.......TT..', '...TT.......TT..'];

function PixelCar({ accent, width }: { accent: string; width: number }) {
  const cells: { x: number; y: number; c: string }[] = [];
  const body = accent;
  const dark = mix(accent, '#000000', 0.45);
  CAR.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      cells.push({ x, y, c: ch === 'C' ? body : ch === 'W' ? dark : ch === 'T' ? '#15161a' : ch === 'H' ? '#f4f4f4' : '#2a2b30' });
    })
  );
  return (
    <Svg width={width} height={(width * 9) / 16} viewBox="0 0 16 9">
      {cells.map((c, i) => (
        <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.c} />
      ))}
    </Svg>
  );
}

export function RaceBoard({ text, theme, width, maxSize, motion, remaining }: BoardProps) {
  const w = Math.min(width, maxSize * 3.8);
  const h = w * 0.44;
  const lane = Math.max(10, w * 0.055);
  const r = h * 0.42;
  const carW = lane * 3.4;
  const carH = (carW * 9) / 16;

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
        <PixelCar accent={theme.accent} width={carW} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text allowFontScaling={false} style={{ ...TYPE.heavy, fontSize: digits, lineHeight: digits * 1.1, letterSpacing: -digits * 0.03, color: theme.ink, fontVariant: ['tabular-nums'] }}>
          {text}
        </Text>
      </View>
    </View>
  );
}
