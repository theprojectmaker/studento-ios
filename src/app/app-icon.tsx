/** Settings > App icon: pick the home-screen icon. iOS shows its own confirmation popup. */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/glass';
import { Note, Screen, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { APP_ICONS, chooseIcon, currentIcon, iconsSupported } from '@/lib/appIcon';
import { alpha } from '@/lib/themes';
import { sz } from '@/lib/scale';

export default function AppIcon() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState<string | null>(() => currentIcon());
  const [err, setErr] = useState<string | null>(null);
  const supported = iconsSupported();
  const cols = width > 700 ? 5 : 3;
  const cell = (Math.min(width, 680) - 32 - (cols - 1) * 14) / cols;

  const pick = async (id: string | null) => {
    if (id === current) return;
    tap();
    setErr(null);
    const problem = await chooseIcon(id);
    if (problem) setErr(problem);
    else setCurrent(id);
  };

  return (
    <Screen>
      <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(21), color: theme.muted, textAlign: 'center' }}>
        {supported ? 'Pick the icon on your home screen. iOS will show a short confirmation popup when it changes.' : 'Changing the icon works in the installed app (TestFlight or the App Store), not in Expo Go.'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
        {APP_ICONS.map((ic) => {
          const on = ic.id === current;
          return (
            <Pressable
              key={ic.id ?? 'default'}
              disabled={!supported}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !supported }}
              accessibilityLabel={`${ic.label} icon`}
              onPress={() => void pick(ic.id)}
              style={({ pressed }) => ({ width: cell, alignItems: 'center', gap: 8, opacity: !supported ? 0.55 : pressed ? 0.8 : 1 })}
            >
              <View style={{ width: cell, height: cell, borderRadius: cell * 0.225, borderWidth: on ? 3 : 1, borderColor: on ? theme.accent : alpha(theme.ink, 0.12), padding: on ? 2 : 0 }}>
                <Image source={ic.image} style={{ flex: 1, borderRadius: cell * 0.2 }} contentFit="cover" />
                {on ? (
                  <View style={{ position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="checkmark" color="#ffffff" size={13} fallback={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />} />
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={{ ...TYPE.medium, fontSize: sz(12), color: on ? theme.ink : theme.muted, textAlign: 'center' }}>
                {ic.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {err ? <Note tone="error">{err}</Note> : null}
    </Screen>
  );
}
