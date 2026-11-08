/** Beam: the conversation list, styled like the Beam website (rows, avatars, search pill, filter chips). */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamAvatar, Glyph, useBeam } from '@/components/beam-ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { startCall } from '@/lib/calls';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';

function when(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  if (now.getTime() - ms < 6 * 86400_000) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
}
const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function Beam() {
  const c = useBeam();
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const [tab, setTab] = useState<'all' | 'unread' | 'calls'>('all');
  const [threads, setThreads] = useState<api.Thread[] | null>(null);
  const [calls, setCalls] = useState<api.RecentCall[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: number; username: string }[]>([]);

  const load = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const [th, cl] = await Promise.all([api.listThreads(t), api.recentCalls(t)]);
      setThreads(th);
      setCalls(cl);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!account) return;
      void load();
      const id = setInterval(() => void load(), 8000);
      return () => clearInterval(id);
    }, [account, load])
  );

  useEffect(() => {
    if (!account || q.trim().length < 2) return;
    let dead = false;
    const id = setTimeout(async () => {
      const t = await getToken();
      if (!t) return;
      try {
        const r = await api.searchUsers(t, q.trim());
        if (!dead) setHits(r);
      } catch {
        if (!dead) setHits([]);
      }
    }, 300);
    return () => {
      dead = true;
      clearTimeout(id);
    };
  }, [q, account]);

  const call = (peer: string, video: boolean) => void startCall(peer, video).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't start the call."));

  const header = (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 6, backgroundColor: c.sidebar }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -6 }}>
          <Glyph.Back color={c.blue} />
          <Text style={{ color: c.blue, fontSize: 17 }}>Clock</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="New message" onPress={() => setQ(q || ' ')} hitSlop={10}>
          <Glyph.Compose color={c.blue} />
        </Pressable>
      </View>
      <Text style={{ color: c.text, fontSize: sz(32), fontWeight: '700', letterSpacing: -0.6, marginTop: 4 }}>Beam</Text>
    </View>
  );

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: c.sidebar }}>
        {header}
        <View style={{ padding: 24, gap: 14, alignItems: 'center' }}>
          <Text style={{ color: c.text2, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>Sign in so people know who they are talking to.</Text>
          <Pressable onPress={() => router.push('/account')} style={({ pressed }) => ({ backgroundColor: pressed ? '#0a6fd8' : c.blue, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 })}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const searching = q.trim().length >= 2;
  const list = (threads ?? []).filter((t) => tab !== 'unread' || t.unread > 0);
  return (
    <View style={{ flex: 1, backgroundColor: c.sidebar }}>
      {header}
      <View style={{ marginHorizontal: 12, marginBottom: 8, height: 34, borderRadius: 10, backgroundColor: c.search, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9 }}>
        <Glyph.Search color={c.text3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search people" placeholderTextColor={c.text3} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.text, fontSize: 15, height: '100%' }} />
      </View>
      {!searching ? (
        <View style={{ flexDirection: 'row', gap: 6, marginHorizontal: 12, marginBottom: 8 }}>
          {(['all', 'unread', 'calls'] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: tab === k ? c.blue : c.search }}>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: tab === k ? '#fff' : c.text2 }}>{k === 'all' ? 'All' : k === 'unread' ? 'Unread' : 'Calls'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">
        {searching ? (
          hits.length === 0 ? (
            <Text style={{ color: c.text3, fontSize: 14, textAlign: 'center', marginTop: 24 }}>No one by that name.</Text>
          ) : (
            hits.map((h) => (
              <Pressable key={h.id} onPress={() => router.push({ pathname: '/chat', params: { u: h.username } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, paddingLeft: 18, borderRadius: 12, backgroundColor: pressed ? c.rowPress : 'transparent' })}>
                <BeamAvatar name={h.username} />
                <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '600' }}>{h.username}</Text>
                <Pressable onPress={() => call(h.username, false)} hitSlop={8} style={{ padding: 6 }}>
                  <Glyph.Phone color={c.blue} size={20} />
                </Pressable>
                <Pressable onPress={() => call(h.username, true)} hitSlop={8} style={{ padding: 6 }}>
                  <Glyph.Video color={c.blue} size={22} />
                </Pressable>
              </Pressable>
            ))
          )
        ) : tab === 'calls' ? (
          calls === null ? (
            <Text style={{ color: c.text3, fontSize: 14, textAlign: 'center', marginTop: 24 }}>{err ?? 'Loading…'}</Text>
          ) : calls.length === 0 ? (
            <Text style={{ color: c.text3, fontSize: 14, textAlign: 'center', marginTop: 24 }}>No calls yet.</Text>
          ) : (
            calls.map((k) => {
              const missed = !k.outgoing && (k.status === 'missed' || k.status === 'declined');
              return (
                <Pressable key={k.id} onPress={() => call(k.peer, k.video)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, paddingLeft: 18, borderRadius: 12, backgroundColor: pressed ? c.rowPress : 'transparent' })}>
                  <BeamAvatar name={k.peer} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: missed ? c.red : c.text, fontSize: 15, fontWeight: '600' }}>{k.peer}</Text>
                    <Text style={{ color: c.text2, fontSize: 13, marginTop: 2 }}>{`${k.video ? 'Video' : 'Audio'} · ${k.outgoing ? 'Outgoing' : missed ? 'Missed' : 'Incoming'}${k.seconds ? ` · ${dur(k.seconds)}` : ''}`}</Text>
                  </View>
                  <Text style={{ color: c.text3, fontSize: 12 }}>{when(k.at)}</Text>
                  {k.video ? <Glyph.Video color={c.blue} size={20} /> : <Glyph.Phone color={c.blue} size={18} />}
                </Pressable>
              );
            })
          )
        ) : threads === null ? (
          <Text style={{ color: c.text3, fontSize: 14, textAlign: 'center', marginTop: 24 }}>{err ?? 'Loading…'}</Text>
        ) : list.length === 0 ? (
          <Text style={{ color: c.text3, fontSize: 14, textAlign: 'center', marginTop: 24 }}>{tab === 'unread' ? 'No unread messages.' : 'No messages yet. Search for someone above.'}</Text>
        ) : (
          list.map((t) => {
            const unread = t.unread > 0;
            return (
              <Pressable key={t.id} onPress={() => router.push({ pathname: '/chat', params: { u: t.username } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingRight: 10, paddingLeft: 4, borderRadius: 12, backgroundColor: pressed ? c.rowPress : 'transparent' })}>
                <View style={{ width: 14, alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.blue, opacity: unread ? 1 : 0 }} />
                </View>
                <View style={{ marginHorizontal: 10 }}>
                  <BeamAvatar name={t.username} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: unread ? '700' : '600' }} numberOfLines={1}>
                      {t.username}
                    </Text>
                    <Text style={{ color: unread ? c.blue : c.text3, fontSize: 12, fontWeight: unread ? '600' : '400' }}>{when(t.lastAt)}</Text>
                    <Glyph.Chevron color={c.text3} />
                  </View>
                  <Text style={{ color: unread ? c.text : c.text2, fontSize: 13.5, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>
                    {t.lastBody}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
