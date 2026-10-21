/**
 * The countdown in each theme's board style. Text is laid out in fixed-width
 * cells; a cell cross-fades (180 ms) only when its own character changes, so
 * nothing jumps or flickers.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { MONO, TYPE } from '@/lib/fonts';
import { fontStyle, GLYPH_W } from '@/lib/typefaces';
import { alpha, mix, type Theme } from '@/lib/themes';

import { Glass } from './glass';
import { DecoBoard, ReelBoard, SmallLuxeClock } from './luxe-boards';

/** The theme's countdown font. */
function digitFont(theme: Theme, weight: TextStyle['fontWeight']): TextStyle {
  return fontStyle(theme.type.digits, weight);
}

const SIGN_FONTS = new Set<string>(['VT323_400Regular', 'ShareTechMono_400Regular', 'PressStart2P_400Regular', 'Orbitron_800ExtraBold', 'JetBrainsMono_800ExtraBold', 'RubikMonoOne_400Regular', 'Silkscreen_400Regular']);
/** Raw digit width of the theme's countdown font (fraction of font size). */
function rawW(theme: Theme): number {
  return GLYPH_W[theme.type.digits] ?? 0.6;
}
/** Cell widths for rolling text so wide fonts (pixel, Orbitron...) never overlap. */
function cells(theme: Theme): { d: number; c: number } {
  const g = rawW(theme) * (theme.type.digitScale ?? 1);
  return { d: Math.max(0.56, g + 0.05), c: Math.max(0.3, g * 0.5) };
}
/** Same for LED/LCD, which use signFont(). */
function signCells(theme: Theme): { d: number; c: number } {
  const g = SIGN_FONTS.has(theme.type.digits) ? rawW(theme) : GLYPH_W.mono;
  return { d: g + 0.05, c: Math.max(0.36, g * 0.55) };
}

/** LED/LCD boards keep a sign-like font: the theme's if it is one, else monospace. */
function signFont(theme: Theme): TextStyle {
  return SIGN_FONTS.has(theme.type.digits) ? fontStyle(theme.type.digits) : { fontFamily: MONO, fontWeight: '700' };
}

export interface BoardProps {
  text: string;
  theme: Theme;
  width: number;
  maxSize: number;
  motion: boolean;
  /** 0..1 of the period still left (ring). */
  remaining?: number;
  /** Small line inside the ring. */
  caption?: string;
  /** Seconds left, for the analog timer face. */
  secondsLeft?: number;
  /** Wrap the board in a Liquid Glass housing (flap). */
  glass?: boolean;
}

/* ---------------- rolling characters ---------------- */

function RollChar({ ch, w, h, style, motion }: { ch: string; w: number; h: number; style: TextStyle; motion: boolean }) {
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
    p.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [cur, prev, motion, p]);
  const outStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const inStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const t = { ...style, width: w, height: h, lineHeight: h, textAlign: 'center' as const };
  if (!motion) {
    return (
      <View style={{ width: w, height: h }}>
        <Text allowFontScaling={false} style={t}>
          {cur}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Animated.Text allowFontScaling={false} style={[t, styles.abs, outStyle]}>
        {prev}
      </Animated.Text>
      <Animated.Text allowFontScaling={false} style={[t, styles.abs, inStyle]}>
        {cur}
      </Animated.Text>
    </View>
  );
}

/** A row of rolling cells. Colons get a narrower cell. */
function RollText({ text, size, style, motion, digitW = 0.62, colonW = 0.32, scale = 1 }: { text: string; size: number; style: TextStyle; motion: boolean; digitW?: number; colonW?: number; scale?: number }) {
  const h = size * 1.15;
  return (
    <View style={styles.row} accessibilityLabel={text}>
      {[...text].map((ch, i) => (
        // Keyed by position from the right so "9:59" -> "10:00" keeps the seconds cells stable.
        <RollChar key={text.length - i} ch={ch} w={size * (ch === ':' ? colonW : digitW)} h={h} style={{ ...style, fontSize: size * scale }} motion={motion} />
      ))}
    </View>
  );
}

