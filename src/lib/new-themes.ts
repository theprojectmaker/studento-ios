/**
 * 50 brand-new themes (group "New", first in the picker). Every one is a whole different KIND of
 * clock, not a recolour: ten new clock styles (components/boards-new.tsx) x five versions each
 * that are built differently (shapes, materials, layouts). Style is "x:<kind>:<variant>".
 */
import type { RawTheme } from './theme-data';
import type { Effect } from './themes';

type T = Omit<RawTheme, 'group'> & { effect?: Effect };

const LIST: T[] = [
  // Binary lights
  { id: 'x-binary-dots', name: 'Binary', bg: '#0a0f1a', accent: '#5ee1ff', style: 'x:binary:circles' },
  { id: 'x-binary-blocks', name: 'Binary Blocks', bg: '#f4f1ea', accent: '#e4572e', style: 'x:binary:squares' },
  { id: 'x-binary-bars', name: 'Bit Bars', bg: '#111111', accent: '#c6ff3d', style: 'x:binary:bars' },
  { id: 'x-binary-lamps', name: 'Control Panel', bg: '#1c1f22', accent: '#ffb000', style: 'x:binary:lamps', effect: 'scanlines' },
  { id: 'x-binary-punch', name: 'Punch Card', bg: '#efe6cf', accent: '#2a2a2a', ink: '#2a2a2a', style: 'x:binary:holes' },
  // Pixel digits
  { id: 'x-pixel-8bit', name: '8-Bit', bg: '#1d1340', accent: '#ffd23f', ink: '#ffd23f', style: 'x:pixel:blocks' },
  { id: 'x-pixel-matrix', name: 'Dot Matrix Sign', bg: '#050505', accent: '#ff7a00', style: 'x:pixel:dots' },
  { id: 'x-pixel-stitch', name: 'Cross-Stitch', bg: '#f6efe4', accent: '#c0392b', style: 'x:pixel:stitch' },
  { id: 'x-pixel-lego', name: 'Brick Builder', bg: '#2d6a4f', accent: '#ffcd00', style: 'x:pixel:lego' },
  { id: 'x-pixel-mosaic', name: 'Mosaic', bg: '#f3ead8', accent: '#1d4e89', ink: '#c06014', style: 'x:pixel:mosaic' },
  // Segment digits
  { id: 'x-seg-capsule', name: 'Capsules', bg: '#fff6e9', accent: '#ff6b6b', style: 'x:segment:capsule' },
  { id: 'x-seg-neon', name: 'Neon Outline', bg: '#07000f', accent: '#ff2bd6', style: 'x:segment:neon', effect: 'bokeh' },
  { id: 'x-seg-match', name: 'Matchsticks', bg: '#3a2617', accent: '#e8c48a', style: 'x:segment:match' },
  { id: 'x-seg-slant', name: 'Racing Digits', bg: '#0e0e10', accent: '#ff3b30', style: 'x:segment:slant' },
  { id: 'x-seg-dotted', name: 'Dotted', bg: '#eef3f8', accent: '#3355ff', style: 'x:segment:dotted' },
  // Fill-up timers
  { id: 'x-fill-glass', name: 'Water Glass', bg: '#e9f4fb', accent: '#2a9df4', style: 'x:fill:glass', effect: 'bubbles' },
  { id: 'x-fill-battery', name: 'Battery', bg: '#0b0d0c', accent: '#34c759', style: 'x:fill:battery' },
  { id: 'x-fill-hourglass', name: 'Hourglass', bg: '#2a1d12', accent: '#e9c46a', style: 'x:fill:hourglass', effect: 'dust' },
  { id: 'x-fill-pie', name: 'Pie Chart', bg: '#fffaf0', accent: '#f4a261', style: 'x:fill:pie' },
  { id: 'x-fill-thermo', name: 'Thermometer', bg: '#f7f7f7', accent: '#e63946', style: 'x:fill:thermo' },
  // Word clocks
  { id: 'x-word-stack', name: 'Spelled Out', bg: '#111827', accent: '#facc15', style: 'x:word:stack' },
  { id: 'x-word-sentence', name: 'Storybook', bg: '#fbf6ec', accent: '#9b2c2c', style: 'x:word:sentence', effect: 'petals' },
  { id: 'x-word-grid', name: 'Letter Grid', bg: '#0c0c0c', accent: '#ffffff', style: 'x:word:grid' },
  { id: 'x-word-type', name: 'Typewriter', bg: '#ece5d8', accent: '#1f1f1f', ink: '#1f1f1f', style: 'x:word:type' },
  { id: 'x-word-vertical', name: 'Banner', bg: '#d7263d', accent: '#fff3b0', ink: '#ffffff', style: 'x:word:vertical' },
  // Dot fields
  { id: 'x-dots-grid', name: 'Minute Grid', bg: '#f2f2f2', accent: '#111111', style: 'x:dots:grid' },
  { id: 'x-dots-spiral', name: 'Galaxy Spiral', bg: '#04040d', accent: '#a78bfa', style: 'x:dots:spiral', effect: 'stars' },
  { id: 'x-dots-ring', name: 'Bead Ring', bg: '#1b2a24', accent: '#7ee8c3', style: 'x:dots:ring' },
  { id: 'x-dots-abacus', name: 'Abacus', bg: '#f5e6c8', accent: '#b5462f', style: 'x:dots:abacus' },
  { id: 'x-dots-confetti', name: 'Confetti', bg: '#ffffff', accent: '#ff3d7f', glow: '#2ec4b6', ink: '#3a3a3a', style: 'x:dots:confetti' },
  // Sculpted digits
  { id: 'x-sculpt-stack', name: 'Tower', bg: '#000000', accent: '#ff5f1f', style: 'x:sculpt:stack' },
  { id: 'x-sculpt-outline', name: 'Hollow', bg: '#0f172a', accent: '#38bdf8', style: 'x:sculpt:outline' },
  { id: 'x-sculpt-cutout', name: 'Cut-Out', bg: '#fdf0d5', accent: '#003049', style: 'x:sculpt:cutout' },
  { id: 'x-sculpt-extrude', name: '3D Block', bg: '#ffe066', accent: '#ef476f', ink: '#ffffff', style: 'x:sculpt:extrude' },
  { id: 'x-sculpt-mirror', name: 'Reflection', bg: '#0a0a0a', accent: '#cfcfcf', style: 'x:sculpt:mirror' },
  // Counting systems
  { id: 'x-count-tally', name: 'Tally Marks', bg: '#2b3a2e', accent: '#f4d35e', ink: '#f2f2ea', style: 'x:count:tally' },
  { id: 'x-count-roman', name: 'Roman Time', bg: '#f1ece2', accent: '#7a1f2b', style: 'x:count:roman' },
  { id: 'x-count-dice', name: 'Dice', bg: '#0b6e4f', accent: '#ffffff', ink: '#ffffff', style: 'x:count:dice' },
  { id: 'x-count-morse', name: 'Morse Code', bg: '#0d1b2a', accent: '#ffd166', style: 'x:count:morse', effect: 'scanlines' },
  { id: 'x-count-ruler', name: 'Ruler', bg: '#f6d860', accent: '#1a1a1a', ink: '#1a1a1a', style: 'x:count:ruler' },
  // Radial countdowns
  { id: 'x-radial-sun', name: 'Sun Rays', bg: '#ff9f1c', accent: '#fff3c4', ink: '#3d1f00', style: 'x:radial:rays' },
  { id: 'x-radial-petals', name: 'Flower', bg: '#fdf2f8', accent: '#ec4899', style: 'x:radial:petals', effect: 'petals' },
  { id: 'x-radial-rings', name: 'Ripples', bg: '#03224c', accent: '#4cc9f0', style: 'x:radial:rings' },
  { id: 'x-radial-pie', name: 'Pizza', bg: '#1a1a1a', accent: '#ffb703', style: 'x:radial:pie' },
  { id: 'x-radial-orbit', name: 'Planets', bg: '#05030f', accent: '#ff6b35', style: 'x:radial:orbit', effect: 'stars' },
  // Tile digits
  { id: 'x-tiles-sticky', name: 'Sticky Notes', bg: '#e9e4d8', accent: '#ffe066', style: 'x:tiles:sticky' },
  { id: 'x-tiles-scrabble', name: 'Word Game', bg: '#1f5f3b', accent: '#f1dcae', ink: '#ffffff', style: 'x:tiles:scrabble' },
  { id: 'x-tiles-keys', name: 'Keyboard', bg: '#1e1e22', accent: '#8a8aff', style: 'x:tiles:keys' },
  { id: 'x-tiles-cards', name: 'Card Table', bg: '#0b5d3b', accent: '#ffffff', ink: '#ffffff', style: 'x:tiles:cards' },
  { id: 'x-tiles-domino', name: 'Dominoes', bg: '#c9b79c', accent: '#1b1b1b', style: 'x:tiles:domino' },
];

export const NEW_THEMES: RawTheme[] = LIST.map(({ effect: _e, ...t }) => ({ ...t, group: 'New' }));
export const NEW_EFFECTS: Record<string, Effect> = Object.fromEntries(LIST.filter((t) => t.effect).map((t) => [t.id, t.effect as Effect]));
export const NEW_IDS: string[] = LIST.map((t) => t.id);
