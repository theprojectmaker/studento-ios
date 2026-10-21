/**
 * Every theme from the real Studento (generated into theme-data.ts by
 * scripts/extract-themes.mjs), polished for the app. Each keeps its board:
 *   flap   split-flap departure board        led    glowing LED sign
 *   lcd    calculator LCD (+ seven-segment)  nixie  warm nixie tubes
 *   ink    big type (sans, serif, mono)      ring   timer ring
 *   dial   analog kitchen-timer face: a colored wedge shows the minutes left
 *   reel   slot-machine reels that spin down    deco   Art Deco metallic gold
 * and, where it fits the theme, one quiet live effect (snow, petals, embers...).
 */
import { RAW_THEMES, type RawTheme } from './theme-data';
import { typeFor, type TypeSpec } from './typefaces';

export type Engine = 'flap' | 'dial' | 'ring' | 'led' | 'lcd' | 'nixie' | 'ink' | 'reel' | 'deco';
export type HeroFont = 'sans' | 'serif' | 'mono' | 'rounded';
export type Effect = 'none' | 'stars' | 'snow' | 'petals' | 'embers' | 'fireflies' | 'bubbles' | 'rain' | 'scanlines' | 'dust' | 'glints' | 'bokeh';
export type Numerals = 'arabic' | 'roman' | 'quarters' | 'none';
export type DialStyle = 'watch' | 'grandfather' | 'swiss' | 'diver' | 'pocket' | 'bauhaus' | 'minimal' | 'sector';

export interface Theme {
  id: string;
  name: string;
  group: string;
  engine: Engine;
  dialStyle: DialStyle;
  numerals: Numerals;
  font: HeroFont;
  effect: Effect;
  /** Fonts for title, countdown digits and labels. */
  type: TypeSpec;
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  glow: string;
  light: boolean;
  /** Cards and list rows. */
  panel: string;
  tile: string;
  tileInk: string;
  lcd: string;
  lcdInk: string;
  dialFace: string;
  dialTick: string;
  dialInk: string;
  dialSecond: string;
  /** Slot-machine cabinet (reel engine). */
  cabinet: string;
  /** Reel engine with nothing but the rolling digits (no cabinet, bulbs, payline). */
  bare: boolean;
}