function units(text: string, digitW: number, colonW: number, gap = 0) {
  let u = 0;
  for (const ch of text) u += ch === ':' ? colonW : digitW;
  return u + Math.max(0, text.length - 1) * gap;
}

function fit(text: string, width: number, maxSize: number, digitW: number, colonW: number, gap = 0) {
  return Math.max(14, Math.min(maxSize, width / units(text, digitW, colonW, gap)));
}

/* ---------------- board switch ---------------- */

export function Board(props: BoardProps) {
  switch (props.theme.engine) {
    case 'ring':
      return <RingBoard {...props} />;
    case 'dial':
      return <DialBoard {...props} />;
    case 'led':
      return <LedBoard {...props} />;
    case 'lcd':
      return <LcdBoard {...props} />;
    case 'nixie':
      return <NixieBoard {...props} />;
    case 'ink':
      return <InkBoard {...props} />;
    case 'reel':
      return <ReelBoard {...props} />;
    case 'deco':
      return <DecoBoard {...props} />;
    default:
      return <FlapBoard {...props} />;
  }
}

/* ---------------- big clean type ---------------- */

export function InkBoard({ text, theme, width, maxSize, motion }: BoardProps) {
  const serif = theme.font === 'serif';
  const cw = cells(theme);
  const size = fit(text, width, maxSize * 1.3, cw.d, cw.c);
  return (
    <RollText
      text={text}
      size={size}
      motion={motion}
      digitW={cw.d}
      colonW={cw.c}
      scale={theme.type.digitScale ?? 1}
      style={{ ...digitFont(theme, serif ? '400' : '200'), color: theme.ink, fontVariant: ['tabular-nums'] }}
    />
  );
}

/* ---------------- Apple Timer ring ---------------- */

export function RingBoard({ text, theme, width, maxSize, remaining = 1, caption, motion }: BoardProps) {
  const size = Math.min(width, maxSize * 2.9, 400);
  const stroke = Math.max(9, size * 0.036);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, remaining));
  const cw = cells(theme);
  const digits = fit(text, size * 0.74, size * 0.27, cw.d, cw.c);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={alpha(theme.ink, theme.light ? 0.1 : 0.14)} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * left} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <RollText text={text} size={digits} motion={motion} digitW={cw.d} colonW={cw.c} scale={theme.type.digitScale ?? 1} style={{ ...digitFont(theme, '200'), color: theme.ink, fontVariant: ['tabular-nums'] }} />
      {caption ? <Text style={{ ...TYPE.medium, fontSize: Math.max(14, size * 0.046), color: theme.muted }}>{caption}</Text> : null}
    </View>
  );
}

/* ---------------- split-flap (the original Studento board) ---------------- */

function Housing({ theme, glass, pad, radius, children }: { theme: Theme; glass?: boolean; pad: number; radius: number; children: ReactNode }) {
  if (glass) {
    return (
      <Glass theme={theme} radius={radius} style={{ padding: pad }}>
        {children}
      </Glass>
    );
  }
  return (
    <View
      style={{
        padding: pad,
        borderRadius: radius,
        backgroundColor: theme.light ? mix(theme.bg, '#000000', 0.06) : mix(theme.bg, '#000000', 0.35),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
      }}>
      {children}
    </View>
  );
}

/**
 * A real split-flap tile. When the character changes, the old character's top
 * half folds down on the hinge (0 to -90 deg), then the new character's bottom
 * half lands (90 to 0 deg) with a little bounce of shading, like a departure
 * board. Underneath, the static top half already shows the new character and the
 * static bottom half the old one, so every frame is a physically correct board.
 */
