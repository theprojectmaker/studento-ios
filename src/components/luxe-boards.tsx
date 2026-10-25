/**
 * Two showpiece boards:
 *  - ReelBoard: a slot machine. Every digit sits on a curved reel; when it
 *    changes the reel spins DOWN through a couple of blurred symbols and clunks
 *    onto the new one (small overshoot). Gold cabinet, payline, chasing bulbs.
 *  - DecoBoard: Art Deco gold. Metallic gradient digits in a double-line frame
 *    with sunburst corners; a soft shine sweeps across now and then.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { alpha, mix, type Theme } from '@/lib/themes';
import { fontStyle, GLYPH_W } from '@/lib/typefaces';

import type { BoardProps } from './boards';

const svgId = (raw: string) => 'g' + raw.replace(/[^a-zA-Z0-9]/g, '');

function digitW(theme: Theme): number {
  return (GLYPH_W[theme.type.digits] ?? 0.6) * (theme.type.digitScale ?? 1);
}

function fitSize(text: string, width: number, maxSize: number, cell: number, colon: number, gap: number) {
  let u = 0;
  for (const ch of text) u += ch === ':' ? colon : cell;
  u += Math.max(0, text.length - 1) * gap;
  return Math.max(14, Math.min(maxSize, width / u));
}

/* ---------------- slot reels ---------------- */

/** Symbols that blur past between the old and new digit. */
function spinGlyphs(cur: string): string[] {
  if (!/\d/.test(cur)) return [];
  const n = Number(cur);
  return [String((n + 3) % 10), String((n + 7) % 10)];
}

function ReelChar({ ch, w, h, theme, style, motion }: { ch: string; w: number; h: number; theme: Theme; style: TextStyle; motion: boolean }) {
  const [cur, setCur] = useState(ch);
  const [prev, setPrev] = useState(ch);
  if (ch !== cur) {
    setPrev(cur);
    setCur(ch);
  }
  const strip = prev === cur ? [cur] : [cur, ...spinGlyphs(cur), prev];
  const travel = (strip.length - 1) * h;
  const p = useSharedValue(1);
  useEffect(() => {
    if (!motion || prev === cur) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }); // rolls down and settles, no overshoot
  }, [cur, prev, motion, p]);
  // The strip moves down: it starts showing the old digit (bottom) and lands on the new one (top).
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: motion ? -travel * (1 - p.value) : 0 }] }));
  const id = svgId(useId());
  const glyph = { ...style, width: w, height: h, lineHeight: h, textAlign: 'center' as const, color: theme.tileInk };
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', borderRadius: Math.max(3, w * 0.08), backgroundColor: theme.tile }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, roll]}>
        {(motion ? strip : [cur]).map((g, i) => (
          <Text key={i} allowFontScaling={false} style={[glyph, i > 0 && i < strip.length - 1 ? { opacity: 0.45 } : null]}>
            {g}
          </Text>
        ))}
      </Animated.View>
      {/* Drum curvature: dark at the top and bottom edges, a soft highlight above center. */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.55} />
            <Stop offset="0.24" stopColor="#000000" stopOpacity={0} />
            <Stop offset="0.36" stopColor="#ffffff" stopOpacity={theme.light ? 0.12 : 0.1} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.76" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.6} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function Bulbs({ count, theme, motion, size }: { count: number; theme: Theme; motion: boolean; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!motion) return;
    p.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
  }, [motion, p]);
  const a = useAnimatedStyle(() => ({ opacity: !motion || p.value < 0.5 ? 1 : 0.28 }));
  const b = useAnimatedStyle(() => ({ opacity: !motion || p.value >= 0.5 ? 1 : 0.28 }));
  const bulb = mix(theme.accent, '#ffffff', 0.55);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: size }}>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            { width: size, height: size, borderRadius: size, backgroundColor: bulb, shadowColor: theme.accent, shadowOpacity: 1, shadowRadius: size, shadowOffset: { width: 0, height: 0 } },
            i % 2 ? b : a,
          ]}
        />
      ))}
    </View>
  );
}

