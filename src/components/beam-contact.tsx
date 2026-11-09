/** Contact info, like WhatsApp: picture, quick actions, disappearing messages, photos from the chat, block. */
import { Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamAvatar, Glyph, type BeamPalette } from '@/components/beam-ui';
import { ChatBackground, CHAT_BGS, Swatch } from '@/components/chat-background';
import { TTL_OPTIONS } from '@/lib/beam-extra';

export function BeamContact({
  c,
  username,
  open,
  onClose,
  photos,
  ttl,
  blocked,
  onCall,
  onSendPhoto,
  onTtl,
  onPhoto,
  onBlock,
  bg,
  onBg,
  onBgPhoto,
}: {
  c: BeamPalette;
  username: string;
  open: boolean;
  onClose: () => void;
  /** every photo in this chat, newest first */
  photos: string[];
  ttl: number;
  blocked: boolean;
  onCall: (video: boolean) => void;
  onSendPhoto: () => void;
  onTtl: (ms: number) => void;
  onPhoto: (uri: string) => void;
  onBlock: () => void;
  /** this chat's background ("" = none) */
  bg: string;
  onBg: (v: string) => void;
  onBgPhoto: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cell = (Math.min(width, 600) - 32 - 8) / 3;

  const action = (label: string, icon: React.ReactNode, onPress: () => void, off = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={off} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: c.card, opacity: off ? 0.35 : pressed ? 0.6 : 1 })}>
      {icon}
      <Text style={{ color: c.blue, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  const label = (t: string) => <Text style={{ color: c.text3, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 4, marginBottom: 6 }}>{t.toUpperCase()}</Text>;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.sidebar }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text style={{ flex: 1, color: c.text, fontSize: 17, fontWeight: '700', textAlign: 'center', marginLeft: 50 }}>Contact info</Text>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 50, alignItems: 'flex-end' }}>
            <Text style={{ color: c.blue, fontSize: 17, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <BeamAvatar name={username} size={110} />
            <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>{username}</Text>
            <Text style={{ color: c.text3, fontSize: 14 }}>{`@${username}`}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {action('Message', <Glyph.Bubble color={c.blue} size={22} />, onClose)}
            {action('Audio', <Glyph.Phone color={c.blue} size={21} />, () => onCall(false), blocked)}
            {action('Video', <Glyph.Video color={c.blue} size={24} />, () => onCall(true), blocked)}
            {action('Photo', <Glyph.Photo color={c.blue} size={22} />, onSendPhoto, blocked)}
          </View>

          <View>
            {label('Disappearing messages')}
            <View style={{ backgroundColor: c.card, borderRadius: 14, overflow: 'hidden' }}>
              {TTL_OPTIONS.map(([name, ms], i) => (
                <Pressable key={ms} onPress={() => onTtl(ms)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 0.5 : 0, borderTopColor: c.hairline, backgroundColor: pressed ? c.rowPress : 'transparent' })}>
                  <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{name}</Text>
                  {ttl === ms ? <Text style={{ color: c.blue, fontSize: 17, fontWeight: '700' }}>✓</Text> : null}
                </Pressable>
              ))}
            </View>
            <Text style={{ color: c.text3, fontSize: 12.5, paddingHorizontal: 4, marginTop: 6, lineHeight: 17 }}>
              {ttl ? 'New and old messages in this chat disappear after the time you picked. Both of you see this setting.' : 'Messages stay until someone unsends them.'}
            </Text>
          </View>

          <View>
            {label('Chat background')}
            <View style={{ backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 12 }}>
              <View style={{ height: 90, borderRadius: 12, overflow: 'hidden', backgroundColor: c.chatBg, borderWidth: 0.5, borderColor: c.hairline }}>
                <ChatBackground value={bg} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Pressable accessibilityLabel="No background" onPress={() => onBg('')} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: bg ? 1 : 3, borderColor: bg ? c.hairline : c.text, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: c.text3, fontSize: 10, fontWeight: '700' }}>NONE</Text>
                </Pressable>
                {CHAT_BGS.map((b) => (
                  <Pressable key={b.id} accessibilityLabel={`${b.label} background`} onPress={() => onBg(b.id)} style={{ borderRadius: 22, borderWidth: bg === b.id ? 3 : 0, borderColor: c.text, padding: bg === b.id ? 1 : 0 }}>
                    <Swatch id={b.id} size={bg === b.id ? 34 : 40} />
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={onBgPhoto} style={({ pressed }) => ({ paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: c.search, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ color: c.blue, fontSize: 15, fontWeight: '600' }}>{bg.startsWith('data:') ? 'Choose a different photo' : 'Use a photo'}</Text>
              </Pressable>
            </View>
            <Text style={{ color: c.text3, fontSize: 12.5, paddingHorizontal: 4, marginTop: 6 }}>Only you see this background.</Text>
          </View>

          <View>
            {label(`Photos${photos.length ? `  ${photos.length}` : ''}`)}
            {photos.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {photos.slice(0, 60).map((p, i) => (
                  <Pressable key={i} onPress={() => onPhoto(p)}>
                    <Image source={{ uri: p }} style={{ width: cell, height: cell, borderRadius: 8, backgroundColor: c.search }} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={{ color: c.text3, fontSize: 14, paddingHorizontal: 4 }}>No photos in this chat yet.</Text>
            )}
          </View>

          <Pressable onPress={onBlock} style={({ pressed }) => ({ backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: blocked ? c.blue : c.red, fontSize: 16 }}>{blocked ? `Unblock ${username}` : `Block ${username}`}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