function FlipTile({
  ch,
  w,
  h,
  radius,
  textStyle,
  top,
  bottom,
  motion,
}: {
  ch: string;
  w: number;
  h: number;
  radius: number;
  textStyle: TextStyle;
  top: string;
  bottom: string;
  motion: boolean;
}) {
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
    p.value = withTiming(1, { duration: 360, easing: Easing.inOut(Easing.quad) });
  }, [cur, prev, motion, p]);

  const half = h / 2;
  const glyph = { ...textStyle, width: w, height: h, lineHeight: h, textAlign: 'center' as const };

  // Falling top flap (old char): visible for the first half of the flip.
  const fall = useAnimatedStyle(() => ({
    opacity: p.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 600 }, { rotateX: `${-180 * Math.min(p.value, 0.5)}deg` }],
  }));
  const fallShade = useAnimatedStyle(() => ({ opacity: Math.min(p.value, 0.5) * 1.1 }));
  // Landing bottom flap (new char): swings in for the second half, then stays flat.
  const land = useAnimatedStyle(() => ({
    opacity: p.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 600 }, { rotateX: `${180 * (1 - Math.max(p.value, 0.5))}deg` }],
  }));
  const landShade = useAnimatedStyle(() => ({ opacity: (1 - Math.max(p.value, 0.5)) * 1.2 }));

  const topHalf = (text: string, extra?: object) => (
    <View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: half, overflow: 'hidden', backgroundColor: top, borderTopLeftRadius: radius, borderTopRightRadius: radius }, extra]}>
      <Text allowFontScaling={false} style={glyph}>
        {text}
      </Text>
    </View>
  );
  const bottomHalf = (text: string, extra?: object) => (
    <View style={[{ position: 'absolute', left: 0, top: half, width: w, height: half, overflow: 'hidden', backgroundColor: bottom, borderBottomLeftRadius: radius, borderBottomRightRadius: radius }, extra]}>
      <Text allowFontScaling={false} style={[glyph, { marginTop: -half }]}>
        {text}
      </Text>
    </View>
  );

  if (!motion) {
    return (
      <View style={{ width: w, height: h }}>
        {topHalf(cur)}
        {bottomHalf(cur)}
      </View>
    );
  }

  return (
    <View style={{ width: w, height: h }}>
      {topHalf(cur)}
      {bottomHalf(prev)}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: half, transformOrigin: 'bottom', backfaceVisibility: 'hidden' }, fall]}>
        {topHalf(prev, { position: 'relative' })}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', borderTopLeftRadius: radius, borderTopRightRadius: radius }, fallShade]} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: half, width: w, height: half, transformOrigin: 'top', backfaceVisibility: 'hidden' }, land]}>
        {bottomHalf(cur, { position: 'relative', top: 0 })}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', borderBottomLeftRadius: radius, borderBottomRightRadius: radius }, landShade]} />
      </Animated.View>
    </View>
  );
}

export function FlapBoard({ text, theme, width, maxSize, motion, glass }: BoardProps) {
  const pad = Math.max(6, width * 0.02);
  const size = fit(text, width - pad * 2, maxSize, 0.74, 0.3, 0.05);
  const tileW = size * 0.74;
  const tileH = size * 1.32;
  const top = mix(theme.tile, '#ffffff', 0.05);
  return (
    <Housing theme={theme} glass={glass} pad={pad} radius={size * 0.2}>
      <View style={[styles.row, { gap: size * 0.05 }]} accessibilityLabel={text}>
        {[...text].map((ch, i) =>
          ch === ':' ? (
            <View key={`c${text.length - i}`} style={{ width: size * 0.3, height: tileH, alignItems: 'center', justifyContent: 'center', gap: size * 0.22 }}>
              <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: 99, backgroundColor: alpha(theme.tileInk, 0.45) }} />
              <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: 99, backgroundColor: alpha(theme.tileInk, 0.45) }} />
            </View>
          ) : (
            <View key={`t${text.length - i}`} style={{ width: tileW, height: tileH }}>
              <FlipTile
                ch={ch}
                w={tileW}
                h={tileH}
                radius={size * 0.1}
                top={top}
                bottom={theme.tile}
                motion={motion}
                textStyle={{ ...digitFont(theme, '800'), fontSize: size * Math.min(theme.type.digitScale ?? 1, 0.64 / rawW(theme)), color: theme.tileInk, fontVariant: ['tabular-nums'] }}
              />
              <View style={{ position: 'absolute', left: 0, right: 0, top: tileH / 2 - 1, height: 2, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            </View>
          )
        )}
      </View>
    </Housing>
  );
}

