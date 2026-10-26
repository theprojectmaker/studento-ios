/**
 * Check and fix a schedule (from the AI, or the saved one) before Studento runs it.
 * Two ways to run it:
 *  - North High bells (default): Great Neck North's real bell times, with the
 *    student's own class and room for each period. Easiest; most students want this.
 *  - My own times: a different school's times, edited per day.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Screen, Section, Segmented, tap, ToggleRow } from '@/components/ui';
import { getDraft, getDraftFlags, SCHOOL_DAYS } from '@/lib/draft';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { NORTH_BELLS, periodIdsFor, sortPeriods, validatePeriods, type Period, type PersonalSchedule, type SchoolDay } from '@/lib/schedule';
import { getState, setPersonal, setPref, useStore } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';
import { parseTime } from '@/lib/timeinput';

interface Row {
  period: string;
  label: string;
  start: string;
  end: string;
  room: string;
}

const toRows = (list: Period[]): Row[] => list.map((p) => ({ period: p.period, label: p.label, start: p.start, end: p.end, room: p.room ?? '' }));
const same = (a: Row[], b: Row[]) => JSON.stringify(a) === JSON.stringify(b);
const periodName = (id: string) => (id === 'advisory' ? 'Advisory' : `Period ${id}`);

/** Starting point for the class list: from the scan, or from an own-times schedule. */
function initialClasses(p: PersonalSchedule): { names: Record<string, string>; rooms: Record<string, string> } {
  const names: Record<string, string> = { ...(p.classNames ?? {}) };
  const rooms: Record<string, string> = { ...(p.rooms ?? {}) };
  for (const d of SCHOOL_DAYS) {
    for (const r of p.days[d] ?? []) {
      if (!names[r.period] && r.label && r.label !== periodName(r.period)) names[r.period] = r.label;
      if (!rooms[r.period] && r.room) rooms[r.period] = r.room;
    }
  }
  return { names, rooms };
}

/** Own-times rows: the scanned times, or North's bells as a starting point. */
function initialDays(p: PersonalSchedule, names: Record<string, string>, bells: Record<SchoolDay, Period[]>): Record<SchoolDay, Row[]> {
  const out = {} as Record<SchoolDay, Row[]>;
  const any = SCHOOL_DAYS.some((d) => (p.days[d] ?? []).length > 0);
  for (const d of SCHOOL_DAYS) {
    const base = any ? (p.days[d] ?? []) : (bells[d] ?? []);
    out[d] = toRows(any ? base : base.map((x) => ({ ...x, label: names[x.period] || x.label })));
  }
  return out;
}

