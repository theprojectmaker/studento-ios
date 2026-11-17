/** Admin control center: live overview, maintenance mode and per-feature Beam switches. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Divider, Field, Note, Row, Section, ToggleRow } from '@/components/ui';
import { FEATURES, useFlags } from '@/lib/admin-switches';
import { banOver, setFlag, totals, watchAccessList, watchAnnouncements, watchBans, watchMessageCount, type AccessRequest, type Announcement, type Ban } from '@/lib/beam-extra';
import { doc, setDoc } from 'firebase/firestore';
import { fbDb } from '@/lib/fb';

/** Choices for how long something lasts. 0 = no end. */
export const DURATIONS: [string, number][] = [
  ['No end', 0],
  ['1 hour', 3600_000],
  ['1 day', 86400_000],
  ['7 days', 7 * 86400_000],
];

export function DurationPick({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {DURATIONS.map(([label, ms]) => (
        <Button key={label} title={label} kind={value === ms ? undefined : 'plain'} onPress={() => onChange(ms)} />
      ))}
    </View>
  );
}

export function AdminControl() {
  const flags = useFlags();
  const [live, setLive] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<number | null>(null);
  const [bans, setBans] = useState<Record<string, Ban>>({});
  const [access, setAccess] = useState<AccessRequest[]>([]);
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [mmsg, setMmsg] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  useEffect(() => watchMessageCount(setLive), []);
  useEffect(() => watchBans(setBans), []);
  useEffect(() => watchAccessList(setAccess), []);
  useEffect(() => watchAnnouncements(setAnn), []);
  useEffect(() => {
    void totals()
      .then((t) => setAccounts(t.accounts))
      .catch(() => {});
  }, []);

  const flip = (k: string, v: boolean, label: string) =>
    void setFlag(k, v)
      .then(() => setNote({ text: label, tone: 'ok' }))
      .catch((e: unknown) => setNote({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' }));

  const banList = Object.values(bans).filter((b) => !banOver(b));
  const waiting = access.filter((a) => a.status === 'waiting').length;
  const liveAnn = ann.filter((a) => !a.until || a.until > now).length;
  const msgShown = mmsg ?? (typeof flags.maintenanceMsg === 'string' ? flags.maintenanceMsg : '');
  const off = FEATURES.filter((f) => flags[f.key] === false).length;

  return (
    <>
      <Section title="Overview" footer="Live counts. Nothing here shows what anyone says or who they talk to.">
        <Row label="Accounts" value={accounts === null ? '…' : accounts.toLocaleString()} />
        <Divider />
        <Row label="Messages sent" value={live === null ? '…' : live.toLocaleString()} />
        <Divider />
        <Row label="Banned or chatting off" value={String(banList.length)} />
        <Divider />
        <Row label="Waiting to join Beam" value={String(waiting)} />
        <Divider />
        <Row label="Announcements up" value={String(liveAnn)} />
        <Divider />
        <Row label="Features switched off" value={String(off + (flags.maintenance === true ? 1 : 0))} />
      </Section>

      <Section title="Maintenance mode" footer="On = everyone but you sees a 'Be right back' screen until you turn it off.">
        <ToggleRow label="Maintenance mode" value={flags.maintenance === true} onChange={(v) => flip('maintenance', v, v ? 'Maintenance mode on. Only you can use the app.' : 'Maintenance mode off.')} />
        <View style={{ padding: 12, gap: 8 }}>
          <Field value={msgShown} onChangeText={setMmsg} placeholder="Message people see (optional)" maxLength={200} multiline />
          <Button
            title="Save message"
            kind="plain"
            onPress={() =>
              void setDoc(doc(fbDb(), 'config', 'flags'), { maintenanceMsg: msgShown.trim() }, { merge: true })
                .then(() => setNote({ text: 'Message saved.', tone: 'ok' }))
                .catch((e: unknown) => setNote({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' }))
            }
          />
        </View>
      </Section>

      <Section title="Beam features" footer="Switch single Beam features off for everyone but you. Chats keep working.">
        {FEATURES.map((f, i) => (
          <View key={f.key}>
            {i ? <Divider /> : null}
            <ToggleRow label={f.label} sub={f.sub} value={flags[f.key] !== false} onChange={(v) => flip(f.key, v, `${f.label} ${v ? 'on' : 'off'}.`)} />
          </View>
        ))}
        <View style={{ padding: 12, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="All on" kind="plain" onPress={() => void Promise.all(FEATURES.map((f) => setFlag(f.key, true))).then(() => setNote({ text: 'Every Beam feature is on.', tone: 'ok' })).catch(() => {})} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="All off" kind="danger" onPress={() => void Promise.all(FEATURES.map((f) => setFlag(f.key, false))).then(() => setNote({ text: 'Every Beam feature is off.', tone: 'ok' })).catch(() => {})} />
          </View>
        </View>
      </Section>
      {note ? <Note tone={note.tone}>{note.text}</Note> : null}
    </>
  );
}
