/** Admin control center: dashboard counts, maintenance, and every kill switch. */
import { doc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Button, Divider, Field, Note, Row, Section, ToggleRow } from '@/components/ui';
import { FEATURES, useFlags } from '@/lib/admin-switches';
import { AREAS, areaFlag, audit, listCodes, watchAudit, type AuditEntry } from '@/lib/admin-tools';
import { toCsv } from '@/lib/admin-extra';
import * as api from '@/lib/api';
import { banOver, setFlag, totals, watchAccessList, watchAnnouncements, watchBans, watchMessageCount, type AccessRequest, type Announcement, type Ban } from '@/lib/beam-extra';
import { fbDb } from '@/lib/fb';
import { getToken } from '@/lib/account';

/** Choices for how long something lasts. 0 = no end. */
export const DURATIONS: [string, number][] = [
  ['No end', 0],
  ['1 hour', 3600_000],
  ['1 day', 86400_000],
  ['7 days', 7 * 86400_000],
  ['30 days', 30 * 86400_000],
];

export function DurationPick({ value, onChange, options = DURATIONS }: { value: number; onChange: (v: number) => void; options?: [string, number][] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([label, ms]) => (
        <Button key={label} title={label} kind={value === ms ? undefined : 'plain'} onPress={() => onChange(ms)} />
      ))}
    </View>
  );
}

