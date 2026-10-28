/**
 * "What school do you go to?": search the shared list, pick one of its bell schedules, or
 * add your school / publish a schedule for it (needs an account). The pick is cached on
 * the phone so the clock works offline afterwards.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/glass';
import { Button, Divider, Field, Note, Row, Screen, Section, tap } from '@/components/ui';
import * as api from '@/lib/api';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { NORTH_BELLS, SCHOOL_DAY_LIST } from '@/lib/schedule';
import { setSchool, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { sz } from '@/lib/scale';

/** Works with no server at all: the built-in Great Neck North week. */
export const BUILT_IN_SCHOOL = { id: 1, name: 'Great Neck North High School' };
export const BUILT_IN_SET: api.BellSet = { id: 1, name: 'Regular day', days: NORTH_BELLS };

export default function School() {
  const theme = useTheme();
  const account = useStore((s) => s.account);
  const current = useStore((s) => s.school);
  const currentSet = useStore((s) => s.bellSet);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<api.SchoolHit[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ school: { id: number; name: string }; schedules: api.BellSet[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Search as you type (debounced); an empty query lists the most-used schools.
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
    tap();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.getSchool(school.id);
      setPicked({ school: r.school, schedules: r.schedules });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load that school.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (set: api.BellSet) => {
    tap();
    if (!picked) return;
    await setSchool(picked.school, set, picked.schedules);
    router.back();
  };

  const addSchool = async () => {
    if (!account) return router.push('/account');
    setErr(null);
    setBusy(true);
    try {
      const token = (await import('@/lib/account')).getToken;
      const t = await token();
      if (!t) return router.push('/account');
      const r = await api.addSchool(t, q.trim());
      await open(r.school);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add that school.");
    } finally {
      setBusy(false);
    }
  };

  const pickBuiltIn = async () => {
    tap();
    await setSchool(BUILT_IN_SCHOOL, BUILT_IN_SET, [BUILT_IN_SET]);
    router.back();
  };

  if (picked) {
    return (
      <Screen>
        <Text style={{ ...TYPE.bold, fontSize: sz(24), color: theme.ink, textAlign: 'center' }}>{picked.school.name}</Text>
        <Text style={{ ...TYPE.regular, fontSize: sz(15), color: theme.muted, textAlign: 'center' }}>Pick the bell schedule your school uses on a normal day. You can switch for a day anytime.</Text>
        <Section title="Bell schedules">
          {picked.schedules.length === 0 ? <Note>No schedules yet for this school. Add the first one below.</Note> : null}
          {picked.schedules.map((s, i) => {
            const days = SCHOOL_DAY_LIST.filter((d) => (s.days[d] ?? []).length).length;
            const on = currentSet?.id === s.id && current?.id === picked.school.id;
            return (
              <View key={s.id}>
                {i ? <Divider /> : null}
                <Row
                  label={s.name}
                  sub={`${days} ${days === 1 ? 'day' : 'days'} · ${(s.days.Mon ?? s.days[SCHOOL_DAY_LIST.find((d) => s.days[d]?.length) ?? 'Mon'] ?? []).length} periods`}
                  value={on ? 'In use' : undefined}
                  onPress={() => void choose(s)}
                  right={
                    <Pressable accessibilityRole="button" accessibilityLabel={`Report ${s.name}`} hitSlop={8} onPress={() => router.push({ pathname: '/report', params: { kind: 'schedule', id: String(s.id), name: `${s.name} · ${picked.school.name}` } })} style={{ paddingHorizontal: 6 }}>
                      <Text style={{ ...TYPE.medium, fontSize: sz(12), color: theme.muted }}>Report</Text>
                    </Pressable>
                  }
                />
              </View>
            );
          })}
        </Section>
        <Button
          title="Add a schedule for this school"
          kind="plain"
          onPress={() => (account ? router.push({ pathname: '/schedule-publish', params: { schoolId: String(picked.school.id), schoolName: picked.school.name } }) : router.push('/account'))}
        />
        {!account ? <Note>Sign in to add a schedule.</Note> : null}
        <Button title="Back to search" kind="plain" onPress={() => setPicked(null)} />
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/report', params: { kind: 'school', id: String(picked.school.id), name: picked.school.name } })} style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={{ ...TYPE.medium, fontSize: sz(13), color: theme.muted }}>Report this school or one of its schedules</Text>
        </Pressable>
        {err ? <Note tone="error">{err}</Note> : null}
      </Screen>
    );
  }

  const exact = hits?.some((h) => h.name.toLowerCase() === q.trim().toLowerCase());
  return (
    <Screen>
      <Text style={{ ...TYPE.bold, fontSize: sz(24), color: theme.ink, textAlign: 'center' }}>What school do you go to?</Text>
      <Field value={q} onChangeText={setQ} placeholder="Search schools" autoCapitalize="words" autoCorrect={false} accessibilityLabel="Search schools" />
      {offline ? (
        <Note tone="error">{"Can't reach Studento's server right now. You can use the built-in Great Neck North schedule and pick your school later."}</Note>
      ) : hits === null ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <Section title={q.trim() ? 'Matches' : 'Schools'}>
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
        <Pressable
          accessibilityRole="button"
          onPress={() => void addSchool()}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: alpha(theme.accent, 0.12) })}
        >
          <Icon name="plus.circle.fill" color={theme.accent} size={20} fallback={<Text style={{ color: theme.accent, fontSize: sz(18) }}>+</Text>} />
          <Text style={{ ...TYPE.semibold, fontSize: sz(15), color: theme.ink, flex: 1 }}>{account ? `Add “${q.trim()}” as a new school` : `Sign in to add “${q.trim()}”`}</Text>
        </Pressable>
      ) : null}
      <Button title="Use Great Neck North (built in, works offline)" kind="plain" onPress={() => void pickBuiltIn()} />
      {busy ? <ActivityIndicator color={theme.accent} /> : null}
      {err ? <Note tone="error">{err}</Note> : null}
    </Screen>
  );
}
