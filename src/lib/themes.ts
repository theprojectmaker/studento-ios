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
import { TABLET } from './scale';
import { MORE_EFFECTS, MORE_THEMES } from './more-themes';
import { NEW_EFFECTS, NEW_THEMES } from './new-themes';
import { THEME_ALIASES } from './theme-aliases';
import { RAW_THEMES, type RawTheme } from './theme-data';
import { typeFor, type TypeSpec } from './typefaces';

export type Engine = 'flap' | 'dial' | 'ring' | 'led' | 'lcd' | 'nixie' | 'ink' | 'reel' | 'deco' | 'race' | 'x' | 'y';
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
  /** New-style clocks (engine "x"): "kind:variant", see components/boards-new.tsx. */
  x?: string;
  /** More new clocks (engine "y"): "kind:n", see components/boards-more.tsx. */
  y?: string;
}

/** Palettes the website keeps in CSS rather than in its theme data. */
const CSS: Record<string, Partial<RawTheme> & { tile?: string; tileInk?: string; cabinet?: string }> = {
  departure: { ink: '#f2e8d5', tileInk: '#f2e8d5' },
  chalkboard: { ink: '#eef2e8', tile: '#22322a' },
  watch: { dialFace: '#1c1f25', dialTick: '#8c96a6' },
  grandfather: { dialFace: '#f1e4c8', dialTick: '#3a2a1a', dialInk: '#2a1d12', dialSecond: '#9c2b1c' },
  swiss: { dialFace: '#ffffff', dialTick: '#111111', dialInk: '#111111', ink: '#111111' },
  diver: { dialFace: '#0b0e12', dialTick: '#e8ffd0' },
  bauhaus: { dialFace: '#ffffff', dialTick: '#111111', dialInk: '#111111', ink: '#111111' },
  gameboy: { lcdPanel: '#8bac0f', lcdInk: '#0f380f' },
  editorial: { ink: '#1f1a14' },
  sakura: { ink: '#3a1f2b', fonts: 'serif' },
  space: { ink: '#e8eeff' },
  // Casino reels: tile = reel face, tileInk = symbols, cabinet = machine body.
  jackpot: { tile: '#f6ecd6', tileInk: '#a3121f', cabinet: '#5a0b12', ink: '#fbeed2' },
  vegas: { tile: '#fff4fa', tileInk: '#1b0730', cabinet: '#2a0a45', ink: '#ffe6f4' },
  // Gilded: ink is a soft champagne so labels sit with the gold digits.
  gatsby: { ink: '#efe2bd' },
  ivory: { ink: '#3a2c14' },
  rosechampagne: { ink: '#f7dfd5' },
  rollers: { tile: '#f6ecd6', tileInk: '#14110b', ink: '#f6ecd6' },
  noirflip: { ink: '#f4f4f4', tile: '#f4f4f4', tileInk: '#0a0a0a' },
};

