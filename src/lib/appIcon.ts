/**
 * Alternate app icons (Settings > App icon). The native module only exists in a
 * real iOS build with the icons baked in; in Expo Go and on the web it is missing,
 * so it is loaded lazily inside try/catch and everything quietly reports
 * "not supported" instead of crashing.
 *
 * The default icon is "Studento" (id null). The other 20 are listed in app.json
 * under the expo-alternate-app-icons plugin with the same names (PascalCase).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export interface AppIconChoice {
  /** Native icon name; null = the default icon. */
  id: string | null;
  label: string;
  /** 192 px preview shown in the picker. */
  image: number;
}

export const APP_ICONS: AppIconChoice[] = [
  { id: null, label: 'Studento', image: require('../../assets/icon-thumbs/StudentoNavy.png') },
  { id: 'TrainStation', label: 'Train Station', image: require('../../assets/icon-thumbs/TrainStation.png') },
  { id: 'Midnight', label: 'Midnight', image: require('../../assets/icon-thumbs/Midnight.png') },
  { id: 'Sunset', label: 'Sunset', image: require('../../assets/icon-thumbs/Sunset.png') },
  { id: 'Ocean', label: 'Ocean', image: require('../../assets/icon-thumbs/Ocean.png') },
  { id: 'Forest', label: 'Forest', image: require('../../assets/icon-thumbs/Forest.png') },
  { id: 'Jackpot', label: 'Jackpot', image: require('../../assets/icon-thumbs/Jackpot.png') },
  { id: 'VegasStrip', label: 'Vegas Strip', image: require('../../assets/icon-thumbs/VegasStrip.png') },
  { id: 'MonteCarlo', label: 'Monte Carlo', image: require('../../assets/icon-thumbs/MonteCarlo.png') },
  { id: 'Gatsby', label: 'Gatsby', image: require('../../assets/icon-thumbs/Gatsby.png') },
  { id: 'Champagne', label: 'Champagne', image: require('../../assets/icon-thumbs/Champagne.png') },
  { id: 'Emerald', label: 'Gilded Emerald', image: require('../../assets/icon-thumbs/Emerald.png') },
  { id: 'Ivory', label: 'Ivory', image: require('../../assets/icon-thumbs/Ivory.png') },
  { id: 'Paper', label: 'Paper', image: require('../../assets/icon-thumbs/Paper.png') },
  { id: 'PastelPink', label: 'Pastel Pink', image: require('../../assets/icon-thumbs/PastelPink.png') },
  { id: 'PastelMint', label: 'Pastel Mint', image: require('../../assets/icon-thumbs/PastelMint.png') },
  { id: 'PastelLavender', label: 'Pastel Lavender', image: require('../../assets/icon-thumbs/PastelLavender.png') },
  { id: 'Graphite', label: 'Graphite', image: require('../../assets/icon-thumbs/Graphite.png') },
  { id: 'Neon', label: 'Neon', image: require('../../assets/icon-thumbs/Neon.png') },
  { id: 'RoseGold', label: 'Rose Gold', image: require('../../assets/icon-thumbs/RoseGold.png') },
  { id: 'Lava', label: 'Lava', image: require('../../assets/icon-thumbs/Lava.png') },
];

type IconsLib = typeof import('expo-alternate-app-icons');
let lib: IconsLib | null | undefined;

function load(): IconsLib | null {
  if (lib !== undefined) return lib;
  lib = null;
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return lib;
  try {
    // Lazy on purpose: importing it at the top would load the missing native module in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-alternate-app-icons') as IconsLib;
    lib = m.supportsAlternateIcons ? m : null;
  } catch {
    lib = null;
  }
  return lib;
}

/** True only in a real iOS build that supports alternate icons. */
export function iconsSupported(): boolean {
  return load() !== null;
}

/** The icon name in use right now (null = default). */
export function currentIcon(): string | null {
  try {
    return load()?.getAppIconName() ?? null;
  } catch {
    return null;
  }
}

/** Switch icons. iOS shows its own "You have changed the icon" popup. Returns an error message or null. */
export async function chooseIcon(id: string | null): Promise<string | null> {
  const m = load();
  if (!m) return "Changing the icon isn't available here.";
  try {
    await m.setAlternateAppIcon(id as never);
    return null;
  } catch (e) {
    return e instanceof Error && e.message.length < 140 ? e.message : "Couldn't change the icon. Try again.";
  }
}
