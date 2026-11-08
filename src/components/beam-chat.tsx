/**
 * One Beam conversation: iMessage-style bubbles plus WhatsApp/Snapchat extras (photos,
 * one-time photos, videos, polls, countdowns, stickers, replies, reactions, edit, unsend).
 * Used full screen on phones (/chat) and as the right pane of the Beam sidebar layout on iPad.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, AttachSheet, CountdownSheet, PhotoViewer, PollSheet, StickerSheet, VideoViewer, type AttachKind } from '@/components/beam-sheets';
import { BeamAvatar, Glyph, Tail, useBeam, type BeamPalette } from '@/components/beam-ui';
import { tap } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { newGame, sendTyping, watchChatMeta } from '@/lib/beam-extra';
import { getPhotos, getVideo } from '@/lib/beam-media';
import { useBeamSettings } from '@/lib/beam-settings';
import { encode, fold, MAX_BODY, preview, type Folded, type Rich } from '@/lib/beam-msg';
import { startCall } from '@/lib/calls';

const HOUR = 60 * 60_000;

function stamp(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}

function left(ms: number): string {
  if (ms <= 0) return "It's time!";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
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

function plain(f: Folded): string {
  if (f.deleted) return 'Message unsent';
  return f.rich.k === 'txt' ? f.rich.t : preview(encode(f.rich));
}

export function BeamChat({ username, onBack }: { username: string; onBack?: () => void }) {
  const base = useBeam();
  const st = useBeamSettings();
  const c = useMemo(() => ({ ...base, outBubble: st.bubble }), [base, st.bubble]);
  const [meta, setMeta] = useState({ seen: false, typingAt: 0 });
  const [typing, setTyping] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const [timeFor, setTimeFor] = useState<number | null>(null);
  const lastTap = useRef({ id: 0, at: 0 });
  // The typing bubble shows for 6 s after their last keystroke signal.
  useEffect(() => {
    if (!username) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const stop = watchChatMeta(username, (m) => {
      setMeta(m);
      clearTimeout(t);
      const left = m.typingAt + 6000 - Date.now();
      setTyping(left > 0);
      if (left > 0) t = setTimeout(() => setTyping(false), left);
    });
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [username]);
  const insets = useSafeAreaInsets();
  const [raw, setRaw] = useState<api.ChatMessage[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState<Folded | null>(null);
  const [editing, setEditing] = useState<Folded | null>(null);
  const [sheet, setSheet] = useState<'attach' | 'poll' | 'cd' | 'stk' | null>(null);
  const [act, setAct] = useState<Folded | null>(null);
  const [photo, setPhoto] = useState<{ uri: string; once?: Folded } | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef<ScrollView>(null);

  const msgs = useMemo(() => fold(raw), [raw]);
  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const hasCountdown = msgs.some((m) => m.rich.k === 'cd' && !m.deleted && m.rich.at > now);

  useEffect(() => {
    if (!hasCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasCountdown]);

  useFocusEffect(
    useCallback(() => {
      setRaw([]);
      if (!username) return;
      // Live listener: new messages appear as they arrive, without re-reading the whole chat.
      return api.watchChat(
        username,
        (r) => {
          setRaw(r.messages);
          setBlocked(r.blocked);
          setErr(null);
        },
        (e) => setErr(e.message)
      );
    }, [username])
  );

  const sendBody = async (body: string) => {
    const t = await getToken();
    if (!t) throw new Error('Sign in first.');
    if (body.length > MAX_BODY) throw new Error('That is too big to send. Try fewer photos.');
    const m = await api.sendMessage(t, username, body);
    setRaw((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setErr(null);
  };
  const sendRich = async (r: Rich, label = 'Sending…') => {
    setBusy(label);
    try {
      await sendBody(encode(r));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(null);
    }
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || busy) return;
    if (editing) {
      setText('');
      setEditing(null);
      return sendRich({ k: 'edit', m: editing.id, t: body.slice(0, 500) });
    }
    setText('');
    const r = reply;
    setReply(null);
    if (r) return sendRich({ k: 'txt', t: body.slice(0, 500), r: r.id });
    setBusy('Sending…');
    try {
      await sendBody(body);
    } catch (e) {
      setText(body);
      setErr(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(null);
    }
  };

  const attach = async (k: AttachKind) => {
    setSheet(k === 'poll' ? 'poll' : k === 'countdown' ? 'cd' : k === 'sticker' ? 'stk' : null);
    if (k === 'poll' || k === 'countdown' || k === 'sticker') return;
    if (k === 'chess') {
      setBusy('Starting a game…');
      try {
        const g = await newGame(username);
        await sendBody(encode({ k: 'chess', g }));
        router.push({ pathname: '/chess', params: { g } });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't start a game.");
      } finally {
        setBusy(null);
      }
      return;
    }
    // let the sheet fade before the system picker slides up
    await new Promise((r) => setTimeout(r, 250));
    try {
      if (k === 'video' || k === 'record') {
        const v = await getVideo(k === 'record', setBusy);
        if (v) await sendRich({ k: 'vid', u: v.url, s: v.seconds, r: reply?.id }, 'Sending video…');
      } else {
        setBusy('Getting photo…');
        const d = await getPhotos(k === 'camera');
        setBusy(null);
        if (d.length) await sendRich({ k: 'img', d: k === 'once' ? d.slice(0, 1) : d, once: k === 'once' || undefined, r: reply?.id }, 'Sending photo…');
      }
      setReply(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send that.");
    } finally {
      setBusy(null);
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

  const actionsFor = (m: Folded) => {
    const close = (fn: () => void) => () => {
      setAct(null);
      fn();
    };
    const a: { label: string; red?: boolean; run: () => void }[] = [];
    if (!m.deleted) a.push({ label: 'Reply', run: close(() => setReply(m)) });
    if (m.mine && !m.deleted && m.rich.k === 'txt')
      a.push({
        label: 'Edit',
        run: close(() => {
          setEditing(m);
          setText(m.rich.k === 'txt' ? m.rich.t : '');
        }),
      });
    if (m.mine && !m.deleted) a.push({ label: 'Unsend', red: true, run: close(() => void sendRich({ k: 'del', m: m.id })) });
    if (!m.mine)
      a.push({
        label: 'Report',
        red: true,
        run: close(() =>
          ask('Report this message?', 'It goes to the Studento admin.', 'Report', async () => {
            const t = await getToken();
            if (t) await api.sendReport(t, 'message', m.id, 'Not okay', '').catch((e) => setErr(e instanceof Error ? e.message : "Couldn't report it."));
          })
        ),
      });
    return a;
  };

  const vote = (m: Folded, i: number) => {
    if (m.rich.k !== 'poll') return;
    const cur = m.votes.mine;
    const next = m.rich.multi ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : cur.includes(i) ? [] : [i];
    if (st.haptics) tap();
    void sendRich({ k: 'vote', m: m.id, o: next }, 'Voting…');
  };

  const openOnce = (m: Folded) => {
    if (m.rich.k !== 'img') return;
    if (m.mine || m.seen) return;
    setPhoto({ uri: m.rich.d[0], once: m });
  };
  const closePhoto = () => {
    const p = photo;
    setPhoto(null);
    if (p?.once) void sendRich({ k: 'seen', m: p.once.id });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.chatBg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: onBack ? insets.top + 4 : 10, paddingBottom: 8, paddingHorizontal: 10, backgroundColor: c.glass, borderBottomWidth: 0.5, borderBottomColor: c.hairline, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 104 }}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10}>
              <Glyph.Back color={c.blue} size={26} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${username}, options`} onPress={toggleBlock} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          <BeamAvatar name={username} size={38} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 12, fontWeight: '500' }}>{username}</Text>
            <Glyph.Chevron color={c.text3} size={10} />
          </View>
        </Pressable>
        <View style={{ width: 104, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search this chat" onPress={() => setSearch(search === null ? '' : null)} hitSlop={8} style={{ justifyContent: 'center' }}>
            <Glyph.Search color={c.blue} size={19} />
          </Pressable>
          {blocked ? null : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Video call" onPress={() => void startCall(username, true).catch((e) => setErr(String(e?.message ?? e)))} hitSlop={8}>
                <Glyph.Video color={c.blue} size={26} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Audio call" onPress={() => void startCall(username, false).catch((e) => setErr(String(e?.message ?? e)))} hitSlop={8}>
                <Glyph.Phone color={c.blue} size={22} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {search !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginTop: 8, height: 34, borderRadius: 10, backgroundColor: c.search, paddingHorizontal: 9 }}>
          <Glyph.Search color={c.text3} />
          <TextInput value={search} onChangeText={setSearch} autoFocus placeholder="Search this chat" placeholderTextColor={c.text3} style={{ flex: 1, color: c.text, fontSize: 15, height: '100%' }} />
          <Pressable onPress={() => setSearch(null)} hitSlop={8}>
            <Text style={{ color: c.blue, fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView ref={scroller} style={{ flex: 1 }} onLayout={() => search === null && scroller.current?.scrollToEnd({ animated: false })} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }} onContentSizeChange={() => search === null && scroller.current?.scrollToEnd({ animated: false })}>
        {search ? <Text style={{ textAlign: 'center', color: c.text3, fontSize: 12, marginBottom: 6 }}>{`${msgs.filter((x) => !x.deleted && plain(x).toLowerCase().includes(search.toLowerCase())).length} found`}</Text> : null}
        {msgs.length === 0 && !err ? <Text style={{ textAlign: 'center', color: c.text3, fontSize: 12, marginTop: 20 }}>{`Say hi to ${username}.`}</Text> : null}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const newTime = !prev || m.createdAt - prev.createdAt > HOUR;
          const runStart = newTime || prev?.mine !== m.mine;
          const runEnd = !next || next.mine !== m.mine || next.createdAt - m.createdAt > HOUR;
          const quoted = 'r' in m.rich && m.rich.r ? byId.get(m.rich.r) : undefined;
          if (search && (m.deleted || !plain(m).toLowerCase().includes(search.toLowerCase()))) return null;
          return (
            <View key={m.id}>
              {newTime ? <Text style={{ textAlign: 'center', fontSize: 11, color: c.text3, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>{stamp(m.createdAt)}</Text> : null}
              <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start', marginTop: runStart && !newTime ? 8 : 2 }}>
                {quoted ? (
                  <View style={{ maxWidth: '70%', borderLeftWidth: 3, borderLeftColor: c.text3, paddingLeft: 8, marginBottom: 3, marginHorizontal: 6 }}>
                    <Text style={{ color: c.text3, fontSize: 12.5 }} numberOfLines={2}>
                      {plain(quoted)}
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => {
                    // double-tap = heart; single tap shows the time
                    const t = Date.now();
                    if (lastTap.current.id === m.id && t - lastTap.current.at < 320 && !m.deleted) {
                      lastTap.current = { id: 0, at: 0 };
                      if (st.haptics) tap();
                      const had = m.reactions.find((r) => r.mine)?.e;
                      void sendRich({ k: 're', m: m.id, e: had === '❤️' ? '' : '❤️' }, 'Reacting…');
                      return;
                    }
                    lastTap.current = { id: m.id, at: t };
                    setTimeFor(timeFor === m.id ? null : m.id);
                  }}
                  onLongPress={() => {
                    if (st.haptics) tap();
                    setAct(m);
                  }}
                  delayLongPress={300}
                  style={{ maxWidth: '76%' }}>
                  <Body c={c} m={m} runEnd={runEnd} now={now} onVote={(o) => vote(m, o)} onPhoto={(uri) => setPhoto({ uri })} onOnce={() => openOnce(m)} onVideo={setVideo} />
                  {m.reactions.length ? (
                    <View style={{ position: 'absolute', top: -12, [m.mine ? 'left' : 'right']: -10, flexDirection: 'row', backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1.5, borderColor: c.chatBg }}>
                      {m.reactions.map((r) => (
                        <Text key={`${r.mine}`} style={{ fontSize: 13 }}>
                          {r.e}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
                {m.edited && !m.deleted ? <Text style={{ color: c.text3, fontSize: 10.5, marginTop: 2, marginHorizontal: 6 }}>Edited</Text> : null}
              </View>
              {timeFor === m.id ? <Text style={{ textAlign: m.mine ? 'right' : 'left', fontSize: 11, color: c.text3, marginTop: 3, marginHorizontal: 6 }}>{new Date(m.createdAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</Text> : null}
              {m.mine && !next && !search ? <Text style={{ textAlign: 'right', fontSize: 11, color: c.text3, marginTop: 3, marginRight: 4, fontWeight: '500' }}>{meta.seen ? 'Read' : 'Delivered'}</Text> : null}
            </View>
          );
        })}
        {typing && !search ? (
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 4, backgroundColor: c.inBubble, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 }}>
            {[0.4, 0.6, 0.8].map((o) => (
              <View key={o} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.text3, opacity: o }} />
            ))}
          </View>
        ) : null}
        {err ? <Text style={{ textAlign: 'center', color: c.red, fontSize: 12, marginTop: 10 }}>{err}</Text> : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: (onBack ? Math.max(insets.bottom - 8, 0) : 0) + 10 }}>
        {busy ? <Text style={{ alignSelf: 'center', color: c.text2, fontSize: 12, marginBottom: 6, backgroundColor: c.glass, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' }}>{busy}</Text> : null}
        {blocked ? (
          <View style={{ backgroundColor: c.glass, borderRadius: 24, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: c.text2, fontSize: 14 }}>{`You blocked ${username}. Tap their name to unblock.`}</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 24, backgroundColor: c.glass, padding: 6, shadowColor: '#000', shadowOpacity: c.dark ? 0.45 : 0.1, shadowRadius: 17, shadowOffset: { width: 0, height: 10 } }}>
            {reply || editing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Glyph.Reply color={c.blue} />
                <Text style={{ flex: 1, color: c.text2, fontSize: 13 }} numberOfLines={1}>
                  {editing ? `Editing: ${plain(editing)}` : `Replying to ${reply!.mine ? 'yourself' : username}: ${plain(reply!)}`}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    if (editing) setText('');
                    setReply(null);
                    setEditing(null);
                  }}>
                  <Glyph.Close color={c.text3} size={14} />
                </Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Attach" onPress={() => setSheet('attach')} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.search, alignItems: 'center', justifyContent: 'center', marginBottom: 1, marginLeft: 2 }}>
                <Glyph.Plus color={c.text2} />
              </Pressable>
              <View style={{ flex: 1, minHeight: 36, borderRadius: 18, backgroundColor: c.field, borderWidth: 1, borderColor: c.fieldBorder, flexDirection: 'row', alignItems: 'flex-end' }}>
                <TextInput
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    if (t) void sendTyping(username).catch(() => {});
                  }}
                  placeholder={editing ? 'Edit message' : 'Message'}
                  placeholderTextColor={c.text3}
                  multiline={!st.enterSends}
                  blurOnSubmit={false}
                  returnKeyType={st.enterSends ? 'send' : 'default'}
                  onSubmitEditing={st.enterSends ? () => void sendText() : undefined}
                  maxLength={500}
                  style={{ flex: 1, color: c.text, fontSize: st.textSize, lineHeight: 20, paddingLeft: 13, paddingRight: 8, paddingTop: 8, paddingBottom: 8, maxHeight: 140 }}
                  accessibilityLabel="Message"
                />
                {text.trim() ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => void sendText()} disabled={!!busy} style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, margin: 3, backgroundColor: pressed ? '#0a6fd8' : c.blue, alignItems: 'center', justifyContent: 'center' })}>
                    <Glyph.Up color="#fff" />
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel="Camera" onPress={() => void attach('camera')} style={{ width: 30, height: 30, margin: 3, alignItems: 'center', justifyContent: 'center' }}>
                    <Glyph.Camera color={c.text3} size={20} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      <AttachSheet c={c} open={sheet === 'attach'} onClose={() => setSheet(null)} onPick={(k) => void attach(k)} />
      <StickerSheet
        c={c}
        open={sheet === 'stk'}
        onClose={() => setSheet(null)}
        onPick={(e) => {
          setSheet(null);
          void sendRich({ k: 'stk', e });
        }}
      />
      <PollSheet
        c={c}
        open={sheet === 'poll'}
        onClose={() => setSheet(null)}
        onSend={(q, o, multi) => {
          setSheet(null);
          void sendRich({ k: 'poll', q, o, multi: multi || undefined });
        }}
      />
      <CountdownSheet
        c={c}
        open={sheet === 'cd'}
        onClose={() => setSheet(null)}
        onSend={(t, at) => {
          setSheet(null);
          void sendRich({ k: 'cd', t, at });
        }}
      />
      <ActionSheet
        c={c}
        open={!!act}
        onClose={() => setAct(null)}
        preview={act ? plain(act) : ''}
        actions={act ? actionsFor(act) : []}
        onReact={(e) => {
          const m = act;
          setAct(null);
          if (!m) return;
          const mineNow = m.reactions.find((r) => r.mine)?.e;
          void sendRich({ k: 're', m: m.id, e: mineNow === e ? '' : e }, 'Reacting…');
        }}
      />
      <PhotoViewer uri={photo?.uri ?? null} seconds={photo?.once ? 10 : undefined} onClose={closePhoto} />
      <VideoViewer url={video} onClose={() => setVideo(null)} />
    </KeyboardAvoidingView>
  );
}

function Body({
  c,
  m,
  runEnd,
  now,
  onVote,
  onPhoto,
  onOnce,
  onVideo,
}: {
  c: BeamPalette;
  m: Folded;
  runEnd: boolean;
  now: number;
  onVote: (i: number) => void;
  onPhoto: (uri: string) => void;
  onOnce: () => void;
  onVideo: (u: string) => void;
}) {
  const st = useBeamSettings();
  const bg = m.mine ? c.outBubble : c.inBubble;
  const fg = m.mine ? c.outText : c.inText;
  const bubble = (child: React.ReactNode, pad = true) => (
    <View>
      <View style={{ backgroundColor: bg, borderRadius: 18, overflow: 'hidden', ...(pad ? { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 8 } : null) }}>{child}</View>
      {runEnd && pad ? <Tail color={bg} side={m.mine ? 'right' : 'left'} bg={c.chatBg} /> : null}
    </View>
  );
  if (m.deleted)
    return (
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.hairline, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text style={{ color: c.text3, fontSize: 15, fontStyle: 'italic' }}>{m.mine ? 'You unsent a message' : 'Message unsent'}</Text>
      </View>
    );
  const r = m.rich;
  switch (r.k) {
    case 'txt':
      // a message that is only one or two emoji shows big, like iMessage
      if (st.bigEmoji && /^\p{Extended_Pictographic}(‍?\p{Extended_Pictographic}|️){0,6}$/u.test(r.t.trim())) return <Text style={{ fontSize: 44 }}>{r.t.trim()}</Text>;
      return bubble(
        <Text style={{ color: fg, fontSize: st.textSize, lineHeight: st.textSize * 1.32 }}>
          {r.t.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
            /^https?:\/\//.test(part) ? (
              <Text key={i} style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(part).catch(() => {})}>
                {part}
              </Text>
            ) : (
              part
            )
          )}
        </Text>
      );
    case 'chess':
      return (
        <Pressable onPress={() => router.push({ pathname: '/chess', params: { g: r.g } })} style={{ width: 230, borderRadius: 18, padding: 14, backgroundColor: '#3a2f22', gap: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '600' }}>CHESS</Text>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{m.mine ? 'You started a game' : 'Wants to play chess'}</Text>
          <View style={{ backgroundColor: '#ebecd0', borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: '#3a2f22', fontSize: 15, fontWeight: '700' }}>Open game</Text>
          </View>
        </Pressable>
      );
    case 'stk':
      return <Text style={{ fontSize: 64 }}>{r.e}</Text>;
    case 'img':
      if (r.once) {
        const gone = m.seen;
        return (
          <Pressable onPress={onOnce} disabled={m.mine || gone} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: gone ? 'transparent' : m.mine ? c.outBubble : c.inBubble, borderWidth: gone ? 1 : 0, borderColor: c.hairline }}>
            <View style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: gone ? 'transparent' : '#ff9f0a', borderWidth: gone ? 2 : 0, borderColor: '#ff9f0a' }} />
            <Text style={{ color: gone ? c.text2 : fg, fontSize: 15, fontWeight: '600' }}>{gone ? 'Opened' : m.mine ? 'One-time photo · Delivered' : 'Tap to view one-time photo'}</Text>
          </Pressable>
        );
      }
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, width: r.d.length > 1 ? 243 : 230, borderRadius: 18, overflow: 'hidden' }}>
          {r.d.map((d, i) => (
            <Pressable key={i} onPress={() => onPhoto(d)}>
              <Image source={{ uri: d }} style={r.d.length > 1 ? { width: 120, height: 120 } : { width: 230, height: 260 }} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      );
    case 'vid':
      return (
        <Pressable onPress={() => onVideo(r.u)} style={{ width: 220, height: 150, borderRadius: 18, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Glyph.Play color="#fff" size={26} />
          </View>
          {r.s ? <Text style={{ position: 'absolute', bottom: 8, right: 12, color: '#fff', fontSize: 12, fontWeight: '600' }}>{`${Math.floor(r.s / 60)}:${String(r.s % 60).padStart(2, '0')}`}</Text> : null}
        </Pressable>
      );
    case 'poll': {
      const counts = r.o.map((_, i) => (m.votes.mine.includes(i) ? 1 : 0) + (m.votes.theirs.includes(i) ? 1 : 0));
      const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
      return (
        <View style={{ width: 260, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.hairline, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Glyph.Poll color={c.green} size={16} />
            <Text style={{ color: c.text3, fontSize: 11.5, fontWeight: '600' }}>{r.multi ? 'POLL · PICK ANY' : 'POLL'}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{r.q}</Text>
          {r.o.map((o, i) => {
            const mine = m.votes.mine.includes(i);
            const pct = counts[i] / total;
            return (
              <Pressable key={i} onPress={() => onVote(i)} style={{ borderRadius: 10, backgroundColor: c.search, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, backgroundColor: mine ? c.blue : 'rgba(120,120,128,0.28)' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, gap: 8 }}>
                  <View style={{ width: 18, height: 18, borderRadius: r.multi ? 5 : 9, borderWidth: 2, borderColor: mine ? '#fff' : c.text3, backgroundColor: mine ? '#fff' : 'transparent' }} />
                  <Text style={{ flex: 1, color: mine ? '#fff' : c.text, fontSize: 15, fontWeight: mine ? '600' : '400' }}>{o}</Text>
                  <Text style={{ color: mine ? '#fff' : c.text2, fontSize: 13 }}>{counts[i]}</Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={{ color: c.text3, fontSize: 11.5 }}>{`${counts.reduce((a, b) => a + b, 0)} vote${counts.reduce((a, b) => a + b, 0) === 1 ? '' : 's'} · tap to vote`}</Text>
        </View>
      );
    }
    case 'cd': {
      const ms = r.at - now;
      return (
        <View style={{ width: 240, borderRadius: 18, padding: 14, backgroundColor: ms > 0 ? '#1c1c1e' : c.green, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Glyph.Timer color="#64d2ff" size={16} />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '600' }}>COUNTDOWN</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{r.t}</Text>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{left(ms)}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{new Date(r.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        </View>
      );
    }
    default:
      return null;
  }
}
