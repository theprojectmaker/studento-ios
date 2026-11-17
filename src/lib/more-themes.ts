/**
 * Everyday-object clocks (components/boards-more.tsx). Style "y:<kind>:<n>": n picks how the
 * clock is built (shape, layout, material). One standout version of each kind is kept; ids are
 * unchanged so saved picks still match, and dropped versions map via theme-aliases.ts.
 */
import type { RawTheme } from './theme-data';
import type { Effect } from './themes';

type Row = { kind: string; n: number; name: string; bg: string; accent: string; ink?: string; effect?: Effect };

const ROWS: Row[] = [
  { kind: 'gauge', n: 0, name: 'Speedometer', bg: '#0b0c10', accent: '#ff3b30' },
  { kind: 'odometer', n: 1, name: 'Wooden Counter', bg: '#3b2a1a', accent: '#f3e9d2' },
  { kind: 'dymo', n: 0, name: 'Label Maker', bg: '#efeae0', accent: '#d62828', ink: '#222222' },
  { kind: 'plate', n: 0, name: 'License Plate', bg: '#0b2545', accent: '#b2182b' },
  { kind: 'candles', n: 1, name: 'Candlelight', bg: '#1a0f0a', accent: '#ffb703', effect: 'embers' },
  { kind: 'moon', n: 0, name: 'Full Moon', bg: '#04060f', accent: '#f4f1de', effect: 'stars' },
  { kind: 'signal', n: 0, name: 'Traffic Light', bg: '#e9ecef', accent: '#34c759', ink: '#111111' },
  { kind: 'heartbeat', n: 0, name: 'Heart Monitor', bg: '#000000', accent: '#00ff87', effect: 'scanlines' },
  { kind: 'stack', n: 1, name: 'Coin Stack', bg: '#0b1d13', accent: '#e9b949' },
  { kind: 'frame', n: 0, name: 'Polaroid', bg: '#2b2b2b', accent: '#e76f51' },
  { kind: 'loading', n: 2, name: 'Retro Loader', bg: '#000000', accent: '#33ff33', effect: 'scanlines' },
];

export const MORE_THEMES: RawTheme[] = ROWS.map(({ kind, n, name, bg, accent, ink }) => ({ id: `y-${kind}-${n}`, name, group: 'Objects', bg, accent, ...(ink ? { ink } : null), style: `y:${kind}:${n}` }));
export const MORE_EFFECTS: Record<string, Effect> = Object.fromEntries(ROWS.filter((r) => r.effect).map((r) => [`y-${r.kind}-${r.n}`, r.effect as Effect]));
