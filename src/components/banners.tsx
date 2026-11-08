/**
 * Small banners under the countdown: a running focus timer, and the next countdown once it
 * is 30 days away or closer. Plain pills, no motion; tap to open the tool.
 */
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { TYPE } from '@/lib/fonts';
import { useRealNow } from '@/lib/hooks';
import { daysBetween, usePlanner } from '@/lib/planner';
import { sz } from '@/lib/scale';
import { alpha, type Theme } from '@/lib/themes';
import { focusLeft, useTools } from '@/lib/tools';

import { tap } from './ui';

const SOON_DAYS = 30;

export function ClockBanners({ theme, today }: { theme: Theme; today: string }) {
  const focus = useTools((t) => t.focus);
  const countdowns = usePlanner((p) => p.countdowns);
  const realNow = useRealNow();

  const items: { key: string; text: string; go: '/focus' | '/planner'; accent?: boolean }[] = [];
  if (focus.mode !== 'idle') {
    const s = Math.ceil(focusLeft(focus, realNow) / 1000);
    const mm = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    items.push({ key: 'focus', text: `${focus.mode === 'break' ? 'Break' : focus.pausedLeft != null ? 'Focus paused' : 'Focusing'} · ${mm}`, go: '/focus', accent: true });
  }
  const next = countdowns.find((c) => c.date >= today);
  if (next) {
    const n = daysBetween(today, next.date);
    if (n <= SOON_DAYS) items.push({ key: 'cd', text: `${next.emoji} ${next.title} · ${n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days`}`, go: '/planner' });
  }
  if (!items.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          accessibilityRole="button"
          accessibilityLabel={it.text}
          onPress={() => {
            tap();
            router.push(it.go);
          }}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: it.accent ? alpha(theme.accent, pressed ? 0.3 : 0.18) : alpha(theme.ink, pressed ? 0.16 : 0.08),
            borderWidth: 1,
            borderColor: it.accent ? alpha(theme.accent, 0.45) : alpha(theme.ink, 0.1),
          })}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: theme.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {it.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
