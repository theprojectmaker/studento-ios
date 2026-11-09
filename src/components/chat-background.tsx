/** Per-chat backgrounds: soft preset gradients or a photo from the library (kept on this device). */
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const CHAT_BGS: { id: string; label: string; colors: [string, string] }[] = [
  { id: 'sky', label: 'Sky', colors: ['#cfe6ff', '#f4f9ff'] },
  { id: 'sunset', label: 'Sunset', colors: ['#ffb199', '#ffe3c2'] },
  { id: 'mint', label: 'Mint', colors: ['#b8f0d8', '#effdf6'] },
  { id: 'grape', label: 'Grape', colors: ['#d7c4ff', '#f5efff'] },
  { id: 'rose', label: 'Rose', colors: ['#ffc6d9', '#fff0f5'] },
  { id: 'sand', label: 'Sand', colors: ['#f1e2c6', '#fbf6ec'] },
  { id: 'midnight', label: 'Midnight', colors: ['#0f1a3d', '#2a1b4d'] },
  { id: 'forest', label: 'Forest', colors: ['#0f2f24', '#1d4a3a'] },
  { id: 'ember', label: 'Ember', colors: ['#3a0f12', '#5b2416'] },
];

/** true when a background is dark enough that light timestamps should be used on it */
export const isDarkBg = (v: string) => v.startsWith('data:') || ['midnight', 'forest', 'ember'].includes(v);

export function Swatch({ id, size = 40 }: { id: string; size?: number }) {
  const p = CHAT_BGS.find((b) => b.id === id);
  if (!p) return null;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={`sw-${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={p.colors[0]} />
          <Stop offset="1" stopColor={p.colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width={size} height={size} rx={size / 2} fill={`url(#sw-${id})`} />
    </Svg>
  );
}

/** Fills its parent behind the messages. Empty value = nothing (the normal chat color). */
export function ChatBackground({ value }: { value: string }) {
  if (!value) return null;
  if (value.startsWith('data:')) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={{ uri: value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
      </View>
    );
  }
  const p = CHAT_BGS.find((b) => b.id === value);
  if (!p) return null;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 10 10">
      <Defs>
        <LinearGradient id={`bg-${p.id}`} x1="0" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={p.colors[0]} />
          <Stop offset="1" stopColor={p.colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width={10} height={10} fill={`url(#bg-${p.id})`} />
    </Svg>
  );
}
