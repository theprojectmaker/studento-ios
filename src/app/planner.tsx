/** Countdowns to big days. Stored on this phone. */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Button, Field, Note, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useNow, useTheme } from '@/lib/hooks';
import { fmtDate, nyParts } from '@/lib/nytime';
import { addCountdown, daysBetween, deleteCountdown, usePlanner } from '@/lib/planner';
import { useSchedule } from '@/lib/store';
import { schoolDaysBetween } from '@/lib/calc';
import { alpha, readableOn } from '@/lib/themes';
import { parseDate } from '@/lib/timeinput';
import { sz } from '@/lib/scale';

const EMOJI = ['🎉', '🏖️', '🎄', '📚', '🎂', '✈️', '🏆', '🎓'];

export default function PlannerScreen() {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <CountdownTab />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function CountdownTab() {
  const theme = useTheme();
  const now = useNow();
  const today = nyParts(now).date;
  const countdowns = usePlanner((p) => p.countdowns);
  const sched = useSchedule();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    const d = parseDate(date, Number(today.slice(0, 4)));
    if (!title.trim()) return setErr('Give it a name.');
    if (!d) return setErr('Date should look like 12/22 or 2026-12-22.');
    if (d < today) return setErr('Pick today or a later date.');
    addCountdown({ title: title.trim().slice(0, 60), date: d, emoji });
    setTitle('');
    setDate('');
    setErr(null);
  };

  return (
    <>
      {countdowns.map((c) => {
        const n = daysBetween(today, c.date);
        const sd = n > 0 ? schoolDaysBetween(today, c.date, sched.data) : 0;
        return (
          <Animated.View key={c.id} entering={FadeInDown.duration(300)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
            <View style={{ backgroundColor: theme.panel, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: sz(34) }}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.semibold, fontSize: sz(17), color: theme.ink }}>{c.title}</Text>
                <Text style={{ ...TYPE.regular, fontSize: sz(13), color: theme.muted }}>{n > 0 ? `${fmtDate(c.date)} · ${sd} school ${sd === 1 ? 'day' : 'days'}` : fmtDate(c.date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...TYPE.heavy, fontSize: sz(34), color: n <= 0 ? theme.accent : theme.ink, fontVariant: ['tabular-nums'] }}>{Math.max(0, n)}</Text>
                <Text style={{ ...TYPE.medium, fontSize: sz(12), color: theme.muted }}>{n <= 0 ? 'today!' : n === 1 ? 'day' : 'days'}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${c.title}`} hitSlop={10} onPress={() => deleteCountdown(c.id)}>
                <Text style={{ fontSize: sz(20), color: alpha(theme.ink, 0.35) }}>×</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })}
      <Section title="New countdown" footer="Winter break, a test, a birthday: anything you're counting down to.">
        <View style={{ padding: 14, gap: 12 }}>
          <Chips>
            {EMOJI.map((e) => (
              <Chip key={e} label={e} on={emoji === e} onPress={() => setEmoji(e)} />
            ))}
          </Chips>
          <Field value={title} onChangeText={setTitle} placeholder="e.g. Winter break" accessibilityLabel="Countdown name" />
          <Field value={date} onChangeText={setDate} placeholder="Date, e.g. 12/22" accessibilityLabel="Countdown date" autoCapitalize="none" />
          {err ? <Note tone="error">{err}</Note> : null}
          <Button title="Add countdown" onPress={add} />
        </View>
      </Section>
    </>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? theme.accent : alpha(theme.ink, 0.08) }}>
      <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: on ? readableOn(theme.accent) : theme.ink }}>{label}</Text>
    </Pressable>
  );
}
