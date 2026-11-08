/** Pop-up sheets for a Beam chat: attach menu, poll + countdown makers, message actions, viewers. */
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Glyph, type BeamPalette } from '@/components/beam-ui';
import { REACTIONS, STICKERS } from '@/lib/beam-msg';

function Sheet({ c, open, onClose, children }: { c: BeamPalette; open: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 520, backgroundColor: c.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: insets.bottom + 16 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.search, marginBottom: 12 }} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type AttachKind = 'camera' | 'photos' | 'once' | 'video' | 'record' | 'poll' | 'countdown' | 'sticker';

const ATTACH: { k: AttachKind; label: string; tint: string; icon: keyof typeof Glyph }[] = [
  { k: 'camera', label: 'Camera', tint: '#8e8e93', icon: 'Camera' },
  { k: 'photos', label: 'Photos', tint: '#0b84fe', icon: 'Photo' },
  { k: 'once', label: 'One-time photo', tint: '#ff9f0a', icon: 'Once' },
  { k: 'video', label: 'Video', tint: '#bf5af2', icon: 'Play' },
  { k: 'record', label: 'Record video', tint: '#ff375f', icon: 'Video' },
  { k: 'poll', label: 'Poll', tint: '#30d158', icon: 'Poll' },
  { k: 'countdown', label: 'Countdown', tint: '#64d2ff', icon: 'Timer' },
  { k: 'sticker', label: 'Stickers', tint: '#ffd60a', icon: 'Smile' },
];

