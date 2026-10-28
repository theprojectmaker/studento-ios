/**
 * Publish a bell schedule for a school ("Regular day", "Early dismissal"...), so other
 * students there can pick it. Needs an account. The new schedule becomes yours right away.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Screen, Section, tap, ToggleRow } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { REGULAR_SCHEDULE, SCHOOL_DAY_LIST, sortPeriods, validatePeriods, type Period, type SchoolDay } from '@/lib/schedule';
import { getState, setSchool, useStore } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';
import { parseTime } from '@/lib/timeinput';
import { sz } from '@/lib/scale';

interface Row {
  period: string;
  start: string;
  end: string;
}
const seed = (): Row[] => REGULAR_SCHEDULE.map((p) => ({ period: p.period, start: p.start, end: p.end }));

export default function SchedulePublish() {
  const theme = useTheme();
  const { schoolId, schoolName } = useLocalSearchParams<{ schoolId?: string; schoolName?: string }>();
  const account = useStore((s) => s.account);
  const [name, setName] = useState('');
  const [sameAll, setSameAll] = useState(true);
  const [day, setDay] = useState<SchoolDay>('Mon');
  const [days, setDays] = useState<Record<SchoolDay, Row[]>>(() => ({ Mon: seed(), Tue: seed(), Wed: seed(), Thu: seed(), Fri: seed() }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown: SchoolDay = sameAll ? 'Mon' : day;
  const rows = days[shown];
  const setRows = (next: Row[]) =>
    setDays((cur) => {
      if (!sameAll) return { ...cur, [shown]: next };
      return { Mon: next, Tue: next, Wed: next, Thu: next, Fri: next };
    });
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const publish = async () => {
    setErr(null);
    const token = await getToken();
    if (!token || !account) return router.push('/account');
    const clean = name.trim();
    if (clean.length < 2) return setErr('Name the schedule, like "Regular day" or "Early dismissal".');
    const out = {} as Record<SchoolDay, Period[]>;
    for (const d of SCHOOL_DAY_LIST) {
      const list: Period[] = [];
      for (const r of sameAll ? days.Mon : days[d]) {
        const id = r.period.trim().toLowerCase();
        if (!id) continue;
        const s = parseTime(r.start);
        const e = parseTime(r.end);
        if (!s || !e) return setErr(`${d}: check the times for period ${id} (like 8:00 or 1:05 pm).`);
        list.push({ period: id, label: id === 'advisory' ? 'Advisory' : /^\d+$/.test(id) ? `Period ${id}` : id, start: s, end: e });
      }
      const bad = list.length ? validatePeriods(list) : null;
      if (bad) return setErr(`${d}: ${bad}`);
      out[d] = sortPeriods(list);
    }
    if (SCHOOL_DAY_LIST.every((d) => out[d].length === 0)) return setErr('Add at least one period.');
    setBusy(true);
    try {
      const set = await api.publishSchedule(token, Number(schoolId), clean, out);
      const st = getState();
      const list = st.school?.id === Number(schoolId) ? [...st.schoolSchedules.filter((x) => x.id !== set.id), set] : [set];
      await setSchool({ id: Number(schoolId), name: schoolName ?? st.school?.name ?? 'My school' }, set, list);
      router.dismissAll();
      router.replace('/welcome');
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't publish it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(21), color: theme.muted, textAlign: 'center' }}>
          {`Bell times for ${schoolName ?? 'your school'}. Other students there will be able to pick this.`}
        </Text>
        {!account ? <Note tone="error">Sign in to publish a schedule.</Note> : null}
        <Section title="Schedule name">
          <View style={{ padding: 12 }}>
            <Field value={name} onChangeText={setName} placeholder='Like "Regular day" or "Early dismissal"' maxLength={40} accessibilityLabel="Schedule name" />
          </View>
        </Section>
        <Section>
          <ToggleRow label="Same every day" sub="Turn off if some days have different times" value={sameAll} onChange={setSameAll} />
        </Section>
        {!sameAll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {SCHOOL_DAY_LIST.map((d) => {
              const on = d === day;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    tap();
                    setDay(d);
                  }}
                  style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? theme.accent : alpha(theme.ink, 0.08) }}
                >
                  <Text style={{ ...TYPE.semibold, fontSize: sz(15), color: on ? readableOn(theme.accent) : theme.ink }}>{d}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <Section title={sameAll ? 'Every school day' : shown} footer="Period: a number, or a word like advisory or lunch. Times like 8:00, 805 or 1:05 pm. Leave a period blank to drop it.">
          {rows.map((r, i) => (
            <View key={i}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10 }}>
                <Field style={{ width: 84 }} value={r.period} onChangeText={(v) => update(i, { period: v })} placeholder="Period" accessibilityLabel={`Row ${i + 1} period`} maxLength={12} />
                <Field style={{ flex: 1 }} value={r.start} onChangeText={(v) => update(i, { start: v })} onBlur={() => update(i, { start: parseTime(r.start) ?? r.start })} placeholder="Start" keyboardType="numbers-and-punctuation" accessibilityLabel={`Row ${i + 1} start`} />
                <Field style={{ flex: 1 }} value={r.end} onChangeText={(v) => update(i, { end: v })} onBlur={() => update(i, { end: parseTime(r.end) ?? r.end })} placeholder="End" keyboardType="numbers-and-punctuation" accessibilityLabel={`Row ${i + 1} end`} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove row ${i + 1}`}
                  hitSlop={6}
                  onPress={() => {
                    tap();
                    setRows(rows.filter((_, j) => j !== i));
                  }}
                  style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha('#ff453a', 0.14) }}
                >
                  <Text style={{ ...TYPE.bold, color: '#ff453a', fontSize: sz(18), lineHeight: sz(20) }}>−</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={{ padding: 12 }}>
            <Button
              title="Add a period"
              kind="plain"
              onPress={() => {
                const last = rows[rows.length - 1];
                const s = last ? (parseTime(last.end) ?? '08:00') : '08:00';
                const [h, m] = s.split(':').map(Number);
                const t0 = h * 60 + m + 3;
                const f = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
                const next = last && /^\d+$/.test(last.period) ? String(Number(last.period) + 1) : String(rows.length + 1);
                setRows([...rows, { period: next, start: f(t0), end: f(t0 + 41) }]);
              }}
            />
          </View>
        </Section>
        {err ? <Note tone="error">{err}</Note> : null}
        <Button title={busy ? 'Publishing…' : 'Publish and use it'} onPress={publish} disabled={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
