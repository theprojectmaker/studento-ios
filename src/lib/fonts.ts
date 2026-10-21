import { Platform, type TextStyle } from 'react-native';

import type { HeroFont } from './themes';

/** San Francisco (the system font) at Apple's usual weights. */
export const TYPE = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  heavy: { fontWeight: '800' },
} satisfies Record<string, TextStyle>;

export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' });
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

/** fontFamily for a theme's hero font; undefined = system (SF). */
export function heroFamily(f: HeroFont): string | undefined {
  if (f === 'serif') return SERIF;
  if (f === 'mono') return MONO;
  if (f === 'rounded' && Platform.OS === 'web') return 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  return undefined;
}
