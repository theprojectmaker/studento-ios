/** One conversation (beta). Polls while open. Block from the header row; long-press a message to report it. */
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Note, tap } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { alpha, readableOn } from '@/lib/themes';

export default function Chat() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { u } = useLocalSearchParams<{ u: string }>();
  const username = String(u ?? '').toLowerCase();
  const [messages, setMessages] = useState<api.ChatMessage[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const t = await getToken();
    if (!t || !username) return;
    try {
      const r = await api.getChat(t, username);
      setMessages(r.messages);
      setBlocked(r.blocked);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load this chat.");
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load(), 4000);
      return () => clearInterval(id);
    }, [load])
  );

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const t = await getToken();
      if (!t) throw new Error('Sign in first.');
      const m = await api.sendMessage(t, username, body);
      setMessages((prev) => [...prev, m]);
      setText('');
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  };

  const toggleBlock = async () => {
    const t = await getToken();
    if (!t) return;
    try {
      await api.setBlocked(t, username, !blocked);
      setBlocked(!blocked);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't change that.");
    }
  };

  const report = (m: api.ChatMessage) => {
    if (m.mine) return;
    const go = async () => {
      const t = await getToken();
      if (!t) return;
      try {
        await api.sendReport(t, 'message', m.id, 'Not okay', '');
        setErr(null);
        if (Platform.OS !== 'web') Alert.alert('Reported', 'Thanks. The Studento admin will look at it. You can also block this person.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't report it.");
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Report this message?', 'It goes to the Studento admin.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: username }} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 6 }}>
        <Pressable accessibilityRole="button" onPress={() => void toggleBlock()} hitSlop={8}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: blocked ? theme.accent : '#ff453a' }}>{blocked ? 'Unblock' : 'Block'}</Text>
        </Pressable>
      </View>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 6, maxWidth: sz(680), width: '100%', alignSelf: 'center' }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        {messages.length === 0 && !err ? <Note>{`Say hi to ${username}. Keep it friendly.`}</Note> : null}
        {messages.map((m) => (
          <Pressable
            key={m.id}
            onLongPress={() => {
              tap();
              report(m);
            }}
            style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderBottomRightRadius: m.mine ? 6 : 18, borderBottomLeftRadius: m.mine ? 18 : 6, backgroundColor: m.mine ? theme.accent : theme.panel }}>
              <Text style={{ ...TYPE.regular, fontSize: sz(16), lineHeight: sz(21), color: m.mine ? readableOn(theme.accent) : theme.ink }}>{m.body}</Text>
            </View>
            <Text style={{ ...TYPE.regular, fontSize: sz(11), color: theme.muted, marginTop: 2, textAlign: m.mine ? 'right' : 'left' }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
          </Pressable>
        ))}
        {err ? <Note tone="error">{err}</Note> : null}
      </ScrollView>
      {blocked ? (
        <Note>{`You blocked ${username}. Unblock to send messages.`}</Note>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: alpha(theme.ink, 0.08) }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={alpha(theme.ink, 0.35)}
            multiline
            maxLength={500}
            style={{ flex: 1, ...TYPE.regular, fontSize: sz(16), color: theme.ink, backgroundColor: alpha(theme.ink, 0.08), borderRadius: 18, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, maxHeight: 120 }}
            accessibilityLabel="Message"
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => void send()} disabled={!text.trim() || sending} style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: text.trim() ? theme.accent : alpha(theme.ink, 0.12) }}>
            <Text style={{ ...TYPE.semibold, fontSize: sz(15), color: text.trim() ? readableOn(theme.accent) : theme.muted }}>Send</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
