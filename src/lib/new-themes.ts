/**
 * 50 brand-new themes to try out (group "New", shown first in the picker). Each one is its own
 * palette + engine + number font + live effect combination, made for the app, not taken from
 * the website's theme list.
 */
import type { RawTheme } from './theme-data';
import type { Effect } from './themes';

type T = Omit<RawTheme, 'group'> & { effect?: Effect };

const LIST: T[] = [
  // Split-flap and tape
  { id: 'n-matcha', name: 'Matcha Latte', bg: '#e9efe0', accent: '#5f8f3e', style: 'flap', fonts: 'rounded' },
  { id: 'n-blackcherry', name: 'Black Cherry', bg: '#14070b', accent: '#e0435f', glow: '#ff8fa3', style: 'flap', effect: 'bokeh' },
  { id: 'n-tangerine', name: 'Tangerine', bg: '#ff8a3d', accent: '#2b1608', style: 'flap', fonts: 'rounded' },
  { id: 'n-glacier', name: 'Glacier', bg: '#0c1a24', accent: '#9fe7ff', style: 'tape', effect: 'snow' },
  { id: 'n-mint', name: 'Mint Chip', bg: '#d9f4ea', accent: '#3a2a20', style: 'tape', fonts: 'rounded' },
  { id: 'n-terminalgold', name: 'Gold Board', bg: '#0b0a07', accent: '#f2c14e', style: 'flap', effect: 'glints' },

  // LED / dots / LCD / seven-segment
  { id: 'n-synthwave', name: 'Synthwave', bg: '#1a0b2e', accent: '#ff3cac', glow: '#2bd2ff', style: 'led', effect: 'scanlines' },
  { id: 'n-toxic', name: 'Toxic', bg: '#050a04', accent: '#a6ff00', style: 'dots', effect: 'scanlines' },
  { id: 'n-ambertube', name: 'Amber Bus', bg: '#0d0802', accent: '#ffb000', style: 'dots' },
  { id: 'n-icecream', name: 'Ice Cream Truck', bg: '#fff1f6', accent: '#ff5fa2', style: 'led', fonts: 'rounded' },
  { id: 'n-calculator', name: 'Calculator', bg: '#2e3133', accent: '#9aa58a', style: 'lcd', lcdPanel: '#b7c4a1', lcdInk: '#1d2416', fonts: 'mono' },
  { id: 'n-pager', name: 'Pager', bg: '#141a1c', accent: '#7ed6c6', style: 'lcd', lcdPanel: '#8fd8c8', lcdInk: '#0f2a26', fonts: 'mono' },
  { id: 'n-alarm', name: 'Alarm Clock', bg: '#0a0202', accent: '#ff2a1a', style: 'seven', effect: 'scanlines' },
  { id: 'n-scoreboard', name: 'Scoreboard', bg: '#0f1a12', accent: '#ffe066', style: 'seven' },
  { id: 'n-cyberlime', name: 'Cyber Lime', bg: '#0b0f14', accent: '#c6ff3d', glow: '#00e5ff', style: 'led' },

  // Nixie tubes
  { id: 'n-nixieblue', name: 'Blue Tubes', bg: '#04070d', accent: '#4fb3ff', style: 'nixie', effect: 'stars' },
  { id: 'n-nixierose', name: 'Rose Tubes', bg: '#0e0508', accent: '#ff6f91', style: 'nixie', effect: 'embers' },
  { id: 'n-steampunk', name: 'Steampunk', bg: '#1c130b', accent: '#ff9a3c', glow: '#ffd27a', style: 'nixie', effect: 'embers' },

  // Big type
  { id: 'n-newsprint', name: 'Newsprint', bg: '#f1ede4', accent: '#c81d25', style: 'ink', fonts: 'serif' },
  { id: 'n-brutal', name: 'Brutalist', bg: '#e6e6e1', accent: '#ff3b00', style: 'ink', fonts: 'mono' },
  { id: 'n-midnightink', name: 'Midnight Ink', bg: '#060814', accent: '#8ea8ff', style: 'ink', fonts: 'serif', effect: 'stars' },
  { id: 'n-cottoncandy', name: 'Cotton Candy', bg: '#ffe3f1', accent: '#7b5cff', style: 'ink', fonts: 'rounded', effect: 'bubbles' },
  { id: 'n-solarflare', name: 'Solar Flare', bg: '#1a0600', accent: '#ff6a00', glow: '#ffd000', style: 'ink', fonts: 'sans', effect: 'embers' },
  { id: 'n-poetry', name: 'Poetry', bg: '#f6f1e7', accent: '#6b4f3a', style: 'word', fonts: 'serif', effect: 'petals' },
  { id: 'n-graffiti', name: 'Graffiti', bg: '#16161a', accent: '#ffd400', glow: '#ff3cac', style: 'word', fonts: 'rounded' },
  { id: 'n-equalizer', name: 'Equalizer', bg: '#08080c', accent: '#00ffa3', glow: '#a855f7', style: 'bars' },
  { id: 'n-sunrisebars', name: 'Sunrise Bars', bg: '#2a1033', accent: '#ffb347', glow: '#ff5e62', style: 'bars' },

  // Rings
  { id: 'n-orbit', name: 'Orbit', bg: '#05060f', accent: '#7c5cff', glow: '#00d4ff', style: 'ring', effect: 'stars' },
  { id: 'n-donut', name: 'Donut', bg: '#ffd6e0', accent: '#8a3b12', style: 'ring', fonts: 'rounded' },
  { id: 'n-radar', name: 'Radar', bg: '#020a05', accent: '#33ff99', style: 'ring', fonts: 'mono', effect: 'scanlines' },
  { id: 'n-zen', name: 'Zen Garden', bg: '#eae6dc', accent: '#5b6b4f', style: 'ring', fonts: 'serif', effect: 'petals' },

  // Analog dials
  { id: 'n-pilot', name: 'Pilot Watch', bg: '#0e1013', accent: '#ff8a00', style: 'dial:diver', dialFace: '#15181c' },
  { id: 'n-dresswatch', name: 'Dress Watch', bg: '#f4efe6', accent: '#1e3a5f', style: 'dial:swiss', dialFace: '#fbf8f2' },
  { id: 'n-bauhausred', name: 'Bauhaus Red', bg: '#d62828', accent: '#1d1d1d', style: 'dial:bauhaus', dialFace: '#f5efe0' },
  { id: 'n-oceanwatch', name: 'Ocean Diver', bg: '#06243a', accent: '#29e0c8', style: 'dial:diver', dialFace: '#0a3350', effect: 'bubbles' },
  { id: 'n-pocketgold', name: 'Gold Pocket', bg: '#1a1208', accent: '#e8b04a', style: 'dial:pocket', dialFace: '#f3e6c8', effect: 'dust' },
  { id: 'n-grandpa', name: 'Grandfather', bg: '#2a1a10', accent: '#c9a26a', style: 'dial:grandfather', dialFace: '#efe3c8' },
  { id: 'n-minimalwhite', name: 'Gallery', bg: '#ffffff', accent: '#ff3b30', style: 'dial:minimal' },
  { id: 'n-sectorlime', name: 'Sector Lime', bg: '#101410', accent: '#c8f560', style: 'dial:sector', dialFace: '#1a201a' },
  { id: 'n-romanmarble', name: 'Roman Marble', bg: '#ece9e4', accent: '#7a1f2b', style: 'dial:watch', dialFace: '#f7f5f1', numerals: 'roman' },

  // Casino reels and deco
  { id: 'n-luckyseven', name: 'Lucky Seven', bg: '#0a1f0f', accent: '#ffd23f', style: 'reel', effect: 'glints' },
  { id: 'n-arcade', name: 'Arcade', bg: '#12002a', accent: '#00f0ff', glow: '#ff00c8', style: 'reel', effect: 'bokeh' },
  { id: 'n-candyreel', name: 'Candy Reels', bg: '#ffe9f3', accent: '#ff3d7f', style: 'reelbare', fonts: 'rounded' },
  { id: 'n-artdecoteal', name: 'Deco Teal', bg: '#062a2a', accent: '#d8b45a', style: 'deco', effect: 'glints' },
  { id: 'n-roaring', name: 'Roaring 20s', bg: '#0b0b0b', accent: '#e6c36a', style: 'deco', effect: 'bubbles' },

  // Nature moods
  { id: 'n-rainforest', name: 'Rainforest', bg: '#071a10', accent: '#5fd38d', style: 'ink', fonts: 'serif', effect: 'rain' },
  { id: 'n-autumn', name: 'Autumn', bg: '#2a140a', accent: '#ff8c42', style: 'flap', effect: 'petals' },
  { id: 'n-blizzard', name: 'Blizzard', bg: '#dfe8ef', accent: '#2b4a6b', style: 'ink', fonts: 'sans', effect: 'snow' },
  { id: 'n-campfire', name: 'Campfire', bg: '#0f0805', accent: '#ff7b29', glow: '#ffc06b', style: 'nixie', effect: 'embers' },
  { id: 'n-meadow', name: 'Firefly Meadow', bg: '#0a120a', accent: '#d4ff6b', style: 'word', fonts: 'serif', effect: 'fireflies' },
];

export const NEW_THEMES: RawTheme[] = LIST.map(({ effect: _e, ...t }) => ({ ...t, group: 'New' }));
export const NEW_EFFECTS: Record<string, Effect> = Object.fromEntries(LIST.filter((t) => t.effect).map((t) => [t.id, t.effect as Effect]));
export const NEW_IDS: string[] = LIST.map((t) => t.id);
