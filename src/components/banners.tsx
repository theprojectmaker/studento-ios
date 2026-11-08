/**
 * Quiet strip under the top chrome: a running focus timer, and the next countdown once it is
 * 30 days away or closer. Text only, no emoji, no motion. Tap opens the tool, except while
 * the clock is locked (focus lock), when the strip is read-only.
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

interface Item {
  key: string;
  label: string;
  value: string;
  go: '/focus' | '/planner';
  accent?: boolean;
}

export function ClockBanners({ theme, today, locked = false }: { theme: Theme; today: string; locked?: boolean }) {
  const focus = useTools((t) => t.focus);
  const countdowns = usePlanner((p) => p.countdowns);
  const realNow = useRealNow();

  const items: Item[] = [];
  if (focus.mode !== 'idle') {
    const s = Math.ceil(focusLeft(focus, realNow) / 1000);
    const mm = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    items.push({ key: 'focus', label: focus.mode === 'break' ? 'Break' : focus.pausedLeft != null ? 'Paused' : 'Focus', value: mm, go: '/focus', accent: focus.mode === 'focus' && focus.pausedLeft == null });
  }
  const next = countdowns.find((c) => c.date >= today);
  if (next) {
    const n = daysBetween(today, next.date);
    if (n <= SOON_DAYS) items.push({ key: 'cd', label: next.title, value: n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days`, go: '/planner' });
  }
  if (!items.length) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          disabled={locked}
          accessibilityRole={locked ? undefined : 'button'}
          accessibilityLabel={`${it.label} ${it.value}`}
          onPress={() => {
            tap();
            router.push(it.go);
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: sz(10),
            backgroundColor: alpha(theme.ink, pressed && !locked ? 0.12 : 0.06),
          })}>
          {it.accent ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent }} /> : null}
          <Text style={{ ...TYPE.semibold, fontSize: sz(11), letterSpacing: 0.8, color: theme.muted }} numberOfLines={1}>
            {it.label.toUpperCase()}
          </Text>
          <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: theme.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {it.value}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