/** Just the digit reels: no cabinet, no bulbs, no payline. */
function BareReels({ text, theme, width, maxSize, motion }: BoardProps) {
  const g = digitW(theme);
  const cell = Math.max(0.7, g + 0.16);
  const size = fitSize(text, width, maxSize * 0.95, cell, 0.3, 0.07);
  const w = size * cell;
  const h = size * 1.3;
  const style = { ...fontStyle(theme.type.digits, '800'), fontSize: size * (theme.type.digitScale ?? 1), fontVariant: ['tabular-nums' as const] };
  return (
    <View style={[styles.row, { gap: size * 0.07 }]} accessibilityLabel={text}>
      {[...text].map((ch, i) =>
        ch === ':' ? (
          <View key={`c${text.length - i}`} style={{ width: size * 0.3, height: h, alignItems: 'center', justifyContent: 'center', gap: size * 0.2 }}>
            <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: 99, backgroundColor: theme.accent }} />
            <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: 99, backgroundColor: theme.accent }} />
          </View>
        ) : (
          <ReelChar key={`r${text.length - i}`} ch={ch} w={w} h={h} theme={theme} style={style} motion={motion} />
        )
      )}
    </View>
  );
}

export function ReelBoard(props: BoardProps) {
  if (props.theme.bare) return <BareReels {...props} />;
  return <CabinetReels {...props} />;
}

function CabinetReels({ text, theme, width, maxSize, motion }: BoardProps) {
  const pad = Math.max(8, width * 0.03);
  const g = digitW(theme);
  const cell = Math.max(0.7, g + 0.16);
  const size = fitSize(text, width - pad * 2 - 8, maxSize * 0.86, cell, 0.32, 0.06);
  const w = size * cell;
  const h = size * 1.3;
  const bulb = Math.max(4, size * 0.07);
  const style = { ...fontStyle(theme.type.digits, '800'), fontSize: size * (theme.type.digitScale ?? 1), fontVariant: ['tabular-nums' as const] };
  return (
    <View
      style={{
        padding: pad * 0.6,
        borderRadius: size * 0.22,
        backgroundColor: theme.cabinet,
        borderWidth: 2,
        borderColor: theme.accent,
        gap: pad * 0.55,
        shadowColor: theme.accent,
        shadowOpacity: theme.light ? 0.15 : 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      }}>
      <Bulbs count={Math.max(6, Math.round(width / (bulb * 5)))} theme={theme} motion={motion} size={bulb} />
      <View style={{ padding: 4, borderRadius: size * 0.12, backgroundColor: mix(theme.cabinet, '#000000', 0.45), borderWidth: 1, borderColor: alpha(theme.accent, 0.55) }}>
        <View style={[styles.row, { gap: size * 0.06 }]} accessibilityLabel={text}>
          {[...text].map((ch, i) =>
            ch === ':' ? (
              <View key={`c${text.length - i}`} style={{ width: size * 0.32, height: h, alignItems: 'center', justifyContent: 'center', gap: size * 0.2 }}>
                <View style={{ width: size * 0.11, height: size * 0.11, borderRadius: 99, backgroundColor: theme.accent }} />
                <View style={{ width: size * 0.11, height: size * 0.11, borderRadius: 99, backgroundColor: theme.accent }} />
              </View>
            ) : (
              <ReelChar key={`r${text.length - i}`} ch={ch} w={w} h={h} theme={theme} style={style} motion={motion} />
            )
          )}
        </View>
        {/* Payline with arrow tabs. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>
          <View style={{ height: 1.5, marginHorizontal: 2, backgroundColor: alpha(theme.accent, 0.5) }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: -7, top: '50%', marginTop: -6, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: theme.accent }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -7, top: '50%', marginTop: -6, borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: theme.accent }} />
      </View>
      <Bulbs count={Math.max(6, Math.round(width / (bulb * 5)))} theme={theme} motion={motion} size={bulb} />
    </View>
  );
}

/* ---------------- Art Deco gold ---------------- */

function goldStops(theme: Theme) {
  const a = theme.accent;
  return [
    <Stop key="0" offset="0" stopColor={mix(a, '#ffffff', 0.6)} />,
    <Stop key="1" offset="0.38" stopColor={a} />,
    <Stop key="2" offset="0.52" stopColor={mix(a, '#000000', 0.42)} />,
    <Stop key="3" offset="0.7" stopColor={a} />,
    <Stop key="4" offset="1" stopColor={mix(a, '#ffffff', 0.35)} />,
  ];
}

/** One metallic glyph. */
function GoldGlyph({ ch, w, h, size, theme }: { ch: string; w: number; h: number; size: number; theme: Theme }) {
  const id = svgId(useId());
  const font = theme.type.digits === 'system' ? undefined : theme.type.digits;
  const y = h / 2 + size * 0.36;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {goldStops(theme)}
        </LinearGradient>
      </Defs>
      <SvgText x={w / 2 + size * 0.025} y={y + size * 0.03} fontSize={size} fontFamily={font} fontWeight={font ? undefined : '300'} textAnchor="middle" fill="#000000" fillOpacity={theme.light ? 0.12 : 0.55}>
        {ch}
      </SvgText>
      <SvgText x={w / 2} y={y} fontSize={size} fontFamily={font} fontWeight={font ? undefined : '300'} textAnchor="middle" fill={`url(#${id})`}>
        {ch}
      </SvgText>
    </Svg>
  );
}

function DecoChar({ ch, w, h, size, theme, motion }: { ch: string; w: number; h: number; size: number; theme: Theme; motion: boolean }) {
  const [cur, setCur] = useState(ch);
  const [prev, setPrev] = useState(ch);
  if (ch !== cur) {
    setPrev(cur);
    setCur(ch);
  }
  const p = useSharedValue(1);
  useEffect(() => {
    if (!motion || prev === cur) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
  }, [cur, prev, motion, p]);
  const out = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const inn = useAnimatedStyle(() => ({ opacity: p.value }));
  if (!motion || prev === cur) {
    return (
      <View style={{ width: w, height: h }}>
        <GoldGlyph ch={cur} w={w} h={h} size={size} theme={theme} />
      </View>
    );
  }
  return (
    <View style={{ width: w, height: h }}>
      <Animated.View style={[StyleSheet.absoluteFill, out]}>
        <GoldGlyph ch={prev} w={w} h={h} size={size} theme={theme} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, inn]}>
        <GoldGlyph ch={cur} w={w} h={h} size={size} theme={theme} />
      </Animated.View>
    </View>
  );
}

