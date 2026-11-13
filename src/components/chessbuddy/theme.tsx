/**
 * The bits of Chess Buddy's theme (tests/chess/lib/theme.ts) that its Board and Piece need,
 * so Beam chess uses the same board, pieces and feel. Fixed to the "Buddy" look.
 */
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export const colors = {
  page: '#FFFFFF',
  faint: '#A9B6C2',
  lineLip: '#CFD8E1',
  wash: '#F3F6F9',
  leaf: '#58B92E',
  sky: '#2FA8F0',
  coral: '#FF5C5C',
};

export const fonts = { display: 'System', displayBold: 'System', body: 'System', bold: 'System' };
export const shape = { button: 16, card: 18, boardRadius: 10 };

export type PieceStyle = 'chunky' | 'flat';
export const boardPrefs = {
  board: { id: 'buddy', name: 'Buddy', light: '#EFF3D9', dark: '#7BAA5C', plinth: '#4F7C38' as string | null, plinthLip: '#37592A' },
  pieces: 'chunky' as PieceStyle,
  showHints: true,
  showCoords: true,
  autoQueen: true,
};

/** Chess Buddy rebuilds styles when its theme changes; here the theme is fixed, so build once. */
export function themed<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(make: () => T & StyleSheet.NamedStyles<any>): T {
  let built: T | null = null;
  return new Proxy({} as object, {
    get(_, key) {
      if (!built) built = StyleSheet.create(make()) as T;
      return (built as Record<string | symbol, unknown>)[key];
    },
  }) as T;
}

export const webNoSelect = Platform.OS === 'web' ? ({ userSelect: 'none', touchAction: 'none' } as unknown as ViewStyle) : null;

export function CheckIcon({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4.5 12.8 9.8 18 19.5 6.8" fill="none" stroke={color} strokeWidth={3.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function CloseIcon({ size = 24, color = colors.faint }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" />
    </Svg>
  );
}
