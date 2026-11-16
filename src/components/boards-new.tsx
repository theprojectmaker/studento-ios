/**
 * Ten all-new kinds of clock, each with five versions that differ in how they are built (not
 * just their colour): binary lights, pixel digits, segment digits, fill-up timers, word clocks,
 * dot fields, sculpted digits, counting systems, radial countdowns and tile digits.
 * A theme picks one with style "x:<kind>:<variant>" (see src/lib/new-themes.ts).
 */
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { alpha, mix } from '@/lib/themes';

import type { BoardProps } from './boards';

export type XKind = 'binary' | 'pixel' | 'segment' | 'fill' | 'word' | 'dots' | 'sculpt' | 'count' | 'radial' | 'tiles';

const chars = (t: string) => [...t];
const digitsOf = (t: string) => chars(t).filter((c) => c >= '0' && c <= '9').map(Number);
/** "12:34" -> [12, 34]; "1:05:22" -> [1, 5, 22] */
const parts = (t: string) => t.split(':').map((p) => Number(p) || 0);
const minutesLeft = (t: string) => {
  const p = parts(t);
  return p.length === 3 ? p[0] * 60 + p[1] : p[0];
};

/* ---------------- 1. binary lights ---------------- */
function Binary({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const ds = chars(text);
  const cols = ds.length;
  const cell = Math.min(maxSize * 0.42, width / (cols * 1.35));
  const on = theme.accent;
  const off = alpha(theme.ink, 0.12);
  return (
    <View style={{ flexDirection: 'row', gap: cell * 0.35, alignItems: 'flex-end', alignSelf: 'center' }} accessibilityLabel={text}>
      {ds.map((ch, i) =>
        ch === ':' ? (
          <View key={i} style={{ width: cell * 0.3 }} />
        ) : (
          <View key={i} style={{ gap: cell * 0.18 }}>
            {[8, 4, 2, 1].map((b) => {
              const lit = (Number(ch) & b) !== 0;
              const c = lit ? on : off;
              const s = cell;
              if (variant === 'bars') return <View key={b} style={{ width: s, height: s * 0.38, borderRadius: s * 0.1, backgroundColor: c }} />;
              if (variant === 'squares') return <View key={b} style={{ width: s, height: s, borderRadius: s * 0.12, backgroundColor: c }} />;
              if (variant === 'holes') return <View key={b} style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: lit ? theme.bg : alpha(theme.ink, 0.85), borderWidth: 2, borderColor: alpha(theme.ink, 0.85) }} />;
              if (variant === 'lamps')
                return <View key={b} style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: c, shadowColor: on, shadowOpacity: lit ? 0.9 : 0, shadowRadius: s * 0.35, borderWidth: 2, borderColor: alpha(theme.ink, 0.25) }} />;
              return <View key={b} style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: c }} />;
            })}
          </View>
        )
      )}
    </View>
  );
}

