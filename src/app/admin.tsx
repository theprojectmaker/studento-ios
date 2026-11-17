/**
 * Owner tools, in tabs. Only admin accounts reach it (long-press the version line in Settings),
 * and it asks for Face ID / Touch ID (or the device passcode) every time it opens.
 */
import { requireOptionalNativeModule } from 'expo';
import * as FA from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { AccountsAdmin } from '@/components/accounts-admin';
import { AdminDashboard, AdminSwitches } from '@/components/admin-control';
import { AppConfigAdmin, AuditLogAdmin, PromoCodesAdmin } from '@/components/admin-more';
import { AnnouncementsAdmin, WaitlistAdmin } from '@/components/beam-admin-section';
import { Button, Divider, Field, Note, Row, Screen, Section } from '@/components/ui';
import { audit } from '@/lib/admin-tools';
import { currentUser } from '@/lib/fb';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { useStore } from '@/lib/store';

const hasLA = !!requireOptionalNativeModule('ExpoLocalAuthentication');

/** Face ID / Touch ID, falling back to the device passcode. False = cancelled or failed. */
async function deviceAuth(): Promise<boolean | 'none'> {
  if (!hasLA) return 'none';
  const LA = await import('expo-local-authentication');
  if ((await LA.getEnrolledLevelAsync()) === LA.SecurityLevel.NONE) return 'none';
  const r = await LA.authenticateAsync({ promptMessage: 'Open tools', disableDeviceFallback: false });
  return r.success;
}

const TABS = [
  ['dash', 'Dashboard'],
  ['switches', 'Switches'],
  ['announce', 'Announce'],
  ['accounts', 'Accounts'],
  ['waitlist', 'Waitlist'],
  ['codes', 'Codes'],
  ['reports', 'Reports'],
  ['schools', 'Schools'],
  ['config', 'Config'],
  ['log', 'Log'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function Admin() {
  const account = useStore((s) => s.account);
  const [ok, setOk] = useState(false);
  const [mode, setMode] = useState<'checking' | 'failed' | 'password'>('checking');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('dash');

  const ask = () =>
    void deviceAuth()
      .then((r) => (r === 'none' ? setMode('password') : r ? setOk(true) : setMode('failed')))
      .catch(() => setMode('failed'));
  const check = () => {
    setMode('checking');
    ask();
  };
  const isAdmin = !!account?.user.admin;
  useEffect(() => {
    if (isAdmin) ask();
  }, [isAdmin]);
  useEffect(() => {
    if (ok) void audit('open', Platform.OS);
  }, [ok]);

  if (!account?.user.admin) return <Screen><Note>Nothing here.</Note></Screen>;
  if (!ok) {
    const withPassword = async () => {
      setErr('');
      try {
        const u = await currentUser();
        if (!u?.email) throw new Error('Sign in first.');
        await FA.reauthenticateWithCredential(u, FA.EmailAuthProvider.credential(u.email, pw));
        setOk(true);
      } catch {
        setErr('Wrong password.');
      }
    };
    return (
      <Screen>
        <Section title="Locked" footer={mode === 'password' ? 'This device has no Face ID, Touch ID or passcode, so enter your account password.' : 'Confirm it is you to continue.'}>
          <View style={{ padding: 12, gap: 8 }}>
            {mode === 'password' ? (
              <>
                <Field value={pw} onChangeText={setPw} placeholder="Account password" secureTextEntry autoCapitalize="none" onSubmitEditing={() => void withPassword()} />
                <Button title="Unlock" disabled={!pw} onPress={() => void withPassword()} />
              </>
            ) : (
              <Button title={mode === 'checking' ? 'Checking…' : 'Try again'} disabled={mode === 'checking'} onPress={check} />
            )}
            {err ? <Note tone="error">{err}</Note> : null}
          </View>
        </Section>
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
        {TABS.map(([k, l]) => (
          <Button key={k} title={l} kind={tab === k ? undefined : 'plain'} onPress={() => setTab(k)} />
        ))}
      </ScrollView>
      <View style={{ flex: 1 }}>
        {tab === 'dash' ? <Screen><AdminDashboard /></Screen> : null}
        {tab === 'switches' ? <Screen><AdminSwitches /></Screen> : null}
        {tab === 'announce' ? <Screen><AnnouncementsAdmin /></Screen> : null}
        {tab === 'accounts' ? <Screen><AccountsAdmin /></Screen> : null}
        {tab === 'waitlist' ? <Screen><WaitlistAdmin /></Screen> : null}
        {tab === 'codes' ? <Screen><PromoCodesAdmin /></Screen> : null}
        {tab === 'reports' || tab === 'schools' ? <Moderation tab={tab} /> : null}
        {tab === 'config' ? <Screen><AppConfigAdmin /></Screen> : null}
        {tab === 'log' ? <Screen><AuditLogAdmin /></Screen> : null}
      </View>
    </View>
  );
}

/** Reports and shared schools/schedules (the original admin page). */
function Moderation({ tab }: { tab: 'reports' | 'schools' }) {
  const [schools, setSchools] = useState<api.SchoolHit[]>([]);
  const [open, setOpen] = useState<{ school: { id: number; name: string }; schedules: api.BellSet[] } | null>(null);
  const [rename, setRename] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [reports, setReports] = useState<api.Report[] | null>(null);

  const refresh = async () => {
    try {
      setSchools(await api.searchSchools(''));
      const t = await getToken();
      if (t) setReports(await api.listReports(t));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Offline', tone: 'error' });
    }
  };
  useEffect(() => {
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
      void audit('moderate', label);
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

  return (
    <Screen>
      {tab === 'reports' ? (
      <Section title="Reports" footer="What students flagged on shared schools and schedules. Delete removes the flagged item; Dismiss just clears the report.">
        {reports === null ? <Note>Loading…</Note> : reports.length === 0 ? <Note>No reports.</Note> : null}
        {(reports ?? []).map((r, i) => (
          <View key={r.id}>
            {i ? <Divider /> : null}
            <View style={{ padding: 14, gap: 8 }}>
              <Row label={`${r.kind === 'school' ? 'School' : r.kind === 'message' ? 'Message' : 'Schedule'}: ${r.targetName}`} sub={`${r.reason}${r.note ? ` · ${r.note}` : ''} · ${new Date(r.createdAt).toLocaleDateString()}${r.status === 'dismissed' ? ' · dismissed' : ''}`} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title={r.kind === 'school' ? 'Delete school' : r.kind === 'message' ? 'Delete message' : 'Delete schedule'} kind="danger" onPress={() => confirm(`Delete “${r.targetName}”?`, 'This removes the flagged item for everyone and closes the report.', () => void run('Removed.', async (t) => { if (r.kind === 'school') await api.deleteSchool(t, r.targetId); else if (r.kind === 'message') await api.deleteMessage(t, r.targetId); else await api.deleteSchedule(t, r.targetId); await api.deleteReport(t, r.id); }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={r.status === 'dismissed' ? 'Clear' : 'Dismiss'} kind="plain" onPress={() => void run('Report cleared.', (t) => (r.status === 'dismissed' ? api.deleteReport(t, r.id) : api.dismissReport(t, r.id)))} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </Section>
      ) : null}

      {tab !== 'schools' ? null : open ? (
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
