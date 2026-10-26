/**
 * Inline school search + schedule pick, used by the setup wizard. Picks are saved to the
 * store (and cached for offline) as soon as they are made. Works without a server: the
 * built-in Great Neck North week is always offered.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import * as api from '@/lib/api';
import { getToken } from '@/lib/account';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { fmtTime, nyParts, weekdayOf } from '@/lib/nytime';
import { NORTH_BELLS, SCHOOL_DAY_LIST, type SchoolDay } from '@/lib/schedule';
import { setSchool, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';

import { Button, Divider, Field, Note, Row, Section } from './ui';

export const BUILT_IN_SCHOOL = { id: 1, name: 'Great Neck North High School' };
export const BUILT_IN_SET: api.BellSet = { id: 1, name: 'Regular day', days: NORTH_BELLS };

/** Step: search and pick the school. Calls onPicked once a school is chosen (schedules loaded). */
export function SchoolSearch({ onPicked }: { onPicked: (school: { id: number; name: string }, schedules: api.BellSet[]) => void }) {
  const theme = useTheme();
  const account = useStore((s) => s.account);
  const current = useStore((s) => s.school);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<api.SchoolHit[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const r = await api.searchSchools(q.trim());
        if (!dead) {
          setHits(r);
          setOffline(false);
        }
      } catch {
        if (!dead) setOffline(true);
      }
    }, 300);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [q]);

  const open = async (school: { id: number; name: string }) => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.getSchool(school.id);
      onPicked(r.school, r.schedules);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load that school.");
    } finally {
      setBusy(false);
    }
  };

  const addSchool = async () => {
    setErr(null);
    const t = await getToken();
    if (!t || !account) return setErr('Adding a school needs an account. You can add it later from Settings, or pick the built-in schedule for now.');
    setBusy(true);
    try {
      const r = await api.addSchool(t, q.trim());
      await open(r.school);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add that school.");
    } finally {
      setBusy(false);
    }
  };

  const exact = hits?.some((h) => h.name.toLowerCase() === q.trim().toLowerCase());
  return (
    <View style={{ gap: 14 }}>
      <Field value={q} onChangeText={setQ} placeholder="Search schools" autoCapitalize="words" autoCorrect={false} accessibilityLabel="Search schools" />
      {offline ? (
        <Note tone="error">{"Can't reach Studento's server right now. Use the built-in schedule below and pick your school later in Settings."}</Note>
      ) : hits === null ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <Section>
          {hits.length === 0 ? <Note>{q.trim() ? 'No school with that name yet.' : 'No schools yet.'}</Note> : null}
          {hits.map((h, i) => (
            <View key={h.id}>
              {i ? <Divider /> : null}
              <Row label={h.name} sub={`${h.schedules} ${h.schedules === 1 ? 'schedule' : 'schedules'}`} value={current?.id === h.id ? 'Current' : undefined} onPress={() => void open(h)} />
            </View>
          ))}
        </Section>
      )}
      {q.trim().length >= 3 && !exact && !offline ? (
        <Pressable accessibilityRole="button" onPress={() => void addSchool()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 14, borderRadius: 16, backgroundColor: alpha(theme.accent, 0.12) })}>
          <Text style={{ ...TYPE.semibold, fontSize: 15, color: theme.ink }}>{`Add “${q.trim()}” as a new school`}</Text>
          {!account ? <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted, marginTop: 2 }}>Needs an account (you can make one in a later step).</Text> : null}
        </Pressable>
      ) : null}
      <Button title="Use the built-in Great Neck North schedule" kind="plain" onPress={() => onPicked(BUILT_IN_SCHOOL, [BUILT_IN_SET])} />
      {busy ? <ActivityIndicator color={theme.accent} /> : null}
      {err ? <Note tone="error">{err}</Note> : null}
    </View>
  );
}

/** Step: pick one of the school's bell schedules, with a preview of today's periods. */
export function SchedulePick({ school, schedules, onPicked }: { school: { id: number; name: string }; schedules: api.BellSet[]; onPicked: (set: api.BellSet) => void }) {
  const theme = useTheme();
  const h24 = useStore((s) => s.prefs.h24);
  const current = useStore((s) => s.bellSet);
  const [chosen, setChosen] = useState<api.BellSet | null>(current && schedules.some((s) => s.id === current.id) ? current : (schedules[0] ?? null));
  const [today] = useState(() => weekdayOf(nyParts(Date.now()).date));
  const day: SchoolDay = (SCHOOL_DAY_LIST as string[]).includes(today) ? (today as SchoolDay) : 'Mon';
  const preview = chosen ? (chosen.days[day]?.length ? chosen.days[day] : (SCHOOL_DAY_LIST.map((d) => chosen.days[d]).find((l) => l?.length) ?? [])) : [];

  const pick = async (s: api.BellSet) => {
    setChosen(s);
    await setSchool(school, s, schedules);
    onPicked(s);
  };

  return (
    <View style={{ gap: 14 }}>
      <Section title={school.name}>
        {schedules.length === 0 ? <Note>No schedules yet for this school. You can add one later from Settings.</Note> : null}
        {schedules.map((s, i) => (
          <View key={s.id}>
            {i ? <Divider /> : null}
            <Row label={s.name} sub={`${SCHOOL_DAY_LIST.filter((d) => (s.days[d] ?? []).length).length} days`} value={chosen?.id === s.id ? '✓' : undefined} onPress={() => void pick(s)} />
          </View>
        ))}
      </Section>
      {chosen && preview.length ? (
        <Section title={`${chosen.name} · ${day === today ? 'today' : 'a school day'}`}>
          {preview.map((p, i) => (
            <View key={`${p.period}-${p.start}`}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9 }}>
                <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.ink }}>{p.label}</Text>
                <Text style={{ ...TYPE.regular, fontSize: 15, color: theme.muted, fontVariant: ['tabular-nums'] }}>{`${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}`}</Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}
    </View>
  );
}
