/**
 * Make (or change) a dated custom day. The server has no "update", so editing
 * saves a new day and then deletes the old one.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { addDays, fmtDate, nyParts, weekdayOf } from '@/lib/nytime';
import { ASSEMBLY_SCHEDULE, CUSTOM_SCHEDULE, periodTitle, REGULAR_SCHEDULE, sortPeriods, validatePeriods, WEDNESDAY_SCHEDULE, type Period } from '@/lib/schedule';
import { addCustomDay, deleteCustomDay, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { parseDate, parseTime } from '@/lib/timeinput';
import { sz } from '@/lib/scale';

interface Draft {
  period: string;
  start: string;
  end: string;
}

const TEMPLATES: { label: string; periods: Period[] }[] = [
  { label: 'Regular', periods: REGULAR_SCHEDULE },
  { label: 'Wednesday', periods: WEDNESDAY_SCHEDULE },
  { label: 'Assembly', periods: ASSEMBLY_SCHEDULE },
  { label: 'Custom', periods: CUSTOM_SCHEDULE },
];

const toDraft = (list: Period[]): Draft[] => list.map((p) => ({ period: p.period === 'advisory' ? 'Advisory' : p.period, start: p.start, end: p.end }));

export default function ScheduleEdit() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; copy?: string }>();
  const customDays = useStore((s) => s.shared.customDays);
  const editing = params.id ? customDays.find((d) => d.id === params.id) : undefined;
  const source = editing ?? (params.copy ? customDays.find((d) => d.id === params.copy) : undefined);
  const [today] = useState(() => nyParts(Date.now()).date);

  const [date, setDate] = useState(editing?.date ?? nextSchoolDate(today));
  const [label, setLabel] = useState(source?.label ?? '');
  const [rows, setRows] = useState<Draft[]>(() => toDraft(source?.periods ?? REGULAR_SCHEDULE));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const quickDates = Array.from({ length: 10 }, (_, i) => addDays(today, i)).filter((d) => !['Sat', 'Sun'].includes(weekdayOf(d))).slice(0, 6);

  const update = (i: number, patch: Partial<Draft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setError(null);
    const d = parseDate(date, Number(today.slice(0, 4)));
    if (!d) return setError('Date should look like 2026-10-21 or 10/21.');
    if (d < today) return setError('Pick today or a later date.');
    const periods: Period[] = [];
    for (const r of rows) {
      const start = parseTime(r.start);
      const end = parseTime(r.end);
      const raw = r.period.trim();
      const id = /^advisory$/i.test(raw) ? 'advisory' : raw;
      if (!start || !end) return setError(`Check the times for ${raw || 'a row'} (like 8:00 or 1:05 pm).`);
      periods.push({ period: id, label: id === 'advisory' ? 'Advisory' : /^\d+$/.test(id) ? `Period ${id}` : id, start, end });
    }
    const bad = validatePeriods(periods);
    if (bad) return setError(bad);
    const clash = customDays.find((x) => x.date === d && x.id !== editing?.id);
    if (clash) return setError(`${fmtDate(d)} already has "${clash.label}". Delete that one first.`);
    setSaving(true);
    const err = await addCustomDay({ date: d, label: label.trim() || 'Custom day', periods: sortPeriods(periods) });
    if (!err && editing) await deleteCustomDay(editing.id);
    setSaving(false);
    if (err) return setError(err);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Section title="Date">
          <View style={{ padding: 14, gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {quickDates.map((d) => (
                <Chip key={d} label={d === today ? 'Today' : fmtDate(d).replace(/,.*$/, '').slice(0, 3) + ' ' + Number(d.slice(8))} on={date === d} onPress={() => setDate(d)} />
              ))}
            </ScrollView>
            <Field value={date} onChangeText={setDate} placeholder="2026-10-21" accessibilityLabel="Date" autoCapitalize="none" />
            {parseDate(date, Number(today.slice(0, 4))) ? <Note>{fmtDate(parseDate(date, Number(today.slice(0, 4)))!)}</Note> : null}
          </View>
          <Divider />
          <View style={{ padding: 14, gap: 6 }}>
            <Text style={{ ...TYPE.bold, fontSize: sz(12), letterSpacing: 1, color: theme.muted }}>NAME</Text>
            <Field value={label} onChangeText={setLabel} placeholder="e.g. Pep rally schedule" maxLength={80} accessibilityLabel="Name" />
          </View>
        </Section>

        <Section title="Start from">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 }}>
            {TEMPLATES.map((t) => (
              <Chip key={t.label} label={t.label} onPress={() => setRows(toDraft(t.periods))} />
            ))}
            <Chip label="Blank" onPress={() => setRows([{ period: '1', start: '08:00', end: '08:40' }])} />
          </View>
        </Section>

        <Section title="Bells" footer="Type times like 8:00, 805 or 1:05 pm. 1–6 without AM/PM means afternoon.">
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingTop: 12, gap: 8 }}>
            <Text style={[colHead, { width: 92, color: theme.muted }]}>PERIOD</Text>
            <Text style={[colHead, { flex: 1, color: theme.muted }]}>START</Text>
            <Text style={[colHead, { flex: 1, color: theme.muted }]}>END</Text>
            <View style={{ width: 36 }} />
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Field style={{ width: 92 }} value={r.period} onChangeText={(v) => update(i, { period: v })} accessibilityLabel={`Row ${i + 1} period`} maxLength={20} />
              <Field
                style={{ flex: 1 }}
                value={r.start}
                onChangeText={(v) => update(i, { start: v })}
                onBlur={() => update(i, { start: parseTime(r.start) ?? r.start })}
                accessibilityLabel={`${periodTitle({ period: r.period, label: r.period, start: '', end: '' })} start`}
                keyboardType="numbers-and-punctuation"
              />
              <Field
                style={{ flex: 1 }}
                value={r.end}
                onChangeText={(v) => update(i, { end: v })}
                onBlur={() => update(i, { end: parseTime(r.end) ?? r.end })}
                accessibilityLabel={`${periodTitle({ period: r.period, label: r.period, start: '', end: '' })} end`}
                keyboardType="numbers-and-punctuation"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove row ${i + 1}`}
                hitSlop={6}
                onPress={() => {
                  tap();
                  setRows((x) => x.filter((_, j) => j !== i));
                }}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha('#ff5a4e', 0.14) }}>
                <Text style={{ color: '#ff5a4e', fontSize: sz(20), lineHeight: sz(22), ...TYPE.bold }}>−</Text>
              </Pressable>
            </View>
          ))}
          <View style={{ padding: 14 }}>
            <Button
              title="Add a period"
              kind="plain"
              onPress={() =>
                setRows((x) => {
                  const last = x[x.length - 1];
                  const start = last ? (parseTime(last.end) ?? '08:00') : '08:00';
                  const [h, m] = start.split(':').map(Number);
                  const s = h * 60 + m + 3;
                  const e = s + 40;
                  const f = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
                  const nextId = last && /^\d+$/.test(last.period) ? String(Number(last.period) + 1) : '1';
                  return [...x, { period: nextId, start: f(s), end: f(e) }];
                })
              }
            />
          </View>
        </Section>

        {error ? <Note tone="error">{error}</Note> : null}
        <Button title={saving ? 'Saving…' : editing ? 'Save changes' : 'Save custom day'} onPress={save} disabled={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: on ? theme.accent : alpha(theme.ink, pressed ? 0.16 : 0.09),
      })}>
      <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: on ? (theme.light ? '#fff' : theme.bg) : theme.ink }}>{label}</Text>
    </Pressable>
  );
}

function nextSchoolDate(today: string): string {
  let d = addDays(today, 1);
  while (['Sat', 'Sun'].includes(weekdayOf(d))) d = addDays(d, 1);
  return d;
}

const colHead = { ...TYPE.bold, fontSize: sz(11), letterSpacing: 1 } as const;
