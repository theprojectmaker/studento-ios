/** Beam settings, with the live count of every message sent on Beam at the top. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type BeamPalette } from '@/components/beam-ui';
import { watchMessageCount } from '@/lib/beam-extra';
import { BUBBLES, setBeamSetting, useBeamSettings, type BeamSettings } from '@/lib/beam-settings';

const SIZES: [string, number][] = [
  ['Small', 14],
  ['Default', 16],
  ['Large', 18],
  ['Huge', 21],
];

export function BeamSettingsPane({ c, wide }: { c: BeamPalette; wide: boolean }) {
  const insets = useSafeAreaInsets();
  const st = useBeamSettings();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => watchMessageCount(setCount), []);

  const toggle = (k: keyof BeamSettings, label: string, sub: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15.5 }}>{label}</Text>
        <Text style={{ color: c.text3, fontSize: 12.5, marginTop: 1 }}>{sub}</Text>
      </View>
      <Switch value={st[k] as boolean} onValueChange={(v) => setBeamSetting(k, v as never)} trackColor={{ true: c.green }} />
    </View>
  );
  const group = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text3, fontSize: 12, fontWeight: '600', paddingHorizontal: 14, letterSpacing: 0.4 }}>{title.toUpperCase()}</Text>
      <View style={{ backgroundColor: c.card, borderRadius: 14, overflow: 'hidden' }}>{children}</View>
    </View>
  );

  return (
    <View style={{ width: wide ? 340 : undefined, flex: wide ? undefined : 1, backgroundColor: c.sidebar, borderRightWidth: wide ? 0.5 : 0, borderRightColor: c.hairline }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: insets.bottom + 20, gap: 18 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 2 }}>Settings</Text>

        <View style={{ backgroundColor: c.blue, borderRadius: 18, padding: 16, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7CFFA0' }} />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>LIVE</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{count === null ? '…' : count.toLocaleString()}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>messages sent on Beam</Text>
        </View>

        {group(
          'Bubble color',
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 }}>
            {BUBBLES.map((b) => (
              <Pressable key={b} accessibilityLabel={`Bubble color ${b}`} onPress={() => setBeamSetting('bubble', b)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: b, borderWidth: st.bubble === b ? 3 : 0, borderColor: c.text }} />
            ))}
          </View>
        )}

        {group(
          'Text size',
          <View style={{ flexDirection: 'row', padding: 8, gap: 6 }}>
            {SIZES.map(([label, n]) => (
              <Pressable key={n} onPress={() => setBeamSetting('textSize', n)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: st.textSize === n ? c.blue : c.search }}>
                <Text style={{ color: st.textSize === n ? '#fff' : c.text, fontSize: n - 2, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {group(
          'Chats',
          <>
            {toggle('enterSends', 'Return key sends', 'Press return to send instead of a new line')}
            {toggle('bigEmoji', 'Big emoji', 'A message that is only emoji shows large')}
            {toggle('haptics', 'Haptics', 'A small tap when you react or vote')}
          </>
        )}

        {group(
          'Alerts',
          <>
            {toggle('alerts', 'New message alerts', '"New messages in inbox" notifications')}
          </>
        )}
      </ScrollView>
    </View>
  );
}
