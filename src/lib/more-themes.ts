/**
 * 150 more themes: 15 new kinds of clock (components/boards-more.tsx) x 10 versions each.
 * Style "y:<kind>:<n>": n changes how the clock is built (shape, layout, count, material).
 * Each kind gets its own group in the picker.
 */
import type { RawTheme } from './theme-data';
import type { Effect } from './themes';

type Row = [name: string, bg: string, accent: string, ink?: string, effect?: Effect];

const KINDS: { kind: string; group: string; rows: Row[] }[] = [
  {
    kind: 'gauge',
    group: 'Gauges',
    rows: [
      ['Speedometer', '#0b0c10', '#ff3b30'], ['Tachometer', '#14161a', '#ffcc00'], ['Fuel Gauge', '#1d2a22', '#7bd389'], ['Pressure', '#f2f2ee', '#1d3557'], ['Boost', '#0a0014', '#c77dff'],
      ['Altimeter', '#0d1b2a', '#4cc9f0'], ['Volume Knob', '#efe7dc', '#bc4749'], ['Steam Gauge', '#2b1d14', '#e9c46a', undefined, 'embers'], ['Oven Dial', '#fafafa', '#e76f51'], ['Cockpit', '#05070a', '#38f9a6', undefined, 'scanlines'],
    ],
  },
  {
    kind: 'odometer',
    group: 'Odometers',
    rows: [
      ['Mileage', '#1a1a1a', '#d9d9d9'], ['Wooden Counter', '#3b2a1a', '#f3e9d2'], ['Night Meter', '#000000', '#ffffff'], ['Gas Pump', '#c1121f', '#e9f1f7'], ['Taxi Meter', '#ffcc00', '#3b2a1a', '#1a1a1a'],
      ['Steel Counter', '#2f3e46', '#d9d9d9'], ['Antique Counter', '#4a3424', '#f3e9d2'], ['Ticket Counter', '#264653', '#ffffff'], ['Ice Meter', '#dbeafe', '#e9f1f7', '#0f172a'], ['Workshop', '#22223b', '#f3e9d2'],
    ],
  },
  {
    kind: 'dymo',
    group: 'Label Maker',
    rows: [
      ['Red Label', '#efeae0', '#d62828', '#222'], ['Navy Label', '#f4f4f4', '#1d3557', '#222'], ['Black Label', '#e5e5e5', '#111111', '#222'], ['Teal Label', '#f6efe6', '#2a9d8f', '#222'], ['Orange Label', '#1d1d1d', '#f4a261'],
      ['Purple Label', '#f3efe7', '#6a4c93', '#222'], ['Desk Label', '#cdb38b', '#d62828', '#222'], ['Locker Label', '#59656f', '#1d3557'], ['Toolbox', '#c1121f', '#111111'], ['Pantry', '#fefae0', '#2a9d8f', '#222'],
    ],
  },
  {
    kind: 'receipt',
    group: 'Receipts',
    rows: [
      ['Class Receipt', '#2b2d42', '#ffffff'], ['Time Ticket', '#e63946', '#ffffff'], ['Diner Order', '#1d3557', '#ffffff'], ['Bell Ticket', '#2a9d8f', '#ffffff'], ['Period Stub', '#111111', '#ffffff'],
      ['Café Slip', '#7f5539', '#ffffff'], ['Arcade Ticket', '#5a189a', '#ffffff'], ['Store Tape', '#3a5a40', '#ffffff'], ['Cinema Stub', '#9d0208', '#ffffff'], ['Library Slip', '#b08968', '#ffffff'],
    ],
  },
  {
    kind: 'plate',
    group: 'License Plates',
    rows: [
      ['State Plate', '#0b2545', '#b2182b'], ['Euro Plate', '#e5e5e5', '#003399', '#222'], ['Vintage Plate', '#3a2f22', '#f2c94c'], ['Moto Plate', '#111111', '#ffd23f'], ['Neon Plate', '#07000f', '#ff2bd6'],
      ['Desert Plate', '#e9c46a', '#b2182b', '#222'], ['Euro Night', '#0d1b2a', '#003399'], ['Classic Black', '#1b1b1b', '#f2c94c'], ['Race Plate', '#ff4d00', '#ffd23f', '#111'], ['Cyber Plate', '#000814', '#00f5d4'],
    ],
  },
  {
    kind: 'calendar',
    group: 'Calendars',
    rows: [
      ['Desk Calendar', '#e9e4d8', '#d62828', '#222'], ['Wall Pad', '#264653', '#264653'], ['Daily Tear', '#f4a261', '#e76f51', '#222'], ['Planner', '#f1faee', '#2a9d8f', '#222'], ['Purple Pad', '#3c096c', '#6d597a'],
      ['Classic Pad', '#111111', '#111111'], ['Office', '#cfd8dc', '#d62828', '#222'], ['Kitchen', '#fff1e6', '#264653', '#222'], ['Garden', '#2d6a4f', '#e76f51'], ['Holiday', '#7b2cbf', '#2a9d8f'],
    ],
  },
  {
    kind: 'candles',
    group: 'Candles',
    rows: [
      ['Single Candle', '#0d0a08', '#ffb703', undefined, 'embers'], ['Three Candles', '#1a0f0a', '#ffb703'], ['Birthday Row', '#2b0f3a', '#ff8fd1'], ['Pair', '#0a1a2a', '#ffb703'], ['Four Candles', '#14110b', '#ffd166'],
      ['Chapel', '#0b0b0b', '#ffe8a3', undefined, 'dust'], ['Bubblegum Wax', '#1b0a1f', '#ffb703'], ['Ice Wax', '#071a2b', '#ffb703'], ['Lemon Wax', '#201a07', '#ffb703'], ['Lavender Wax', '#140f24', '#ffb703'],
    ],
  },
  {
    kind: 'moon',
    group: 'Moon Phases',
    rows: [
      ['Full Moon', '#04060f', '#f4f1de', undefined, 'stars'], ['Harvest Moon', '#120a04', '#ffd580'], ['Blue Moon', '#020814', '#cfe8ff', undefined, 'stars'], ['Blood Moon', '#140404', '#ffb4a2'], ['Silver Moon', '#0a0a0a', '#e0e0e0'],
      ['Night Sky', '#000814', '#f4f1de', undefined, 'stars'], ['Desert Moon', '#1a0f05', '#ffd580'], ['Ice Moon', '#06121f', '#cfe8ff'], ['Coral Moon', '#1a0a0a', '#ffb4a2', undefined, 'stars'], ['Eclipse', '#000000', '#e0e0e0'],
    ],
  },
  {
    kind: 'signal',
    group: 'Signal Lights',
    rows: [
      ['Traffic Light', '#e9ecef', '#34c759', '#111'], ['Crosswalk', '#2b2d42', '#34c759'], ['Rounded Lights', '#f8f9fa', '#34c759', '#111'], ['Forest Signal', '#081c15', '#34c759'], ['Rail Signal', '#3a2f22', '#34c759'],
      ['Square Lamps', '#0b132b', '#34c759'], ['Night Road', '#000000', '#34c759'], ['Race Start', '#1b1b1b', '#34c759'], ['Tower Lights', '#f1faee', '#34c759', '#111'], ['Pit Lane', '#212529', '#34c759'],
    ],
  },
  {
    kind: 'heartbeat',
    group: 'Heartbeat',
    rows: [
      ['ECG', '#000000', '#00ff87', undefined, 'scanlines'], ['Brain Waves', '#0b0221', '#c77dff'], ['Square Wave', '#001219', '#94d2bd'], ['Sawtooth', '#1a0b00', '#ff8c42'], ['Pulse', '#100000', '#ff3b30'],
      ['Monitor', '#020c02', '#39ff14', undefined, 'scanlines'], ['Ocean Waves', '#03045e', '#90e0ef'], ['Synth Wave', '#14001f', '#ff3cac'], ['Radio Wave', '#111111', '#ffd60a'], ['Signal Scope', '#001a1a', '#2ec4b6'],
    ],
  },
  {
    kind: 'stack',
    group: 'Stacks',
    rows: [
      ['Block Tower', '#101820', '#fee715'], ['Coin Stack', '#0b1d13', '#e9b949'], ['Book Pile', '#f3ead8', '#9c4221', '#2b1d10'], ['Brick Wall', '#2b2b2b', '#b5462f'], ['Pancakes', '#fff8e7', '#d9a35b', '#3d2a12'],
      ['Pastel Blocks', '#fdf2f8', '#a78bfa', '#333'], ['Gold Stack', '#000000', '#e9b949'], ['Library', '#1b263b', '#e07a5f'], ['Chimney', '#e9e4d8', '#b5462f', '#222'], ['Breakfast', '#2b1a0e', '#d9a35b'],
    ],
  },
  {
    kind: 'stamp',
    group: 'Stamps',
    rows: [
      ['Red Stamp', '#f4ede1', '#c1121f', '#222'], ['Navy Seal', '#eef1f6', '#1d3557', '#222'], ['Oval Stamp', '#f6f1e9', '#2b9348', '#222'], ['Wine Stamp', '#f3e9e0', '#6a040f', '#222'], ['Royal Seal', '#f1ecf6', '#3c096c', '#222'],
      ['Passport', '#e8e1d0', '#1d3557', '#222'], ['Postmark', '#fdfcf7', '#c1121f', '#222'], ['Approved', '#efeee8', '#2b9348', '#222'], ['Wax Seal', '#2b1a12', '#6a040f'], ['Notary', '#ecebe4', '#3c096c', '#222'],
    ],
  },
  {
    kind: 'frame',
    group: 'Photo Frames',
    rows: [
      ['Polaroid', '#2b2b2b', '#e76f51'], ['Film Strip', '#f0ebe3', '#264653', '#222'], ['Slide', '#1a1a2e', '#e76f51'], ['Postage', '#c9ada7', '#8ecae6', '#222'], ['Snapshot', '#0f0f0f', '#2d6a4f'],
      ['Darkroom', '#1a0000', '#e63946'], ['Vacation', '#caf0f8', '#0077b6', '#222'], ['Museum', '#f8f5f0', '#9c6644', '#222'], ['Air Mail', '#e0e1dd', '#d62828', '#222'], ['Retro Roll', '#3d2b1f', '#ffb703'],
    ],
  },
  {
    kind: 'loading',
    group: 'Loading Bars',
    rows: [
      ['Loading', '#0f0f13', '#0a84ff'], ['Chunky Bar', '#fff1e6', '#ff6b6b', '#222'], ['Retro Load', '#000000', '#33ff33', undefined, 'scanlines'], ['Dot Loader', '#1b1b2f', '#e94560'], ['Candy Stripe', '#fdf2f8', '#ec4899', '#222'],
      ['Install', '#f5f5f7', '#0071e3', '#111'], ['Battery Bar', '#0b0b0b', '#34c759'], ['Boot Screen', '#000080', '#ffffff'], ['Progress', '#f8f9fa', '#7209b7', '#222'], ['Download', '#10002b', '#ff9e00'],
    ],
  },
  {
    kind: 'sundial',
    group: 'Sundials',
    rows: [
      ['Garden Sundial', '#2d6a4f', '#d8cfc4'], ['Temple', '#e9d8a6', '#b8b0a2', '#222'], ['Courtyard', '#f4f1de', '#e9e1d0', '#222'], ['Old Stone', '#3a3a3a', '#a3a091'], ['Desert Dial', '#e76f51', '#cbbfa7', '#222'],
      ['Morning Sun', '#ffe8a3', '#d8cfc4', '#222'], ['Moss Stone', '#344e41', '#b8b0a2'], ['Marble Dial', '#f8f9fa', '#e9e1d0', '#222'], ['Granite', '#212529', '#a3a091'], ['Sunset Dial', '#9d0208', '#cbbfa7'],
    ],
  },
];

const LIST = KINDS.flatMap(({ kind, group, rows }) =>
  rows.map(([name, bg, accent, ink, effect], n) => ({ raw: { id: `y-${kind}-${n}`, name, group, bg, accent, ...(ink ? { ink } : null), style: `y:${kind}:${n}` } as RawTheme, effect }))
);

export const MORE_THEMES: RawTheme[] = LIST.map((x) => x.raw);
export const MORE_EFFECTS: Record<string, Effect> = Object.fromEntries(LIST.filter((x) => x.effect).map((x) => [x.raw.id, x.effect as Effect]));
export const MORE_IDS: string[] = LIST.map((x) => x.raw.id);
export const MORE_GROUPS: string[] = KINDS.map((k) => k.group);