function DecoFrame({ W, H, theme }: { W: number; H: number; theme: Theme }) {
  const c = theme.accent;
  const fan = (x: number, y: number, sx: number, sy: number) =>
    [0, 1, 2, 3, 4].map((k) => {
      const ang = (k / 4) * (Math.PI / 2);
      const len = 14 + (k % 2 ? 0 : 6);
      return <Line key={`${x}${y}${k}`} x1={x} y1={y} x2={x + sx * Math.cos(ang) * len} y2={y + sy * Math.sin(ang) * len} stroke={c} strokeWidth={0.9} strokeOpacity={0.85} />;
    });
  const mid = W / 2;
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={1} y={1} width={W - 2} height={H - 2} stroke={c} strokeWidth={1.6} fill="none" />
      <Rect x={7} y={7} width={W - 14} height={H - 14} stroke={c} strokeWidth={0.7} strokeOpacity={0.7} fill="none" />
      {fan(7, 7, 1, 1)}
      {fan(W - 7, 7, -1, 1)}
      {fan(7, H - 7, 1, -1)}
      {fan(W - 7, H - 7, -1, -1)}
      <Path d={`M${mid - 8} 1 L${mid} -6 L${mid + 8} 1 L${mid} 8 Z`} fill={theme.bg} stroke={c} strokeWidth={1.2} />
      <Path d={`M${mid - 8} ${H - 1} L${mid} ${H - 8} L${mid + 8} ${H - 1} L${mid} ${H + 6} Z`} fill={theme.bg} stroke={c} strokeWidth={1.2} />
    </Svg>
  );
}

