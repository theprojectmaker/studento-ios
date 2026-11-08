/**
 * Admin announcements for people who have Beam. A closable one pops up once (OK hides it for
 * good on this device); a permanent one stays pinned at the top of the screen until the admin
 * takes it down. Never shows while the screen is shared.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBeam } from '@/components/beam-ui';
import { watchAnnouncements, type Announcement } from '@/lib/beam-extra';
import { useBeamVisible } from '@/lib/beam-on';
import { useCapturing } from '@/lib/capture';
import { useStore } from '@/lib/store';

const K_SEEN = 'beam.announcements.closed';

export function Announcements() {
  const c = useBeam();
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const on = useBeamVisible();
  const captured = useCapturing();
  const [list, setList] = useState<Announcement[]>([]);
  const [closed, setClosed] = useState<string[] | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(K_SEEN)
      .then((s) => setClosed(s ? (JSON.parse(s) as string[]) : []))
      .catch(() => setClosed([]));
  }, []);
  useEffect(() => {
    if (!account || !on) return;
    return watchAnnouncements(setList);
  }, [account, on]);

  if (!account || !on || captured || closed === null) return null;
  const pinned = list.filter((a) => !a.closable);
  const pop = list.find((a) => a.closable && !closed.includes(a.id));
  const close = (id: string) => {
    const next = [...closed, id].slice(-50);
    setClosed(next);
    void AsyncStorage.setItem(K_SEEN, JSON.stringify(next)).catch(() => {});
  };

  return (
    <>
      {pinned.length ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 6, zIndex: 900, gap: 6, alignItems: 'center' }}>
          {pinned.map((a) => (
            <View key={a.id} style={{ width: '100%', maxWidth: 520, backgroundColor: c.card, borderRadius: 16, padding: 12, borderLeftWidth: 4, borderLeftColor: c.blue, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{a.title}</Text>
              {a.body ? <Text style={{ color: c.text2, fontSize: 13.5, marginTop: 2, lineHeight: 18 }}>{a.body}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      <Modal visible={!!pop} transparent animationType="fade" onRequestClose={() => pop && close(pop.id)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 380, backgroundColor: c.card, borderRadius: 20, padding: 20, gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{pop?.title}</Text>
            {pop?.body ? <Text style={{ color: c.text2, fontSize: 15, lineHeight: 21 }}>{pop.body}</Text> : null}
            <Pressable onPress={() => pop && close(pop.id)} style={({ pressed }) => ({ marginTop: 8, backgroundColor: pressed ? '#0a6fd8' : c.blue, borderRadius: 12, paddingVertical: 12, alignItems: 'center' })}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
