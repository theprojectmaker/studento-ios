/** Owner tools: kill switches and moderation of shared schools and schedules. Only for admin accounts. */
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, Divider, Field, Note, Row, Screen, Section, ToggleRow } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { useStore } from '@/lib/store';

export default function Admin() {
  const account = useStore((s) => s.account);
  const [cfg, setCfg] = useState<api.ServerConfig | null>(null);
  const [schools, setSchools] = useState<api.SchoolHit[]>([]);
  const [open, setOpen] = useState<{ school: { id: number; name: string }; schedules: api.BellSet[] } | null>(null);
  const [rename, setRename] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [reports, setReports] = useState<api.Report[] | null>(null);

  const refresh = async () => {
    try {
      setCfg(await api.getConfig());
      setSchools(await api.searchSchools(''));
      const t = await getToken();
      if (t) setReports(await api.listReports(t));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Offline', tone: 'error' });
    }
  };
  useEffect(() => {
    void api
      .getConfig()
      .then(setCfg)
      .catch((e: unknown) => setMsg({ text: e instanceof Error ? e.message : 'Offline', tone: 'error' }));
    void api
      .searchSchools('')
      .then(setSchools)
      .catch(() => undefined);
    void getToken()
      .then((t) => (t ? api.listReports(t) : []))
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  const run = async (label: string, fn: (token: string) => Promise<unknown>) => {
    setMsg(null);
    const t = await getToken();
    if (!t) return setMsg({ text: 'Sign in first.', tone: 'error' });
    try {
      await fn(t);
      setMsg({ text: label, tone: 'ok' });
      await refresh();
      if (open) {
        try {
          const r = await api.getSchool(open.school.id);
          setOpen({ school: r.school, schedules: r.schedules });
        } catch {
          setOpen(null);
        }
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' });
    }
  };
  const confirm = (title: string, body: string, go: () => void) => {
    if (Platform.OS === 'web') return go();
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  if (!account?.user.admin) return <Screen><Note>Admin tools are only for the owner account.</Note></Screen>;

  return (
    <Screen>
      <Section title="Reports" footer="What students flagged on shared schools and schedules. Delete removes the flagged item; Dismiss just clears the report.">
        {reports === null ? <Note>Loading…</Note> : reports.length === 0 ? <Note>No reports.</Note> : null}
        {(reports ?? []).map((r, i) => (
          <View key={r.id}>
            {i ? <Divider /> : null}
            <View style={{ padding: 14, gap: 8 }}>
              <Row label={`${r.kind === 'school' ? 'School' : 'Schedule'}: ${r.targetName}`} sub={`${r.reason}${r.note ? ` · ${r.note}` : ''} · ${new Date(r.createdAt).toLocaleDateString()}${r.status === 'dismissed' ? ' · dismissed' : ''}`} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title={r.kind === 'school' ? 'Delete school' : 'Delete schedule'} kind="danger" onPress={() => confirm(`Delete “${r.targetName}”?`, 'This removes the flagged item for everyone and closes the report.', () => void run('Removed.', async (t) => { if (r.kind === 'school') await api.deleteSchool(t, r.targetId); else await api.deleteSchedule(t, r.targetId); await api.deleteReport(t, r.id); }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={r.status === 'dismissed' ? 'Clear' : 'Dismiss'} kind="plain" onPress={() => void run('Report cleared.', (t) => (r.status === 'dismissed' ? api.deleteReport(t, r.id) : api.dismissReport(t, r.id)))} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Kill switches" footer="Off = that feature pauses for everyone right away. The clock and alerts keep working.">
        {cfg ? (
          <>
            <ToggleRow label="Sign-ups" value={cfg.signup} onChange={(v) => void run(`Sign-ups ${v ? 'on' : 'off'}`, (t) => api.setConfig(t, { signup: v }))} />
            <Divider />
            <ToggleRow label="Sharing schools and schedules" value={cfg.sharing} onChange={(v) => void run(`Sharing ${v ? 'on' : 'off'}`, (t) => api.setConfig(t, { sharing: v }))} />
            <Divider />
            <ToggleRow label="Schedule reader (AI)" value={cfg.ai} onChange={(v) => void run(`Reader ${v ? 'on' : 'off'}`, (t) => api.setConfig(t, { ai: v }))} />
          </>
        ) : (
          <Note>Loading…</Note>
        )}
      </Section>

      {open ? (
        <>
          <Section title={open.school.name} footer="Rename, or delete schedules that are wrong.">
            <View style={{ padding: 12, gap: 10 }}>
              <Field value={rename} onChangeText={setRename} placeholder="New school name" maxLength={80} accessibilityLabel="New school name" />
              <Button title="Rename school" kind="plain" disabled={rename.trim().length < 3} onPress={() => void run('Renamed.', (t) => api.renameSchool(t, open.school.id, rename.trim()))} />
            </View>
            {open.schedules.map((s, i) => (
              <View key={s.id}>
                <Divider />
                <Row label={s.name} sub={`#${s.id}`} right={<Button title="Delete" kind="danger" onPress={() => confirm(`Delete "${s.name}"?`, 'Students using it keep their cached copy.', () => void run('Schedule deleted.', (t) => api.deleteSchedule(t, s.id)))} />} />
                {i === open.schedules.length - 1 ? null : null}
              </View>
            ))}
          </Section>
          <Button title="Delete this school and all its schedules" kind="danger" onPress={() => confirm(`Delete "${open.school.name}"?`, 'This removes the school and every schedule under it.', () => void run('School deleted.', (t) => api.deleteSchool(t, open.school.id)).then(() => setOpen(null)))} />
          <Button title="Back to schools" kind="plain" onPress={() => setOpen(null)} />
        </>
      ) : (
        <Section title="Shared schools" footer="Tap one to rename it or remove bad schedules.">
          {schools.map((h, i) => (
            <View key={h.id}>
              {i ? <Divider /> : null}
              <Row
                label={h.name}
                sub={`${h.schedules} schedules · #${h.id}`}
                onPress={async () => {
                  try {
                    const r = await api.getSchool(h.id);
                    setOpen({ school: r.school, schedules: r.schedules });
                    setRename(r.school.name);
                  } catch (e) {
                    setMsg({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' });
                  }
                }}
              />
            </View>
          ))}
          {schools.length === 0 ? <Note>No schools yet.</Note> : null}
        </Section>
      )}
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
    </Screen>
  );
}