function Shine({ W, H, motion }: { W: number; H: number; motion: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!motion) return;
    p.value = withRepeat(withSequence(withTiming(0, { duration: 0 }), withDelay(5200, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }))), -1, false);
  }, [motion, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -W * 0.4 + p.value * W * 1.6 }, { skewX: '-20deg' }] }));
  if (!motion) return null;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, width: W * 0.16, height: H, backgroundColor: 'rgba(255,255,255,0.07)' }, style]} />;
}

export function DecoBoard({ text, theme, width, maxSize, motion }: BoardProps) {
  const pad = Math.max(18, width * 0.06);
  const g = digitW(theme);
  const cell = Math.max(0.58, g + 0.06);
  const colon = Math.max(0.3, g * 0.5);
  const size = fitSize(text, width - pad * 2, maxSize * 1.2, cell, colon, 0);
  const h = size * 1.2;
  let inner = 0;
  for (const ch of text) inner += size * (ch === ':' ? colon : cell);
  const W = inner + pad * 2;
  const H = h + pad * 1.2;
  const fs = size * (theme.type.digitScale ?? 1);
  return (
    <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <Shine W={W} H={H} motion={motion} />
      </View>
      <DecoFrame W={W} H={H} theme={theme} />
      <View style={styles.row} accessibilityLabel={text}>
        {[...text].map((ch, i) => (
          <DecoChar key={text.length - i} ch={ch} w={size * (ch === ':' ? colon : cell)} h={h} size={fs} theme={theme} motion={motion} />
        ))}
      </View>
    </View>
  );
}

/* ---------------- small clocks under the countdown ---------------- */

export function SmallLuxeClock({ text, theme, motion }: { text: string; theme: Theme; motion: boolean }): ReactNode {
  if (theme.engine === 'reel') {
    const size = 20;
    if (theme.bare) {
      const w = size * Math.max(0.7, digitW(theme) + 0.16);
      const st = { ...fontStyle(theme.type.digits, '800'), fontSize: size * (theme.type.digitScale ?? 1) };
      return (
        <View style={[styles.row, { gap: 3 }]}>
          {[...text].map((ch, i) =>
            /\d/.test(ch) ? (
              <ReelChar key={text.length - i} ch={ch} w={w} h={size * 1.3} theme={theme} style={st} motion={motion} />
            ) : (
              <Text key={text.length - i} allowFontScaling={false} style={{ ...st, color: theme.accent, width: size * 0.36, textAlign: 'center' }}>
                {ch}
              </Text>
            )
          )}
        </View>
      );
    }
    const w = size * Math.max(0.7, digitW(theme) + 0.16);
    const style = { ...fontStyle(theme.type.digits, '800'), fontSize: size * (theme.type.digitScale ?? 1) };
    return (
      <View style={[styles.row, { gap: 2, padding: 3, borderRadius: 8, backgroundColor: theme.cabinet, borderWidth: 1, borderColor: alpha(theme.accent, 0.7) }]}>
        {[...text].map((ch, i) =>
          /\d/.test(ch) ? (
            <ReelChar key={text.length - i} ch={ch} w={w} h={size * 1.3} theme={theme} style={style} motion={motion} />
          ) : (
            <Text key={text.length - i} allowFontScaling={false} style={{ ...style, color: theme.accent, width: size * 0.36, textAlign: 'center' }}>
              {ch}
            </Text>
          )
        )}
      </View>
    );
  }
  const size = 24 * Math.min(1, 0.62 / (GLYPH_W[theme.type.digits] ?? 0.6));
  const cw = size * Math.max(0.58, digitW(theme) + 0.06);
  return (
    <View style={styles.row}>
      {[...text].map((ch, i) => (
        <GoldGlyph key={i} ch={ch} w={ch === ':' ? cw * 0.5 : ch === ' ' ? cw * 0.4 : cw} h={size * 1.25} size={size} theme={theme} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
