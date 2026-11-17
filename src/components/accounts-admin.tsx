/** Admin: every account, with chat ban / full ban and personal pop-ups. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Divider, Field, Note, Row, Section, ToggleRow } from '@/components/ui';
import { DurationPick } from '@/components/admin-control';
import { banOver, listAccounts, sendNotice, setBan, takeDownNotice, watchBans, watchNoticesFor, type Account, type Ban, type Notice } from '@/lib/beam-extra';

function AccountTools({ a, ban }: { a: Account; ban?: Ban }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [closable, setClosable] = useState(true);
  const [reason, setReason] = useState(ban?.reason ?? '');
  const [banFor, setBanFor] = useState(0);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  useEffect(() => watchNoticesFor(a.uid, setNotices), [a.uid]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      setMsg({ text: label, tone: 'ok' });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' });
    }
  };

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
      {ban ? <Note>{`${ban.level === 'full' ? 'Banned' : 'Chatting off'} since ${new Date(ban.at).toLocaleString()}${ban.until ? ` · until ${new Date(ban.until).toLocaleString()}` : ' · no end'}${ban.reason ? ` · ${ban.reason}` : ''}`}</Note> : null}
      <Field value={reason} onChangeText={setReason} placeholder="Reason they see (optional)" maxLength={200} />
      <Note>Ban lasts</Note>
      <DurationPick value={banFor} onChange={setBanFor} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ban?.level !== 'chat' ? <Button title="Turn off chatting" kind="plain" onPress={() => void run(`${a.username} can't message or call now.`, () => setBan(a.uid, 'chat', reason.trim(), banFor ? Date.now() + banFor : 0))} /> : null}
        {ban?.level !== 'full' ? <Button title="Ban fully" kind="danger" onPress={() => void run(`${a.username} is banned. The app won't work for them.`, () => setBan(a.uid, 'full', reason.trim(), banFor ? Date.now() + banFor : 0))} /> : null}
        {ban ? <Button title="Unban" onPress={() => void run(`${a.username} is back to normal.`, () => setBan(a.uid, null))} /> : null}
      </View>
      <Note>Pop-up just for {a.username}</Note>
      <Field value={title} onChangeText={setTitle} placeholder="Title" maxLength={80} />
      <Field value={body} onChangeText={setBody} placeholder="Message" maxLength={600} multiline />
      <ToggleRow label="They can close it" sub={closable ? 'Closable' : 'Stays until you take it down'} value={closable} onChange={setClosable} />
      <Button
        title="Send pop-up"
        disabled={!title.trim()}
        onPress={() =>
          void run('Sent.', async () => {
            await sendNotice(a.uid, title, body, closable);
            setTitle('');
            setBody('');
          })
        }
      />
      {notices.map((n) => (
        <Row key={n.id} label={n.title} sub={n.closable ? 'Closable' : 'Permanent'} right={<Button title="Take down" kind="danger" onPress={() => void run('Taken down.', () => takeDownNotice(n.id))} />} />
      ))}
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
    </View>
  );
}

export function AccountsAdmin() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [bans, setBans] = useState<Record<string, Ban>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'banned' | 'admins' | 'new'>('all');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => watchBans(setBans), []);
  // Timed bans whose time is up get removed for real (only the admin may delete bans).
  useEffect(() => {
    Object.values(bans).forEach((b) => {
      if (banOver(b)) void setBan(b.uid, null).catch(() => {});
    });
  }, [bans]);
  useEffect(() => {
    void listAccounts()
      .then(setAccounts)
      .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load accounts."));
  }, []);

  const newest = (accounts ?? []).slice(-25).map((a) => a.uid);
  const shown = (accounts ?? [])
    .filter((a) => !q.trim() || a.username.includes(q.trim().toLowerCase()) || String(a.num) === q.trim().replace('#', ''))
    .filter((a) => (only === 'banned' ? !!bans[a.uid] : only === 'admins' ? a.admin : only === 'new' ? newest.includes(a.uid) : true));
  if (only === 'new') shown.reverse();
  return (
    <Section title={`Accounts${accounts ? ` (${accounts.length})` : ''}`} footer="Tap an account to turn off its chatting, ban it fully (for a set time or for good, with a reason they see), or send it a pop-up only it sees.">
      <View style={{ padding: 12 }}>
        <Field value={q} onChangeText={setQ} placeholder="Find a username or #number" autoCapitalize="none" autoCorrect={false} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {([['all', 'All'], ['new', 'Newest 25'], ['banned', `Banned (${Object.keys(bans).length})`], ['admins', 'Admins']] as const).map(([k, l]) => (
            <Button key={k} title={l} kind={only === k ? undefined : 'plain'} onPress={() => setOnly(k)} />
          ))}
        </View>
      </View>
      {err ? <Note tone="error">{err}</Note> : null}
      {accounts === null && !err ? <Note>Loading…</Note> : null}
      {shown.map((a) => {
        const b = bans[a.uid];
        return (
          <View key={a.uid}>
            <Divider />
            <Row label={a.username} sub={`#${a.num}${a.admin ? ' · admin' : ''}${b ? (b.level === 'full' ? ' · banned' : ' · chatting off') : ''}`} onPress={() => setOpen(open === a.uid ? null : a.uid)} />
            {open === a.uid && !a.admin ? <AccountTools a={a} ban={b} /> : null}
          </View>
        );
      })}
    </Section>
  );
}
