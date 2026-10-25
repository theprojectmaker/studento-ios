/** Today's schedule switch (any of the school's schedules) + dated custom days (assemblies, half days). */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { Button, Divider, Note, Row, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { fmtDate, fmtTime, nyParts } from '@/lib/nytime';
import { scheduleFor, type CustomDay, type OverrideType, type Period, type SchoolDay } from '@/lib/schedule';
import { deleteCustomDay, setOverride, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';

interface Choice {
  key: string;
  id: OverrideType | null;
  label: string;
  sub: string;
  pick?: { scheduleId: number; days: Record<SchoolDay, Period[]> };
}

export default function Schedules() {
  const theme = useTheme();
  const shared = useStore((s) => s.shared);
  const school = useStore((s) => s.school);
  const bellSet = useStore((s) => s.bellSet);
  const sets = useStore((s) => s.schoolSchedules);
  const h24 = useStore((s) => s.prefs.h24);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [today] = useState(() => nyParts(Date.now()).date);
  const todaySched = scheduleFor(today, { customDays: shared.customDays, override: shared.override, bells: bellSet?.days ?? null });
  const dated = shared.customDays.find((d) => d.date === today);
  const ov = shared.override?.date === today ? shared.override : null;
  const active = ov ? (ov.type === 'schedule' ? `s:${ov.scheduleId}` : ov.type) : 'normal';
  const upcoming = shared.customDays.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = shared.customDays.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date));

  // Normal = the chosen schedule; the rest of the school's schedules are one-day switches.
  // Without a school (built-in Great Neck North), the old Assembly/Custom switches remain.
  const choices: Choice[] = [
    { key: 'normal', id: null, label: 'Normal', sub: bellSet ? bellSet.name : 'Regular, or Advisory on Wednesday' },
    ...sets.filter((s) => s.id !== bellSet?.id).map((s) => ({ key: `s:${s.id}`, id: 'schedule' as const, label: s.name, sub: school?.name ?? '', pick: { scheduleId: s.id, days: s.days } })),
    ...(!school || sets.length <= 1
      ? [
          { key: 'assembly', id: 'assembly' as const, label: 'Assembly', sub: 'Period 3 split around the assembly' },
          { key: 'custom', id: 'custom' as const, label: 'Custom', sub: 'The saved custom-day bell times' },
        ]
      : []),
  ];

  const choose = async (c: Choice) => {
    tap();
    setMsg(null);
    await setOverride(c.id, c.pick);
    setMsg({ text: 'Changed for today.', tone: 'ok' });
  };

  const remove = (d: CustomDay) => {
    const go = async () => {
      const err = await deleteCustomDay(d.id);
      setMsg(err ? { text: err, tone: 'error' } : { text: `Deleted ${d.label}.`, tone: 'ok' });
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(`Delete "${d.label}"?`, 'This removes it from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <Screen>
      <Section
        title={`Today · ${fmtDate(today)}`}
        footer={
          dated
            ? `Today uses the custom day "${dated.label}". Delete it below to go back to normal.`
            : todaySched.isSchoolDay
              ? 'Goes back to Normal tomorrow by itself.'
              : 'No school today, so there is nothing to switch.'
        }>
        {choices.map((c, i) => {
          const on = active === c.key;
          return (
            <View key={c.key}>
              {i ? <Divider /> : null}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !!dated || !todaySched.isSchoolDay }}
                disabled={!!dated || !todaySched.isSchoolDay}
                onPress={() => void choose(c)}
                style={({ pressed }) => ({ opacity: dated || !todaySched.isSchoolDay ? 0.45 : 1, backgroundColor: pressed ? alpha(theme.ink, 0.06) : 'transparent' })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: on ? theme.accent : alpha(theme.ink, 0.3),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: theme.accent }} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...TYPE.semibold, fontSize: 16, color: theme.ink }}>{c.label}</Text>
                    <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted }}>{c.sub}</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </Section>
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}

      <Section title="Custom days" footer="A custom day replaces the bells on its date. Past days drop off this list on their own.">
        {upcoming.length ? (
          upcoming.map((d, i) => (
            <View key={d.id}>
              {i ? <Divider /> : null}
              <DayRow day={d} h24={h24} onEdit={() => router.push({ pathname: '/schedule-edit', params: { id: d.id } })} onDelete={() => remove(d)} />
            </View>
          ))
        ) : (
          <Row label="No custom days coming up" />
        )}
      </Section>
      <Button title="New custom day" onPress={() => router.push('/schedule-edit')} />

      {past.length ? (
        <Section title="Past custom days">
          {past.slice(0, 8).map((d, i) => (
            <View key={d.id}>
              {i ? <Divider /> : null}
              <DayRow day={d} h24={h24} onEdit={() => router.push({ pathname: '/schedule-edit', params: { copy: d.id } })} editLabel="Reuse" onDelete={() => remove(d)} />
            </View>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function DayRow({ day, h24, onEdit, onDelete, editLabel = 'Edit' }: { day: CustomDay; h24: boolean; onEdit: () => void; onDelete: () => void; editLabel?: string }) {
  const theme = useTheme();
  const first = day.periods[0];
  const last = day.periods[day.periods.length - 1];
  return (
    <View style={{ padding: 14, gap: 8 }}>
      <Text style={{ ...TYPE.bold, fontSize: 16, color: theme.ink }}>{day.label}</Text>
      <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted }}>
        {fmtDate(day.date)} · {day.periods.length} periods{first && last ? ` · ${fmtTime(first.start, h24)} – ${fmtTime(last.end, h24)}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={editLabel} kind="plain" onPress={onEdit} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Delete" kind="danger" onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}
