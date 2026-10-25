/**
 * First launch (and Settings > Change my schedule): whose bell schedule should
 * Studento run? The default is the shared Great Neck schedule; anyone else can
 * scan theirs or type it out and the AI turns it into a schedule.
 */
import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/glass';
import { Screen, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { setPersonal, setPref, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { fontStyle } from '@/lib/typefaces';

export default function Welcome() {
  const theme = useTheme();
  const personal = useStore((s) => s.personal);
  const onboarded = useStore((s) => s.prefs.onboarded);

  const useDefault = async () => {
    await setPersonal(null);
    setPref('onboarded', true);
    router.replace('/');
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ ...fontStyle(theme.type.title, '800'), fontSize: 34 * Math.min(1.1, theme.type.titleScale ?? 1), color: theme.ink, textAlign: 'center' }}>
          {onboarded ? 'Your schedule' : 'Welcome to Studento'}
        </Text>
        <Text style={{ ...TYPE.regular, fontSize: 16, lineHeight: 22, color: theme.muted, textAlign: 'center', maxWidth: 340 }}>
          Studento counts down to every bell. Which schedule should it use?
        </Text>
      </View>

      <Choice
        icon="camera.viewfinder"
        color="#007aff"
        title="Scan my schedule"
        sub="Snap a photo or screenshot. Studento reads it on your phone, fills in your classes and rooms, and keeps North High's real bell times."
        recommended
        onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'scan' } })}
      />
      <Choice
        icon="keyboard"
        color="#af52de"
        title="Type it out"
        sub="Write your classes in your own words, like “1 Math 204, 2 English 112”."
        onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'type' } })}
      />
      <Choice
        icon="building.columns.fill"
        color="#ff9500"
        title="Skip for now"
        sub="Use the shared Great Neck North schedule and class names."
        selected={onboarded && !personal}
        onPress={useDefault}
      />
      {personal ? (
        <Choice icon="pencil" color="#34c759" title={`Keep “${personal.name}”`} sub="Change your classes, rooms or times." selected onPress={() => router.push({ pathname: '/schedule-review', params: { edit: '1' } })} />
      ) : null}
      <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted, textAlign: 'center', paddingHorizontal: 12 }}>
        Your own schedule stays on this phone. You can change it anytime in Settings.
      </Text>
    </Screen>
  );
}

function Choice({ icon, color, title, sub, onPress, selected, recommended }: { icon: SFSymbol; color: string; title: string; sub: string; onPress: () => void; selected?: boolean; recommended?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: theme.panel,
          borderRadius: 22,
          padding: 16,
          borderWidth: selected || recommended ? 2 : 0,
          borderColor: recommended && !selected ? '#007aff' : theme.accent,
        }}>
        <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color="#ffffff" size={22} fallback={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: alpha('#ffffff', 0.9) }} />} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          {recommended ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#007aff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ ...TYPE.bold, fontSize: 11, letterSpacing: 0.8, color: '#ffffff' }}>RECOMMENDED</Text>
            </View>
          ) : null}
          <Text style={{ ...TYPE.bold, fontSize: 17, color: theme.ink }}>{title}</Text>
          <Text style={{ ...TYPE.regular, fontSize: 14, lineHeight: 19, color: theme.muted }}>{sub}</Text>
        </View>
      </View>
    </Pressable>
  );
}
