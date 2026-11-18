/**
 * Pieces of a Beam chat: formatted message text (*bold* _italic_ ~strike~ `code`, tappable
 * links), link preview cards, swipe-to-reply, and the animated typing dots.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, Text, View, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { tap } from '@/components/ui';
import { Glyph, type BeamPalette } from '@/components/beam-ui';

const URL_RE = /(https?:\/\/[^\s]+)/g;
const FMT_RE = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

function formatted(part: string, key: string, base: TextStyle): ReactNode[] {
  return part.split(FMT_RE).map((seg, i) => {
    const k = `${key}-${i}`;
    if (seg.length > 2) {
      const a = seg[0];
      const inner = seg.slice(1, -1);
      if (a === '*' && seg.endsWith('*')) return <Text key={k} style={{ fontWeight: '700' }}>{inner}</Text>;
      if (a === '_' && seg.endsWith('_')) return <Text key={k} style={{ fontStyle: 'italic' }}>{inner}</Text>;
      if (a === '~' && seg.endsWith('~')) return <Text key={k} style={{ textDecorationLine: 'line-through' }}>{inner}</Text>;
      if (a === '`' && seg.endsWith('`'))
        return (
          <Text key={k} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: (base.fontSize ?? 16) - 1 }}>
            {inner}
          </Text>
        );
    }
    return seg;
  });
}

/** Message text with formatting and links. */
export function RichText({ text, style }: { text: string; style: TextStyle }) {
  return (
    <Text style={style}>
      {text.split(URL_RE).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Text key={i} style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(part).catch(() => {})}>
            {part}
          </Text>
        ) : (
          formatted(part, String(i), style)
        )
      )}
    </Text>
  );
}

export const firstUrl = (t: string) => t.match(URL_RE)?.[0] ?? null;

/* ---------- link previews ---------- */
interface Card {
  title: string;
  site: string;
  image: string;
}
const cards = new Map<string, Promise<Card | null>>();
const meta = (html: string, prop: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')) ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return m?.[1] ?? '';
};
const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function loadCard(url: string): Promise<Card | null> {
  let p = cards.get(url);
  if (!p) {
    p = (async () => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      try {
        const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'text/html' } });
        const html = (await r.text()).slice(0, 200_000);
        const title = unescape(meta(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
        if (!title) return null;
        let image = meta(html, 'og:image');
        if (image && !/^https?:/.test(image)) image = new URL(image, url).toString();
        return { title: title.slice(0, 120), site: unescape(meta(html, 'og:site_name')) || new URL(url).hostname.replace(/^www\./, ''), image: image.startsWith('https') ? image : '' };
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    })();
    cards.set(url, p);
  }
  return p;
}

/** A small card under a message with a link (native only; the web blocks reading other sites). */
export function LinkPreview({ url, c, mine }: { url: string; c: BeamPalette; mine: boolean }) {
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let dead = false;
    void loadCard(url).then((x) => !dead && setCard(x));
    return () => {
      dead = true;
    };
  }, [url]);
  if (!card) return null;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={card.title} onPress={() => void Linking.openURL(url).catch(() => {})} style={{ width: 240, marginTop: 4, borderRadius: 16, overflow: 'hidden', backgroundColor: c.card, borderWidth: 0.5, borderColor: c.hairline, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
      {card.image ? <Image source={{ uri: card.image }} style={{ width: 240, height: 126 }} resizeMode="cover" /> : null}
      <View style={{ padding: 10, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
          {card.title}
        </Text>
        <Text style={{ color: c.text3, fontSize: 12 }} numberOfLines={1}>
          {card.site}
        </Text>
      </View>
    </Pressable>
  );
}

/* ---------- swipe to reply ---------- */
const EASE = Easing.bezier(0.25, 0.9, 0.3, 1);
export function SwipeToReply({ enabled, haptics, onReply, children, c }: { enabled: boolean; haptics: boolean; onReply: () => void; children: ReactNode; c: BeamPalette }) {
  const x = useSharedValue(0);
  const fired = useSharedValue(0);
  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(enabled)
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const v = Math.max(0, Math.min(72, e.translationX * 0.6));
      x.set(v);
      if (v > 54 && !fired.value) {
        fired.set(1);
        if (haptics) tap();
      }
    })
    .onEnd(() => {
      if (fired.value) onReply();
    })
    .onFinalize(() => {
      fired.set(0);
      x.set(withTiming(0, { duration: 220, easing: EASE }));
    });
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const icon = useAnimatedStyle(() => ({ opacity: Math.min(1, x.value / 54), transform: [{ translateX: x.value / 2 - 20 }] }));
  return (
    <GestureDetector gesture={pan}>
      <View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }, icon]}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.search, alignItems: 'center', justifyContent: 'center' }}>
            <Glyph.Reply color={c.text2} size={15} />
          </View>
        </Animated.View>
        <Animated.View style={row}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

/* ---------- typing dots ---------- */
function Dot({ c, delay }: { c: BeamPalette; delay: number }) {
  const v = useSharedValue(0.35);
  useEffect(() => {
    v.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.35, { duration: 380 })), -1)));
  }, [delay, v]);
  const st = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.text3 }, st]} />;
}
export function TypingDots({ c }: { c: BeamPalette }) {
  return (
    <View accessibilityLabel="Typing" style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 4, backgroundColor: c.inBubble, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 }}>
      <Dot c={c} delay={0} />
      <Dot c={c} delay={160} />
      <Dot c={c} delay={320} />
    </View>
  );
}
