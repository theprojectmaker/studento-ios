/**
 * Typography: every theme gets a real type personality (title font, countdown
 * digits, small labels), not just a color swap. Fonts are bundled Google Fonts,
 * one weight each (imported per weight so only these files ship).
 */
import { AbrilFatface_400Regular } from '@expo-google-fonts/abril-fatface/400Regular';
import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { Bungee_400Regular } from '@expo-google-fonts/bungee/400Regular';
import { Caveat_700Bold } from '@expo-google-fonts/caveat/700Bold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { Fraunces_300Light } from '@expo-google-fonts/fraunces/300Light';
import { Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces/800ExtraBold';
import { Italiana_400Regular } from '@expo-google-fonts/italiana/400Regular';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
import { Limelight_400Regular } from '@expo-google-fonts/limelight/400Regular';
import { Monoton_400Regular } from '@expo-google-fonts/monoton/400Regular';
import { Orbitron_800ExtraBold } from '@expo-google-fonts/orbitron/800ExtraBold';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker/400Regular';
import { PlayfairDisplay_900Black } from '@expo-google-fonts/playfair-display/900Black';
import { PoiretOne_400Regular } from '@expo-google-fonts/poiret-one/400Regular';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p/400Regular';
import { Righteous_400Regular } from '@expo-google-fonts/righteous/400Regular';
import { RubikMonoOne_400Regular } from '@expo-google-fonts/rubik-mono-one/400Regular';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono/400Regular';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen/400Regular';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { Syne_800ExtraBold } from '@expo-google-fonts/syne/800ExtraBold';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import type { TextStyle } from 'react-native';

/** Passed to useFonts() in the root layout. */
export const FONT_FILES = {
  AbrilFatface_400Regular,
  Anton_400Regular,
  BebasNeue_400Regular,
  Bungee_400Regular,
  Caveat_700Bold,
  Cinzel_700Bold,
  CourierPrime_700Bold,
  DMSerifDisplay_400Regular,
  Fraunces_300Light,
  Fraunces_800ExtraBold,
  Italiana_400Regular,
  JetBrainsMono_800ExtraBold,
  Limelight_400Regular,
  Monoton_400Regular,
  Orbitron_800ExtraBold,
  PermanentMarker_400Regular,
  PlayfairDisplay_900Black,
  PoiretOne_400Regular,
  PressStart2P_400Regular,
  Righteous_400Regular,
  RubikMonoOne_400Regular,
  ShareTechMono_400Regular,
  Silkscreen_400Regular,
  SpaceGrotesk_700Bold,
  Syne_800ExtraBold,
  VT323_400Regular,
};
export type FontName = keyof typeof FONT_FILES;

export interface TypeSpec {
  /** Class name. */
  title: FontName | 'system';
  /** Big countdown digits. */
  digits: FontName | 'system';
  /** Eyebrow, small labels. */
  label: FontName | 'system';
  /** Title in capitals (signage, scoreboards). */
  titleCaps?: boolean;
  /** Multiplier on the title size (pixel fonts run wide, condensed ones run narrow). */
  titleScale?: number;
  /** Multiplier on digit size within a cell. */
  digitScale?: number;
  labelTracking?: number;
}

export const PRESETS = {
  signage: { title: 'BebasNeue_400Regular', digits: 'Anton_400Regular', label: 'SpaceGrotesk_700Bold', titleCaps: true, titleScale: 1.25, digitScale: 0.95, labelTracking: 3 },
  editorial: { title: 'PlayfairDisplay_900Black', digits: 'DMSerifDisplay_400Regular', label: 'Fraunces_300Light', titleScale: 1.05, labelTracking: 1.5 },
  luxe: { title: 'Cinzel_700Bold', digits: 'Fraunces_300Light', label: 'Cinzel_700Bold', titleScale: 0.9, labelTracking: 4 },
  terminal: { title: 'VT323_400Regular', digits: 'VT323_400Regular', label: 'VT323_400Regular', titleCaps: true, titleScale: 1.35, digitScale: 1.25, labelTracking: 2 },
  arcade: { title: 'PressStart2P_400Regular', digits: 'PressStart2P_400Regular', label: 'Silkscreen_400Regular', titleScale: 0.55, digitScale: 0.72, labelTracking: 1 },
  neon: { title: 'Monoton_400Regular', digits: 'Orbitron_800ExtraBold', label: 'Righteous_400Regular', titleScale: 0.8, digitScale: 0.85, labelTracking: 2 },
  scifi: { title: 'Orbitron_800ExtraBold', digits: 'Orbitron_800ExtraBold', label: 'ShareTechMono_400Regular', titleCaps: true, titleScale: 0.72, digitScale: 0.82, labelTracking: 3 },
  chalk: { title: 'Caveat_700Bold', digits: 'PermanentMarker_400Regular', label: 'Caveat_700Bold', titleScale: 1.3, digitScale: 0.95, labelTracking: 0.5 },
  marker: { title: 'PermanentMarker_400Regular', digits: 'Bungee_400Regular', label: 'SpaceGrotesk_700Bold', titleScale: 1, digitScale: 0.85, labelTracking: 2 },
  swiss: { title: 'SpaceGrotesk_700Bold', digits: 'SpaceGrotesk_700Bold', label: 'SpaceGrotesk_700Bold', titleScale: 1, labelTracking: 2.5 },
  poster: { title: 'AbrilFatface_400Regular', digits: 'AbrilFatface_400Regular', label: 'Syne_800ExtraBold', titleScale: 1.05, labelTracking: 2 },
  grotesk: { title: 'Syne_800ExtraBold', digits: 'SpaceGrotesk_700Bold', label: 'SpaceGrotesk_700Bold', titleScale: 0.85, labelTracking: 2 },
  typewriter: { title: 'CourierPrime_700Bold', digits: 'CourierPrime_700Bold', label: 'CourierPrime_700Bold', titleScale: 0.95, labelTracking: 1.5 },
  softserif: { title: 'Fraunces_800ExtraBold', digits: 'Fraunces_300Light', label: 'Fraunces_300Light', titleScale: 1, labelTracking: 1.5 },
  scoreboard: { title: 'Anton_400Regular', digits: 'RubikMonoOne_400Regular', label: 'Bungee_400Regular', titleCaps: true, titleScale: 1.05, digitScale: 0.8, labelTracking: 1.5 },
  code: { title: 'JetBrainsMono_800ExtraBold', digits: 'JetBrainsMono_800ExtraBold', label: 'ShareTechMono_400Regular', titleScale: 0.8, labelTracking: 1.5 },
  nixie: { title: 'Cinzel_700Bold', digits: 'Fraunces_300Light', label: 'ShareTechMono_400Regular', titleScale: 0.9, digitScale: 1.05, labelTracking: 3 },
  casino: { title: 'Limelight_400Regular', digits: 'AbrilFatface_400Regular', label: 'Bungee_400Regular', titleScale: 1, digitScale: 1, labelTracking: 2 },
  marquee: { title: 'Monoton_400Regular', digits: 'Righteous_400Regular', label: 'Righteous_400Regular', titleScale: 0.8, labelTracking: 2.5 },
  odometer: { title: 'SpaceGrotesk_700Bold', digits: 'JetBrainsMono_800ExtraBold', label: 'ShareTechMono_400Regular', titleScale: 1, labelTracking: 3 },
  deco: { title: 'Limelight_400Regular', digits: 'Limelight_400Regular', label: 'PoiretOne_400Regular', titleScale: 1, labelTracking: 5 },
  ballroom: { title: 'Italiana_400Regular', digits: 'PlayfairDisplay_900Black', label: 'PoiretOne_400Regular', titleScale: 1.15, labelTracking: 5 },
  apple: { title: 'system', digits: 'system', label: 'system', labelTracking: 2.2 },
} satisfies Record<string, TypeSpec>;
export type PresetName = keyof typeof PRESETS;

/** Which type personality each Studento theme gets. */
export const THEME_TYPE: Record<string, PresetName> = {
  jackpot: 'casino',
  vegas: 'marquee',
  montecarlo: 'casino',
  cherry: 'casino',
  diamond: 'marquee',
  pachinko: 'marquee',
  clover: 'casino',
  odometer: 'odometer',
  gatsby: 'deco',
  champagne: 'ballroom',
  emerald: 'deco',
  onyxgold: 'ballroom',
  ivory: 'ballroom',
  rosechampagne: 'ballroom',
  sapphire: 'deco',
  noir: 'deco',
  rollers: 'casino',
  'rollers-ivory': 'odometer',
  highroller: 'marquee',
  baccarat: 'casino',
  roulette: 'casino',
  goldrush: 'casino',
  bluechip: 'marquee',
  neonslots: 'marquee',
  speakeasy: 'deco',
  orient: 'ballroom',
  opera: 'deco',
  platinum: 'ballroom',
  copperdeco: 'deco',
  pearl: 'ballroom',
  departure: 'signage',
  midnight: 'signage',
  sunset: 'poster',
  ocean: 'grotesk',
  forest: 'grotesk',
  lava: 'poster',
  lavender: 'softserif',
  rosegold: 'luxe',
  cassette: 'marker',
  chalkboard: 'chalk',
  paper: 'editorial',
  watch: 'swiss',
  grandfather: 'luxe',
  swiss: 'swiss',
  diver: 'scifi',
  pocket: 'luxe',
  bauhaus: 'swiss',
  luxe: 'luxe',
  pilot: 'scifi',
  field: 'swiss',
  moonphase: 'softserif',
  schoolhouse: 'marker',
  neondial: 'neon',
  rosedial: 'poster',
  kitchen: 'marker',
  observatory: 'luxe',
  onyx: 'apple',
  motorway: 'signage',
  neon: 'neon',
  stadium: 'scoreboard',
  vapor: 'neon',
  terminal: 'terminal',
  amber: 'terminal',
  lcd: 'code',
  gameboy: 'arcade',
  nixie: 'nixie',
  editorial: 'editorial',
  gold: 'luxe',
  mono: 'apple',
  arctic: 'grotesk',
  sakura: 'softserif',
  space: 'scifi',
  sunrise: 'editorial',
  'city-tokyo': 'neon',
  'city-kyoto': 'softserif',
  'city-london': 'swiss',
  'city-newyork': 'signage',
  'city-sydney': 'scifi',
  'mat-terrazzo': 'marker',
  'mat-carrara': 'editorial',
  'mat-letterpress': 'editorial',
  'mat-stainedglass': 'luxe',
  'mat-kintsugi': 'luxe',
  'mood-threeam': 'nixie',
  'mood-goldenhour': 'poster',
  'mood-library': 'typewriter',
  'mood-highcontrast': 'code',
  'mood-onecolor': 'terminal',
  'nat-aurora': 'scifi',
  'nat-thunderhead': 'grotesk',
  'nat-firstsnow': 'softserif',
  'nat-thaw': 'grotesk',
  'nat-highdesert': 'poster',
  'ret-phosphor': 'terminal',
  'ret-woodgrain': 'arcade',
  'ret-shellpet': 'arcade',
  'ret-tracking': 'neon',
  'ret-eighttrack': 'typewriter',
  'sci-flightdir': 'code',
  'sci-cassini': 'scifi',
  'sci-scope': 'terminal',
  'sci-periodic': 'swiss',
  'sci-blueprint': 'code',
};

export function typeFor(themeId: string): TypeSpec {
  return PRESETS[THEME_TYPE[themeId] ?? 'apple'];
}

/** Style for a font slot; custom fonts carry their own weight, system uses `weight`. */
export function fontStyle(name: FontName | 'system', weight: TextStyle['fontWeight'] = '700'): TextStyle {
  return name === 'system' ? { fontWeight: weight } : { fontFamily: name, fontWeight: 'normal' };
}

/** How wide a digit is in each font, as a fraction of the font size (measured roughly). */
export const GLYPH_W: Record<FontName | 'system' | 'mono', number> = {
  system: 0.6,
  mono: 0.62,
  AbrilFatface_400Regular: 0.62,
  Anton_400Regular: 0.52,
  BebasNeue_400Regular: 0.42,
  Bungee_400Regular: 0.78,
  Caveat_700Bold: 0.48,
  Cinzel_700Bold: 0.72,
  CourierPrime_700Bold: 0.6,
  DMSerifDisplay_400Regular: 0.6,
  Fraunces_300Light: 0.6,
  Fraunces_800ExtraBold: 0.66,
  Italiana_400Regular: 0.5,
  JetBrainsMono_800ExtraBold: 0.62,
  Limelight_400Regular: 0.62,
  PoiretOne_400Regular: 0.5,
  Monoton_400Regular: 1.0,
  Orbitron_800ExtraBold: 0.82,
  PermanentMarker_400Regular: 0.62,
  PlayfairDisplay_900Black: 0.64,
  PressStart2P_400Regular: 1.0,
  Righteous_400Regular: 0.6,
  RubikMonoOne_400Regular: 0.96,
  ShareTechMono_400Regular: 0.54,
  Silkscreen_400Regular: 0.78,
  SpaceGrotesk_700Bold: 0.62,
  Syne_800ExtraBold: 0.86,
  VT323_400Regular: 0.5,
};
