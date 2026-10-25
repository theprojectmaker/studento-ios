/**
 * First launch (and Settings > My classes): pick your school's bell schedule, then your
 * classes. Everything can be skipped; the clock works with the built-in schedule.
 */
import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/glass';
import { Screen, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { setPref, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { fontStyle } from '@/lib/typefaces';

export default function Welcome() {
  const theme = useTheme();
  const personal = useStore((s) => s.personal);
  const onboarded = useStore((s) => s.prefs.onboarded);
  const school = useStore((s) => s.school);
  const bellSet = useStore((s) => s.bellSet);
  const account = useStore((s) => s.account);

  const finish = () => {
    setPref('onboarded', true);
    router.dismissAll();
    router.replace('/');
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 4 }}>
        <Text style={{ ...fontStyle(theme.type.title, '800'), fontSize: 34 * Math.min(1.1, theme.type.titleScale ?? 1), color: theme.ink, textAlign: 'center' }}>
          {onboarded ? 'Your schedule' : 'Welcome to Studento'}
        </Text>
        <Text style={{ ...TYPE.regular, fontSize: 16, lineHeight: 22, color: theme.muted, textAlign: 'center', maxWidth: 340 }}>Studento counts down to every bell. Two quick steps.</Text>
      </View>

      <Step n={1} title="Your school's bell times" />
      <Choice
        icon="building.columns.fill"
        color="#ff9500"
        title={school ? school.name : 'What school do you go to?'}
        sub={school ? `${bellSet?.name ?? 'Schedule'} · tap to change the school or schedule` : 'Search for your school and pick its bell schedule, or add it.'}
        selected={!!school}
        recommended={!school}
        onPress={() => router.push('/school')}
      />

      <Step n={2} title="Your classes" />
      <Choice
        icon="camera.viewfinder"
        color="#007aff"
        title="Scan my schedule"
        sub={account ? 'Snap a photo or screenshot. The reader fills in your classes and rooms; you check every row before it saves.' : 'Snap a photo or screenshot. Sign in for the best reader, or Studento reads it on your phone.'}
        recommended={!!school}
        onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'scan' } })}
      />
      <Choice icon="keyboard" color="#af52de" title="Type it out" sub="Write your classes in your own words, like “1 Math 204, 2 English 112”." onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'type' } })} />
      {personal ? (
        <Choice icon="pencil" color="#34c759" title={`Keep “${personal.name}”`} sub="Change your classes, rooms or times." selected onPress={() => router.push({ pathname: '/schedule-review', params: { edit: '1' } })} />
      ) : null}
      <Choice
        icon="arrow.right.circle.fill"
        color="#8e8e93"
        title={onboarded ? 'Done' : 'Skip for now'}
        sub={school ? 'Just the bells, no class names yet. Add them anytime in Settings.' : 'Uses the built-in Great Neck North bells until you pick a school.'}
        onPress={finish}
      />

      <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted, textAlign: 'center', paddingHorizontal: 12 }}>
        {account ? `Saved to your account (${account.user.username}).` : 'Everything stays on this phone. Create an account in Settings to keep it across devices.'}
      </Text>
    </Screen>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: -10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...TYPE.bold, fontSize: 13, color: '#111111' }}>{n}</Text>
      </View>
      <Text style={{ ...TYPE.semibold, fontSize: 13, letterSpacing: 1.2, color: theme.muted }}>{title.toUpperCase()}</Text>
    </View>
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
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.panel, borderRadius: 22, padding: 16, borderWidth: selected || recommended ? 2 : 0, borderColor: recommended && !selected ? '#007aff' : theme.accent }}>
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
