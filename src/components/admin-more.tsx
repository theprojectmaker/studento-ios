/** Admin tabs: one-time promo codes, app config values and the audit log. */
import { useEffect, useState } from 'react';
import { Alert, Platform, Share, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Row, Section, Segmented } from '@/components/ui';
import { deleteCode, generateCodes, listCodes, PROMO_UNLOCKS, revokeCode, saveAppConfig, useAppConfig, watchAudit, type AuditEntry, type PromoCode } from '@/lib/admin-tools';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { THEMES } from '@/lib/themes';

type Tone = { text: string; tone: 'ok' | 'error' };
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Failed');

async function copyOrShare(text: string, how: 'copy' | 'share'): Promise<string> {
  const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
  if (how === 'copy' && Platform.OS === 'web' && nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text);
    return 'Copied.';
  }
  // The iOS share sheet has Copy at the top, so it covers both.
  await Share.share({ message: text });
  return '';
}

export function PromoCodesAdmin() {
  const theme = useTheme();
  const [list, setList] = useState<PromoCode[] | null>(null);
  const [n, setN] = useState('10');
  const [unlock, setUnlock] = useState(PROMO_UNLOCKS[0].id);
  const [batch, setBatch] = useState('');
  const [fresh, setFresh] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<'open' | 'used' | 'revoked'>('open');
  const [msg, setMsg] = useState<Tone | null>(null);

  const load = () =>
    void listCodes()
      .then(setList)
      .catch((e: unknown) => {
        setList([]);
        setMsg({ text: errText(e), tone: 'error' });
      });
  useEffect(load, []);

  const make = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const codes = await generateCodes(Number(n) || 1, unlock, batch.trim());
      setFresh(codes);
      setMsg({ text: `Made ${codes.length} codes. Only this device can show them again, so share them now.`, tone: 'ok' });
      load();
    } catch (e) {
      setMsg({ text: errText(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const act = (p: () => Promise<unknown>, ok: string) =>
    void p()
      .then(() => {
        setMsg({ text: ok, tone: 'ok' });
        load();
      })
      .catch((e: unknown) => setMsg({ text: errText(e), tone: 'error' }));
  const confirm = (title: string, go: () => void) => {
    if (Platform.OS === 'web') return go();
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', style: 'destructive', onPress: go },
    ]);
  };
  const out = (text: string, how: 'copy' | 'share') =>
    void copyOrShare(text, how)
      .then((m) => m && setMsg({ text: m, tone: 'ok' }))
      .catch(() => {});

  const all = list ?? [];
  const shown = all.filter((c) => (show === 'revoked' ? c.revoked : show === 'used' ? c.used && !c.revoked : !c.used && !c.revoked));
  const label = (id: string) => PROMO_UNLOCKS.find((u) => u.id === id)?.label ?? id;

  return (
    <>
      <Section title="Make one-time codes" footer="Each code works once, for one signed-in account. Only a hash is saved online; the words stay on this device.">
        <View style={{ padding: 12, gap: 8 }}>
          <Note>Unlocks</Note>
          <Segmented value={unlock} onChange={setUnlock} options={PROMO_UNLOCKS.map((u) => ({ value: u.id, label: u.label }))} />
          <Field value={n} onChangeText={(t) => setN(t.replace(/\D/g, '').slice(0, 3))} placeholder="How many (1-200)" keyboardType="number-pad" />
          <Field value={batch} onChangeText={setBatch} placeholder="Label for this batch (optional)" maxLength={40} />
          <Button title={busy ? 'Making…' : `Make ${Number(n) || 1} codes`} disabled={busy} onPress={() => void make()} />
        </View>
        {fresh.length ? (
          <View style={{ padding: 12, gap: 8 }}>
            <Text selectable style={{ ...TYPE.semibold, fontSize: sz(16), color: theme.ink, lineHeight: sz(24) }}>
              {fresh.join('\n')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Copy all" kind="plain" onPress={() => out(fresh.join('\n'), 'copy')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Share all" onPress={() => out(fresh.join('\n'), 'share')} />
              </View>
            </View>
          </View>
        ) : null}
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      </Section>

      <Section title={`Codes (${all.filter((c) => !c.used && !c.revoked).length} unused · ${all.filter((c) => c.used).length} used)`}>
        <View style={{ padding: 12 }}>
          <Segmented
            value={show}
            onChange={setShow}
            options={[
              { value: 'open', label: 'Unused' },
              { value: 'used', label: 'Used' },
              { value: 'revoked', label: 'Revoked' },
            ]}
          />
        </View>
        {list === null ? <Note>Loading…</Note> : shown.length === 0 ? <Note>None.</Note> : null}
        {shown.map((c) => (
          <View key={c.hash}>
            <Divider />
            <Row
              label={c.code ?? c.hint}
              sub={`${label(c.unlock)}${c.batch ? ` · ${c.batch}` : ''} · ${new Date(c.createdAt).toLocaleDateString()}${c.used ? ` · used by ${c.usedName || 'someone'} ${c.usedAt ? new Date(c.usedAt).toLocaleString() : ''}` : ''}${c.code ? '' : ' · made on another device'}`}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 10 }}>
              {c.code ? <Button title="Copy" kind="plain" onPress={() => out(c.code ?? '', 'copy')} /> : null}
              {c.code ? <Button title="Share" kind="plain" onPress={() => out(`Your Studento code: ${c.code}\nOpen Studento > Settings > Redeem a code.`, 'share')} /> : null}
              {!c.used && !c.revoked ? <Button title="Revoke" kind="danger" onPress={() => confirm(`Revoke ${c.code ?? c.hint}?`, () => act(() => revokeCode(c), 'Revoked.'))} /> : null}
              {c.revoked || c.used ? <Button title="Delete" kind="plain" onPress={() => confirm('Delete this code record?', () => act(() => deleteCode(c), 'Deleted.'))} /> : null}
            </View>
          </View>
        ))}
      </Section>
    </>
  );
}

