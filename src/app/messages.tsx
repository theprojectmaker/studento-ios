/** Beam (beta): chats and calls with other Studento users. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Row, Screen, Section, Segmented } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { startCall } from '@/lib/calls';
import { CallButtons } from '@/components/call-buttons';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';

function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ width: sz(size), height: sz(size), borderRadius: sz(size / 2), backgroundColor: alpha(theme.accent, 0.2), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...TYPE.bold, fontSize: sz(size * 0.42), color: theme.accent }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export default function Beam() {
  const theme = useTheme();
  const account = useStore((s) => s.account);
  const [tab, setTab] = useState<'chats' | 'calls'>('chats');
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
      setErr(e instanceof Error ? e.message : "Couldn't load Beam.");
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

  if (!account) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(34), letterSpacing: -1, color: theme.accent }}>Beam</Text>
          <Text style={{ ...TYPE.regular, fontSize: sz(15), color: theme.muted, textAlign: 'center' }}>Chat and call other Studento users. Beam needs an account so people know who they are talking to.</Text>
        </View>
        <Button title="Sign in or create an account" onPress={() => router.push('/account')} />
      </Screen>
    );
  }

  const shownHits = q.trim().length >= 2 ? hits : [];
  const unread = (threads ?? []).reduce((a, t) => a + (t.unread || 0), 0);
  return (
    <Screen>
      <Segmented
        value={tab}
        options={[
          { value: 'chats', label: unread ? `Chats (${unread})` : 'Chats' },
          { value: 'calls', label: 'Calls' },
        ]}
        onChange={setTab}
      />

      <Section title={tab === 'chats' ? 'New chat' : 'New call'}>
        <View style={{ padding: 12 }}>
          <Field value={q} onChangeText={setQ} placeholder="Search by username" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search users" />
        </View>
        {shownHits.map((h) => (
          <View key={h.id}>
            <Divider />
            {tab === 'chats' ? (
              <Row label={h.username} icon={{ name: 'person.fill', color: '#007aff' }} onPress={() => router.push({ pathname: '/chat', params: { u: h.username } })} />
            ) : (
              <Row label={h.username} icon={{ name: 'person.fill', color: '#007aff' }} right={<CallButtons onAudio={() => call(h.username, false)} onVideo={() => call(h.username, true)} />} />
            )}
          </View>
        ))}
      </Section>

      {tab === 'chats' ? (
        <Section title="Chats" footer="Beta. Keep it to school stuff and be kind. In a chat you can call, block someone, or long-press a message to report it.">
          {threads === null ? <Note>{err ?? 'Loading…'}</Note> : threads.length === 0 ? <Note>No chats yet. Search for a friend above.</Note> : null}
          {(threads ?? []).map((t, i) => (
            <View key={t.id}>
              {i ? <Divider inset={64} /> : null}
              <Pressable onPress={() => router.push({ pathname: '/chat', params: { u: t.username } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? alpha(theme.ink, 0.08) : 'transparent' })}>
                <Avatar name={t.username} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...TYPE.semibold, fontSize: sz(16), color: theme.ink }}>{t.username}</Text>
                  <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted }} numberOfLines={1}>
                    {t.lastBody}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ ...TYPE.regular, fontSize: sz(12), color: theme.muted }}>{ago(t.lastAt)}</Text>
                  {t.unread ? (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ ...TYPE.bold, fontSize: sz(11), color: readableOn(theme.accent) }}>{t.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </View>
          ))}
        </Section>
      ) : (
        <Section title="Recent calls" footer="Calls go straight between the two devices; Studento never records them. Tap a call to call back.">
          {calls === null ? <Note>{err ?? 'Loading…'}</Note> : calls.length === 0 ? <Note>No calls yet.</Note> : null}
          {(calls ?? []).map((c, i) => {
            const missed = !c.outgoing && (c.status === 'missed' || c.status === 'declined');
            return (
              <View key={c.id}>
                {i ? <Divider inset={64} /> : null}
                <Pressable onPress={() => call(c.peer, c.video)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? alpha(theme.ink, 0.08) : 'transparent' })}>
                  <Avatar name={c.peer} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ ...TYPE.semibold, fontSize: sz(16), color: missed ? '#ff453a' : theme.ink }}>{c.peer}</Text>
                    <Text style={{ ...TYPE.regular, fontSize: sz(13), color: theme.muted }}>
                      {`${c.outgoing ? '↗' : '↙'} ${c.video ? 'Video' : 'Audio'}${c.seconds ? ` · ${dur(c.seconds)}` : missed ? ' · missed' : c.status === 'declined' ? ' · declined' : ''}`}
                    </Text>
                  </View>
                  <Text style={{ ...TYPE.regular, fontSize: sz(12), color: theme.muted }}>{ago(c.at)}</Text>
                </Pressable>
              </View>
            );
          })}
        </Section>
      )}
      {err && (threads || calls) ? <Note tone="error">{err}</Note> : null}
    </Screen>
  );
}
