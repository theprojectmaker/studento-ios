/** Messages (beta): conversations with other Studento users, plus a search to start a new one. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Divider, Field, Note, Row, Screen, Section } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';
import { readableOn } from '@/lib/themes';

function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Messages() {
  const theme = useTheme();
  const account = useStore((s) => s.account);
  const [threads, setThreads] = useState<api.Thread[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: number; username: string }[]>([]);

  const load = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      setThreads(await api.listThreads(t));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load messages.");
    }
  }, []);

  // Refresh while the screen is open.
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

  if (!account) {
    return (
      <Screen>
        <Note>Messages need an account so people know who they are talking to.</Note>
        <Button title="Sign in or create an account" onPress={() => router.push('/account')} />
      </Screen>
    );
  }

  const shownHits = q.trim().length >= 2 ? hits : [];
  return (
    <Screen>
      <Section title="New message">
        <View style={{ padding: 12 }}>
          <Field value={q} onChangeText={setQ} placeholder="Search by username" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search users" />
        </View>
        {shownHits.map((h) => (
          <View key={h.id}>
            <Divider />
            <Row label={h.username} icon={{ name: 'person.fill', color: '#007aff' }} onPress={() => router.push({ pathname: '/chat', params: { u: h.username } })} />
          </View>
        ))}
      </Section>

      <Section title="Conversations" footer="Beta. Keep it to school stuff and be kind. Inside a chat you can block someone or report a message.">
        {threads === null ? <Note>{err ?? 'Loading…'}</Note> : threads.length === 0 ? <Note>No messages yet. Search for a friend above.</Note> : null}
        {(threads ?? []).map((t, i) => (
          <View key={t.id}>
            {i ? <Divider inset={16} /> : null}
            <Row
              label={t.username}
              sub={t.lastBody}
              onPress={() => router.push({ pathname: '/chat', params: { u: t.username } })}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ ...TYPE.regular, fontSize: sz(12), color: theme.muted }}>{ago(t.lastAt)}</Text>
                  {t.unread ? (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ ...TYPE.bold, fontSize: sz(11), color: readableOn(theme.accent) }}>{t.unread}</Text>
                    </View>
                  ) : null}
                </View>
              }
            />
          </View>
        ))}
      </Section>
      {err && threads ? <Note tone="error">{err}</Note> : null}
    </Screen>
  );
}
