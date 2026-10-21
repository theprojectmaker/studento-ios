/**
 * Liquid Glass + the theme wallpaper it floats on.
 * On iOS 26+ cards are real Liquid Glass (expo-glass-effect). Everywhere else
 * they fall back to a frosted translucent card with a hairline edge.
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { alpha, type Theme } from '@/lib/themes';

let glassOk: boolean | null = null;
export function hasLiquidGlass(): boolean {
  if (glassOk == null) {
    try {
      glassOk = Platform.OS === 'ios' && isLiquidGlassAvailable();
    } catch {
      glassOk = false;
    }
  }
  return glassOk;
}

export function Glass({
  theme,
  style,
  children,
  radius = 26,
  interactive,
  tint,
}: {
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  radius?: number;
  interactive?: boolean;
  tint?: string;
}) {
  if (hasLiquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={theme.light ? 'light' : 'dark'}
        isInteractive={interactive}
        tintColor={tint}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  const web = Platform.OS === 'web' ? ({ backdropFilter: 'blur(28px) saturate(170%)', WebkitBackdropFilter: 'blur(28px) saturate(170%)' } as object) : null;
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: tint ?? theme.panel,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.16)',
        },
        web,
        style,
      ]}>
      {children}
    </View>
  );
}

/** An SF Symbol on iOS, the given fallback elsewhere. */
export function Icon({ name, color, size = 20, fallback }: { name: SFSymbol; color: string; size?: number; fallback: ReactNode }) {
  if (Platform.OS !== 'ios') return <>{fallback}</>;
  return <SymbolView name={name} tintColor={color} size={size} weight="semibold" fallback={fallback} />;
}

/** iOS Settings-style colored icon tile. */
export function IconTile({ name, color, fallback }: { name: SFSymbol; color: string; fallback?: ReactNode }) {
  return (
    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} color="#ffffff" size={17} fallback={fallback ?? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: alpha('#ffffff', 0.9) }} />} />
    </View>
  );
}