/** Themes made for the app (not on the website). Picker group and name come from PICKER below. */
const EXTRA: RawTheme[] = [
  { id: 'liquidglass', name: 'Liquid Glass', group: 'Fun', bg: '#050506', accent: '#5ab8ff', ink: '#ffffff', style: 'ink' },
  { id: 'racetrack', name: 'Race Track', group: 'Fun', bg: '#101214', accent: '#ff3b30', style: 'race' },
  { id: 'racetrack-day', name: 'Race Day', group: 'Fun', bg: '#eef0e6', accent: '#1d6fe0', style: 'race' },
  // Split-flap palettes
  { id: 'cream', name: 'Cream', group: 'Split-flap', bg: '#f3ecdd', accent: '#b5542b', style: 'flap' },
  { id: 'coral', name: 'Coral', group: 'Split-flap', bg: '#ff6b57', accent: '#1d1b1a', style: 'flap' },
  // Reels
  // Deco
  { id: 'jade', name: 'Jade', group: 'Gilded', bg: '#062a22', accent: '#bfe9d2', style: 'deco' },
  // LED signs
  { id: 'dotmatrix', name: 'Dot Matrix', group: 'LED sign', bg: '#0b0b0b', accent: '#ffb000', style: 'dots' },
  // Typographic / ink
  { id: 'bars', name: 'Bars', group: 'Typographic', bg: '#101010', accent: '#ffffff', style: 'bars' },
  // LCD / tubes / dials
  { id: 'casio', name: 'Casio', group: 'LCD', bg: '#c9d6c2', accent: '#1c2a1a', style: 'lcd' },
  { id: 'seven', name: 'Seven Segment', group: 'LCD', bg: '#000000', accent: '#ff5a1f', style: 'seven' },
  { id: 'sector', name: 'Sector Dial', group: 'Analog', bg: '#f0ede6', accent: '#c0392b', style: 'dial:sector' },
  { id: 'noirflip', name: 'Noir Flip', group: 'Split-flap', bg: '#000000', accent: '#ffffff', style: 'flap' },
  { id: 'jackpot', name: 'Jackpot', group: 'Casino', bg: '#14060a', accent: '#f5c542', style: 'reel' },
  { id: 'vegas', name: 'Vegas Strip', group: 'Casino', bg: '#0b0418', accent: '#ff3ea5', style: 'reel' },
  { id: 'gatsby', name: 'Gatsby', group: 'Gilded', bg: '#0a0a0c', accent: '#d4af37', style: 'deco' },
  { id: 'ivory', name: 'Ivory Ballroom', group: 'Gilded', bg: '#f6efe2', accent: '#a67c2e', style: 'deco' },
  { id: 'rosechampagne', name: 'Rose Champagne', group: 'Gilded', bg: '#2a1418', accent: '#f2b8a2', style: 'deco' },
  { id: 'rollers', name: 'Rollers', group: 'Casino', bg: '#000000', accent: '#f5c542', style: 'reelbare' },
  // Fun: bright, playful palettes on the split-flap board.
  // Quiet: soft, low-contrast palettes for a calm screen.
];

/** One quiet live effect, only where it fits the theme. */
const EFFECTS: Record<string, Effect> = {
  jade: 'dust',
  jackpot: 'glints',
  vegas: 'bokeh',
  gatsby: 'glints',
  ivory: 'dust',
  rosechampagne: 'bubbles',
  midnight: 'stars',
  space: 'stars',
  sakura: 'petals',
  'mat-kintsugi': 'embers',
  diver: 'bubbles',
  terminal: 'scanlines',
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
  if (style.startsWith('x:')) return { engine: 'x', dialStyle: 'watch' };
  if (style.startsWith('y:')) return { engine: 'y', dialStyle: 'watch' };
  const map: Record<string, Engine> = { reel: 'reel', reelbare: 'reel', deco: 'deco', flap: 'flap', tape: 'flap', led: 'led', dots: 'led', lcd: 'lcd', seven: 'lcd', nixie: 'nixie', ink: 'ink', word: 'ink', bars: 'ink', ring: 'ring', race: 'race' };
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
    effect: EFFECTS[x.id] ?? NEW_EFFECTS[x.id] ?? MORE_EFFECTS[x.id] ?? 'none',
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
    x: x.style?.startsWith('x:') ? x.style.slice(2) : undefined,
    y: x.style?.startsWith('y:') ? x.style.slice(2) : undefined,
  };
}

/**
 * The picker, in order: each group is one kind of board, and no two themes in it are recolours
 * of each other. Group and name here win over the raw data.
 */