/** Palettes the website keeps in CSS rather than in its theme data. */
const CSS: Record<string, Partial<RawTheme> & { tile?: string; tileInk?: string; cabinet?: string }> = {
  departure: { ink: '#f2e8d5', tileInk: '#f2e8d5' },
  paper: { ink: '#2a2118' },
  chalkboard: { ink: '#eef2e8', tile: '#22322a' },
  cassette: { ink: '#f6e7d4' },
  watch: { dialFace: '#1c1f25', dialTick: '#8c96a6' },
  grandfather: { dialFace: '#f1e4c8', dialTick: '#3a2a1a', dialInk: '#2a1d12', dialSecond: '#9c2b1c' },
  swiss: { dialFace: '#ffffff', dialTick: '#111111', dialInk: '#111111', ink: '#111111' },
  diver: { dialFace: '#0b0e12', dialTick: '#e8ffd0' },
  pocket: { dialFace: '#f4e9d2', dialTick: '#5a4630', dialInk: '#2a1d12' },
  bauhaus: { dialFace: '#ffffff', dialTick: '#111111', dialInk: '#111111', ink: '#111111' },
  lcd: { lcdPanel: '#b9c6a3', lcdInk: '#1e2618' },
  gameboy: { lcdPanel: '#8bac0f', lcdInk: '#0f380f' },
  editorial: { ink: '#1f1a14' },
  gold: { ink: '#f3e7c4', fonts: 'serif' },
  sakura: { ink: '#3a1f2b', fonts: 'serif' },
  arctic: { ink: '#13293d' },
  sunrise: { ink: '#3a2418', fonts: 'serif' },
  space: { ink: '#e8eeff' },
  // Casino reels: tile = reel face, tileInk = symbols, cabinet = machine body.
  jackpot: { tile: '#f6ecd6', tileInk: '#a3121f', cabinet: '#5a0b12', ink: '#fbeed2' },
  vegas: { tile: '#fff4fa', tileInk: '#1b0730', cabinet: '#2a0a45', ink: '#ffe6f4' },
  montecarlo: { tile: '#f4efe2', tileInk: '#0b3a28', cabinet: '#0a3b2a', ink: '#f2ead2' },
  cherry: { tile: '#fffaf0', tileInk: '#c4001f', cabinet: '#1a1a1d', ink: '#fff0ee' },
  diamond: { tile: '#eef5ff', tileInk: '#0b1a3c', cabinet: '#0f2147', ink: '#e8f2ff' },
  odometer: { tile: '#151515', tileInk: '#f2eee4', cabinet: '#2a2622', ink: '#efe9dc' },
  pachinko: { tile: '#ffffff', tileInk: '#5b1fa8', cabinet: '#3b145f', ink: '#fff6d8' },
  clover: { tile: '#f7fff6', tileInk: '#0b5a2c', cabinet: '#0b3a1d', ink: '#eaffef' },
  // Gilded: ink is a soft champagne so labels sit with the gold digits.
  gatsby: { ink: '#efe2bd' },
  champagne: { ink: '#f5e9cf' },
  emerald: { ink: '#efe3bf' },
  onyxgold: { ink: '#e9dcb4' },
  ivory: { ink: '#3a2c14' },
  rosechampagne: { ink: '#f7dfd5' },
  sapphire: { ink: '#f1e6c6' },
  noir: { ink: '#f3e2c2' },
  rollers: { tile: '#f6ecd6', tileInk: '#14110b', ink: '#f6ecd6' },
  'rollers-ivory': { tile: '#1b1b1b', tileInk: '#f4efe2', ink: '#f4efe2' },
  highroller: { tile: '#101010', tileInk: '#f4f4f4', cabinet: '#1a1a1a', ink: '#f4f4f4' },
  baccarat: { tile: '#fff2f3', tileInk: '#7a0f2a', cabinet: '#3a0a18', ink: '#ffe9ec' },
  roulette: { tile: '#0b0b0b', tileInk: '#ff5252', cabinet: '#0b2a1a', ink: '#eaffef' },
  goldrush: { tile: '#2a1c04', tileInk: '#ffcf4a', cabinet: '#3d2a05', ink: '#fff0c8' },
  bluechip: { tile: '#e9f2ff', tileInk: '#0a2a66', cabinet: '#0a2250', ink: '#e8f2ff' },
  neonslots: { tile: '#0a0a12', tileInk: '#39ff88', cabinet: '#12082a', ink: '#eaffef' },
  speakeasy: { ink: '#f0dcc0' },
  orient: { ink: '#eadfbf' },
  opera: { ink: '#f4dfc4' },
  platinum: { ink: '#e8edf5' },
  copperdeco: { ink: '#f2d8c8' },
  pearl: { ink: '#2f3138' },
};

