/**
 * Back up & restore: everything on this phone (settings, classes, custom days, school,
 * homework, countdowns, notes, grades) as one text blob you can share to another device
 * and paste back. No account needed. The account token is never included.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Share, View } from 'react-native';

import { Button, Field, Note, Screen, Section } from '@/components/ui';
import { getPlanner, importPlanner } from '@/lib/planner';
import { addCustomDay, getState, setClassInfo, setPersonal, setPref, setSchool, type Prefs } from '@/lib/store';
import { getTools, importTools } from '@/lib/tools';

const VERSION = 1;
/** Prefs that belong to this device or this install, not to the student. */
const SKIP: (keyof Prefs)[] = ['alertsAsked', 'locked', 'setupStep', 'testPeriod3', 'prefsVersion'];

export function makeBackup(): string {
  const s = getState();
  const p = getPlanner();
  const t = getTools();
  const prefs: Partial<Prefs> = { ...s.prefs };
  for (const k of SKIP) delete prefs[k];
  return JSON.stringify({
    studento: VERSION,
    at: new Date().toISOString(),
    prefs,
    personal: s.personal,
    shared: s.shared,
    school: { school: s.school, bellSet: s.bellSet, schoolSchedules: s.schoolSchedules },
    homework: p.homework,
    countdowns: p.countdowns,
    notes: t.notes,
    grades: t.grades,
  });
}

export async function restoreBackup(text: string): Promise<string> {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text.trim());
  } catch {
    throw new Error("That doesn't look like a Studento backup. Paste the whole text, from { to }.");
  }
  if (!d || typeof d !== 'object' || typeof d.studento !== 'number') throw new Error("That doesn't look like a Studento backup.");
  const s = getState();
  const prefs = (d.prefs ?? {}) as Partial<Prefs>;
  const skip = new Set<string>(SKIP);
  for (const k of Object.keys(prefs) as (keyof Prefs)[]) {
    if (skip.has(k) || !(k in s.prefs)) continue;
    if (typeof prefs[k] !== typeof s.prefs[k]) continue;
    setPref(k, prefs[k] as Prefs[typeof k]);
  }
  setPref('onboarded', true);
  const school = d.school as { school?: typeof s.school; bellSet?: typeof s.bellSet; schoolSchedules?: typeof s.schoolSchedules } | undefined;
  if (school?.school && school.bellSet) await setSchool(school.school, school.bellSet, school.schoolSchedules ?? []);
  if (d.personal !== undefined) await setPersonal((d.personal as typeof s.personal) ?? null);
  const shared = d.shared as Partial<typeof s.shared> | undefined;
  if (shared?.classNames || shared?.classDetails) await setClassInfo(shared.classNames ?? {}, shared.classDetails ?? {});
  let customAdded = 0;
  for (const c of shared?.customDays ?? []) {
    if (s.shared.customDays.some((x) => x.date === c.date)) continue;
    if (await addCustomDay({ date: c.date, label: c.label, periods: c.periods })) customAdded++;
  }
  importPlanner({ homework: d.homework as never, countdowns: d.countdowns as never });
  importTools({ notes: d.notes as never, grades: d.grades as never });
  const n = (arr: unknown) => (Array.isArray(arr) ? arr.length : 0);
  return `Restored: settings, ${d.personal ? 'your classes, ' : ''}${n(d.homework)} homework, ${n(d.countdowns)} countdowns, ${n(d.notes)} notes, ${n(d.grades)} grades${customAdded ? `, ${customAdded} custom days` : ''}.`;
}

export default function Backup() {
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    const blob = makeBackup();
    setOut(blob);
    if (Platform.OS === 'web') return setMsg({ text: 'Copy the text below and paste it on the other device.', tone: 'ok' });
    try {
      await Share.share({ message: blob });
    } catch {
      setMsg({ text: 'Copy the text below instead.', tone: 'ok' });
    }
  };

  const restore = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ text: await restoreBackup(text), tone: 'ok' });
      setText('');
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't restore that.", tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Section title="Back up" footer="Settings, theme, classes, custom days, school, homework, countdowns, notes and grades. Your password is never included. Send it to yourself in Notes, Messages or AirDrop.">
          <View style={{ padding: 14, gap: 10 }}>
            <Button title="Share a backup" onPress={() => void exportNow()} />
            {out ? <Field value={out} multiline editable={false} selectTextOnFocus style={{ maxHeight: 140, fontSize: 12 }} accessibilityLabel="Backup text" /> : null}
          </View>
        </Section>
        <Section title="Restore" footer="Paste a backup from another device. It replaces what is on this one; the focus timer and sign-in are left alone.">
          <View style={{ padding: 14, gap: 10 }}>
            <Field value={text} onChangeText={setText} placeholder="Paste the backup text here" multiline autoCapitalize="none" autoCorrect={false} style={{ minHeight: 110, textAlignVertical: 'top' }} accessibilityLabel="Backup to restore" />
            <Button title={busy ? 'Restoring…' : 'Restore'} kind="plain" onPress={() => void restore()} disabled={busy || !text.trim()} />
          </View>
        </Section>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
