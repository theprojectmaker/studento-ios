/**
 * Beam's own look, copied from the Beam website (messages-facetime/public/style.css):
 * iMessage-faithful bubbles, gradient letter avatars, a grey search pill and a floating
 * composer. It follows the system light/dark setting, not the Studento theme.
 */
import { Text, useColorScheme, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export interface BeamPalette {
  dark: boolean;
  blue: string;
  green: string;
  red: string;
  window: string;
  sidebar: string;
  chatBg: string;
  hairline: string;
  text: string;
  text2: string;
  text3: string;
  field: string;
  fieldBorder: string;
  search: string;
  rowPress: string;
  inBubble: string;
  inText: string;
  outBubble: string;
  outText: string;
  glass: string;
  card: string;
}

const LIGHT: BeamPalette = {
  dark: false,
  blue: '#0b84fe',
  green: '#34c759',
  red: '#ff3b30',
  window: '#f4f4f7',
  sidebar: '#f6f6f8',
  chatBg: '#ffffff',
  hairline: 'rgba(0,0,0,0.08)',
  text: '#1d1d1f',
  text2: '#6e6e73',
  text3: '#74747a',
  field: 'rgba(255,255,255,0.8)',
  fieldBorder: 'rgba(0,0,0,0.12)',
  search: 'rgba(120,120,128,0.12)',
  rowPress: 'rgba(0,0,0,0.045)',
  inBubble: '#e9e9eb',
  inText: '#000000',
  outBubble: '#0b84fe',
  outText: '#ffffff',
  glass: 'rgba(255,255,255,0.92)',
  card: '#ffffff',
};
const DARK: BeamPalette = {
  dark: true,
  blue: '#0a84ff',
  green: '#34c759',
  red: '#ff453a',
  window: '#101012',
  sidebar: '#1c1c1e',
  chatBg: '#000000',
  hairline: 'rgba(255,255,255,0.09)',
  text: '#f5f5f7',
  text2: '#a1a1a6',
  text3: '#8e8e93',
  field: 'rgba(44,44,46,0.8)',
  fieldBorder: 'rgba(255,255,255,0.14)',
  search: 'rgba(120,120,128,0.24)',
  rowPress: 'rgba(255,255,255,0.06)',
  inBubble: '#26252a',
  inText: '#ffffff',
  outBubble: '#0a84ff',
  outText: '#ffffff',
  glass: 'rgba(30,30,34,0.94)',
  card: '#2a2a2c',
};

export function useBeam(): BeamPalette {
  return useColorScheme() === 'light' ? LIGHT : DARK;
}

/* The website's eight avatar gradients (.avatar.av-c0..7), picked from the name. */
const AV = [
  ['#f7847c', '#d63c33'],
  ['#f9a25d', '#d9661a'],
  ['#6fd38b', '#23984a'],
  ['#5ccfd0', '#148f93'],
  ['#6cb4ff', '#2a72e0'],
  ['#9f8cff', '#6446dc'],
  ['#f38bc3', '#cf3f88'],
  ['#b3a390', '#7d6a55'],
];
function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function BeamAvatar({ name, size = 46 }: { name: string; size?: number }) {
  const [a, b] = AV[hash(name) % AV.length];
  const id = `av${hash(name) % AV.length}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: size * 0.37, letterSpacing: 0.3 }}>{name.slice(0, 2).toUpperCase()}</Text>
      </View>
    </View>
  );
}

type G = { color: string; size?: number };
export const Glyph = {
  Back: ({ color, size = 22 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  ),
  Phone: ({ color, size = 22 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
    </Svg>
  ),
  Video: ({ color, size = 24 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M4 6.5h9.5A2.5 2.5 0 0 1 16 9v6a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 15V9A2.5 2.5 0 0 1 4 6.5Zm13 3.6 4.2-2.6c.6-.4 1.3.1 1.3.8v7.4c0 .7-.7 1.2-1.3.8L17 13.9z" />
    </Svg>
  ),
  Compose: ({ color, size = 22 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <Path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
    </Svg>
  ),
  Search: ({ color, size = 14 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Path d="M20 20l-4.5-4.5" />
    </Svg>
  ),
  Plus: ({ color, size = 16 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Up: ({ color, size = 16 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  ),
  Chevron: ({ color, size = 15 }: G) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  ),
};

/** iMessage bubble tail, drawn under the last bubble of a run. */
export function Tail({ color, side, bg }: { color: string; side: 'left' | 'right'; bg: string }) {
  const flip = side === 'left';
  return (
    <Svg width={14} height={18} viewBox="0 0 14 18" style={{ position: 'absolute', bottom: 0, [flip ? 'left' : 'right']: -5, transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <Path d="M0 0 V18 H14 C8 18 3 14 3 6 V0 Z" fill={color} />
      <Path d="M3 0 C3 14 8 18 14 18 V14 C9 13 7 9 7 0 Z" fill={bg} opacity={0} />
    </Svg>
  );
}
