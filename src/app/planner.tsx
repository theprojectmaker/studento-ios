/** Planner: homework (by class and due date) and countdowns to big days. Stored on this phone. */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button, Divider, Field, Note, Screen, Section, Segmented, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useNow, useTheme } from '@/lib/hooks';
import { addDays, fmtDate, nyParts, weekdayOf } from '@/lib/nytime';
import {
  addCountdown,
  addHomework,
  clearDoneHomework,
  daysBetween,
  deleteCountdown,
  deleteHomework,
  toggleHomework,
  usePlanner,
  type Homework,
} from '@/lib/planner';
import { useClasses, useSchedule } from '@/lib/store';
import { schoolDaysBetween } from '@/lib/calc';
import { alpha, readableOn } from '@/lib/themes';
import { parseDate } from '@/lib/timeinput';
import { sz } from '@/lib/scale';

const EMOJI = ['🎉', '🏖️', '🎄', '📚', '🎂', '✈️', '🏆', '🎓'];

export default function PlannerScreen() {
  const [tab, setTab] = useState<'homework' | 'countdowns'>('homework');
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Segmented
          value={tab}
          options={[
            { value: 'homework', label: 'Homework' },
            { value: 'countdowns', label: 'Countdowns' },
          ]}
          onChange={setTab}
        />
        {tab === 'homework' ? <HomeworkTab /> : <CountdownTab />}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function classLabel(id: string, names: Record<string, string>) {
  if (!id) return '';
  return names[id] || (id === 'advisory' ? 'Advisory' : `Period ${id}`);
}

function dueLabel(due: string, today: string) {
  if (!due) return 'No date';
  const n = daysBetween(today, due);
  if (n < 0) return n === -1 ? 'Overdue · yesterday' : `Overdue · ${-n} days`;
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `Due ${fmtDate(due).replace(/,.*$/, '')}${n > 6 ? ` · ${fmtDate(due).split(', ')[1]}` : ''}`;
}

function HomeworkTab() {
  const theme = useTheme();
  const now = useNow();
  const today = nyParts(now).date;
  const { ids: classIds, names } = useClasses();
  const homework = usePlanner((p) => p.homework);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');
  const [due, setDue] = useState(addDays(today, 1));

  const days = Array.from({ length: 9 }, (_, i) => addDays(today, i)).filter((d) => !['Sat', 'Sun'].includes(weekdayOf(d))).slice(0, 5);
  const open = homework.filter((h) => !h.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = homework.filter((h) => h.done);

  const add = () => {
    if (!title.trim()) return;
    addHomework({ title: title.trim().slice(0, 120), period, due });
    setTitle('');
  };

  return (
    <>
      <Section title="Add homework">
        <View style={{ padding: 14, gap: 12 }}>
          <Field value={title} onChangeText={setTitle} placeholder="e.g. Finish lab report" onSubmitEditing={add} returnKeyType="done" accessibilityLabel="Homework" />
          <Chips>
            <Chip label="No class" on={period === ''} onPress={() => setPeriod('')} />
            {classIds.map((id) => (
              <Chip key={id} label={classLabel(id, names)} on={period === id} onPress={() => setPeriod(id)} />
            ))}
          </Chips>
          <Chips>
            {days.map((d) => (
              <Chip key={d} label={d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : fmtDate(d).slice(0, 3)} on={due === d} onPress={() => setDue(d)} />
            ))}
            <Chip label="No date" on={due === ''} onPress={() => setDue('')} />
          </Chips>
          <Button title="Add" onPress={add} disabled={!title.trim()} />
        </View>
      </Section>

      <Section title={open.length ? `To do · ${open.length}` : 'To do'}>
        {open.length ? (
          open.map((h, i) => (
            <Animated.View key={h.id} entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
              {i ? <Divider inset={56} /> : null}
              <HwRow h={h} today={today} names={names} />
            </Animated.View>
          ))
        ) : (
          <Text style={{ ...TYPE.regular, fontSize: sz(15), color: theme.muted, padding: 16 }}>Nothing due. Nice.</Text>
        )}
      </Section>

      {done.length ? (
        <>
          <Section title={`Done · ${done.length}`}>
            {done.map((h, i) => (
              <Animated.View key={h.id} entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)} layout={LinearTransition}>
                {i ? <Divider inset={56} /> : null}
                <HwRow h={h} today={today} names={names} />
              </Animated.View>
            ))}
          </Section>
          <Button title="Clear done" kind="plain" onPress={clearDoneHomework} />
        </>
      ) : null}
    </>
  );
}

function HwRow({ h, today, names }: { h: Homework; today: string; names: Record<string, string> }) {
  const theme = useTheme();
  const overdue = !h.done && h.due && h.due < today;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: h.done }}
        accessibilityLabel={h.title}
        hitSlop={8}
        onPress={() => {
          tap();
          toggleHomework(h.id);
        }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: h.done ? theme.accent : alpha(theme.ink, 0.3),
          backgroundColor: h.done ? theme.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {h.done ? (
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={readableOn(theme.accent)} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...TYPE.medium, fontSize: sz(16), color: theme.ink, textDecorationLine: h.done ? 'line-through' : 'none', opacity: h.done ? 0.5 : 1 }}>{h.title}</Text>
        <Text style={{ ...TYPE.regular, fontSize: sz(13), color: overdue ? '#ff6b5e' : theme.muted }}>
          {[classLabel(h.period, names), dueLabel(h.due, today)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${h.title}`} hitSlop={10} onPress={() => deleteHomework(h.id)}>
        <Text style={{ fontSize: sz(20), color: alpha(theme.ink, 0.35) }}>×</Text>
      </Pressable>
    </View>
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