type Tone = { text: string; tone: 'ok' | 'error' };
const fail = (set: (n: Tone) => void) => (e: unknown) => set({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' });

/** Flip a config/flags switch and record it in the audit log. */
export const flipFlag = (k: string, v: boolean) => setFlag(k, v).then(() => audit('flag', `${k} ${v ? 'on' : 'off'}`));

export function AdminDashboard() {
  const flags = useFlags();
  const [live, setLive] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<number | null>(null);
  const [bans, setBans] = useState<Record<string, Ban>>({});
  const [access, setAccess] = useState<AccessRequest[]>([]);
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [reports, setReports] = useState<number | null>(null);
  const [codes, setCodes] = useState<{ used: number; open: number } | null>(null);
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(() => watchMessageCount(setLive), []);
  useEffect(() => watchBans(setBans), []);
  useEffect(() => watchAccessList(setAccess), []);
  useEffect(() => watchAnnouncements(setAnn), []);
  useEffect(() => watchAudit(setLog, 5), []);
  useEffect(() => {
    void totals()
      .then((t) => setAccounts(t.accounts))
      .catch(() => {});
    void getToken()
      .then((t) => (t ? api.listReports(t) : []))
      .then((r) => setReports(r.filter((x) => x.status !== 'dismissed').length))
      .catch(() => setReports(0));
    void listCodes()
      .then((l) => setCodes({ used: l.filter((c) => c.used).length, open: l.filter((c) => !c.used && !c.revoked).length }))
      .catch(() => setCodes({ used: 0, open: 0 }));
  }, []);

  const banList = Object.values(bans).filter((b) => !banOver(b));
  const waiting = access.filter((a) => a.status === 'waiting').length;
  const liveAnn = ann.filter((a) => (!a.until || a.until > now) && (!a.startAt || a.startAt <= now)).length;
  const scheduled = ann.filter((a) => a.startAt && a.startAt > now).length;
  const off = FEATURES.filter((f) => flags[f.key] === false).length + AREAS.filter((a) => flags[areaFlag(a.key)] === false).length;

  return (
    <>
      <Section title="Dashboard" footer="Counts only. Nothing here shows what anyone says or who they talk to.">
        <Row label="Accounts" value={accounts === null ? '…' : accounts.toLocaleString()} />
        <Divider />
        <Row label="Messages sent (all time)" value={live === null ? '…' : live.toLocaleString()} />
        <Divider />
        <Row label="Banned or chatting off" value={String(banList.length)} />
        <Divider />
        <Row label="Waiting to join Beam" value={String(waiting)} />
        <Divider />
        <Row label="Open reports" value={reports === null ? '…' : String(reports)} />
        <Divider />
        <Row label="Announcements up / scheduled" value={`${liveAnn} / ${scheduled}`} />
        <Divider />
        <Row label="Promo codes unused / used" value={codes ? `${codes.open} / ${codes.used}` : '…'} />
        <Divider />
        <Row label="Switches off" value={String(off + (flags.maintenance === true ? 1 : 0))} />
        <Divider />
        <Row label="Maintenance mode" value={flags.maintenance === true ? 'ON' : 'off'} />
        <View style={{ padding: 12 }}>
          <Button
            title="Export counts (CSV)"
            kind="plain"
            onPress={() =>
              void Share.share({
                message: toCsv([
                  ['metric', 'value'],
                  ['accounts', accounts ?? 0],
                  ['messages_all_time', live ?? 0],
                  ['banned_or_chat_off', banList.length],
                  ['waiting_beam', waiting],
                  ['open_reports', reports ?? 0],
                  ['announcements_live', liveAnn],
                  ['announcements_scheduled', scheduled],
                  ['promo_unused', codes?.open ?? 0],
                  ['promo_used', codes?.used ?? 0],
                  ['switches_off', off + (flags.maintenance === true ? 1 : 0)],
                  ['exported_at', new Date().toISOString()],
                ]),
              }).catch(() => {})
            }
          />
        </View>
      </Section>
      <Section title="Latest admin actions">
        {log.length === 0 ? <Note>Nothing yet.</Note> : null}
        {log.map((e, i) => (
          <View key={e.id}>
            {i ? <Divider /> : null}
            <Row label={e.action} sub={`${e.detail ? `${e.detail} · ` : ''}${new Date(e.at).toLocaleString()}`} />
          </View>
        ))}
      </Section>
    </>
  );
}

export function AdminSwitches() {
  const flags = useFlags();
  const [cfg, setCfg] = useState<api.ServerConfig | null>(null);
  const [mmsg, setMmsg] = useState<string | null>(null);
  const [note, setNote] = useState<Tone | null>(null);
  useEffect(() => {
    void api.getConfig().then(setCfg).catch(fail(setNote));
  }, []);

  const flip = (k: string, v: boolean, label: string) =>
    void flipFlag(k, v)
      .then(() => setNote({ text: label, tone: 'ok' }))
      .catch(fail(setNote));
  const server = (k: keyof api.ServerConfig, v: boolean, label: string) =>
    void getToken()
      .then((t) => api.setConfig(t ?? '', { [k]: v }))
      .then((c) => {
        setCfg(c);
        void audit('flag', `${k} ${v ? 'on' : 'off'}`);
        setNote({ text: `${label} ${v ? 'on' : 'off'}.`, tone: 'ok' });
      })
      .catch(fail(setNote));
  const msgShown = mmsg ?? (typeof flags.maintenanceMsg === 'string' ? flags.maintenanceMsg : '');
  const setMany = (keys: string[], v: boolean, label: string) =>
    void Promise.all(keys.map((k) => setFlag(k, v)))
      .then(() => audit('flag', `${label} ${v ? 'all on' : 'all off'}`))
      .then(() => setNote({ text: `${label}: all ${v ? 'on' : 'off'}.`, tone: 'ok' }))
      .catch(fail(setNote));

  return (
    <>
      {note ? <Note tone={note.tone}>{note.text}</Note> : null}
      <Section title="Maintenance mode" footer="On = everyone but you sees a 'Be right back' screen until you turn it off.">
        <ToggleRow label="Maintenance mode" value={flags.maintenance === true} onChange={(v) => flip('maintenance', v, v ? 'Maintenance mode on. Only you can use the app.' : 'Maintenance mode off.')} />
        <View style={{ padding: 12, gap: 8 }}>
          <Field value={msgShown} onChangeText={setMmsg} placeholder="Message people see (optional)" maxLength={200} multiline />
          <Button
            title="Save message"
            kind="plain"
            onPress={() =>
              void setDoc(doc(fbDb(), 'config', 'flags'), { maintenanceMsg: msgShown.trim() }, { merge: true })
                .then(() => audit('maintenance.msg', msgShown.trim().slice(0, 60)))
                .then(() => setNote({ text: 'Message saved.', tone: 'ok' }))
                .catch(fail(setNote))
            }
          />
        </View>
      </Section>

      <Section title="Core services" footer="Off = that service pauses for everyone right away. The clock and alerts keep working.">
        {cfg ? (
          <>
            <ToggleRow label="Sign-ups" value={cfg.signup} onChange={(v) => server('signup', v, 'Sign-ups')} />
            <Divider />
            <ToggleRow label="Sharing schools and schedules" value={cfg.sharing} onChange={(v) => server('sharing', v, 'Sharing')} />
            <Divider />
            <ToggleRow label="Schedule reader (AI)" value={cfg.ai} onChange={(v) => server('ai', v, 'Reader')} />
            <Divider />
            <ToggleRow label="Messages (beta)" sub="Off hides the Beam button for everyone but you" value={cfg.messaging} onChange={(v) => server('messaging', v, 'Messages')} />
            <Divider />
            <ToggleRow label="One-time promo codes" sub="Off = new codes can't be redeemed" value={flags.promos !== false} onChange={(v) => flip('promos', v, `Promo codes ${v ? 'on' : 'off'}.`)} />
          </>
        ) : (
          <Note>Loading…</Note>
        )}
      </Section>

      <Section title="App areas" footer="Off = that screen shows 'paused' with a Go back button, for everyone but you.">
        {AREAS.map((a, i) => (
          <View key={a.key}>
            {i ? <Divider /> : null}
            <ToggleRow label={a.label} sub={a.sub} value={flags[areaFlag(a.key)] !== false} onChange={(v) => flip(areaFlag(a.key), v, `${a.label} ${v ? 'on' : 'off'}.`)} />
          </View>
        ))}
        <View style={{ padding: 12, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="All on" kind="plain" onPress={() => setMany(AREAS.map((a) => areaFlag(a.key)), true, 'App areas')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="All off" kind="danger" onPress={() => setMany(AREAS.map((a) => areaFlag(a.key)), false, 'App areas')} />
          </View>
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
            <Button title="All on" kind="plain" onPress={() => setMany(FEATURES.map((f) => f.key), true, 'Beam features')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="All off" kind="danger" onPress={() => setMany(FEATURES.map((f) => f.key), false, 'Beam features')} />
          </View>
        </View>
      </Section>
    </>
  );
}