/* ---------------- 2. pixel digits ---------------- */
const PIX: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['0', '1', '0', '0', '0', '1', '0'],
};
function Pixel({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const cs = chars(text);
  const colsTotal = cs.reduce((n, c) => n + (c === ':' ? 1 : 5) + 1, 0);
  const px = Math.min((maxSize * 1.4) / 7, width / colsTotal);
  const on = variant === 'lego' ? theme.accent : theme.ink;
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'center' }} accessibilityLabel={text}>
      {cs.map((c, i) => (
        <View key={i} style={{ marginRight: px }}>
          {(PIX[c] ?? PIX['0']).map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {[...row].map((b, k) => {
                const lit = b === '1';
                const s = px;
                if (variant === 'dots') return <View key={k} style={{ width: s, height: s, padding: s * 0.12 }}><View style={{ flex: 1, borderRadius: s, backgroundColor: lit ? theme.accent : alpha(theme.ink, 0.07) }} /></View>;
                if (variant === 'stitch')
                  return (
                    <Svg key={k} width={s} height={s}>
                      {lit ? <Path d={`M${s * 0.2} ${s * 0.2}L${s * 0.8} ${s * 0.8}M${s * 0.8} ${s * 0.2}L${s * 0.2} ${s * 0.8}`} stroke={theme.accent} strokeWidth={s * 0.16} strokeLinecap="round" /> : null}
                    </Svg>
                  );
                if (variant === 'lego')
                  return (
                    <View key={k} style={{ width: s, height: s, backgroundColor: lit ? on : 'transparent', borderWidth: lit ? 1 : 0, borderColor: alpha('#000', 0.25), alignItems: 'center', justifyContent: 'center' }}>
                      {lit ? <View style={{ width: s * 0.5, height: s * 0.5, borderRadius: s, backgroundColor: mix(on, '#ffffff', 0.25), borderWidth: 1, borderColor: alpha('#000', 0.2) }} /> : null}
                    </View>
                  );
                if (variant === 'mosaic') return <View key={k} style={{ width: s, height: s, padding: s * 0.06 }}><View style={{ flex: 1, borderRadius: s * 0.15, backgroundColor: lit ? (k + r) % 3 === 0 ? theme.accent : theme.ink : alpha(theme.ink, 0.05) }} /></View>;
                return <View key={k} style={{ width: s, height: s, backgroundColor: lit ? on : 'transparent' }} />;
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ---------------- 3. segment digits ---------------- */
// a b c d e f g
const SEG: Record<string, number[]> = {
  '0': [1, 1, 1, 1, 1, 1, 0], '1': [0, 1, 1, 0, 0, 0, 0], '2': [1, 1, 0, 1, 1, 0, 1], '3': [1, 1, 1, 1, 0, 0, 1], '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1], '6': [1, 0, 1, 1, 1, 1, 1], '7': [1, 1, 1, 0, 0, 0, 0], '8': [1, 1, 1, 1, 1, 1, 1], '9': [1, 1, 1, 1, 0, 1, 1],
};
function Segment({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const cs = chars(text);
  const units = cs.reduce((n, c) => n + (c === ':' ? 0.4 : 1.15), 0);
  const H = Math.min(maxSize * 1.5, (width / units) * 1.7);
  const W = H * 0.55;
  const t = variant === 'match' ? H * 0.07 : variant === 'capsule' ? H * 0.13 : H * 0.1;
  const slant = variant === 'slant' ? H * 0.12 : 0;
  const color = theme.accent;
  const segs = (on: number[]) => {
    const pts: [number, number, number, number][] = [
      [t, t / 2, W - t, t / 2], [W - t / 2, t, W - t / 2, H / 2 - t / 2], [W - t / 2, H / 2 + t / 2, W - t / 2, H - t], [t, H - t / 2, W - t, H - t / 2],
      [t / 2, H / 2 + t / 2, t / 2, H - t], [t / 2, t, t / 2, H / 2 - t / 2], [t, H / 2, W - t, H / 2],
    ];
    return pts.map(([x1, y1, x2, y2], i) => {
      const lit = on[i] === 1;
      const sx = (y: number) => slant * (1 - y / H);
      const common = { x1: x1 + sx(y1), y1, x2: x2 + sx(y2), y2 };
      if (variant === 'neon') return <Line key={i} {...common} stroke={lit ? color : alpha(theme.ink, 0.06)} strokeWidth={t * 0.45} strokeLinecap="round" opacity={lit ? 1 : 1} />;
      if (variant === 'dotted') return <Line key={i} {...common} stroke={lit ? color : alpha(theme.ink, 0.06)} strokeWidth={t} strokeLinecap="round" strokeDasharray={`0.1 ${t * 1.6}`} />;
      if (variant === 'match')
        return (
          <G key={i}>
            <Line {...common} stroke={lit ? '#e8c48a' : alpha(theme.ink, 0.05)} strokeWidth={t} strokeLinecap="round" />
            {lit ? <Circle cx={common.x2} cy={common.y2} r={t * 0.75} fill="#d2381e" /> : null}
          </G>
        );
      return <Line key={i} {...common} stroke={lit ? color : alpha(theme.ink, 0.07)} strokeWidth={t} strokeLinecap={variant === 'slant' ? 'butt' : 'round'} />;
    });
  };
  return (
    <View style={{ flexDirection: 'row', gap: W * 0.18, alignSelf: 'center', alignItems: 'center' }} accessibilityLabel={text}>
      {cs.map((c, i) =>
        c === ':' ? (
          <View key={i} style={{ gap: H * 0.25 }}>
            <View style={{ width: t, height: t, borderRadius: t, backgroundColor: color }} />
            <View style={{ width: t, height: t, borderRadius: t, backgroundColor: color }} />
          </View>
        ) : (
          <Svg key={i} width={W + slant} height={H}>
            {segs(SEG[c] ?? SEG['8'])}
          </Svg>
        )
      )}
    </View>
  );
}

/* ---------------- 4. fill-up timers ---------------- */
function Fill({ text, theme, width, maxSize, remaining = 1, variant }: BoardProps & { variant: string }) {
  const r = Math.max(0, Math.min(1, remaining));
  const big = Math.min(width * 0.9, maxSize * 2.6, 340);
  const label: TextStyle = { color: theme.ink, fontSize: big * 0.16, fontWeight: '800', fontVariant: ['tabular-nums'] };
  let art: React.ReactNode;
  if (variant === 'battery') {
    const w = big;
    const h = big * 0.45;
    art = (
      <Svg width={w + 16} height={h}>
        <Rect x={2} y={2} width={w - 4} height={h - 4} rx={h * 0.18} fill="none" stroke={theme.ink} strokeWidth={4} />
        <Rect x={w} y={h * 0.32} width={12} height={h * 0.36} rx={3} fill={theme.ink} />
        <Rect x={10} y={10} width={(w - 20) * r} height={h - 20} rx={h * 0.1} fill={r < 0.2 ? '#ff453a' : theme.accent} />
      </Svg>
    );
  } else if (variant === 'hourglass') {
    const w = big * 0.6;
    const h = big;
    const top = h / 2 - 6;
    art = (
      <Svg width={w} height={h}>
        <Path d={`M4 4H${w - 4}L${w / 2 + 4} ${h / 2}L${w - 4} ${h - 4}H4L${w / 2 - 4} ${h / 2}Z`} fill="none" stroke={theme.ink} strokeWidth={4} strokeLinejoin="round" />
        <Path d={`M${w / 2 - (w / 2 - 10) * r} ${h / 2 - top * r}H${w / 2 + (w / 2 - 10) * r}L${w / 2} ${h / 2 - 4}Z`} fill={theme.accent} />
        <Path d={`M12 ${h - 8}H${w - 12}L${w / 2} ${h - 8 - (top - 8) * (1 - r)}Z`} fill={theme.accent} />
      </Svg>
    );
  } else if (variant === 'pie') {
    const s = big;
    const R = s / 2 - 4;
    const a = r * Math.PI * 2;
    const x = s / 2 + R * Math.sin(a);
    const y = s / 2 - R * Math.cos(a);
    art = (
      <Svg width={s} height={s}>
        <Circle cx={s / 2} cy={s / 2} r={R} fill={alpha(theme.ink, 0.08)} />
        {r >= 0.999 ? <Circle cx={s / 2} cy={s / 2} r={R} fill={theme.accent} /> : <Path d={`M${s / 2} ${s / 2}L${s / 2} ${s / 2 - R}A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y}Z`} fill={theme.accent} />}
      </Svg>
    );
  } else if (variant === 'thermo') {
    const w = big;
    const h = big * 0.22;
    art = (
      <Svg width={w + h} height={h * 1.6}>
        <Rect x={h * 0.8} y={h * 0.3} width={w - h * 0.4} height={h} rx={h / 2} fill={alpha(theme.ink, 0.1)} />
        <Rect x={h * 0.8} y={h * 0.3} width={(w - h * 0.4) * r} height={h} rx={h / 2} fill={theme.accent} />
        <Circle cx={h * 0.8} cy={h * 0.8} r={h * 0.8} fill={theme.accent} />
      </Svg>
    );
  } else {
    // water glass
    const w = big * 0.62;
    const h = big;
    const level = 8 + (h - 16) * (1 - r);
    art = (
      <Svg width={w} height={h}>
        <Path d={`M8 ${level}Q${w * 0.3} ${level - 10} ${w / 2} ${level}T${w - 8} ${level}V${h - 8}H8Z`} fill={theme.accent} opacity={0.9} />
        <Path d={`M4 4L10 ${h - 4}H${w - 10}L${w - 4} 4`} fill="none" stroke={theme.ink} strokeWidth={4} strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 10 }} accessibilityLabel={text}>
      {art}
      <Text style={label}>{text}</Text>
    </View>
  );
}

/* ---------------- 5. word clocks ---------------- */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
const say = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? '-' + ONES[n % 10] : ''}`);
function Word({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const p = parts(text);
  const a = say(Math.min(59, p[0]));
  const b = p.length > 1 ? say(Math.min(59, p[1])) : '';
  const size = Math.min(maxSize * 0.62, width / 7.5);
  if (variant === 'grid') {
    const letters = 'ITISABOUTNOWZEROONETWOTHREEFOURFIVESIXSEVENEIGHTNINETENTWENTYTHIRTYFORTYFIFTYMINUTESLEFT';
    const want = `${a}${b}`.replace(/-/g, '').toUpperCase();
    let at = 0;
    const lit = [...letters].map((ch) => {
      if (at < want.length && ch === want[at]) {
        at++;
        return true;
      }
      return false;
    });
    const perRow = 12;
    const s = Math.min(width / (perRow * 1.2), maxSize * 0.28);
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: s * perRow * 1.2, alignSelf: 'center' }} accessibilityLabel={text}>
        {[...letters].map((ch, i) => (
          <Text key={i} style={{ width: s * 1.2, textAlign: 'center', fontSize: s, fontWeight: lit[i] ? '900' : '500', color: lit[i] ? theme.accent : alpha(theme.ink, 0.15) }}>
            {ch}
          </Text>
        ))}
      </View>
    );
  }
  const base: TextStyle = { color: theme.ink, fontWeight: '800', textAlign: 'center' };
  if (variant === 'sentence')
    return (
      <Text style={[base, { fontSize: size * 0.6, fontWeight: '500', fontStyle: 'italic', lineHeight: size * 0.8 }]} accessibilityLabel={text}>
        {`${a} `}
        <Text style={{ color: theme.accent, fontWeight: '800' }}>{b ? `and ${b}` : 'minutes'}</Text>
        {' to go'}
      </Text>
    );
  if (variant === 'type')
    return (
      <Text style={[base, { fontSize: size * 0.55, fontFamily: 'Courier', fontWeight: '700', letterSpacing: 1 }]} accessibilityLabel={text}>
        {`> ${a}:${b}_`}
      </Text>
    );
  if (variant === 'vertical')
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: size * 0.4 }} accessibilityLabel={text}>
        {[a, b].filter(Boolean).map((w, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            {[...w.replace(/-/g, '')].map((ch, k) => (
              <Text key={k} style={{ color: i ? theme.accent : theme.ink, fontSize: size * 0.42, fontWeight: '900', lineHeight: size * 0.46 }}>
                {ch.toUpperCase()}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  return (
    <View accessibilityLabel={text}>
      <Text style={[base, { fontSize: size, lineHeight: size * 1.05 }]}>{a.toUpperCase()}</Text>
      {b ? <Text style={[base, { fontSize: size, lineHeight: size * 1.05, color: theme.accent }]}>{b.toUpperCase()}</Text> : null}
    </View>
  );
}

/* ---------------- 6. dot fields (one dot per minute left, up to 60) ---------------- */
function Dots({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const left = Math.max(0, Math.min(60, minutesLeft(text)));
  const S = Math.min(width * 0.92, maxSize * 2.6, 340);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 60; i++) {
    if (variant === 'spiral') {
      const a = i * 0.55;
      const rr = 10 + i * (S / 2 - 18) / 60;
      pts.push({ x: S / 2 + Math.cos(a) * rr, y: S / 2 + Math.sin(a) * rr });
    } else if (variant === 'ring') {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: S / 2 + Math.cos(a) * (S / 2 - 12), y: S / 2 + Math.sin(a) * (S / 2 - 12) });
    } else if (variant === 'abacus') {
      const row = Math.floor(i / 10);
      const col = i % 10;
      pts.push({ x: 14 + col * ((S - 28) / 9), y: 14 + row * ((S * 0.6 - 28) / 5) });
    } else if (variant === 'confetti') {
      const h = Math.sin(i * 91.7) * 43758.5;
      const k = Math.sin(i * 12.3) * 9182.1;
      pts.push({ x: 12 + (h - Math.floor(h)) * (S - 24), y: 12 + (k - Math.floor(k)) * (S - 24) });
    } else {
      pts.push({ x: 14 + (i % 10) * ((S - 28) / 9), y: 14 + Math.floor(i / 10) * ((S - 28) / 5) });
    }
  }
  const h = variant === 'abacus' ? S * 0.6 : S;
  const r = variant === 'confetti' ? 7 : variant === 'spiral' ? 5 : 8;
  return (
    <View style={{ alignItems: 'center', gap: 8 }} accessibilityLabel={text}>
      <Svg width={S} height={h}>
        {variant === 'abacus'
          ? Array.from({ length: 6 }, (_, row) => <Line key={row} x1={6} x2={S - 6} y1={14 + row * ((S * 0.6 - 28) / 5)} y2={14 + row * ((S * 0.6 - 28) / 5)} stroke={alpha(theme.ink, 0.25)} strokeWidth={2} />)
          : null}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={r} fill={i < left ? (variant === 'confetti' ? [theme.accent, theme.ink, theme.glow][i % 3] : theme.accent) : alpha(theme.ink, 0.08)} />
        ))}
      </Svg>
      <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{text}</Text>
    </View>
  );
}

/* ---------------- 7. sculpted digits ---------------- */
function Sculpt({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const size = Math.min(maxSize * 1.6, width / (text.length * 0.62));
  const base: TextStyle = { fontSize: size, fontWeight: '900', fontVariant: ['tabular-nums'], textAlign: 'center', includeFontPadding: false };
  if (variant === 'stack') {
    const p = text.split(':');
    const s = Math.min(maxSize * 1.3, width / 2.4);
    return (
      <View style={{ alignItems: 'center' }} accessibilityLabel={text}>
        {p.map((g, i) => (
          <Text key={i} style={[base, { fontSize: s, lineHeight: s * 0.92, color: i % 2 ? theme.accent : theme.ink }]}>
            {g}
          </Text>
        ))}
      </View>
    );
  }
  if (variant === 'outline')
    return (
      <Svg width={width} height={size * 1.15} accessibilityLabel={text}>
        <SvgText x={width / 2} y={size * 0.95} fontSize={size} fontWeight="900" textAnchor="middle" fill="none" stroke={theme.accent} strokeWidth={Math.max(2, size * 0.025)}>
          {text}
        </SvgText>
      </Svg>
    );
  if (variant === 'cutout')
    return (
      <View style={{ backgroundColor: theme.accent, borderRadius: 24, paddingHorizontal: 18, alignSelf: 'center' }} accessibilityLabel={text}>
        <Text style={[base, { color: theme.bg, fontSize: size * 0.85 }]}>{text}</Text>
      </View>
    );
  if (variant === 'extrude')
    return (
      <View accessibilityLabel={text}>
        {[6, 5, 4, 3, 2, 1].map((d) => (
          <Text key={d} style={[base, StyleSheet.absoluteFill, { color: mix(theme.accent, '#000000', 0.25 + d * 0.06), transform: [{ translateX: d * size * 0.012 }, { translateY: d * size * 0.012 }] }]}>
            {text}
          </Text>
        ))}
        <Text style={[base, { color: theme.ink }]}>{text}</Text>
      </View>
    );
  // mirror
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={text}>
      <Text style={[base, { color: theme.ink, lineHeight: size * 1.0 }]}>{text}</Text>
      <Text style={[base, { color: theme.ink, opacity: 0.18, lineHeight: size * 1.0, transform: [{ scaleY: -1 }] }]}>{text}</Text>
    </View>
  );
}

/* ---------------- 8. counting systems ---------------- */
const ROMAN = (n: number) => {
  if (n <= 0) return 'N';
  const m: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s;
};
const MORSE: Record<number, string> = { 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
const PIPS: Record<number, [number, number][]> = {
  0: [], 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]], 7: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]], 8: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 9: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
};
function Count({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const p = parts(text);
  if (variant === 'roman') {
    const s = Math.min(maxSize * 0.9, width / 7);
    return (
      <Text style={{ color: theme.ink, fontSize: s, fontWeight: '300', letterSpacing: 4, textAlign: 'center', fontFamily: 'Georgia' }} accessibilityLabel={text}>
        {p.map(ROMAN).join(' · ')}
      </Text>
    );
  }
  if (variant === 'dice') {
    const ds = digitsOf(text);
    const s = Math.min(maxSize * 0.9, width / (ds.length * 1.25));
    return (
      <View style={{ flexDirection: 'row', gap: s * 0.18, alignSelf: 'center' }} accessibilityLabel={text}>
        {ds.map((d, i) => (
          <View key={i} style={{ width: s, height: s, borderRadius: s * 0.18, backgroundColor: theme.ink, padding: s * 0.12 }}>
            {(PIPS[d] ?? []).map(([x, y], k) => (
              <View key={k} style={{ position: 'absolute', left: s * 0.12 + x * s * 0.27, top: s * 0.12 + y * s * 0.27, width: s * 0.22, height: s * 0.22, borderRadius: s, backgroundColor: theme.bg }} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (variant === 'morse') {
    const ds = digitsOf(text);
    const u = Math.min(maxSize * 0.12, width / 40);
    return (
      <View style={{ gap: u * 1.4, alignSelf: 'center' }} accessibilityLabel={text}>
        {ds.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: u, alignItems: 'center' }}>
            <Text style={{ color: alpha(theme.ink, 0.5), fontSize: u * 2, width: u * 2.6, fontWeight: '700' }}>{d}</Text>
            {[...MORSE[d]].map((m, k) => (
              <View key={k} style={{ width: m === '.' ? u * 1.4 : u * 4, height: u * 1.4, borderRadius: u, backgroundColor: theme.accent }} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (variant === 'ruler') {
    const left = Math.max(0, Math.min(60, minutesLeft(text)));
    const W = Math.min(width * 0.95, 420);
    return (
      <View style={{ alignItems: 'center', gap: 8 }} accessibilityLabel={text}>
        <Svg width={W} height={70}>
          {Array.from({ length: 61 }, (_, i) => {
            const x = 6 + (i / 60) * (W - 12);
            const tall = i % 10 === 0 ? 40 : i % 5 === 0 ? 28 : 16;
            return <Line key={i} x1={x} x2={x} y1={6} y2={6 + tall} stroke={i <= left ? theme.accent : alpha(theme.ink, 0.25)} strokeWidth={i % 5 === 0 ? 3 : 2} />;
          })}
          <Path d={`M${6 + (left / 60) * (W - 12)} 52l-8 14h16z`} fill={theme.ink} />
        </Svg>
        <Text style={{ color: theme.ink, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{text}</Text>
      </View>
    );
  }
  // tally marks for the minutes left (up to 60)
  const left = Math.max(0, Math.min(60, minutesLeft(text)));
  const groups = Math.ceil(left / 5);
  const h = Math.min(maxSize * 0.6, 60);
  return (
    <View style={{ alignItems: 'center', gap: 8 }} accessibilityLabel={text}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: h * 0.35, maxWidth: width }}>
        {Array.from({ length: groups }, (_, g) => {
          const n = Math.min(5, left - g * 5);
          return (
            <Svg key={g} width={h * 0.9} height={h}>
              {Array.from({ length: Math.min(4, n) }, (_, k) => (
                <Line key={k} x1={6 + k * h * 0.2} x2={6 + k * h * 0.2} y1={4} y2={h - 4} stroke={theme.ink} strokeWidth={4} strokeLinecap="round" />
              ))}
              {n === 5 ? <Line x1={2} x2={h * 0.85} y1={h - 10} y2={10} stroke={theme.accent} strokeWidth={4} strokeLinecap="round" /> : null}
            </Svg>
          );
        })}
      </View>
      <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{text}</Text>
    </View>
  );
}

/* ---------------- 9. radial countdowns ---------------- */
function Radial({ text, theme, width, maxSize, remaining = 1, variant }: BoardProps & { variant: string }) {
  const r = Math.max(0, Math.min(1, remaining));
  const S = Math.min(width * 0.92, maxSize * 2.8, 360);
  const c = S / 2;
  const N = variant === 'petals' ? 12 : variant === 'pie' ? 12 : 24;
  const lit = Math.round(r * N);
  let art: React.ReactNode;
  if (variant === 'rings') {
    art = Array.from({ length: 8 }, (_, i) => {
      const rr = (S / 2 - 6) * ((i + 1) / 8);
      return <Circle key={i} cx={c} cy={c} r={rr} fill="none" stroke={i < Math.ceil(r * 8) ? theme.accent : alpha(theme.ink, 0.08)} strokeWidth={S * 0.03} />;
    });
  } else if (variant === 'petals') {
    art = Array.from({ length: N }, (_, i) => (
      <G key={i} rotation={(i / N) * 360} origin={`${c}, ${c}`}>
        <Path d={`M${c} ${c}C${c - S * 0.1} ${c - S * 0.18} ${c - S * 0.06} ${c - S * 0.42} ${c} ${c - S * 0.46}C${c + S * 0.06} ${c - S * 0.42} ${c + S * 0.1} ${c - S * 0.18} ${c} ${c}Z`} fill={i < lit ? theme.accent : alpha(theme.ink, 0.07)} />
      </G>
    ));
  } else if (variant === 'pie') {
    art = Array.from({ length: N }, (_, i) => {
      const a0 = (i / N) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2 - 0.04;
      const R = S / 2 - 4;
      return <Path key={i} d={`M${c} ${c}L${c + R * Math.cos(a0)} ${c + R * Math.sin(a0)}A${R} ${R} 0 0 1 ${c + R * Math.cos(a1)} ${c + R * Math.sin(a1)}Z`} fill={i < lit ? theme.accent : alpha(theme.ink, 0.07)} />;
    });
  } else if (variant === 'orbit') {
    art = [0, 1, 2].map((k) => {
      const R = S / 2 - 8 - k * S * 0.12;
      const a = r * Math.PI * 2 * (1 + k * 0.5);
      return (
        <G key={k}>
          <Circle cx={c} cy={c} r={R} fill="none" stroke={alpha(theme.ink, 0.1)} strokeWidth={2} />
          <Circle cx={c + R * Math.sin(a)} cy={c - R * Math.cos(a)} r={S * 0.035} fill={k === 0 ? theme.accent : theme.ink} />
        </G>
      );
    });
  } else {
    // sun rays
    art = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      return <Line key={i} x1={c + Math.cos(a) * S * 0.28} y1={c + Math.sin(a) * S * 0.28} x2={c + Math.cos(a) * S * 0.47} y2={c + Math.sin(a) * S * 0.47} stroke={i < lit ? theme.accent : alpha(theme.ink, 0.08)} strokeWidth={S * 0.03} strokeLinecap="round" />;
    });
  }
  return (
    <View style={{ width: S, height: S, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={text}>
      <Svg width={S} height={S} style={StyleSheet.absoluteFill}>
        {art}
      </Svg>
      <Text style={{ color: theme.ink, fontSize: S * 0.13, fontWeight: '800', fontVariant: ['tabular-nums'], backgroundColor: variant === 'pie' || variant === 'petals' ? alpha(theme.bg, 0.85) : 'transparent', paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' }}>
        {text}
      </Text>
    </View>
  );
}

/* ---------------- 10. tile digits ---------------- */
function Tiles({ text, theme, width, maxSize, variant }: BoardProps & { variant: string }) {
  const cs = chars(text);
  const n = cs.filter((c) => c !== ':').length;
  const s = Math.min(maxSize * 1.1, width / (n * 1.18 + 0.5));
  const tile = (ch: string, i: number) => {
    if (variant === 'sticky')
      return (
        <View key={i} style={{ width: s, height: s, backgroundColor: ['#ffe066', '#9be7ff', '#ffadad', '#b9fbc0'][i % 4], transform: [{ rotate: `${(i % 2 ? 1 : -1) * 3}deg` }], alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 3 } }}>
          <Text style={{ fontSize: s * 0.62, color: '#2b2b2b', fontWeight: '700', fontStyle: 'italic' }}>{ch}</Text>
        </View>
      );
    if (variant === 'scrabble')
      return (
        <View key={i} style={{ width: s, height: s, borderRadius: s * 0.1, backgroundColor: '#f1dcae', borderBottomWidth: s * 0.07, borderBottomColor: '#c9a868', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s * 0.6, color: '#2d2116', fontWeight: '800' }}>{ch}</Text>
          <Text style={{ position: 'absolute', right: s * 0.1, bottom: s * 0.06, fontSize: s * 0.18, color: '#2d2116', fontWeight: '700' }}>{(Number(ch) % 4) + 1}</Text>
        </View>
      );
    if (variant === 'keys')
      return (
        <View key={i} style={{ width: s, height: s, borderRadius: s * 0.16, backgroundColor: mix(theme.bg, '#ffffff', 0.12), borderBottomWidth: s * 0.08, borderBottomColor: mix(theme.bg, '#000000', 0.4), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: s * 0.5, color: theme.ink, fontWeight: '600' }}>{ch}</Text>
        </View>
      );
    if (variant === 'cards')
      return (
        <View key={i} style={{ width: s * 0.78, height: s * 1.1, borderRadius: s * 0.08, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d6d6d6', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ position: 'absolute', left: s * 0.06, top: s * 0.03, fontSize: s * 0.18, color: i % 2 ? '#d62828' : '#111', fontWeight: '800' }}>{`${ch}${i % 2 ? '♥' : '♠'}`}</Text>
          <Text style={{ fontSize: s * 0.6, color: i % 2 ? '#d62828' : '#111', fontWeight: '800' }}>{ch}</Text>
        </View>
      );
    // domino: digit as pips on a half-domino
    return (
      <View key={i} style={{ width: s * 0.62, height: s * 1.1, borderRadius: s * 0.1, backgroundColor: theme.ink, padding: s * 0.06 }}>
        <View style={{ flex: 1, borderBottomWidth: 2, borderBottomColor: alpha(theme.bg, 0.5) }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.bg, fontSize: s * 0.42, fontWeight: '900' }}>{ch}</Text>
        </View>
      </View>
    );
  };
  return (
    <View style={{ flexDirection: 'row', gap: s * 0.14, alignSelf: 'center', alignItems: 'center' }} accessibilityLabel={text}>
      {cs.map((ch, i) => (ch === ':' ? <Text key={i} style={{ fontSize: s * 0.6, color: theme.ink, fontWeight: '800' }}>:</Text> : tile(ch, i)))}
    </View>
  );
}

/* ---------------- switch ---------------- */
export function NewBoard(props: BoardProps) {
  const [kind, variant] = (props.theme.x ?? 'binary:circles').split(':') as [XKind, string];
  const p = { ...props, variant };
  switch (kind) {
    case 'pixel':
      return <Pixel {...p} />;
    case 'segment':
      return <Segment {...p} />;
    case 'fill':
      return <Fill {...p} />;
    case 'word':
      return <Word {...p} />;
    case 'dots':
      return <Dots {...p} />;
    case 'sculpt':
      return <Sculpt {...p} />;
    case 'count':
      return <Count {...p} />;
    case 'radial':
      return <Radial {...p} />;
    case 'tiles':
      return <Tiles {...p} />;
    default:
      return <Binary {...p} />;
  }
}
