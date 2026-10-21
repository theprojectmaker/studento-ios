/** iOS-style grouped lists on Liquid Glass, used by every settings-type screen. */
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { getState } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';

import { Glass, IconTile } from './glass';

export function tap() {
  if (Platform.OS !== 'web' && getState().prefs.haptics) void Haptics.selectionAsync();
}

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 24, maxWidth: 680, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        {children}
      </ScrollView>
    </View>
  );
}

export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 7 }}>
      {title ? <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title.toUpperCase()}</Text> : null}
      <View style={{ backgroundColor: theme.panel, borderRadius: 18, overflow: 'hidden' }}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: theme.muted }]}>{footer}</Text> : null}
    </View>
  );
}

export function Divider({ inset = 16 }: { inset?: number }) {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: alpha(theme.ink, 0.16), marginLeft: inset }} />;
}

interface RowProps {
  label: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  icon?: { name: SFSymbol; color: string };
  value?: string;
}

export function Row({ label, sub, right, onPress, danger, icon, value }: RowProps) {
  const theme = useTheme();
  const body = (
    <View style={styles.row}>
      {icon ? <IconTile name={icon.name} color={icon.color} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.label, { color: danger ? '#ff453a' : theme.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.sub, { color: theme.muted }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[styles.value, { color: theme.muted }]}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Chevron color={alpha(theme.ink, 0.35)} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ backgroundColor: pressed ? alpha(theme.ink, 0.08) : 'transparent' })}>
      {body}
    </Pressable>
  );
}

export function ToggleRow({ label, sub, value, onChange, disabled, icon }: Omit<RowProps, 'right' | 'onPress' | 'value'> & { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Row
      label={label}
      sub={sub}
      icon={icon}
      right={
        <Switch
          accessibilityLabel={label}
          value={value}
          disabled={disabled}
          onValueChange={(v) => {
            tap();
            onChange(v);
          }}
          trackColor={{ true: '#34c759', false: alpha(theme.ink, 0.18) }}
          thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
          ios_backgroundColor={alpha(theme.ink, 0.18)}
          {...(Platform.OS === 'web' ? ({ activeThumbColor: '#ffffff' } as object) : null)}
        />
      }
    />
  );
}

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'plain' | 'danger'; disabled?: boolean }) {
  const theme = useTheme();
  const fg = kind === 'primary' ? readableOn(theme.accent) : kind === 'danger' ? '#ff453a' : theme.ink;
  const inner = <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      {kind === 'primary' ? (
        <View style={[styles.button, { backgroundColor: theme.accent }]}>{inner}</View>
      ) : (
        <Glass theme={theme} radius={999} tint={kind === 'danger' ? 'rgba(255,69,58,0.14)' : undefined} style={styles.button}>
          {inner}
        </Glass>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={alpha(theme.ink, 0.35)}
      selectionColor={theme.accent}
      {...props}
      style={[styles.field, { color: theme.ink, backgroundColor: alpha(theme.ink, theme.light ? 0.06 : 0.09) }, props.style]}
    />
  );
}

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' | 'ok' }) {
  const theme = useTheme();
  const color = tone === 'error' ? '#ff6b5e' : tone === 'ok' ? theme.accent : theme.muted;
  return <Text style={[styles.sub, { color, paddingHorizontal: 16 }]}>{children}</Text>;
}

export function Chevron({ color }: { color: string }) {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14">
      <Path d="M1.2 1.2 6.8 7 1.2 12.8" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GearIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={3.2} />
      <Path d="M12 3.5v2.1M12 18.4v2.1M20.5 12h-2.1M5.6 12H3.5M17.66 6.34l-1.49 1.49M7.83 16.17l-1.49 1.49M17.66 17.66l-1.49-1.49M7.83 7.83 6.34 6.34" />
    </Svg>
  );
}

export function ListIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M9 6.5h10M9 12h10M9 17.5h10" />
      <Circle cx={5} cy={6.5} r={1} fill={color} />
      <Circle cx={5} cy={12} r={1} fill={color} />
      <Circle cx={5} cy={17.5} r={1} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...TYPE.regular, fontSize: 13, letterSpacing: 0.2, paddingHorizontal: 16 },
  footer: { ...TYPE.regular, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 52 },
  label: { ...TYPE.regular, fontSize: 17, letterSpacing: -0.4 },
  sub: { ...TYPE.regular, fontSize: 13, lineHeight: 18 },
  value: { ...TYPE.regular, fontSize: 17, letterSpacing: -0.4 },
  button: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  buttonText: { ...TYPE.semibold, fontSize: 17, letterSpacing: -0.4 },
  field: { minWidth: 0, ...TYPE.regular, fontSize: 17, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
});

/** iOS-style segmented control. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: alpha(theme.ink, 0.08), borderRadius: 10, padding: 2 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: on ? (theme.light ? '#ffffff' : alpha('#ffffff', 0.18)) : 'transparent',
            }}>
            <Text style={{ ...TYPE.semibold, fontSize: 14, color: theme.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
