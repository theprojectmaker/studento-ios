/**
 * One Beam conversation: iMessage-style bubbles plus WhatsApp/Snapchat extras (photos,
 * one-time photos, videos, polls, countdowns, stickers, replies, reactions, edit, unsend).
 * Used full screen on phones (/chat) and as the right pane of the Beam sidebar layout on iPad.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamContact } from '@/components/beam-contact';
import { ChatBackground, isDarkBg } from '@/components/chat-background';
import { ActionSheet, AttachSheet, CountdownSheet, PhotoViewer, PollSheet, StickerSheet, VideoViewer, type AttachKind } from '@/components/beam-sheets';
import { Piece } from '@/components/chessbuddy/Piece';
import { BeamAvatar, BeamGlass, GlassButton, Glyph, useBeam, type BeamPalette } from '@/components/beam-ui';
import { safetyNumber } from '@/lib/beam-crypto';
import { tap } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { newGame, sendTyping, setDisappearing, sweepExpired, TTL_OPTIONS, watchChatMeta } from '@/lib/beam-extra';
import { getBackgroundPhoto, getPhotos, getVideo } from '@/lib/beam-media';
import { setChatBg, useBeamSettings } from '@/lib/beam-settings';
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
  const [meta, setMeta] = useState({ seen: false, typingAt: 0, ttl: 0 });
  const [contactOpen, setContactOpen] = useState(false);
  const chatBg = st.chatBgs[username] ?? '';
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

  // End-to-end status and the safety number both people can compare.
  const [keys, setKeys] = useState<{ mine: string; peer: string | null } | null>(null);
  const [keysFailed, setKeysFailed] = useState(false);
  useEffect(() => {
    if (!username) return;
    let dead = false;
    void getToken().then((t) => {
      if (!t) return setKeysFailed(true);
      api
        .chatKeys(username)
        .then((k) => !dead && setKeys(k))
        .catch(() => !dead && setKeysFailed(true));
    });
    return () => {
      dead = true;
    };
  }, [username]);
  const showSafety = () => {
    if (!keys?.peer) {
      const msg = `${username} hasn't opened the new Beam yet, so messages to them aren't encrypted. They will be as soon as they do.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Not encrypted yet', msg);
      return;
    }
    const msg = `Messages and photos in this chat can only be read on your phone and ${username}'s. Compare this number with theirs in person; if it matches, no one is in between.\n\n${safetyNumber(keys.mine, keys.peer)}`;
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('End-to-end encrypted', msg);
  };

  // Pinned messages live on this device only.
  const PIN_KEY = `beam.pins.${username}`;
  const [pins, setPins] = useState<number[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(PIN_KEY)
      .then((s) => setPins(s ? (JSON.parse(s) as number[]) : []))
      .catch(() => {});
  }, [PIN_KEY]);
  const togglePin = (id: number) => {
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [id, ...pins].slice(0, 5);
    setPins(next);
    void AsyncStorage.setItem(PIN_KEY, JSON.stringify(next)).catch(() => {});
  };
  const rowY = useRef(new Map<number, number>());
  const goToMsg = (id: number) => scroller.current?.scrollTo({ y: Math.max(0, (rowY.current.get(id) ?? 0) - headH), animated: true });
  const [headH, setHeadH] = useState(96);

  const msgs = useMemo(() => fold(raw), [raw]);
  const photos = msgs.filter((m) => !m.deleted && m.rich.k === 'img' && !m.rich.once).flatMap((m) => (m.rich.k === 'img' ? m.rich.d : [])).reverse();
  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const pinned = pins.map((id) => byId.get(id)).find((x) => x && !x.deleted);
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
    }, [username, setErr])
  );

  // Disappearing messages: delete anything older than the chat's timer, now and every minute.
  useEffect(() => {
    if (!meta.ttl || !username) return;
    const sweep = () => void sweepExpired(username, raw.filter((m) => m.createdAt < Date.now() - meta.ttl).map((m) => m.id)).catch(() => {});
    sweep();
    const id = setInterval(sweep, 60_000);
    return () => clearInterval(id);
  }, [meta.ttl, raw, username]);

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
    if (!m.deleted) a.push({ label: pins.includes(m.id) ? 'Unpin' : 'Pin', run: close(() => togglePin(m.id)) });
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
            if (t) await api.sendReport(t, 'message', m.id, 'Not okay', '', plain(m)).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't report it."));
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
      <View style={{ flex: 1 }}>
      <ChatBackground value={chatBg} />
      <ScrollView ref={scroller} style={{ flex: 1 }} onLayout={() => search === null && scroller.current?.scrollToEnd({ animated: false })} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingTop: headH + 8, paddingBottom: 12 }} onContentSizeChange={() => search === null && scroller.current?.scrollToEnd({ animated: false })}>
        {keysFailed ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Encryption details" onPress={showSafety} style={{ alignSelf: 'center', marginBottom: 6 }}>
          <BeamGlass c={c} radius={14} clear style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 300 }}>
            <Glyph.Lock color={keys?.peer ? c.text2 : c.text3} size={12} />
            <Text style={{ color: c.text2, fontSize: 11.5, textAlign: 'center', flexShrink: 1 }}>
              {keys === null ? 'Checking encryption…' : keys.peer ? 'Messages and photos are end-to-end encrypted. Tap to verify.' : 'Not encrypted yet. Tap to learn why.'}
            </Text>
          </BeamGlass>
        </Pressable>
        )}
        {search ?<Text style={{ textAlign: 'center', color: c.text3, fontSize: 12, marginBottom: 6 }}>{`${msgs.filter((x) => !x.deleted && plain(x).toLowerCase().includes(search.toLowerCase())).length} found`}</Text> : null}
        {msgs.length === 0 && !err ? (
          <View style={{ alignItems: 'center', gap: 8, marginTop: 48 }}>
            <BeamAvatar name={username} size={76} />
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{username}</Text>
            <Text style={{ color: c.text3, fontSize: 14 }}>No messages yet. Say hi.</Text>
          </View>
        ) : null}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const newTime = !prev || m.createdAt - prev.createdAt > HOUR;
          const runStart = newTime || prev?.mine !== m.mine;
          const runEnd = !next || next.mine !== m.mine || next.createdAt - m.createdAt > HOUR;
          const quoted = 'r' in m.rich && m.rich.r ? byId.get(m.rich.r) : undefined;
          if (search && (m.deleted || !plain(m).toLowerCase().includes(search.toLowerCase()))) return null;
          return (
            <View key={m.id} onLayout={(e) => rowY.current.set(m.id, e.nativeEvent.layout.y)}>
              {newTime ? <Text style={{ textAlign: 'center', fontSize: 11, color: isDarkBg(chatBg) ? 'rgba(255,255,255,0.85)' : c.text3, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>{stamp(m.createdAt)}</Text> : null}
              <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start', marginTop: runStart && !newTime ? 10 : 3 }}>
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
                  style={{ maxWidth: '78%' }}>
                  <Body c={c} m={m} runStart={runStart} runEnd={runEnd} now={now} onVote={(o) => vote(m, o)} onPhoto={(uri) => setPhoto({ uri })} onOnce={() => openOnce(m)} onVideo={setVideo} />
                  {m.reactions.length ? (
                    <BeamGlass c={c} radius={13} style={{ position: 'absolute', top: -14, [m.mine ? 'left' : 'right']: -10, flexDirection: 'row', gap: 1, paddingHorizontal: 6, paddingVertical: 2 }}>
                      {m.reactions.map((r) => (
                        <Text key={`${r.mine}`} style={{ fontSize: 13 }}>
                          {r.e}
                        </Text>
                      ))}
                    </BeamGlass>
                  ) : null}
                </Pressable>
                {(m.edited && !m.deleted) || pins.includes(m.id) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginHorizontal: 6 }}>
                    {pins.includes(m.id) ? <Glyph.Pin color={c.text3} size={11} /> : null}
                    <Text style={{ color: c.text3, fontSize: 10.5 }}>{[pins.includes(m.id) ? 'Pinned' : '', m.edited && !m.deleted ? 'Edited' : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                ) : null}
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

      {/* Floating Liquid Glass header: content scrolls under it. */}
      <View pointerEvents="box-none" onLayout={(e) => setHeadH(e.nativeEvent.layout.height)} style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: onBack ? insets.top + 4 : 10, paddingHorizontal: 10, gap: 8 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ minWidth: 42, flexDirection: 'row' }}>
            {onBack ? (
              <GlassButton c={c} label="Back" onPress={onBack} size={42}>
                <Glyph.Back color={c.text} size={22} />
              </GlassButton>
            ) : null}
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${username}, contact info`} onPress={() => setContactOpen(true)}>
              <BeamGlass c={c} radius={22} interactive style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 12, height: 44 }}>
                <BeamAvatar name={username} size={36} />
                <View style={{ maxWidth: 140, minWidth: 0, flexShrink: 1 }}>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                    {username}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    {typing ? null : keys?.peer ? <Glyph.Lock color={c.text3} size={9} /> : null}
                    <Text style={{ color: c.text3, fontSize: 10.5 }} numberOfLines={1}>
                      {typing ? 'typing…' : keys?.peer ? 'Encrypted' : 'Contact info'}
                    </Text>
                  </View>
                </View>
              </BeamGlass>
            </Pressable>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <BeamGlass c={c} radius={22} interactive style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Search this chat" onPress={() => setSearch(search === null ? '' : null)} hitSlop={4} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph.Search color={c.text} size={18} />
              </Pressable>
              {blocked ? null : (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel="Video call" onPress={() => void startCall(username, true).catch((e) => setErr(String(e?.message ?? e)))} hitSlop={4} style={{ width: 38, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Glyph.Video color={c.text} size={23} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Audio call" onPress={() => void startCall(username, false).catch((e) => setErr(String(e?.message ?? e)))} hitSlop={4} style={{ width: 34, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Glyph.Phone color={c.text} size={19} />
                  </Pressable>
                </>
              )}
            </BeamGlass>
          </View>
        </View>
        {search !== null ? (
          <BeamGlass c={c} radius={19} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 11 }}>
            <Glyph.Search color={c.text3} />
            <TextInput value={search} onChangeText={setSearch} autoFocus placeholder="Search this chat" placeholderTextColor={c.text3} style={{ flex: 1, color: c.text, fontSize: 15, height: '100%' }} />
            <Pressable onPress={() => setSearch(null)} hitSlop={8}>
              <Text style={{ color: c.blue, fontSize: 15, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </BeamGlass>
        ) : null}
        {pinned && search === null ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Go to pinned message" onPress={() => goToMsg(pinned.id)} onLongPress={() => togglePin(pinned.id)}>
                <BeamGlass c={c} radius={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Glyph.Pin color={c.blue} size={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.blue, fontSize: 11, fontWeight: '700' }}>{pins.length > 1 ? `PINNED · ${pins.length}` : 'PINNED'}</Text>
                    <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={1}>
                      {plain(pinned)}
                    </Text>
                  </View>
                </BeamGlass>
              </Pressable>
        ) : null}
        {meta.ttl ? (
          <Pressable onPress={() => setContactOpen(true)} style={{ alignSelf: 'center' }}>
            <BeamGlass c={c} radius={12} clear style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: c.text2, fontSize: 12 }}>{`Disappearing messages: ${TTL_OPTIONS.find(([, ms]) => ms === meta.ttl)?.[0] ?? 'on'}`}</Text>
            </BeamGlass>
          </Pressable>
        ) : null}
      </View>
      </View>

      <View style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: (onBack ? Math.max(insets.bottom - 8, 0) : 0) + 10, gap: 6 }}>
        {busy ? (
          <BeamGlass c={c} radius={11} clear style={{ alignSelf: 'center', paddingHorizontal: 11, paddingVertical: 3 }}>
            <Text style={{ color: c.text2, fontSize: 12 }}>{busy}</Text>
          </BeamGlass>
        ) : null}
        {blocked ? (
          <BeamGlass c={c} radius={24} style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: c.text2, fontSize: 14 }}>{`You blocked ${username}. Tap their name to unblock.`}</Text>
          </BeamGlass>
        ) : (
          <>
            {reply || editing ? (
              <BeamGlass c={c} radius={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 48 }}>
                <Glyph.Reply color={c.blue} />
                <Text style={{ flex: 1, color: c.text2, fontSize: 13 }} numberOfLines={1}>
                  {editing ? `Editing: ${plain(editing)}` : `Replying to ${reply!.mine ? 'yourself' : username}: ${plain(reply!)}`}
                </Text>
                <Pressable
                  accessibilityLabel="Cancel"
                  hitSlop={8}
                  onPress={() => {
                    if (editing) setText('');
                    setReply(null);
                    setEditing(null);
                  }}>
                  <Glyph.Close color={c.text3} size={14} />
                </Pressable>
              </BeamGlass>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <GlassButton c={c} label="Attach" size={42} onPress={() => setSheet('attach')}>
                <Glyph.Plus color={c.text} />
              </GlassButton>
              <BeamGlass c={c} radius={21} interactive style={{ flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'flex-end' }}>
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
                  style={{ flex: 1, color: c.text, fontSize: st.textSize, lineHeight: 20, paddingLeft: 15, paddingRight: 8, paddingTop: 11, paddingBottom: 11, maxHeight: 140 }}
                  accessibilityLabel="Message"
                />
                {text.trim() ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => void sendText()} disabled={!!busy} style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, margin: 5, backgroundColor: pressed ? '#0a6fd8' : c.blue, alignItems: 'center', justifyContent: 'center' })}>
                    <Glyph.Up color="#fff" />
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel="Camera" onPress={() => void attach('camera')} style={{ width: 32, height: 32, margin: 5, alignItems: 'center', justifyContent: 'center' }}>
                    <Glyph.Camera color={c.text2} size={20} />
                  </Pressable>
                )}
              </BeamGlass>
            </View>
          </>
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
      <BeamContact
        c={c}
        username={username}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        photos={photos}
        ttl={meta.ttl}
        blocked={blocked}
        onCall={(video) => {
          setContactOpen(false);
          void startCall(username, video).catch((e) => setErr(String(e?.message ?? e)));
        }}
        onSendPhoto={() => {
          setContactOpen(false);
          void attach('photos');
        }}
        onTtl={(ms) => void setDisappearing(username, ms).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't change that."))}
        onPhoto={(uri) => {
          setContactOpen(false);
          setTimeout(() => setPhoto({ uri }), 350);
        }}
        onBlock={() => {
          setContactOpen(false);
          setTimeout(toggleBlock, 350);
        }}
        bg={chatBg}
        onBg={(v) => setChatBg(username, v)}
        onBgPhoto={() =>
          void getBackgroundPhoto()
            .then((d) => d && setChatBg(username, d))
            .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't use that photo."))
        }
      />
    </KeyboardAvoidingView>
  );
}

function Body({
  c,
  m,
  runStart,
  runEnd,
  now,
  onVote,
  onPhoto,
  onOnce,
  onVideo,
}: {
  c: BeamPalette;
  m: Folded;
  runStart: boolean;
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
  // Grouped corners: messages in a run share tight inner corners on the sender's side, and the
  // last one keeps a small corner there as the "tail". Big radius everywhere else.
  const BIG = 20;
  const SMALL = 6;
  const near = (joined: boolean) => (joined ? SMALL : BIG);
  const corners = m.mine
    ? { borderTopLeftRadius: BIG, borderBottomLeftRadius: BIG, borderTopRightRadius: near(!runStart), borderBottomRightRadius: runEnd ? SMALL : near(true) }
    : { borderTopRightRadius: BIG, borderBottomRightRadius: BIG, borderTopLeftRadius: near(!runStart), borderBottomLeftRadius: runEnd ? SMALL : near(true) };
  const bubble = (child: React.ReactNode, pad = true) => (
    <View
      style={{
        backgroundColor: bg,
        ...corners,
        overflow: 'hidden',
        ...(pad ? { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 9 } : null),
        ...(m.mine ? null : { borderWidth: c.dark ? 0 : 0.5, borderColor: 'rgba(0,0,0,0.06)' }),
        shadowColor: '#000',
        shadowOpacity: c.dark ? 0 : 0.06,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      }}>
      {child}
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
        <Text style={{ color: fg, fontSize: st.textSize, lineHeight: st.textSize * 1.3, letterSpacing: -0.1 }}>
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
      // Chess Buddy style invite: green board color, the two kings, a big Play button.
      return (
        <Pressable onPress={() => router.push({ pathname: '/chess', params: { g: r.g } })} style={{ width: 236, borderRadius: 20, padding: 14, backgroundColor: '#58B92E', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#EFF3D9', borderRadius: 12, padding: 4 }}>
              <Piece type="k" color="w" size={30} />
              <Piece type="k" color="b" size={30} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6 }}>CHESS</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{m.mine ? 'You started a game' : 'Wants to play!'}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 9, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#3F921B' }}>
            <Text style={{ color: '#3F921B', fontSize: 15, fontWeight: '900' }}>Play</Text>
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
