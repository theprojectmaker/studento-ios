/**
 * Beam home: a sidebar (Messages, Calls, Contacts) + a list, and on iPad the open chat beside
 * them, like the Beam website. On phones the sidebar shrinks to an icon rail and chats open
 * full screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamChat } from '@/components/beam-chat';
import { BeamAvatar, Glyph, useBeam, type BeamPalette } from '@/components/beam-ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { preview } from '@/lib/beam-msg';
import { startCall } from '@/lib/calls';
import { useStore } from '@/lib/store';

type Section = 'messages' | 'calls' | 'contacts';
const K_CONTACTS = 'beam.contacts';

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

function Empty({ c, text }: { c: BeamPalette; text: string }) {
  return <Text style={{ color: c.text3, fontSize: 14, textAlign: 'center', marginTop: 28, paddingHorizontal: 20, lineHeight: 20 }}>{text}</Text>;
}

export default function Beam() {
  const c = useBeam();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const account = useStore((s) => s.account);
  const me = account?.user.username ?? '';
  const [section, setSection] = useState<Section>('messages');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [threads, setThreads] = useState<api.Thread[] | null>(null);
  const [calls, setCalls] = useState<api.RecentCall[] | null>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: number; username: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(K_CONTACTS)
      .then((s) => s && setContacts(JSON.parse(s) as string[]))
      .catch(() => {});
  }, []);
  const saveContacts = (next: string[]) => {
    const clean = [...new Set(next)].sort();
    setContacts(clean);
    void AsyncStorage.setItem(K_CONTACTS, JSON.stringify(clean)).catch(() => {});
  };

  const load = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const [th, cl] = await Promise.all([api.listThreads(t), api.recentCalls(t)]);
      setThreads(th);
      setCalls(cl);
      setLoadedAt(Date.now());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!account) return;
      // Reload only when a chat or call actually changes (live listeners), not on a timer.
      return api.watchInbox(() => void load());
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
  const openChat = (u: string) => {
    setQ('');
    if (wide) setOpen(u);
    else router.push({ pathname: '/chat', params: { u } });
  };

  const unreadTotal = (threads ?? []).reduce((a, t) => a + (t.unread > 0 ? 1 : 0), 0);
  const missed = (calls ?? []).filter((k) => !k.outgoing && k.status === 'missed' && loadedAt - k.at < 86400_000).length;
  const people = [...new Set([...contacts, ...(threads ?? []).map((t) => t.username), ...(calls ?? []).map((k) => k.peer)])].filter(Boolean).sort();

  /* ---------- sidebar ---------- */
  const NAV: { k: Section; label: string; icon: keyof typeof Glyph; badge: number }[] = [
    { k: 'messages', label: 'Messages', icon: 'Bubble', badge: unreadTotal },
    { k: 'calls', label: 'Calls', icon: 'Phone', badge: missed },
    { k: 'contacts', label: 'Contacts', icon: 'Person', badge: 0 },
  ];
  const sidebar = (
    <View style={{ width: wide ? 210 : 68, backgroundColor: c.window, borderRightWidth: 0.5, borderRightColor: c.hairline, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10, paddingHorizontal: wide ? 10 : 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to the clock" onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', height: 34, marginBottom: wide ? 6 : 10, justifyContent: wide ? 'flex-start' : 'center' }}>
        <Glyph.Back color={c.blue} />
        {wide ? <Text style={{ color: c.blue, fontSize: 16 }}>Clock</Text> : null}
      </Pressable>
      {wide ? <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: 8, marginBottom: 14 }}>Beam</Text> : null}
      <View style={{ gap: 4 }}>
        {NAV.map((n) => {
          const on = section === n.k;
          const I = Glyph[n.icon];
          return (
            <Pressable
              key={n.k}
              accessibilityRole="button"
              accessibilityLabel={n.label}
              onPress={() => {
                setSection(n.k);
                setQ('');
              }}
              style={({ pressed }) => ({
                flexDirection: wide ? 'row' : 'column',
                alignItems: 'center',
                gap: wide ? 12 : 3,
                paddingVertical: wide ? 9 : 8,
                paddingHorizontal: wide ? 10 : 0,
                borderRadius: 12,
                backgroundColor: on ? c.blue : pressed ? c.rowPress : 'transparent',
              })}>
              <View>
                <I color={on ? '#fff' : c.blue} size={wide ? 20 : 24} />
                {n.badge > 0 && !wide ? (
                  <View style={{ position: 'absolute', top: -5, right: -9, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{n.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ flex: wide ? 1 : undefined, color: on ? '#fff' : c.text, fontSize: wide ? 15 : 10.5, fontWeight: on ? '600' : '500' }}>{n.label}</Text>
              {n.badge > 0 && wide ? (
                <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: on ? '#fff' : c.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ color: on ? c.blue : '#fff', fontSize: 12, fontWeight: '700' }}>{n.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      {me ? (
        <Pressable onPress={() => router.push('/account')} style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 10 : 3, padding: 6 }}>
          <BeamAvatar name={me} size={wide ? 34 : 36} />
          {wide ? (
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                {me}
              </Text>
              <Text style={{ color: c.text3, fontSize: 12 }}>Account</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );

  /* ---------- list column ---------- */
  const title = section === 'messages' ? 'Messages' : section === 'calls' ? 'Calls' : 'Contacts';
  const searching = q.trim().length >= 2;
  const rowStyle = ({ pressed }: { pressed: boolean }, active = false) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: active ? (c.dark ? 'rgba(10,132,255,0.28)' : 'rgba(11,132,254,0.13)') : pressed ? c.rowPress : 'transparent',
  });
  const personRow = (u: string, extra?: React.ReactNode, onLong?: () => void) => (
    <Pressable key={u} onPress={() => openChat(u)} onLongPress={onLong} style={(s) => rowStyle(s, open === u)}>
      <BeamAvatar name={u} size={42} />
      <Text style={{ flex: 1, color: c.text, fontSize: 15.5, fontWeight: '600' }} numberOfLines={1}>
        {u}
      </Text>
      {extra}
      <Pressable accessibilityLabel={`Call ${u}`} onPress={() => call(u, false)} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.search, alignItems: 'center', justifyContent: 'center' }}>
        <Glyph.Phone color={c.blue} size={17} />
      </Pressable>
      <Pressable accessibilityLabel={`Video call ${u}`} onPress={() => call(u, true)} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.search, alignItems: 'center', justifyContent: 'center' }}>
        <Glyph.Video color={c.blue} size={18} />
      </Pressable>
    </Pressable>
  );

  let body: React.ReactNode;
  if (searching) {
    body =
      hits.length === 0 ? (
        <Empty c={c} text="No one by that name." />
      ) : (
        hits.map((h) =>
          personRow(
            h.username,
            contacts.includes(h.username) ? null : (
              <Pressable onPress={() => saveContacts([...contacts, h.username])} hitSlop={6} style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: c.blue, justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add</Text>
              </Pressable>
            )
          )
        )
      );
  } else if (section === 'messages') {
    const list = (threads ?? []).filter((t) => !unreadOnly || t.unread > 0);
    body =
      threads === null ? (
        <Empty c={c} text={err ?? 'Loading…'} />
      ) : list.length === 0 ? (
        <Empty c={c} text={unreadOnly ? 'No unread messages.' : 'No messages yet. Search for someone above to start a chat.'} />
      ) : (
        list.map((t) => {
          const unread = t.unread > 0;
          return (
            <Pressable key={t.id || t.username} onPress={() => openChat(t.username)} style={(s) => ({ ...rowStyle(s, open === t.username), paddingLeft: 2, gap: 0 })}>
              <View style={{ width: 14, alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.blue, opacity: unread ? 1 : 0 }} />
              </View>
              <View style={{ marginRight: 10 }}>
                <BeamAvatar name={t.username} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: unread ? '700' : '600' }} numberOfLines={1}>
                    {t.username}
                  </Text>
                  <Text style={{ color: unread ? c.blue : c.text3, fontSize: 12, fontWeight: unread ? '600' : '400' }}>{when(t.lastAt)}</Text>
                </View>
                <Text style={{ color: unread ? c.text : c.text2, fontSize: 13.5, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>
                  {preview(t.lastBody)}
                </Text>
              </View>
            </Pressable>
          );
        })
      );
  } else if (section === 'calls') {
    body =
      calls === null ? (
        <Empty c={c} text={err ?? 'Loading…'} />
      ) : calls.length === 0 ? (
        <Empty c={c} text="No calls yet. Start one from Contacts or a chat." />
      ) : (
        calls.map((k) => {
          const miss = !k.outgoing && (k.status === 'missed' || k.status === 'declined');
          return (
            <Pressable key={k.id} onPress={() => call(k.peer, k.video)} style={(s) => rowStyle(s)}>
              <BeamAvatar name={k.peer} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: miss ? c.red : c.text, fontSize: 15, fontWeight: '600' }}>{k.peer}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  {k.video ? <Glyph.Video color={c.text3} size={14} /> : <Glyph.Phone color={c.text3} size={12} />}
                  <Text style={{ color: c.text2, fontSize: 13 }}>{`${k.outgoing ? 'Outgoing' : miss ? 'Missed' : 'Incoming'}${k.seconds ? ` · ${dur(k.seconds)}` : ''}`}</Text>
                </View>
              </View>
              <Text style={{ color: c.text3, fontSize: 12 }}>{when(k.at)}</Text>
              <Pressable onPress={() => openChat(k.peer)} hitSlop={8} style={{ padding: 4 }}>
                <Glyph.Bubble color={c.blue} size={20} />
              </Pressable>
            </Pressable>
          );
        })
      );
  } else {
    body =
      people.length === 0 ? (
        <Empty c={c} text="No contacts yet. Search for a username above and tap Add." />
      ) : (
        people.map((u) =>
          personRow(u, null, contacts.includes(u) ? () => saveContacts(contacts.filter((x) => x !== u)) : undefined)
        )
      );
  }

  const listCol = (
    <View style={{ width: wide ? 340 : undefined, flex: wide ? undefined : 1, backgroundColor: c.sidebar, borderRightWidth: wide ? 0.5 : 0, borderRightColor: c.hairline }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 34 }}>
          <Text style={{ flex: 1, color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }}>{title}</Text>
          {section === 'messages' ? (
            <Pressable accessibilityLabel="New message" onPress={() => setSection('contacts')} hitSlop={10}>
              <Glyph.Compose color={c.blue} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ marginTop: 8, height: 34, borderRadius: 10, backgroundColor: c.search, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9 }}>
          <Glyph.Search color={c.text3} />
          <TextInput value={q} onChangeText={setQ} placeholder={section === 'contacts' ? 'Find people by username' : 'Search people'} placeholderTextColor={c.text3} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.text, fontSize: 15, height: '100%' }} />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Glyph.Close color={c.text3} size={14} />
            </Pressable>
          ) : null}
        </View>
        {section === 'messages' && !searching ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {[false, true].map((u) => (
              <Pressable key={String(u)} onPress={() => setUnreadOnly(u)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: unreadOnly === u ? c.blue : c.search }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: unreadOnly === u ? '#fff' : c.text2 }}>{u ? 'Unread' : 'All'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">
        {body}
        {section === 'contacts' && !searching && contacts.length ? <Text style={{ color: c.text3, fontSize: 11.5, textAlign: 'center', marginTop: 14 }}>Hold a saved contact to remove it.</Text> : null}
      </ScrollView>
    </View>
  );

  if (!account) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.sidebar }}>
        {sidebar}
        <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 60, gap: 14, alignItems: 'center' }}>
          <Text style={{ color: c.text2, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>Sign in so people know who they are talking to.</Text>
          <Pressable onPress={() => router.push('/account')} style={({ pressed }) => ({ backgroundColor: pressed ? '#0a6fd8' : c.blue, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 })}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.sidebar }}>
      {sidebar}
      {listCol}
      {wide ? (
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.chatBg }}>
          {open ? (
            <BeamChat key={open} username={open} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Glyph.Bubble color={c.text3} size={46} />
              <Text style={{ color: c.text3, fontSize: 15 }}>Pick a chat or find someone to message.</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