/** New in the app: casino reels and Art Deco gold (listed first in the picker). */
const EXTRA: RawTheme[] = [
  { id: 'jackpot', name: 'Jackpot', group: 'Casino', bg: '#14060a', accent: '#f5c542', style: 'reel' },
  { id: 'vegas', name: 'Vegas Strip', group: 'Casino', bg: '#0b0418', accent: '#ff3ea5', style: 'reel' },
  { id: 'montecarlo', name: 'Monte Carlo', group: 'Casino', bg: '#03241a', accent: '#d9b45a', style: 'reel' },
  { id: 'cherry', name: 'Cherry Seven', group: 'Casino', bg: '#0e0e10', accent: '#ff2a3d', style: 'reel' },
  { id: 'diamond', name: 'Diamond Club', group: 'Casino', bg: '#050b1a', accent: '#9fd6ff', style: 'reel' },
  { id: 'pachinko', name: 'Pachinko', group: 'Casino', bg: '#1b0a2e', accent: '#ffd23f', style: 'reel' },
  { id: 'clover', name: 'Lucky Clover', group: 'Casino', bg: '#04200f', accent: '#36d17a', style: 'reel' },
  { id: 'odometer', name: 'Odometer', group: 'Casino', bg: '#0d0c0b', accent: '#c9b98f', style: 'reel' },
  { id: 'gatsby', name: 'Gatsby', group: 'Gilded', bg: '#0a0a0c', accent: '#d4af37', style: 'deco' },
  { id: 'champagne', name: 'Champagne', group: 'Gilded', bg: '#1a1510', accent: '#f1d9a6', style: 'deco' },
  { id: 'emerald', name: 'Gilded Emerald', group: 'Gilded', bg: '#03261c', accent: '#d6b25e', style: 'deco' },
  { id: 'onyxgold', name: 'Onyx & Gold', group: 'Gilded', bg: '#000000', accent: '#c9a227', style: 'deco' },
  { id: 'ivory', name: 'Ivory Ballroom', group: 'Gilded', bg: '#f6efe2', accent: '#a67c2e', style: 'deco' },
  { id: 'rosechampagne', name: 'Rose Champagne', group: 'Gilded', bg: '#2a1418', accent: '#f2b8a2', style: 'deco' },
  { id: 'sapphire', name: 'Sapphire Deco', group: 'Gilded', bg: '#071433', accent: '#e3c27a', style: 'deco' },
  { id: 'noir', name: 'Velvet Noir', group: 'Gilded', bg: '#1a0410', accent: '#e6c27a', style: 'deco' },
  { id: 'rollers', name: 'Rollers', group: 'Casino', bg: '#000000', accent: '#f5c542', style: 'reelbare' },
  { id: 'rollers-ivory', name: 'Rollers Ivory', group: 'Casino', bg: '#101010', accent: '#e8e2d2', style: 'reelbare' },
  { id: 'highroller', name: 'High Roller', group: 'Casino', bg: '#060606', accent: '#ffffff', style: 'reel' },
  { id: 'baccarat', name: 'Baccarat', group: 'Casino', bg: '#16050a', accent: '#e8b4b8', style: 'reel' },
  { id: 'roulette', name: 'Roulette', group: 'Casino', bg: '#04180f', accent: '#ff5252', style: 'reel' },
  { id: 'goldrush', name: 'Gold Rush', group: 'Casino', bg: '#150f02', accent: '#ffb300', style: 'reel' },
  { id: 'bluechip', name: 'Blue Chip', group: 'Casino', bg: '#020a1c', accent: '#4aa3ff', style: 'reel' },
  { id: 'neonslots', name: 'Neon Slots', group: 'Casino', bg: '#07020f', accent: '#39ff88', style: 'reel' },
  { id: 'speakeasy', name: 'Speakeasy', group: 'Gilded', bg: '#120a06', accent: '#c98b4b', style: 'deco' },
  { id: 'orient', name: 'Orient Express', group: 'Gilded', bg: '#0b1410', accent: '#d9b96a', style: 'deco' },
  { id: 'opera', name: 'Opera House', group: 'Gilded', bg: '#240308', accent: '#e7c66a', style: 'deco' },
  { id: 'platinum', name: 'Platinum', group: 'Gilded', bg: '#0a0b0e', accent: '#cfd6e0', style: 'deco' },
  { id: 'copperdeco', name: 'Copper Deco', group: 'Gilded', bg: '#120805', accent: '#d9825a', style: 'deco' },
  { id: 'pearl', name: 'Pearl', group: 'Gilded', bg: '#f4f1ec', accent: '#8a8f99', style: 'deco' },
];

/** One quiet live effect, only where it fits the theme. */
const EFFECTS: Record<string, Effect> = {
  jackpot: 'glints',
  vegas: 'bokeh',
  montecarlo: 'glints',
  diamond: 'glints',
  pachinko: 'bokeh',
  clover: 'glints',
  gatsby: 'glints',
  champagne: 'bubbles',
  emerald: 'glints',
  ivory: 'dust',
  rosechampagne: 'bubbles',
  sapphire: 'stars',
  noir: 'bokeh',
  highroller: 'glints',
  baccarat: 'bokeh',
  roulette: 'glints',
  goldrush: 'glints',
  bluechip: 'glints',
  neonslots: 'bokeh',
  speakeasy: 'dust',
  orient: 'glints',
  opera: 'bokeh',
  platinum: 'glints',
  copperdeco: 'embers',
  pearl: 'bubbles',
  midnight: 'stars',
  space: 'stars',
  observatory: 'stars',
  moonphase: 'stars',
  'sci-cassini': 'stars',
  'nat-aurora': 'stars',
  'mood-threeam': 'stars',
  arctic: 'snow',
  'nat-firstsnow': 'snow',
  sakura: 'petals',
  rosedial: 'petals',
  'city-kyoto': 'petals',
  lava: 'embers',
  gold: 'embers',
  luxe: 'embers',
  'mat-kintsugi': 'embers',
  forest: 'fireflies',
  field: 'fireflies',
  'nat-thaw': 'fireflies',
  ocean: 'bubbles',
  diver: 'bubbles',
  'city-sydney': 'bubbles',
  'city-tokyo': 'rain',
  'nat-thunderhead': 'rain',
  terminal: 'scanlines',
  amber: 'scanlines',
  'ret-phosphor': 'scanlines',
  'ret-tracking': 'scanlines',
  'sci-scope': 'scanlines',
  sunrise: 'dust',
  'mood-goldenhour': 'dust',
  'nat-highdesert': 'dust',
  'mood-library': 'dust',
};