export function AttachSheet({ c, open, onClose, onPick }: { c: BeamPalette; open: boolean; onClose: () => void; onPick: (k: AttachKind) => void }) {
  return (
    <Sheet c={c} open={open} onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
        {ATTACH.map((a) => {
          const I = Glyph[a.icon];
          return (
            <Pressable key={a.k} onPress={() => onPick(a.k)} style={{ width: '25%', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: a.tint, alignItems: 'center', justifyContent: 'center' }}>
                <I color="#fff" size={24} />
              </View>
              <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

export function StickerSheet({ c, open, onClose, onPick }: { c: BeamPalette; open: boolean; onClose: () => void; onPick: (e: string) => void }) {
  return (
    <Sheet c={c} open={open} onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {STICKERS.map((e) => (
          <Pressable key={e} onPress={() => onPick(e)} style={{ width: '16.66%', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 34 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

function Field({ c, ...p }: { c: BeamPalette } & React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={c.text3} {...p} style={{ color: c.text, fontSize: 16, backgroundColor: c.search, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }} />;
}
function Btn({ c, label, onPress, off }: { c: BeamPalette; label: string; onPress: () => void; off?: boolean }) {
  return (
    <Pressable disabled={off} onPress={onPress} style={{ backgroundColor: c.blue, opacity: off ? 0.4 : 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function PollSheet({ c, open, onClose, onSend }: { c: BeamPalette; open: boolean; onClose: () => void; onSend: (q: string, o: string[], multi: boolean) => void }) {
  const [q, setQ] = useState('');
  const [o, setO] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const opts = o.map((x) => x.trim()).filter(Boolean);
  return (
    <Sheet c={c} open={open} onClose={onClose}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 10 }}>New poll</Text>
      <View style={{ gap: 8 }}>
        <Field c={c} value={q} onChangeText={setQ} placeholder="Ask a question" maxLength={120} />
        {o.map((v, i) => (
          <Field key={i} c={c} value={v} onChangeText={(t) => setO((p) => p.map((x, j) => (j === i ? t : x)))} placeholder={`Option ${i + 1}`} maxLength={60} />
        ))}
        {o.length < 6 ? (
          <Pressable onPress={() => setO((p) => [...p, ''])}>
            <Text style={{ color: c.blue, fontSize: 15, paddingVertical: 4 }}>Add option</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setMulti(!multi)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.blue, backgroundColor: multi ? c.blue : 'transparent' }} />
          <Text style={{ color: c.text, fontSize: 15 }}>Allow more than one answer</Text>
        </Pressable>
        <Btn
          c={c}
          label="Send poll"
          off={!q.trim() || opts.length < 2}
          onPress={() => {
            onSend(q.trim(), opts, multi);
            setQ('');
            setO(['', '']);
            setMulti(false);
          }}
        />
      </View>
    </Sheet>
  );
}

const PRESETS: [string, number][] = [
  ['1 hour', 3600_000],
  ['Tonight 9 PM', -1],
  ['1 day', 86400_000],
  ['1 week', 7 * 86400_000],
];

export function CountdownSheet({ c, open, onClose, onSend }: { c: BeamPalette; open: boolean; onClose: () => void; onSend: (t: string, at: number) => void }) {
  const [t, setT] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const valid = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(date.trim());
  const custom = () => {
    const m = date.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return null;
    const now = new Date();
    let y = m[3] ? Number(m[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    const tm = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    let h = tm ? Number(tm[1]) : 9;
    if (tm?.[3]) h = (h % 12) + (tm[3].toLowerCase() === 'pm' ? 12 : 0);
    const d = new Date(y, Number(m[1]) - 1, Number(m[2]), h, tm?.[2] ? Number(tm[2]) : 0);
    return d.getTime() > Date.now() ? d.getTime() : null;
  };
  const go = (at: number) => {
    onSend(t.trim() || 'Countdown', at);
    setT('');
    setDate('');
    setTime('');
  };
  return (
    <Sheet c={c} open={open} onClose={onClose}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 10 }}>New countdown</Text>
      <View style={{ gap: 8 }}>
        <Field c={c} value={t} onChangeText={setT} placeholder="What's happening? (Summer break, game, ...)" maxLength={60} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map(([label, ms]) => (
            <Pressable
              key={label}
              onPress={() => {
                if (ms > 0) return go(Date.now() + ms);
                const d = new Date();
                d.setHours(21, 0, 0, 0);
                if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
                go(d.getTime());
              }}
              style={{ backgroundColor: c.search, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: c.text, fontSize: 14 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: c.text2, fontSize: 13, marginTop: 4 }}>Or pick a date</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field c={c} value={date} onChangeText={setDate} placeholder="6/20" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Field c={c} value={time} onChangeText={setTime} placeholder="3:30 pm" />
          </View>
        </View>
        <Btn c={c} label="Start countdown" off={!valid} onPress={() => {
            const at = custom();
            if (at) go(at);
          }} />
      </View>
    </Sheet>
  );
}

export function ActionSheet({
  c,
  open,
  onClose,
  preview,
  actions,
  onReact,
}: {
  c: BeamPalette;
  open: boolean;
  onClose: () => void;
  preview: string;
  actions: { label: string; red?: boolean; run: () => void }[];
  onReact: (e: string) => void;
}) {
  return (
    <Sheet c={c} open={open} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: c.search, borderRadius: 30, paddingVertical: 8, marginBottom: 12 }}>
        {REACTIONS.map((e) => (
          <Pressable key={e} onPress={() => onReact(e)} hitSlop={4}>
            <Text style={{ fontSize: 28 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: c.text2, fontSize: 13, marginBottom: 8 }} numberOfLines={2}>
        {preview}
      </Text>
      <View style={{ backgroundColor: c.search, borderRadius: 14, overflow: 'hidden' }}>
        {actions.map((a, i) => (
          <Pressable key={a.label} onPress={a.run} style={({ pressed }) => ({ paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: i ? 0.5 : 0, borderTopColor: c.hairline, backgroundColor: pressed ? c.rowPress : 'transparent' })}>
            <Text style={{ color: a.red ? c.red : c.text, fontSize: 16 }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

/** Full-screen photo. With `seconds`, it is a one-time view that closes itself. */
export function PhotoViewer({ uri, seconds, onClose }: { uri: string | null; seconds?: number; onClose: () => void }) {
  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onClose} transparent>
      {uri ? <PhotoBody key={uri} uri={uri} seconds={seconds} onClose={onClose} /> : null}
    </Modal>
  );
}

function PhotoBody({ uri, seconds, onClose }: { uri: string; seconds?: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (!seconds) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  useEffect(() => {
    if (seconds && left <= 0) onClose();
  }, [left, seconds, onClose]);
  return (
    <>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        <View style={{ position: 'absolute', top: insets.top + 10, right: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {seconds ? (
            <View style={{ minWidth: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{Math.max(0, left)}</Text>
            </View>
          ) : null}
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Glyph.Close color="#fff" />
          </View>
        </View>
        {seconds ? <Text style={{ position: 'absolute', bottom: insets.bottom + 20, alignSelf: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>One-time photo. It disappears when you close it.</Text> : null}
      </Pressable>
    </>
  );
}

export function VideoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (url && Platform.OS === 'web') {
      void Linking.openURL(url);
      onClose();
    }
  }, [url, onClose]);
  if (Platform.OS === 'web') return null;
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><video src="${url ?? ''}" controls autoplay playsinline style="width:100%;max-height:100%"></video></body>`;
  return (
    <Modal visible={!!url} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {url ? <WebView source={{ html }} style={{ flex: 1, backgroundColor: '#000' }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} /> : null}
        <Pressable onPress={onClose} hitSlop={10} style={{ position: 'absolute', top: insets.top + 10, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Glyph.Close color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