const PICKER: [group: string, themes: [id: string, name?: string][]][] = [
  ['Featured', [['liquidglass'], ['departure', 'Train Station']]],
  ['Split-flap', [['midnight', 'Midnight Board'], ['noirflip', 'Noir'], ['cream', 'Cream'], ['coral', 'Coral'], ['chalkboard', 'Chalkboard']]],
  ['Analog', [['watch', 'Wristwatch'], ['grandfather', 'Grandfather'], ['swiss', 'Swiss Rail'], ['diver', 'Diver'], ['bauhaus', 'Bauhaus'], ['sector', 'Sector']]],
  ['Signs & Screens', [['motorway', 'Motorway'], ['neon', 'Neon'], ['dotmatrix', 'Dot Matrix'], ['terminal', 'Terminal'], ['gameboy', 'Handheld'], ['casio', 'Calculator'], ['seven', 'Seven Segment'], ['nixie', 'Nixie Tubes']]],
  ['Typographic', [['editorial', 'Editorial'], ['mono', 'Mono'], ['sakura', 'Sakura'], ['space', 'Deep Space'], ['bars', 'Bars'], ['mat-kintsugi', 'Kintsugi']]],
  ['Casino', [['jackpot', 'Jackpot'], ['vegas', 'Vegas Strip'], ['rollers', 'Rollers']]],
  ['Gilded', [['gatsby', 'Gatsby'], ['ivory', 'Ivory Ballroom'], ['jade', 'Jade'], ['rosechampagne', 'Rose Champagne']]],
  ['Clever Clocks', [['x-binary-lamps'], ['x-pixel-8bit'], ['x-seg-neon'], ['x-fill-hourglass'], ['x-word-sentence'], ['x-dots-spiral'], ['x-sculpt-extrude'], ['x-count-dice'], ['x-count-tally'], ['x-radial-orbit'], ['x-tiles-scrabble']]],
  ['Objects', MORE_THEMES.map((t): [string] => [t.id])],
];
const PLACE = new Map(PICKER.flatMap(([group, list]) => list.map(([id, name]) => [id, { group, name }] as const)));
const BETA_IDS = ['racetrack', 'racetrack-day'];
const KEEP = new Set([...PLACE.keys(), ...BETA_IDS]);
/** Every theme the app still ships (the picker plus beta themes). */
export const ALL_THEMES: Theme[] = [...NEW_THEMES, ...MORE_THEMES, ...EXTRA, ...RAW_THEMES]
  .filter((r) => KEEP.has(r.id))
  .map((r) => ({ ...r, name: PLACE.get(r.id)?.name ?? r.name, group: PLACE.get(r.id)?.group ?? r.group }))
  .map(build);
const byId = new Map(ALL_THEMES.map((t) => [t.id, t]));

export const THEMES: Theme[] = PICKER.flatMap(([, list]) => list.map(([id]) => byId.get(id))).filter((t): t is Theme => !!t && (TABLET || t.engine !== 'race'));
export const GROUPS: string[] = [...new Set(THEMES.map((t) => t.group))];

/** Beta themes, shown only after their code is redeemed (and Race Track only on iPad). */
const BETA: { id: string; unlock: string }[] = [
  { id: 'racetrack', unlock: 'race' },
  { id: 'racetrack-day', unlock: 'race' },
];
export function pickerThemes(unlocks: string[]): Theme[] {
  const beta = BETA.filter((b) => unlocks.includes(b.unlock))
    .map((b) => byId.get(b.id))
    .filter((t): t is Theme => !!t && (TABLET || t.engine !== 'race'))
    .map((t) => ({ ...t, group: 'Beta' }));
  return [...beta, ...THEMES];
}
export const DEFAULT_THEME = 'departure';

/** Theme ids removed since a build shipped them resolve to their closest survivor. */
export function canonicalThemeId(id: string): string {
  return byId.has(id) ? id : (THEME_ALIASES[id] ?? DEFAULT_THEME);
}

/** Any id ever shipped still resolves (removed ones via theme-aliases.ts); unknown ids fall back to Train Station. */
export function themeById(id: string): Theme {
  const t = byId.get(canonicalThemeId(id));
  if (t && (TABLET || t.engine !== 'race')) return t;
  return byId.get(DEFAULT_THEME) ?? THEMES[0];
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
