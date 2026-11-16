/**
 * Fifteen more kinds of clock (150 themes, style "y:<kind>:<n>" with n = 0..9). Each n changes
 * how the clock is BUILT (shape, layout, material, count), not just its colour.
 */
import { Text, View, type TextStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { alpha, mix, type Theme } from '@/lib/themes';

import type { BoardProps } from './boards';

type P = BoardProps & { n: number };
const pick = <T,>(arr: T[], n: number) => arr[n % arr.length];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const num = (theme: Theme, size: number, extra?: TextStyle): TextStyle => ({ color: theme.ink, fontSize: size, fontWeight: '800', fontVariant: ['tabular-nums'], ...extra });

/* 1. gauge: arc span, needle shape and tick density vary */
function Gauge({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const S = Math.min(width * 0.9, maxSize * 2.7, 340);
  const span = pick([180, 240, 270, 300, 220], n);
  const ticks = pick([10, 20, 30, 12, 60], n + 1);
  const needle = pick(['line', 'wedge', 'dot', 'arrow'], n);
  const c = S / 2;
  const R = S / 2 - 10;
  const a0 = (-span / 2) * (Math.PI / 180);
  const at = (f: number) => a0 + f * span * (Math.PI / 180);
  const r = clamp01(remaining);
  const ang = at(r);
  const pt = (a: number, rr: number) => [c + Math.sin(a) * rr, c - Math.cos(a) * rr];
  const [nx, ny] = pt(ang, R * 0.82);
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = pt(at(f0), R);
    const [x1, y1] = pt(at(f1), R);
    return `M${x0} ${y0}A${R} ${R} 0 ${(f1 - f0) * span > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={text}>
      <Svg width={S} height={span <= 200 ? S * 0.62 : S}>
        <Path d={arc(0, 1)} stroke={alpha(theme.ink, 0.12)} strokeWidth={S * 0.05} fill="none" strokeLinecap="round" />
        {r > 0.005 ? <Path d={arc(0, r)} stroke={theme.accent} strokeWidth={S * 0.05} fill="none" strokeLinecap="round" /> : null}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const [x0, y0] = pt(at(i / ticks), R * 0.86);
          const [x1, y1] = pt(at(i / ticks), R * (i % 5 === 0 ? 0.74 : 0.8));
          return <Line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={alpha(theme.ink, 0.5)} strokeWidth={i % 5 === 0 ? 3 : 1.5} />;
        })}
        {needle === 'dot' ? <Circle cx={nx} cy={ny} r={S * 0.035} fill={theme.accent} /> : needle === 'wedge' ? <Path d={`M${c + Math.cos(ang) * 6} ${c + Math.sin(ang) * 6}L${nx} ${ny}L${c - Math.cos(ang) * 6} ${c - Math.sin(ang) * 6}Z`} fill={theme.accent} /> : <Line x1={c} y1={c} x2={nx} y2={ny} stroke={theme.accent} strokeWidth={needle === 'arrow' ? 5 : 3} strokeLinecap="round" />}
        <Circle cx={c} cy={c} r={S * 0.03} fill={theme.ink} />
      </Svg>
      <Text style={num(theme, S * 0.13)}>{text}</Text>
    </View>
  );
}

/* 2. odometer: wheel material and window layout */
function Odometer({ text, theme, width, maxSize, n }: P) {
  const cs = [...text];
  const s = Math.min(maxSize * 0.95, width / (cs.length * 0.9));
  const wheel = pick(['#d9d9d9', '#f3e9d2', '#1b1b1b', '#e9f1f7', '#3b2a1a'], n);
  const ink = pick(['#111', '#3b2a1a', '#ffffff', '#123', '#f3e9d2'], n);
  const joined = n % 2 === 0;
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'center', backgroundColor: joined ? mix(theme.bg, '#000', 0.4) : 'transparent', padding: joined ? s * 0.1 : 0, borderRadius: s * 0.12, gap: joined ? 2 : s * 0.1 }} accessibilityLabel={text}>
      {cs.map((ch, i) =>
        ch === ':' ? (
          <Text key={i} style={{ color: theme.ink, fontSize: s * 0.7, fontWeight: '800', alignSelf: 'center' }}>:</Text>
        ) : (
          <View key={i} style={{ width: s * 0.7, height: s * 1.1, backgroundColor: wheel, borderRadius: joined ? 3 : s * 0.12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Text style={{ position: 'absolute', top: -s * 0.55, color: alpha(ink, 0.25), fontSize: s * 0.75, fontWeight: '700' }}>{(Number(ch) + 9) % 10}</Text>
            <Text style={{ color: ink, fontSize: s * 0.75, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{ch}</Text>
            <Text style={{ position: 'absolute', bottom: -s * 0.55, color: alpha(ink, 0.25), fontSize: s * 0.75, fontWeight: '700' }}>{(Number(ch) + 1) % 10}</Text>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: s * 0.25, backgroundColor: alpha('#000', 0.18) }} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: s * 0.25, backgroundColor: alpha('#000', 0.18) }} />
          </View>
        )
      )}
    </View>
  );
}

/* 3. label-maker tape: tape colour, tilt and letter spacing */
function Dymo({ text, theme, width, maxSize, n }: P) {
  const s = Math.min(maxSize * 0.8, width / (text.length * 0.85));
  const tape = pick(['#d62828', '#1d3557', '#111111', '#2a9d8f', '#f4a261', '#6a4c93'], n);
  const tilt = pick([-3, 2, 0, -1.5, 4], n);
  return (
    <View style={{ alignSelf: 'center', backgroundColor: tape, paddingHorizontal: s * 0.4, paddingVertical: s * 0.12, borderRadius: 4, transform: [{ rotate: `${tilt}deg` }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } }} accessibilityLabel={text}>
      <Text style={{ color: '#ffffff', fontSize: s, fontWeight: '900', letterSpacing: s * 0.18, textShadowColor: alpha('#000', 0.45), textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 0 }}>{text}</Text>
    </View>
  );
}

/* 4. receipt printout: header text and paper edge vary */
function Receipt({ text, theme, width, maxSize, n }: P) {
  const W = Math.min(width * 0.8, 300);
  const head = pick(['CLASS RECEIPT', 'TIME LEFT', 'ORDER #42', 'BELL TICKET', 'PERIOD STUB'], n);
  const torn = n % 2 === 0;
  return (
    <View style={{ width: W, alignSelf: 'center', backgroundColor: '#fbfaf6', paddingVertical: 16, paddingHorizontal: 18, borderRadius: torn ? 0 : 6, transform: [{ rotate: `${pick([-1, 1, 0], n)}deg` }] }} accessibilityLabel={text}>
      <Text style={{ fontFamily: 'Courier', color: '#222', fontSize: 13, textAlign: 'center', letterSpacing: 2 }}>{head}</Text>
      <Text style={{ fontFamily: 'Courier', color: '#999', fontSize: 12, textAlign: 'center' }}>- - - - - - - - - - - -</Text>
      <Text style={{ fontFamily: 'Courier', color: '#111', fontSize: Math.min(maxSize, W / 4.2), fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] }}>{text}</Text>
      <Text style={{ fontFamily: 'Courier', color: '#999', fontSize: 12, textAlign: 'center' }}>- - - - - - - - - - - -</Text>
      <Text style={{ fontFamily: 'Courier', color: '#444', fontSize: 11, textAlign: 'center' }}>THANK YOU FOR LEARNING</Text>
      {torn ? (
        <Svg width={W} height={10} style={{ position: 'absolute', bottom: -9, left: 0 }}>
          <Path d={Array.from({ length: Math.ceil(W / 12) + 1 }, (_, i) => `${i ? 'L' : 'M'}${i * 12} ${i % 2 ? 9 : 0}`).join('')} fill="#fbfaf6" />
        </Svg>
      ) : null}
    </View>
  );
}

/* 5. licence plate: plate format */
function Plate({ text, theme, width, maxSize, n }: P) {
  const W = Math.min(width * 0.92, 380);
  const kind = pick(['us', 'eu', 'vintage', 'moto', 'neon'], n);
  const bg = kind === 'eu' ? '#ffffff' : kind === 'vintage' ? '#1b1b1b' : kind === 'neon' ? '#08000f' : kind === 'moto' ? '#ffd23f' : '#f6f6f2';
  const ink = kind === 'vintage' ? '#f2c94c' : kind === 'neon' ? theme.accent : '#152038';
  return (
    <View style={{ width: kind === 'moto' ? W * 0.62 : W, height: kind === 'moto' ? W * 0.42 : W * 0.48, alignSelf: 'center', backgroundColor: bg, borderRadius: W * 0.04, borderWidth: 4, borderColor: kind === 'neon' ? theme.accent : '#2b2b2b', flexDirection: 'row', overflow: 'hidden' }} accessibilityLabel={text}>
      {kind === 'eu' ? (
        <View style={{ width: W * 0.11, backgroundColor: '#003399', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: W * 0.04 }}>SC</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'us' ? <Text style={{ color: '#b2182b', fontSize: W * 0.045, fontWeight: '800', fontStyle: 'italic' }}>Studento</Text> : null}
        <Text style={{ color: ink, fontSize: kind === 'moto' ? W * 0.13 : W * 0.17, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] }}>{text}</Text>
        {kind === 'us' ? <Text style={{ color: '#555', fontSize: W * 0.032, fontWeight: '700' }}>LAND OF LEARNING</Text> : null}
      </View>
    </View>
  );
}

/* 6. tear-off calendar pad: binding and header style */
function Calendar({ text, theme, width, maxSize, n }: P) {
  const W = Math.min(width * 0.7, maxSize * 2.4, 280);
  const head = pick(['#d62828', '#264653', '#e76f51', '#2a9d8f', '#6d597a', '#111111'], n);
  const rings = n % 2 === 1;
  const label = pick(['TIME LEFT', 'TODAY', 'COUNTDOWN', 'THIS PERIOD', 'STUDENTO'], n);
  return (
    <View style={{ width: W, alignSelf: 'center', borderRadius: 14, overflow: 'visible', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } }} accessibilityLabel={text}>
      <View style={{ backgroundColor: head, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingVertical: 10, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '900', letterSpacing: 3, fontSize: W * 0.07 }}>{label}</Text>
      </View>
      {rings ? (
        <View style={{ position: 'absolute', top: -10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly' }}>
          {[0, 1, 2].map((k) => (
            <View key={k} style={{ width: 10, height: 24, borderRadius: 5, backgroundColor: '#9aa0a6', borderWidth: 2, borderColor: '#5f6368' }} />
          ))}
        </View>
      ) : null}
      <View style={{ backgroundColor: '#ffffff', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingVertical: W * 0.08, alignItems: 'center' }}>
        <Text style={{ color: '#1a1a1a', fontSize: W * 0.28, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{text}</Text>
        <View style={{ position: 'absolute', bottom: 6, left: 10, right: 10, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' }} />
      </View>
    </View>
  );
}

/* 7. candles: how many, flame style; wax melts with time left */
function Candles({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const count = pick([1, 3, 5, 2, 4], n);
  const r = clamp01(remaining);
  const H = Math.min(maxSize * 2.2, 220);
  const w = Math.min(width / (count * 2.2), 46);
  const wax = pick(['#fff3e0', '#ffd6e0', '#e0f7ff', '#fdf0b3', '#e9e3ff'], n);
  return (
    <View style={{ alignItems: 'center', gap: 10 }} accessibilityLabel={text}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: w * 0.8, height: H }}>
        {Array.from({ length: count }, (_, i) => {
          const h = Math.max(8, (H - 40) * r * (1 - (i % 2) * 0.12));
          return (
            <View key={i} style={{ alignItems: 'center' }}>
              <View style={{ width: w * 0.5, height: w * 0.9, borderRadius: w, backgroundColor: '#ffb703', shadowColor: '#ff9f1c', shadowOpacity: 0.9, shadowRadius: 12, marginBottom: 2 }}>
                <View style={{ position: 'absolute', left: w * 0.13, right: w * 0.13, bottom: 2, height: w * 0.45, borderRadius: w, backgroundColor: '#fff3b0' }} />
              </View>
              <View style={{ width: 2, height: 6, backgroundColor: '#333' }} />
              <View style={{ width: w, height: h, backgroundColor: wax, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
            </View>
          );
        })}
      </View>
      <Text style={num(theme, 26)}>{text}</Text>
    </View>
  );
}

/* 8. moon phases: the lit part shrinks with the period */
function Moon({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const S = Math.min(width * 0.7, maxSize * 2.4, 280);
  const r = clamp01(remaining);
  const moon = pick(['#f4f1de', '#ffd580', '#cfe8ff', '#ffb4a2', '#e0e0e0'], n);
  const R = S / 2 - 6;
  const c = S / 2;
  // terminator ellipse width: full moon (r=1) -> new moon (r=0)
  const k = (r * 2 - 1) * R;
  const lit = `M${c} ${c - R}A${R} ${R} 0 1 1 ${c} ${c + R}A${Math.abs(k)} ${R} 0 1 ${k > 0 ? 1 : 0} ${c} ${c - R}Z`;
  const stars = n % 2 === 0;
  return (
    <View style={{ alignItems: 'center', gap: 8 }} accessibilityLabel={text}>
      <Svg width={S} height={S}>
        {stars ? Array.from({ length: 14 }, (_, i) => <Circle key={i} cx={(Math.sin(i * 77.1) * 0.5 + 0.5) * S} cy={(Math.cos(i * 31.7) * 0.5 + 0.5) * S} r={1.4} fill={alpha('#ffffff', 0.7)} />) : null}
        <Circle cx={c} cy={c} r={R} fill={alpha(moon, 0.12)} />
        <Path d={lit} fill={moon} />
        {[0.3, 0.55, 0.7].map((f, i) => (
          <Circle key={i} cx={c + (f - 0.5) * R * 1.3} cy={c + (i - 1) * R * 0.35} r={R * 0.08} fill={alpha('#000', 0.08)} />
        ))}
      </Svg>
      <Text style={num(theme, 26)}>{text}</Text>
    </View>
  );
}

/* 9. signal lights: traffic light, tower or pedestrian layouts */
function Signal({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const r = clamp01(remaining);
  const which = r > 0.5 ? 2 : r > 0.2 ? 1 : 0; // green, amber, red
  const cols = ['#ff3b30', '#ffcc00', '#34c759'];
  const horizontal = n % 3 === 1;
  const s = Math.min(maxSize * 0.8, (horizontal ? width / 4.5 : 70));
  const housing = pick(['#1c1c1e', '#2b4a2f', '#3a2f22', '#20253a'], n);
  return (
    <View style={{ alignItems: 'center', gap: 12 }} accessibilityLabel={text}>
      <View style={{ flexDirection: horizontal ? 'row' : 'column', backgroundColor: housing, padding: s * 0.2, borderRadius: s * 0.4, gap: s * 0.16 }}>
        {cols.map((c, i) => (
          <View key={i} style={{ width: s, height: s, borderRadius: n % 3 === 2 ? s * 0.18 : s / 2, backgroundColor: i === which ? c : alpha(c, 0.15), shadowColor: c, shadowOpacity: i === which ? 0.9 : 0, shadowRadius: s * 0.4 }} />
        ))}
      </View>
      <Text style={num(theme, 28)}>{text}</Text>
    </View>
  );
}

/* 10. heartbeat line: waveform type and line weight */
function Heartbeat({ text, theme, width, maxSize, n }: P) {
  const W = Math.min(width * 0.95, 420);
  const H = Math.min(maxSize * 1.3, 120);
  const wave = pick(['ecg', 'sine', 'square', 'saw', 'spikes'], n);
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 4) {
    const t = x / W;
    let y = 0;
    if (wave === 'sine') y = Math.sin(t * Math.PI * 6) * 0.35;
    else if (wave === 'square') y = Math.sin(t * Math.PI * 6) > 0 ? 0.3 : -0.3;
    else if (wave === 'saw') y = ((t * 6) % 1) * 0.6 - 0.3;
    else if (wave === 'spikes') y = (t * 12) % 1 < 0.08 ? -0.45 : 0;
    else {
      const p = (t * 3) % 1;
      y = p > 0.4 && p < 0.44 ? -0.45 : p > 0.44 && p < 0.48 ? 0.3 : p > 0.6 && p < 0.7 ? -0.08 : 0;
    }
    pts.push(`${x},${H / 2 + y * H}`);
  }
  return (
    <View style={{ alignItems: 'center', gap: 6 }} accessibilityLabel={text}>
      <Svg width={W} height={H}>
        {Array.from({ length: Math.floor(W / 20) }, (_, i) => <Line key={i} x1={i * 20} x2={i * 20} y1={0} y2={H} stroke={alpha(theme.accent, 0.08)} strokeWidth={1} />)}
        <Polyline points={pts.join(' ')} fill="none" stroke={theme.accent} strokeWidth={pick([2, 3, 4], n)} strokeLinejoin="round" />
      </Svg>
      <Text style={num(theme, Math.min(maxSize, 54))}>{text}</Text>
    </View>
  );
}

/* 11. stacking: blocks, coins, books or bricks; the stack shrinks with time */
function Stack({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const kind = pick(['blocks', 'coins', 'books', 'bricks', 'pancakes'], n);
  const total = 12;
  const lit = Math.max(1, Math.round(clamp01(remaining) * total));
  const W = Math.min(width * 0.5, 180);
  const h = Math.min(maxSize * 0.22, 18);
  const palette = [theme.accent, mix(theme.accent, '#ffffff', 0.3), mix(theme.accent, '#000000', 0.25)];
  return (
    <View style={{ alignItems: 'center', gap: 10 }} accessibilityLabel={text}>
      <View style={{ height: total * (h + 2), justifyContent: 'flex-end', alignItems: 'center' }}>
        {Array.from({ length: lit }, (_, i) => {
          const off = kind === 'books' || kind === 'pancakes' ? Math.sin(i * 2.3) * W * 0.06 : 0;
          const w = kind === 'coins' ? W * 0.7 : kind === 'pancakes' ? W * (0.85 + Math.sin(i) * 0.08) : kind === 'books' ? W * (0.8 + Math.cos(i * 1.7) * 0.15) : W;
          const color = kind === 'coins' ? '#e9b949' : kind === 'pancakes' ? '#d9a35b' : kind === 'bricks' ? '#b5462f' : palette[i % 3];
          return (
            <View key={i} style={{ width: w, height: h, marginTop: 2, transform: [{ translateX: off }], backgroundColor: color, borderRadius: kind === 'coins' || kind === 'pancakes' ? h : 3, borderWidth: kind === 'bricks' ? 1 : 0, borderColor: '#7a2e1f' }} />
          );
        })}
      </View>
      <Text style={num(theme, 26)}>{text}</Text>
    </View>
  );
}

/* 12. rubber stamp: round, square or oval, ink colour */
function Stamp({ text, theme, width, maxSize, n }: P) {
  const S = Math.min(width * 0.75, maxSize * 2.4, 280);
  const shape = pick(['round', 'square', 'oval', 'round'], n);
  const ink = pick(['#c1121f', '#1d3557', '#2b9348', '#6a040f', '#3c096c'], n);
  const word = pick(['TIME LEFT', 'APPROVED', 'CLASS', 'OFFICIAL', 'PERIOD'], n);
  const w = shape === 'oval' ? S * 1.25 : S;
  return (
    <Svg width={w} height={S} style={{ alignSelf: 'center', transform: [{ rotate: `${pick([-12, 8, -6, 14], n)}deg` }] }} accessibilityLabel={text}>
      {shape === 'square' ? (
        <G>
          <Rect x={6} y={6} width={w - 12} height={S - 12} rx={10} fill="none" stroke={ink} strokeWidth={6} />
          <Rect x={16} y={16} width={w - 32} height={S - 32} rx={6} fill="none" stroke={ink} strokeWidth={2} />
        </G>
      ) : (
        <G>
          <Circle cx={w / 2} cy={S / 2} r={S / 2 - 6} fill="none" stroke={ink} strokeWidth={6} transform={shape === 'oval' ? `translate(${w / 2} ${S / 2}) scale(1.25 1) translate(${-w / 2} ${-S / 2})` : undefined} />
          <Circle cx={w / 2} cy={S / 2} r={S / 2 - 18} fill="none" stroke={ink} strokeWidth={2} transform={shape === 'oval' ? `translate(${w / 2} ${S / 2}) scale(1.25 1) translate(${-w / 2} ${-S / 2})` : undefined} />
        </G>
      )}
      <SvgText x={w / 2} y={S * 0.36} fontSize={S * 0.09} fontWeight="900" fill={ink} textAnchor="middle" letterSpacing={3}>
        {word}
      </SvgText>
      <SvgText x={w / 2} y={S * 0.64} fontSize={S * 0.22} fontWeight="900" fill={ink} textAnchor="middle">
        {text}
      </SvgText>
    </Svg>
  );
}

/* 13. photo frames: polaroid, film strip, slide, postage stamp */
function Frame({ text, theme, width, maxSize, n }: P) {
  const W = Math.min(width * 0.75, maxSize * 2.6, 300);
  const kind = pick(['polaroid', 'film', 'slide', 'postage', 'polaroid'], n);
  const photo = pick([theme.accent, '#264653', '#e76f51', '#8ecae6', '#2d6a4f'], n);
  const big = <Text style={{ color: '#ffffff', fontSize: W * 0.22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{text}</Text>;
  if (kind === 'film')
    return (
      <View style={{ width: W, alignSelf: 'center', backgroundColor: '#111', paddingVertical: 14, paddingHorizontal: 8 }} accessibilityLabel={text}>
        {[0, 1].map((row) => (
          <View key={row} style={{ position: 'absolute', left: 6, right: 6, [row ? 'bottom' : 'top']: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: 10 }, (_, i) => <View key={i} style={{ width: 8, height: 6, borderRadius: 1, backgroundColor: '#eee' }} />)}
          </View>
        ))}
        <View style={{ height: W * 0.5, backgroundColor: photo, alignItems: 'center', justifyContent: 'center' }}>{big}</View>
      </View>
    );
  if (kind === 'slide')
    return (
      <View style={{ width: W, height: W, alignSelf: 'center', backgroundColor: '#f2f2f2', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={text}>
        <View style={{ width: W * 0.72, height: W * 0.55, backgroundColor: photo, alignItems: 'center', justifyContent: 'center' }}>{big}</View>
        <Text style={{ position: 'absolute', bottom: 10, color: '#888', fontSize: 11, fontWeight: '700' }}>STUDENTO 35MM</Text>
      </View>
    );
  if (kind === 'postage')
    return (
      <View style={{ width: W * 0.8, height: W, alignSelf: 'center', backgroundColor: '#fffaf0', padding: 10, borderWidth: 6, borderStyle: 'dotted', borderColor: theme.bg }} accessibilityLabel={text}>
        <View style={{ flex: 1, backgroundColor: photo, alignItems: 'center', justifyContent: 'center' }}>{big}</View>
        <Text style={{ color: '#333', fontWeight: '900', fontSize: 14, marginTop: 6 }}>45¢ · BELL MAIL</Text>
      </View>
    );
  return (
    <View style={{ width: W, alignSelf: 'center', backgroundColor: '#fdfdfb', padding: W * 0.06, paddingBottom: W * 0.2, transform: [{ rotate: `${pick([-4, 3, -2], n)}deg` }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } }} accessibilityLabel={text}>
      <View style={{ height: W * 0.75, backgroundColor: photo, alignItems: 'center', justifyContent: 'center' }}>{big}</View>
      <Text style={{ position: 'absolute', bottom: W * 0.05, left: 0, right: 0, textAlign: 'center', color: '#444', fontSize: W * 0.06, fontStyle: 'italic' }}>time left ♡</Text>
    </View>
  );
}

/* 14. loading bars: segmented, chunky, retro or circles */
function Loading({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const r = clamp01(remaining);
  const W = Math.min(width * 0.92, 400);
  const kind = pick(['segments', 'chunky', 'retro', 'circles', 'stripes'], n);
  const segs = kind === 'retro' ? 20 : kind === 'circles' ? 10 : 12;
  const lit = Math.round(r * segs);
  return (
    <View style={{ alignItems: 'center', gap: 12 }} accessibilityLabel={text}>
      <Text style={num(theme, Math.min(maxSize, 60))}>{text}</Text>
      {kind === 'chunky' || kind === 'stripes' ? (
        <View style={{ width: W, height: 34, borderRadius: 17, borderWidth: 3, borderColor: theme.ink, padding: 4 }}>
          <View style={{ width: `${r * 100}%`, height: '100%', borderRadius: 12, backgroundColor: theme.accent, overflow: 'hidden', flexDirection: 'row' }}>
            {kind === 'stripes' ? Array.from({ length: 30 }, (_, i) => <View key={i} style={{ width: 8, marginRight: 8, height: '200%', backgroundColor: alpha('#ffffff', 0.3), transform: [{ rotate: '30deg' }, { translateY: -10 }] }} />) : null}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: kind === 'retro' ? 2 : 6, borderWidth: kind === 'retro' ? 2 : 0, borderColor: theme.ink, padding: kind === 'retro' ? 4 : 0 }}>
          {Array.from({ length: segs }, (_, i) => (
            <View key={i} style={{ width: (W - segs * 6) / segs, height: kind === 'retro' ? 22 : (W - segs * 6) / segs, borderRadius: kind === 'circles' ? 100 : kind === 'retro' ? 0 : 6, backgroundColor: i < lit ? theme.accent : alpha(theme.ink, 0.1) }} />
          ))}
        </View>
      )}
    </View>
  );
}

/* 15. sundial: the shadow sweeps across the dial */
function Sundial({ text, theme, width, maxSize, remaining = 1, n }: P) {
  const S = Math.min(width * 0.8, maxSize * 2.6, 300);
  const c = S / 2;
  const R = S / 2 - 8;
  const a = (-90 + (1 - clamp01(remaining)) * 180) * (Math.PI / 180);
  const stone = pick(['#d8cfc4', '#b8b0a2', '#e9e1d0', '#a3a091', '#cbbfa7'], n);
  return (
    <View style={{ alignItems: 'center', gap: 6 }} accessibilityLabel={text}>
      <Svg width={S} height={S * 0.62}>
        <Path d={`M${c - R} ${c}A${R} ${R} 0 0 1 ${c + R} ${c}Z`} fill={stone} />
        {Array.from({ length: 13 }, (_, i) => {
          const t = (-90 + i * 15) * (Math.PI / 180);
          return <Line key={i} x1={c + Math.sin(t) * R * 0.75} y1={c - Math.cos(t) * R * 0.75} x2={c + Math.sin(t) * R * 0.95} y2={c - Math.cos(t) * R * 0.95} stroke="#5c5346" strokeWidth={i % 3 === 0 ? 3 : 1.5} />;
        })}
        <Path d={`M${c} ${c}L${c + Math.sin(a) * R * 0.9} ${c - Math.cos(a) * R * 0.9}L${c + Math.sin(a + 0.08) * R * 0.6} ${c - Math.cos(a + 0.08) * R * 0.6}Z`} fill={alpha('#000', 0.45)} />
        <Path d={`M${c} ${c}L${c} ${c - R * 0.55}L${c + 6} ${c}Z`} fill="#3d3529" />
      </Svg>
      <Text style={num(theme, 28)}>{text}</Text>
    </View>
  );
}

export type YKind = 'gauge' | 'odometer' | 'dymo' | 'receipt' | 'plate' | 'calendar' | 'candles' | 'moon' | 'signal' | 'heartbeat' | 'stack' | 'stamp' | 'frame' | 'loading' | 'sundial';
const KINDS: Record<YKind, (p: P) => React.ReactElement> = { gauge: Gauge, odometer: Odometer, dymo: Dymo, receipt: Receipt, plate: Plate, calendar: Calendar, candles: Candles, moon: Moon, signal: Signal, heartbeat: Heartbeat, stack: Stack, stamp: Stamp, frame: Frame, loading: Loading, sundial: Sundial };

export function MoreBoard(props: BoardProps) {
  const [kind, nStr] = (props.theme.y ?? 'gauge:0').split(':');
  const C = KINDS[kind as YKind] ?? Gauge;
  return <C {...props} n={Number(nStr) || 0} />;
}
