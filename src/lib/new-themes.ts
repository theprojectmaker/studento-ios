/**
 * Clever clocks (group "Clever Clocks"). Every one is a whole different KIND of
 * clock, not a recolour: one standout version of each of the ten styles in components/boards-new.tsx
 * (shapes, materials, layouts). Style is "x:<kind>:<variant>".
 */
import type { RawTheme } from './theme-data';
import type { Effect } from './themes';

type T = Omit<RawTheme, 'group'> & { effect?: Effect };

const LIST: T[] = [
  // Binary lights
  { id: 'x-binary-lamps', name: 'Control Panel', bg: '#1c1f22', accent: '#ffb000', style: 'x:binary:lamps', effect: 'scanlines' },
  // Pixel digits
  { id: 'x-pixel-8bit', name: '8-Bit', bg: '#1d1340', accent: '#ffd23f', ink: '#ffd23f', style: 'x:pixel:blocks' },
  // Segment digits
  { id: 'x-seg-neon', name: 'Neon Outline', bg: '#07000f', accent: '#ff2bd6', style: 'x:segment:neon', effect: 'bokeh' },
  // Fill-up timers
  { id: 'x-fill-hourglass', name: 'Hourglass', bg: '#2a1d12', accent: '#e9c46a', style: 'x:fill:hourglass', effect: 'dust' },
  // Word clocks
  { id: 'x-word-sentence', name: 'Storybook', bg: '#fbf6ec', accent: '#9b2c2c', style: 'x:word:sentence', effect: 'petals' },
  // Dot fields
  { id: 'x-dots-spiral', name: 'Galaxy Spiral', bg: '#04040d', accent: '#a78bfa', style: 'x:dots:spiral', effect: 'stars' },
  // Sculpted digits
  { id: 'x-sculpt-extrude', name: '3D Block', bg: '#ffe066', accent: '#ef476f', ink: '#ffffff', style: 'x:sculpt:extrude' },
  // Counting systems
  { id: 'x-count-tally', name: 'Tally Marks', bg: '#2b3a2e', accent: '#f4d35e', ink: '#f2f2ea', style: 'x:count:tally' },
  { id: 'x-count-dice', name: 'Dice', bg: '#0b6e4f', accent: '#ffffff', ink: '#ffffff', style: 'x:count:dice' },
  // Radial countdowns
  { id: 'x-radial-orbit', name: 'Planets', bg: '#05030f', accent: '#ff6b35', style: 'x:radial:orbit', effect: 'stars' },
  // Tile digits
  { id: 'x-tiles-scrabble', name: 'Word Game', bg: '#1f5f3b', accent: '#f1dcae', ink: '#ffffff', style: 'x:tiles:scrabble' },
];

export const NEW_THEMES: RawTheme[] = LIST.map(({ effect: _e, ...t }) => ({ ...t, group: 'Clever Clocks' }));
export const NEW_EFFECTS: Record<string, Effect> = Object.fromEntries(LIST.filter((t) => t.effect).map((t) => [t.id, t.effect as Effect]));

