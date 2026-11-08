/** One Beam conversation, styled like the Beam website: glass header, iMessage bubbles with tails, floating composer. */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamAvatar, Glyph, Tail, useBeam } from '@/components/beam-ui';
import { tap } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { startCall } from '@/lib/calls';

function stamp(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}

function ask(title: string, body: string, action: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) run();
    return;
  }
  Alert.alert(title, body, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: run },
  ]);
}

export default function Chat() {
  const c = useBeam();
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

  const toggleBlock = () =>
    ask(blocked ? `Unblock ${username}?` : `Block ${username}?`, blocked ? 'They will be able to message and call you again.' : "They won't be able to message or call you.", blocked ? 'Unblock' : 'Block', async () => {
      const t = await getToken();
      if (!t) return;
      try {
        await api.setBlocked(t, username, !blocked);
        setBlocked(!blocked);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't change that.");
      }
    });

  const report = (m: api.ChatMessage) => {
    if (m.mine) return;
    ask('Report this message?', 'It goes to the Studento admin.', 'Report', async () => {
      const t = await getToken();
      if (!t) return;
      try {
        await api.sendReport(t, 'message', m.id, 'Not okay', '');
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't report it.");
      }
    });
  };

  const call = (video: boolean) => void startCall(username, video).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't call."));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.chatBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* glass header */}
      <View style={{ paddingTop: insets.top + 4, paddingBottom: 8, paddingHorizontal: 10, backgroundColor: c.glass, borderBottomWidth: 0.5, borderBottomColor: c.hairline, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={{ width: 70, flexDirection: 'row', alignItems: 'center' }}>
          <Glyph.Back color={c.blue} size={26} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${username}, options`} onPress={toggleBlock} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          <BeamAvatar name={username} size={38} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 12, fontWeight: '500' }}>{username}</Text>
            <Glyph.Chevron color={c.text3} size={10} />
          </View>
        </Pressable>
        <View style={{ width: 70, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 }}>
          {blocked ? null : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Video call" onPress={() => call(true)} hitSlop={8}>
                <Glyph.Video color={c.blue} size={26} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Audio call" onPress={() => call(false)} hitSlop={8}>
                <Glyph.Phone color={c.blue} size={22} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 90 }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        {messages.length === 0 && !err ? <Text style={{ textAlign: 'center', color: c.text3, fontSize: 12, marginTop: 20 }}>{`Say hi to ${username}.`}</Text> : null}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newTime = !prev || m.createdAt - prev.createdAt > 60 * 60_000;
          const runStart = newTime || prev?.mine !== m.mine;
          const runEnd = !next || next.mine !== m.mine || next.createdAt - m.createdAt > 60 * 60_000;
          const bg = m.mine ? c.outBubble : c.inBubble;
          return (
            <View key={m.id}>
              {newTime ? (
                <Text style={{ textAlign: 'center', fontSize: 11, color: c.text3, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>{stamp(m.createdAt)}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: m.mine ? 'flex-end' : 'flex-start', marginTop: runStart && !newTime ? 8 : 2 }}>
                <Pressable
                  onLongPress={() => {
                    tap();
                    report(m);
                  }}
                  style={{ maxWidth: '72%' }}>
                  <View style={{ backgroundColor: bg, borderRadius: 18, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 8 }}>
                    <Text style={{ color: m.mine ? c.outText : c.inText, fontSize: 16, lineHeight: 21 }}>{m.body}</Text>
                  </View>
                  {runEnd ? <Tail color={bg} side={m.mine ? 'right' : 'left'} bg={c.chatBg} /> : null}
                </Pressable>
              </View>
              {runEnd && m.mine && !next ? <Text style={{ textAlign: 'right', fontSize: 11, color: c.text3, marginTop: 3, marginRight: 4, fontWeight: '500' }}>Delivered</Text> : null}
            </View>
          );
        })}
        {err ? <Text style={{ textAlign: 'center', color: c.red, fontSize: 12, marginTop: 10 }}>{err}</Text> : null}
      </ScrollView>

      {/* floating composer */}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 10 }}>
        {blocked ? (
          <View style={{ backgroundColor: c.glass, borderRadius: 24, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: c.text2, fontSize: 14 }}>{`You blocked ${username}. Tap their name to unblock.`}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, paddingLeft: 8, borderRadius: 24, backgroundColor: c.glass, shadowColor: '#000', shadowOpacity: c.dark ? 0.45 : 0.1, shadowRadius: 17, shadowOffset: { width: 0, height: 10 } }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.search, alignItems: 'center', justifyContent: 'center', marginBottom: 1 }}>
              <Glyph.Plus color={c.text2} />
            </View>
            <View style={{ flex: 1, minHeight: 36, borderRadius: 18, backgroundColor: c.field, borderWidth: 1, borderColor: c.fieldBorder, flexDirection: 'row', alignItems: 'flex-end' }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Beam"
                placeholderTextColor={c.text3}
                multiline
                maxLength={500}
                style={{ flex: 1, color: c.text, fontSize: 16, lineHeight: 20, paddingLeft: 13, paddingRight: 8, paddingTop: 8, paddingBottom: 8, maxHeight: 140 }}
                accessibilityLabel="Message"
              />
              {text.trim() ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => void send()} disabled={sending} style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, margin: 3, backgroundColor: pressed ? '#0a6fd8' : c.blue, alignItems: 'center', justifyContent: 'center' })}>
                  <Glyph.Up color="#fff" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