const NUMERALS: Record<DialStyle, Numerals> = {
  watch: 'arabic',
  grandfather: 'roman',
  swiss: 'none',
  diver: 'quarters',
  pocket: 'roman',
  bauhaus: 'none',
  minimal: 'none',
  sector: 'quarters',
};

function engineOf(style: string): { engine: Engine; dialStyle: DialStyle } {
  if (style.startsWith('dial:')) return { engine: 'dial', dialStyle: style.slice(5) as DialStyle };
  const map: Record<string, Engine> = { reel: 'reel', reelbare: 'reel', deco: 'deco', flap: 'flap', tape: 'flap', led: 'led', dots: 'led', lcd: 'lcd', seven: 'lcd', nixie: 'nixie', ink: 'ink', word: 'ink', bars: 'ink', ring: 'ring' };
  return { engine: map[style] ?? 'flap', dialStyle: 'watch' };
}

function build(r: RawTheme): Theme {
  const x = { ...r, ...CSS[r.id] };
  const css = CSS[r.id] ?? {};
  const light = luminance(x.bg) > 0.5;
  // Warm off-white / soft black instead of pure #fff / #000 reads calmer.
  const ink = x.ink ?? (light ? '#1a1814' : '#f2eee6');
  const { engine, dialStyle } = engineOf(x.style || 'flap');
  const dialFace = x.dialFace ?? (light ? '#ffffff' : mix(x.bg, '#ffffff', 0.07));
  const faceLight = luminance(dialFace) > 0.5;
  return {
    id: x.id,
    name: x.name,
    group: x.group,
    engine,
    dialStyle,
    numerals: (x.numerals as Numerals) ?? NUMERALS[dialStyle] ?? 'none',
    font: (x.fonts as HeroFont) ?? (engine === 'ink' ? 'serif' : 'sans'),
    effect: EFFECTS[x.id] ?? 'none',
    type: typeFor(x.id),
    bg: x.bg,
    ink,
    muted: alpha(ink, 0.56),
    accent: x.accent,
    glow: x.glow ?? x.accent,
    light,
    panel: light ? mix(x.bg, '#000000', 0.05) : mix(x.bg, '#ffffff', 0.075),
    tile: css.tile ?? (light ? '#26262a' : mix(x.bg, '#ffffff', 0.1)),
    tileInk: css.tileInk ?? (light ? '#f5f1e8' : ink),
    lcd: x.lcdPanel ?? mix(x.accent, '#c8d0b8', 0.55),
    lcdInk: x.lcdInk ?? '#1c2418',
    dialFace,
    dialTick: x.dialTick ?? (faceLight ? '#1b1a17' : alpha(ink, 0.6)),
    dialInk: x.dialInk ?? (faceLight ? '#16181d' : ink),
    dialSecond: x.dialSecond ?? x.accent,
    cabinet: css.cabinet ?? mix(x.bg, '#000000', 0.35),
    bare: x.style === 'reelbare',
  };
}

// Picker order: Train Station (split-flap) first, then Casino, Gilded, then the rest.
const FIRST = ['Split-flap', 'Casino', 'Gilded'];
const rank = (g: string) => (FIRST.includes(g) ? FIRST.indexOf(g) : FIRST.length);
export const THEMES: Theme[] = [...EXTRA, ...RAW_THEMES].map(build).sort((x, y) => rank(x.group) - rank(y.group));
export const GROUPS: string[] = [...new Set(THEMES.map((t) => t.group))];
export const DEFAULT_THEME = 'departure';

/** Unknown ids (e.g. from an older build) fall back to Train Station. */
export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0];
}

function hex(c: string): [number, number, number] {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(c: string): number {
  const [r, g, b] = hex(c).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function alpha(c: string, a: number): string {
  if (c.startsWith('rgba')) return c;
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}

export function readableOn(c: string): string {
  return luminance(c) > 0.55 ? '#111111' : '#ffffff';
}
