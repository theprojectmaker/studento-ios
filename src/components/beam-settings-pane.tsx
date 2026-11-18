/** Beam settings, with the live count of every message sent on Beam at the top. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamAvatar, type BeamPalette } from '@/components/beam-ui';
import { pickProfilePhoto, saveMyProfile, STATUS_PRESETS, useProfile } from '@/lib/beam-profile';
import { useStore } from '@/lib/store';
import { watchMessageCount } from '@/lib/beam-extra';
import { BUBBLES, setBeamSetting, useBeamSettings, type BeamSettings } from '@/lib/beam-settings';

const SIZES: [string, number][] = [
  ['Small', 14],
  ['Default', 16],
  ['Large', 18],
  ['Huge', 21],
];

export function BeamSettingsPane({ c, wide, topPad }: { c: BeamPalette; wide: boolean; topPad?: number }) {
  const insets = useSafeAreaInsets();
  const st = useBeamSettings();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => watchMessageCount(setCount), []);
  const me = useStore((s) => s.account?.user.username ?? '');
  const prof = useProfile(me || undefined);
  const [status, setStatus] = useState<string | null>(null);
  const [pmsg, setPmsg] = useState<string | null>(null);
  const save = (p: { status?: string; photo?: string }) =>
    void saveMyProfile(me, p)
      .then(() => setPmsg('Saved.'))
      .catch((e) => setPmsg(e instanceof Error ? e.message : "Couldn't save."));

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
      <ScrollView contentContainerStyle={{ paddingTop: topPad ?? insets.top + 8, paddingHorizontal: 12, paddingBottom: wide ? insets.bottom + 20 : 20, gap: 18 }}>
        <Text style={{ color: c.text, fontSize: wide ? 24 : 32, fontWeight: wide ? '700' : '800', letterSpacing: -0.6, paddingHorizontal: 4 }}>Settings</Text>

        <View style={{ backgroundColor: c.blue, borderRadius: 18, padding: 16, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7CFFA0' }} />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>LIVE</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{count === null ? '…' : count.toLocaleString()}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>messages sent on Beam</Text>
        </View>

        {me
          ? group(
              'Profile',
              <View style={{ padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <BeamAvatar name={me} size={56} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{me}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => void pickProfilePhoto().then((d) => d && save({ photo: d })).catch((e) => setPmsg(e instanceof Error ? e.message : 'Failed'))}>
                        <Text style={{ color: c.blue, fontSize: 14, fontWeight: '600' }}>{prof.photo ? 'Change photo' : 'Add photo'}</Text>
                      </Pressable>
                      {prof.photo ? (
                        <Pressable onPress={() => save({ photo: '' })}>
                          <Text style={{ color: c.red, fontSize: 14 }}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
                <TextInput value={status ?? prof.status} onChangeText={setStatus} onEndEditing={() => status !== null && save({ status })} placeholder="Status (anyone on Beam can see it)" placeholderTextColor={c.text3} maxLength={80} style={{ color: c.text, fontSize: 15, backgroundColor: c.search, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {STATUS_PRESETS.map((p) => (
                    <Pressable key={p} onPress={() => { setStatus(p); save({ status: p }); }} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: (status ?? prof.status) === p ? c.blue : c.search }}>
                      <Text style={{ color: (status ?? prof.status) === p ? '#fff' : c.text2, fontSize: 12.5, fontWeight: '600' }}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
                {pmsg ? <Text style={{ color: c.text3, fontSize: 12 }}>{pmsg}</Text> : null}
              </View>
            )
          : null}

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
            {toggle('haptics', 'Haptics', 'A small tap when you send, react or vote')}
            {toggle('swipeReply', 'Swipe to reply', 'Swipe a message to the right to reply to it')}
            {toggle('linkPreviews', 'Link previews', 'Show a title card for links people send')}
            {toggle('receipts', 'Read receipts', 'Off: nobody sees Read, including you')}
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