/** The website's small flap clock at the bottom: "09:47:31" + AM. */
export function SmallFlapClock({ text, suffix, theme, motion, glass, height = 34 }: { text: string; suffix?: string; theme: Theme; motion: boolean; glass?: boolean; height?: number }) {
  const size = height / 1.32;
  const tileW = size * 0.78;
  return (
    <View style={[styles.row, { gap: 8 }]}>
      <Housing theme={theme} glass={glass} pad={5} radius={12}>
        <View style={[styles.row, { gap: 3 }]}>
          {[...text].map((ch, i) =>
            ch === ':' ? (
              <Text key={`c${i}`} allowFontScaling={false} style={{ ...TYPE.bold, fontSize: size * 0.7, color: theme.muted, width: size * 0.3, textAlign: 'center' }}>
                :
              </Text>
            ) : (
              <View key={`t${text.length - i}`} style={{ width: tileW, height }}>
                <FlipTile
                  ch={ch}
                  w={tileW}
                  h={height}
                  radius={5}
                  top={mix(theme.tile, '#ffffff', 0.05)}
                  bottom={theme.tile}
                  motion={motion}
                  textStyle={{ ...digitFont(theme, '700'), fontSize: size * Math.min(0.95 * (theme.type.digitScale ?? 1), 0.7 / rawW(theme)), color: theme.tileInk }}
                />
                <View style={{ position: 'absolute', left: 0, right: 0, top: height / 2 - 0.5, height: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
              </View>
            )
          )}
        </View>
      </Housing>
      {suffix ? <Text style={{ ...TYPE.bold, fontSize: size * 0.62, color: theme.muted }}>{suffix}</Text> : null}
    </View>
  );
}

/* ---------------- LED sign ---------------- */

export function LedBoard({ text, theme, width, maxSize, motion }: BoardProps) {
  const cw = signCells(theme);
  const size = fit(text, width, maxSize * 1.15, cw.d, cw.c);
  const base: TextStyle = signFont(theme);
  return (
    <View>
      <View style={styles.abs}>
        <RollText text={text.replace(/\d/g, '8')} size={size} motion={false} digitW={cw.d} colonW={cw.c} style={{ ...base, color: alpha(theme.accent, 0.08) }} />
      </View>
      <RollText
        text={text}
        size={size}
        motion={motion}
        digitW={cw.d}
        colonW={cw.c}
        style={{ ...base, color: theme.accent, textShadowColor: alpha(theme.glow, 0.9), textShadowRadius: size * 0.2, textShadowOffset: { width: 0, height: 0 } }}
      />
    </View>
  );
}

/* ---------------- LCD ---------------- */

export function LcdBoard({ text, theme, width, maxSize, motion }: BoardProps) {
  const pad = 18;
  const cw = signCells(theme);
  const size = fit(text, width - pad * 2, maxSize, cw.d, cw.c);
  const base: TextStyle = { ...signFont(theme), fontStyle: SIGN_FONTS.has(theme.type.digits) ? 'normal' : 'italic' };
  return (
    <View style={{ backgroundColor: theme.lcd, borderRadius: 18, paddingHorizontal: pad, paddingVertical: 8, borderWidth: 2, borderColor: mix(theme.lcd, '#000000', 0.3) }}>
      <View style={{ position: 'absolute', left: pad, top: 8 }}>
        <RollText text={text.replace(/\d/g, '8')} size={size} motion={false} digitW={cw.d} colonW={cw.c} style={{ ...base, color: alpha(theme.lcdInk, 0.1) }} />
      </View>
      <RollText text={text} size={size} motion={motion} digitW={cw.d} colonW={cw.c} style={{ ...base, color: theme.lcdInk }} />
    </View>
  );
}

/* ---------------- nixie tubes ---------------- */

export function NixieBoard({ text, theme, width, maxSize, motion }: BoardProps) {
  const size = fit(text, width, maxSize, 0.68, 0.3, 0.06);
  const tubeW = size * 0.68;
  const tubeH = size * 1.32;
  const dot = { width: size * 0.08, height: size * 0.08, borderRadius: 99, backgroundColor: theme.accent };
  const lit = mix(theme.accent, '#ffffff', 0.25);
  return (
    <View style={[styles.row, { gap: size * 0.06 }]} accessibilityLabel={text}>
      {[...text].map((ch, i) =>
        ch === ':' ? (
          <View key={`c${text.length - i}`} style={{ width: size * 0.3, height: tubeH, alignItems: 'center', justifyContent: 'center', gap: size * 0.22 }}>
            <View style={dot} />
            <View style={dot} />
          </View>
        ) : (
          <View
            key={`t${text.length - i}`}
            style={{
              width: tubeW,
              height: tubeH,
              borderTopLeftRadius: tubeW / 2,
              borderTopRightRadius: tubeW / 2,
              borderBottomLeftRadius: size * 0.08,
              borderBottomRightRadius: size * 0.08,
              backgroundColor: 'rgba(255,170,90,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,220,180,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text allowFontScaling={false} style={{ position: 'absolute', fontSize: size, fontWeight: '200', color: alpha(theme.accent, 0.1) }}>
              8
            </Text>
            <RollChar
              ch={ch}
              w={tubeW}
              h={size * 1.15}
              motion={motion}
              style={{ ...digitFont(theme, '300'), fontSize: size, color: lit, textShadowColor: theme.accent, textShadowRadius: size * 0.22, textShadowOffset: { width: 0, height: 0 } }}
            />
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute', left: 0, top: 0 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});

/* ---------------- analog kitchen timer ---------------- */

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function polar(c: number, r: number, turn: number) {
  const a = turn * 2 * Math.PI - Math.PI / 2;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
}

/** A clock face used as a timer: the colored wedge is the minutes left until the bell. */
export function DialBoard({ text, theme, width, maxSize, motion, secondsLeft = 0 }: BoardProps) {
  const size = Math.min(width * 0.72, maxSize * 1.65, 340);
  const c = 150;
  const st = theme.dialStyle;
  const left = Math.max(0, Math.min(1, secondsLeft / 3600));
  const end = polar(c, 118, left);
  const wedge = left >= 0.999 ? `M ${c} ${c - 118} A 118 118 0 1 1 ${c - 0.01} ${c - 118} Z` : `M ${c} ${c} L ${c} ${c - 118} A 118 118 0 ${left > 0.5 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
  const hand = polar(c, 108, left);
  const serif = st === 'grandfather' || st === 'pocket';
  const swiss = st === 'swiss';
  const cw = cells(theme);
  const digits = fit(text, width * 0.6, Math.min(maxSize * 0.42, 52), cw.d, cw.c);
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Svg width={size} height={size} viewBox="0 0 300 300">
        {st === 'diver' ? <Circle cx={c} cy={c} r={148} fill={mix(theme.dialFace, '#000000', 0.45)} /> : null}
        <Circle cx={c} cy={c} r={st === 'diver' ? 137 : 146} fill={theme.dialFace} stroke={alpha(theme.dialTick, 0.25)} strokeWidth={1.5} />
        <Path d={wedge} fill={alpha(theme.dialSecond, 0.22)} />
        {Array.from({ length: 60 }, (_, i) => {
          const big = i % 5 === 0;
          if (st === 'minimal' && i % 15 !== 0) return null;
          if (st === 'sector' && !big) return null;
          const a = polar(c, swiss ? (big ? 100 : 114) : big ? 110 : 117, i / 60);
          const b = polar(c, 124, i / 60);
          return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.dialTick} strokeWidth={swiss ? (big ? 7 : 2.4) : big ? 3.4 : 1.3} strokeLinecap={swiss ? 'butt' : 'round'} />;
        })}
        {theme.numerals !== 'none'
          ? Array.from({ length: 12 }, (_, i) => {
              if (theme.numerals === 'quarters' && i % 3 !== 0) return null;
              const p = polar(c, 88, i / 12);
              const label = theme.numerals === 'roman' ? ROMAN[i] : String(i * 5);
              return (
                <SvgText key={i} x={p.x} y={p.y + 7} fill={theme.dialInk} fontSize={theme.numerals === 'roman' ? 18 : 20} fontWeight={serif ? '400' : '600'} fontFamily={serif ? 'Georgia' : undefined} textAnchor="middle">
                  {label}
                </SvgText>
              );
            })
          : null}
        <Line x1={c} y1={c} x2={hand.x} y2={hand.y} stroke={theme.dialSecond} strokeWidth={swiss ? 6 : 4} strokeLinecap="round" />
        <Circle cx={c} cy={c} r={8} fill={theme.dialSecond} />
        <Circle cx={c} cy={c} r={3} fill={theme.dialFace} />
      </Svg>
      <RollText text={text} size={digits} motion={motion} digitW={cw.d} colonW={cw.c} scale={theme.type.digitScale ?? 1} style={{ ...digitFont(theme, '300'), color: theme.ink, fontVariant: ['tabular-nums'] }} />
    </View>
  );
}

/**
 * The small clock under the countdown, drawn in the same style as the theme's
 * board: split-flap tiles only on split-flap themes, a glowing sign on LED,
 * an LCD strip on LCD, warm tubes on nixie, and plain type everywhere else.
 */
export function SmallClock({ text, suffix, theme, motion, glass }: { text: string; suffix?: string; theme: Theme; motion: boolean; glass?: boolean }) {
  if (theme.engine === 'flap') return <SmallFlapClock text={text} suffix={suffix} theme={theme} motion={motion} glass={glass} />;
  const size = 24;
  let body: ReactNode;
  if (theme.engine === 'reel' || theme.engine === 'deco') {
    body = <SmallLuxeClock text={text} theme={theme} motion={motion} />;
  } else if (theme.engine === 'led') {
    body = (
      <Text allowFontScaling={false} style={{ ...signFont(theme), fontSize: size, color: theme.accent, textShadowColor: alpha(theme.glow, 0.85), textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }}>
        {text}
      </Text>
    );
  } else if (theme.engine === 'lcd') {
    body = (
      <View style={{ backgroundColor: theme.lcd, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1.5, borderColor: mix(theme.lcd, '#000000', 0.3) }}>
        <Text allowFontScaling={false} style={{ ...signFont(theme), fontSize: size * 0.85, color: theme.lcdInk }}>
          {text}
        </Text>
      </View>
    );
  } else if (theme.engine === 'nixie') {
    body = (
      <Text
        allowFontScaling={false}
        style={{ ...digitFont(theme, '300'), fontSize: size, color: mix(theme.accent, '#ffffff', 0.25), textShadowColor: theme.accent, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }}>
        {text}
      </Text>
    );
  } else {
    body = (
      <Text allowFontScaling={false} style={{ ...digitFont(theme, '500'), fontSize: size * Math.min(1, 0.62 / rawW(theme)), color: theme.ink, fontVariant: ['tabular-nums'] }}>
        {text}
      </Text>
    );
  }
  return (
    <View style={[styles.row, { gap: 8 }]} accessibilityLabel={`${text} ${suffix ?? ''}`}>
      {body}
      {suffix ? <Text style={{ ...fontStyle(theme.type.label, '700'), fontSize: 14, color: theme.muted }}>{suffix}</Text> : null}
    </View>
  );
}