export default function ScheduleReview() {
  const theme = useTheme();
  const school = useStore((s) => s.school);
  const bellSet = useStore((s) => s.bellSet);
  const ids = periodIdsFor(bellSet?.days);
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [fl] = useState(() => (edit ? null : getDraftFlags()));
  const [initial] = useState<PersonalSchedule | null>(() => (edit ? getState().personal : getDraft()));
  const [start] = useState(() => (initial ? initialClasses(initial) : { names: {}, rooms: {} }));
  const [mode, setMode] = useState<'school' | 'own'>(initial?.bells === 'own' ? 'own' : 'school');
  const [name, setName] = useState(initial?.name ?? 'My schedule');
  const [names, setNames] = useState<Record<string, string>>(start.names);
  const [rooms, setRooms] = useState<Record<string, string>>(start.rooms);
  const [days, setDays] = useState<Record<SchoolDay, Row[]>>(() => (initial ? initialDays(initial, start.names, getState().bellSet?.days ?? NORTH_BELLS) : ({} as Record<SchoolDay, Row[]>)));
  const [sameAll, setSameAll] = useState(() => (initial ? SCHOOL_DAYS.every((d) => same(days[d] ?? [], days.Mon ?? [])) : true));
  const [day, setDay] = useState<SchoolDay>('Mon');
  const [err, setErr] = useState<string | null>(null);

  if (!initial) {
    return (
      <Screen>
        <Note>Nothing to review yet.</Note>
        <Button title="Scan my schedule" onPress={() => router.replace({ pathname: '/setup-schedule', params: { mode: 'scan' } })} />
      </Screen>
    );
  }

  const shown: SchoolDay = sameAll ? 'Mon' : day;
  const rows = days[shown] ?? [];
  const setRows = (next: Row[]) =>
    setDays((cur) => {
      if (!sameAll) return { ...cur, [shown]: next };
      const out = {} as Record<SchoolDay, Row[]>;
      for (const d of SCHOOL_DAYS) out[d] = next;
      return out;
    });
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const finish = async (p: PersonalSchedule) => {
    try {
      const inSetup = !getState().prefs.onboarded;
      await setPersonal(p);
      if (inSetup) setPref('onboarded', false); // setPersonal marks onboarded; the wizard is still running
      router.dismissAll();
      router.replace(inSetup ? '/setup' : '/');
    } catch {
      setErr("Couldn't save that. Try again.");
    }
  };

  const save = async () => {
    setErr(null);
    const cleanNames: Record<string, string> = {};
    const cleanRooms: Record<string, string> = {};
    for (const id of ids) {
      if (names[id]?.trim()) cleanNames[id] = names[id].trim().slice(0, 60);
      if (rooms[id]?.trim()) cleanRooms[id] = rooms[id].trim().slice(0, 20);
    }
    if (mode === 'school') {
      if (!Object.keys(cleanNames).length) return setErr('Add at least one class.');
      return finish({ name: name.trim() || 'My schedule', bells: 'school', days: initial.days, classNames: cleanNames, rooms: cleanRooms });
    }
    const out = {} as PersonalSchedule['days'];
    for (const d of SCHOOL_DAYS) {
      const list: Period[] = [];
      for (const r of sameAll ? days.Mon : days[d]) {
        const s = parseTime(r.start);
        const e = parseTime(r.end);
        const label = r.label.trim();
        if (!label) return setErr(`${d}: every row needs a class name.`);
        if (!s || !e) return setErr(`${d}: check the times for ${label} (like 8:00 or 1:05 pm).`);
        list.push({ period: (r.period.trim() || label).toLowerCase().slice(0, 12), label: label.slice(0, 60), start: s, end: e, room: r.room.trim() || undefined });
      }
      const bad = list.length ? validatePeriods(list) : null;
      if (bad) return setErr(`${d}: ${bad}`);
      out[d] = sortPeriods(list);
    }
    if (SCHOOL_DAYS.every((d) => out[d].length === 0)) return setErr('Add at least one class.');
    return finish({ name: name.trim() || 'My schedule', bells: 'own', days: out, classNames: cleanNames, rooms: cleanRooms });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Text style={{ ...TYPE.regular, fontSize: 15, lineHeight: 21, color: theme.muted, textAlign: 'center' }}>
          {edit ? 'Change anything, then save.' : 'Here is what the reader found. It can make mistakes, so check each row, then save.'}
        </Text>
        {fl?.warnings.length ? <Note tone="error">{fl.warnings.join(' ')}</Note> : null}

        <Section title="Bell times" footer={mode === 'school' ? `Uses ${school?.name ?? 'Great Neck North'}'s bell times (${bellSet?.name ?? 'Regular day'}), plus any custom days.` : 'Your own times, set for each day below.'}>
          <View style={{ padding: 12 }}>
            <Segmented
              value={mode}
              options={[
                { value: 'school', label: school ? 'School bells' : 'North High bells' },
                { value: 'own', label: 'My own times' },
              ]}
              onChange={setMode}
            />
          </View>
        </Section>

        {mode === 'school' ? (
          <Section title="My classes" footer={fl ? 'Highlighted rows: the reader was unsure, or the time did not match the bells. Leave a period empty if you have no class then.' : "Leave a period empty if you don't have a class then."}>
            {ids.map((id, i) => (
              <View key={id}>
                {i ? <Divider /> : null}
                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }, fl?.flags[id] ? { backgroundColor: alpha('#ff9f0a', 0.14) } : null]}>
                  <Text style={{ ...TYPE.semibold, fontSize: 13, color: theme.accent, width: 70 }}>{periodName(id)}</Text>
                  <Field style={{ flex: 1 }} value={names[id] ?? ''} onChangeText={(v) => setNames((n) => ({ ...n, [id]: v }))} placeholder="Class" accessibilityLabel={`${periodName(id)} class`} maxLength={60} />
                  <Field style={{ width: 76 }} value={rooms[id] ?? ''} onChangeText={(v) => setRooms((r) => ({ ...r, [id]: v }))} placeholder="Room" accessibilityLabel={`${periodName(id)} room`} maxLength={20} />
                </View>
              </View>
            ))}
          </Section>
        ) : (
          <>
            <Section>
              <ToggleRow label="Same every day" sub="Turn off if some days have different times" value={sameAll} onChange={setSameAll} />
            </Section>
            {!sameAll ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {SCHOOL_DAYS.map((d) => {
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
                      style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? theme.accent : alpha(theme.ink, 0.08) }}>
                      <Text style={{ ...TYPE.semibold, fontSize: 15, color: on ? readableOn(theme.accent) : theme.ink }}>{d}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <Section title={sameAll ? 'Every school day' : shown} footer="Times like 8:00, 805 or 1:05 pm. 1–6 without AM/PM means afternoon.">
              {rows.map((r, i) => (
                <View key={i}>
                  {i ? <Divider /> : null}
                  <View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Field style={{ width: 64 }} value={r.period} onChangeText={(v) => update(i, { period: v })} placeholder="#" accessibilityLabel={`Row ${i + 1} period`} maxLength={12} />
                      <Field style={{ flex: 1 }} value={r.label} onChangeText={(v) => update(i, { label: v })} placeholder="Class" accessibilityLabel={`Row ${i + 1} class`} maxLength={60} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${r.label || 'row'}`}
                        hitSlop={6}
                        onPress={() => {
                          tap();
                          setRows(rows.filter((_, j) => j !== i));
                        }}
                        style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha('#ff453a', 0.14) }}>
                        <Text style={{ ...TYPE.bold, color: '#ff453a', fontSize: 18, lineHeight: 20 }}>−</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Field style={{ flex: 1 }} value={r.start} onChangeText={(v) => update(i, { start: v })} onBlur={() => update(i, { start: parseTime(r.start) ?? r.start })} placeholder="Start" keyboardType="numbers-and-punctuation" accessibilityLabel={`${r.label} start`} />
                      <Field style={{ flex: 1 }} value={r.end} onChangeText={(v) => update(i, { end: v })} onBlur={() => update(i, { end: parseTime(r.end) ?? r.end })} placeholder="End" keyboardType="numbers-and-punctuation" accessibilityLabel={`${r.label} end`} />
                      <Field style={{ flex: 1 }} value={r.room} onChangeText={(v) => update(i, { room: v })} placeholder="Room" accessibilityLabel={`${r.label} room`} maxLength={20} />
                    </View>
                  </View>
                </View>
              ))}
              <View style={{ padding: 12 }}>
                <Button
                  title="Add a class"
                  kind="plain"
                  onPress={() => {
                    const last = rows[rows.length - 1];
                    const s = last ? (parseTime(last.end) ?? '08:00') : '08:00';
                    const [h, m] = s.split(':').map(Number);
                    const t0 = h * 60 + m + 3;
                    const f = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
                    const nextNum = last && /^\d+$/.test(last.period) ? String(Number(last.period) + 1) : String(rows.length + 1);
                    setRows([...rows, { period: nextNum, label: '', start: f(t0), end: f(t0 + 41), room: '' }]);
                  }}
                />
              </View>
            </Section>
          </>
        )}

        <Section>
          <View style={{ padding: 14, gap: 6 }}>
            <Text style={{ ...TYPE.semibold, fontSize: 12, letterSpacing: 1, color: theme.muted }}>SCHEDULE NAME</Text>
            <Field value={name} onChangeText={setName} placeholder="My schedule" maxLength={40} accessibilityLabel="Schedule name" />
          </View>
        </Section>

        {err ? <Note tone="error">{err}</Note> : null}
        <Button title="Use this schedule" onPress={save} />
        <Button title="Scan again" kind="plain" onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'scan' } })} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
