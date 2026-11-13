import React, { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { boardPrefs } from './theme';

type PieceColor = 'w' | 'b';

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const BASE = rr(23, 76, 54, 13, 6.5);
const flare = (top: number, half: number) =>
  `M${50 - half} ${top}C${50 - half} ${top + 12} ${44 - half} 69 33 77H67C${56 + half} 69 ${50 + half} ${top + 12} ${50 + half} ${top}Z`;

// Parts are painted bottom to top, so each one reads as a separate turned section of the piece.
const SHAPES: Record<string, { parts: string[]; shine: string; detail?: string; eye?: [number, number] }> = {
  p: {
    parts: [BASE, flare(46, 7), rr(36, 41, 28, 7.5, 3.75), circle(50, 27, 15.5)],
    shine: 'M41 27C41 22 44.5 18.5 48 17.5',
  },
  r: {
    parts: [
      BASE,
      'M38 42L35 77H65L62 42Z',
      rr(33, 38, 34, 7, 3.5),
      'M29 13.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V20h5.5v-6.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V20H59v-6.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V30c0 4-3 8-7 8H36c-4 0-7-4-7-8Z',
    ],
    shine: 'M42 48L40.5 70',
  },
  b: {
    parts: [
      BASE,
      flare(52, 7),
      rr(36, 47, 28, 7, 3.5),
      'M50 15C60 23 67 32 62.5 47.5H37.5C33 32 40 23 50 15Z',
      circle(50, 11, 5.5),
    ],
    shine: 'M42 41C40.5 34 43 28 47 23',
    detail: 'M56 25L49 36',
  },
  n: {
    parts: [
      BASE,
      'M72 77C75 54 72 34 57 23C53 20 49 18.5 46 18.5L40 9L36.5 19.5C31 25 25 34 20 42.5C18 46 18.5 49.5 21 52C24 55 28 55.5 31.5 53.5L41 48.5C43.5 49 44.5 50.5 43.5 53C41 60 33 66 30 77Z',
    ],
    shine: 'M45 25C37 29 32 36 28 43',
    detail: 'M58 30C64 38 66 50 65.5 62',
    eye: [39, 33],
  },
  q: {
    parts: [
      BASE,
      flare(59, 8),
      rr(34, 53, 32, 7.5, 3.75),
      'M20 28L35 42L36 21L45.5 39L50 16L54.5 39L64 21L65 42L80 28L68 54H32Z',
      circle(20, 26, 5),
      circle(36, 19, 5),
      circle(50, 13, 5.5),
      circle(64, 19, 5),
      circle(80, 26, 5),
    ],
    shine: 'M39 49L34 42',
  },
  k: {
    parts: [
      BASE,
      flare(59, 8),
      rr(34, 53, 32, 7.5, 3.75),
      'M50 34C45 24 34 21 27.5 27.5C21.5 33.5 25.5 43 33 53.5H67C74.5 43 78.5 33.5 72.5 27.5C66 21 55 24 50 34Z',
      rr(46.5, 6, 7, 26, 2.5),
      rr(39.5, 12, 21, 7, 2.5),
    ],
    shine: 'M32 40C29.5 35 31 30 35 28.5',
  },
};

const PALETTE = {
  w: { top: '#FFFFFF', bottom: '#CFD7E3', lip: '#97A4B7', line: '#8290A5', shine: '#FFFFFF', shineOpacity: 1, detail: '#AEB9C8', eye: '#3B4757' },
  b: { top: '#65727F', bottom: '#262D38', lip: '#141920', line: '#141920', shine: '#FFFFFF', shineOpacity: 0.34, detail: '#141920', eye: '#E9EEF4' },
};

interface Props {
  type: string;
  color: PieceColor;
  size: number;
}

export const Piece = memo(function Piece({ type, color, size }: Props) {
  const shape = SHAPES[type];
  const c = PALETTE[color];
  if (!shape) return null;
  const gradId = `piece-${color}`;
  if (boardPrefs.pieces === 'flat') {
    // Flat look: solid fills and a firm outline, with no shine, drop shadow or raised edge.
    const fill = color === 'w' ? '#F8F8F8' : '#565352';
    const line = color === 'w' ? '#3A3836' : '#1E1C1B';
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {shape.parts.map((d, i) => (
          <Path key={i} d={d} fill={fill} stroke={line} strokeWidth={3.4} strokeLinejoin="round" />
        ))}
        {shape.detail && <Path d={shape.detail} fill="none" stroke={line} strokeWidth={3} strokeLinecap="round" />}
        {shape.eye && <Circle cx={shape.eye[0]} cy={shape.eye[1]} r={3} fill={line} />}
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gradId} x1="0.1" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={c.top} />
          <Stop offset="1" stopColor={c.bottom} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={50} cy={92.5} rx={31} ry={4.5} fill="#000000" opacity={0.17} />
      <G translate="0,3.5">
        {shape.parts.map((d, i) => (
          <Path key={i} d={d} fill={c.lip} stroke={c.lip} strokeWidth={2.6} strokeLinejoin="round" />
        ))}
      </G>
      {shape.parts.map((d, i) => (
        <Path key={i} d={d} fill={`url(#${gradId})`} stroke={c.line} strokeWidth={2.6} strokeLinejoin="round" />
      ))}
      {shape.detail && (
        <Path d={shape.detail} fill="none" stroke={c.detail} strokeWidth={3} strokeLinecap="round" />
      )}
      <Path d={shape.shine} fill="none" stroke={c.shine} strokeOpacity={c.shineOpacity} strokeWidth={3.6} strokeLinecap="round" />
      {shape.eye && <Circle cx={shape.eye[0]} cy={shape.eye[1]} r={3} fill={c.eye} />}
    </Svg>
  );
});
