/** Friends tab: add by username, incoming requests (accept / deny), sent requests, friends, suggestions. */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamAvatar, Glyph, type BeamPalette } from '@/components/beam-ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { acceptFriend, dropFriend, friendSuggestions, sendFriendRequest, withBeam, type FriendState } from '@/lib/beam-social';

function Pill({ c, label, onPress, kind = 'blue' }: { c: BeamPalette; label: string; onPress: () => void; kind?: 'blue' | 'grey' | 'red' }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center', opacity: pressed ? 0.7 : 1, backgroundColor: kind === 'blue' ? c.blue : c.search })}>
      <Text style={{ color: kind === 'blue' ? '#fff' : kind === 'red' ? c.red : c.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function BeamFriends({ c, wide, topPad, fs, onOpen }: { c: BeamPalette; wide: boolean; topPad?: number; fs: FriendState; onOpen: (u: string) => void }) {
  const insets = useSafeAreaInsets();
  const show = (u: string) => u;
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<string[]>([]);
  const [sugg, setSugg] = useState<string[]>([]);
  // Suggested people who haven't put in the Beam code yet show greyed out (null = can't tell).
  const [hasBeam, setHasBeam] = useState<Set<string> | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const connected = Object.keys(fs.byName);
  const connectedKey = connected.join(',');
  useEffect(() => {
    void friendSuggestions(connectedKey ? connectedKey.split(',') : [])
      .then(async (list) => {
        setSugg(list);
        setHasBeam(await withBeam(list));
      })
      .catch(() => {});
  }, [connectedKey]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let dead = false;
    const id = setTimeout(async () => {
      const t = await getToken();
      if (!t) return;
      try {
        const r = await api.searchUsers(t, q.trim());
        if (!dead) setHits(r.map((x) => x.username));
      } catch {
        if (!dead) setHits([]);
      }
    }, 300);
    return () => {
      dead = true;
      clearTimeout(id);
    };
  }, [q]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ text: ok, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't do that.", ok: false });
    }
  };

  const action = (u: string) => {
    const r = fs.byName[u];
    if (!r) return <Pill c={c} label="Add" onPress={() => void run(() => sendFriendRequest(u), `Request sent to ${show(u)}.`)} />;
    if (r.status === 'accepted') return <Pill c={c} label="Message" kind="grey" onPress={() => onOpen(u)} />;
    if (fs.incoming.some((x) => x.id === r.id)) return <Pill c={c} label="Accept" onPress={() => void run(() => acceptFriend(r.id), `You and ${show(u)} are friends.`)} />;
    return <Pill c={c} label="Requested" kind="grey" onPress={() => void run(() => dropFriend(r.id), 'Request canceled.')} />;
  };

  const row = (u: string, right: React.ReactNode, sub?: string, dim = false) => (
    <Animated.View key={u} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} layout={LinearTransition.duration(180)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10 }}>
      <View style={{ opacity: dim ? 0.3 : 1 }}>
        <BeamAvatar name={u} size={44} gray={dim} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.text, fontSize: 15.5, fontWeight: '600' }} numberOfLines={1}>
          {show(u)}
        </Text>
        {sub ? <Text style={{ color: c.text3, fontSize: 12.5 }}>{sub}</Text> : null}
      </View>
      {right}
    </Animated.View>
  );
  const head = (t: string, n?: number) => (
    <Text style={{ color: c.text3, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 12, marginTop: 14, marginBottom: 2 }}>
      {t.toUpperCase()}
      {n ? `  ${n}` : ''}
    </Text>
  );

  const searching = q.trim().length >= 2;
  return (
    <View style={{ width: wide ? 340 : undefined, flex: wide ? undefined : 1, backgroundColor: c.sidebar, borderRightWidth: wide ? 0.5 : 0, borderRightColor: c.hairline }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: topPad ?? insets.top + 8, paddingHorizontal: 6, paddingBottom: wide ? insets.bottom + 20 : 20 }}>
        <Text style={{ color: c.text, fontSize: wide ? 24 : 32, fontWeight: wide ? '700' : '800', letterSpacing: -0.6, paddingHorizontal: 10 }}>Add friends</Text>
        <View style={{ marginTop: 10, marginHorizontal: 8, height: 36, borderRadius: 11, backgroundColor: c.search, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 }}>
          <Glyph.Search color={c.text3} />
          <TextInput value={q} onChangeText={setQ} placeholder="Add by username" placeholderTextColor={c.text3} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.text, fontSize: 15, height: '100%' }} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Glyph.Close color={c.text3} size={14} />
            </Pressable>
          ) : null}
        </View>
        {msg ? <Text style={{ color: msg.ok ? c.green : c.red, fontSize: 13, paddingHorizontal: 12, marginTop: 8 }}>{msg.text}</Text> : null}

        {searching ? (
          <>
            {head('Results')}
            {hits.length ? hits.map((u) => row(u, action(u))) : <Text style={{ color: c.text3, fontSize: 14, padding: 12 }}>No one by that name.</Text>}
          </>
        ) : (
          <>
            {fs.incoming.length ? (
              <>
                {head('Friend requests', fs.incoming.length)}
                {fs.incoming.map((r) =>
                  row(
                    r.fromName,
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pill c={c} label="Accept" onPress={() => void run(() => acceptFriend(r.id), `You and ${show(r.fromName)} are friends.`)} />
                      <Pill c={c} label="Deny" kind="red" onPress={() => void run(() => dropFriend(r.id), 'Request denied.')} />
                    </View>,
                    'Wants to be friends'
                  )
                )}
              </>
            ) : null}
            {sugg.length ? (
              <>
                {head('Suggested for you')}
                {sugg.map((u) => {
                  const dim = !!hasBeam && !hasBeam.has(u);
                  return row(u, action(u), dim ? "Hasn't joined Beam yet" : 'On Beam', dim);
                })}
              </>
            ) : null}
            {fs.outgoing.length ? (
              <>
                {head('Sent')}
                {fs.outgoing.map((r) => row(r.toName, <Pill c={c} label="Cancel" kind="grey" onPress={() => void run(() => dropFriend(r.id), 'Request canceled.')} />, 'Waiting for them'))}
              </>
            ) : null}
            {head('Friends', fs.friends.length)}
            {fs.friends.length ? fs.friends.map((u) => row(u, <Pill c={c} label="Message" kind="grey" onPress={() => onOpen(u)} />)) : <Text style={{ color: c.text3, fontSize: 14, paddingHorizontal: 12, paddingVertical: 8 }}>No friends yet. Add someone above.</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}