export function AppConfigAdmin() {
  const cfg = useAppConfig();
  const [text, setText] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [rkey, setRkey] = useState('');
  const [rpct, setRpct] = useState('');
  const [msg, setMsg] = useState<Tone | null>(null);
  const save = (patch: Parameters<typeof saveAppConfig>[0], ok: string) =>
    void saveAppConfig(patch)
      .then(() => setMsg({ text: ok, tone: 'ok' }))
      .catch((e: unknown) => setMsg({ text: errText(e), tone: 'error' }));
  const shownText = text ?? cfg.remoteText;
  const shownTheme = theme ?? cfg.defaultTheme;
  const known = THEMES.some((t) => t.id === shownTheme);

  return (
    <>
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      <Section title="Remote text" footer="A line shown at the bottom of Settings for everyone. Empty = nothing.">
        <View style={{ padding: 12, gap: 8 }}>
          <Field value={shownText} onChangeText={setText} placeholder="e.g. New themes this week!" maxLength={200} multiline />
          <Button title="Save text" kind="plain" onPress={() => save({ remoteText: shownText.trim() }, 'Text saved.')} />
        </View>
      </Section>
      <Section title="Default theme" footer={`Theme id for new installs. ${shownTheme && !known ? 'Not a known theme id.' : ''}`}>
        <View style={{ padding: 12, gap: 8 }}>
          <Field value={shownTheme} onChangeText={setTheme} placeholder="Theme id (empty = app default)" autoCapitalize="none" autoCorrect={false} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {THEMES.slice(0, 8).map((t) => (
              <Button key={t.id} title={t.name} kind={shownTheme === t.id ? undefined : 'plain'} onPress={() => setTheme(t.id)} />
            ))}
          </View>
          <Button title="Save default theme" kind="plain" disabled={!!shownTheme && !known} onPress={() => save({ defaultTheme: shownTheme.trim() }, 'Default theme saved.')} />
        </View>
      </Section>
      <Section title="Feature rollout" footer="Percent of accounts that get a feature, by key. Each account always lands in the same bucket.">
        {Object.entries(cfg.rollout).map(([k, v]) => (
          <View key={k}>
            <Row label={k} value={`${v}%`} right={<Button title="Remove" kind="plain" onPress={() => save({ rollout: Object.fromEntries(Object.entries(cfg.rollout).filter(([x]) => x !== k)) }, 'Removed.')} />} />
            <Divider />
          </View>
        ))}
        <View style={{ padding: 12, gap: 8 }}>
          <Field value={rkey} onChangeText={(t) => setRkey(t.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30))} placeholder="Feature key" autoCapitalize="none" autoCorrect={false} />
          <Field value={rpct} onChangeText={(t) => setRpct(t.replace(/\D/g, '').slice(0, 3))} placeholder="Percent (0-100)" keyboardType="number-pad" />
          <Button title="Set rollout" disabled={!rkey || rpct === ''} onPress={() => save({ rollout: { ...cfg.rollout, [rkey]: Math.min(100, Number(rpct)) } }, `${rkey} at ${Math.min(100, Number(rpct))}%.`)} />
        </View>
      </Section>
    </>
  );
}

export function AuditLogAdmin() {
  const [log, setLog] = useState<AuditEntry[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => watchAudit(setLog), []);
  const shown = (log ?? []).filter((e) => !q.trim() || `${e.action} ${e.detail} ${e.by}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Section title="Audit log" footer="Every admin action, newest first. Entries can't be edited or deleted.">
      <View style={{ padding: 12 }}>
        <Field value={q} onChangeText={setQ} placeholder="Filter" autoCapitalize="none" autoCorrect={false} />
      </View>
      {log === null ? <Note>Loading…</Note> : shown.length === 0 ? <Note>Nothing yet.</Note> : null}
      {shown.map((e) => (
        <View key={e.id}>
          <Divider />
          <Row label={e.action} sub={`${e.detail ? `${e.detail} · ` : ''}${e.by} · ${new Date(e.at).toLocaleString()}`} />
        </View>
      ))}
    </Section>
  );
}
