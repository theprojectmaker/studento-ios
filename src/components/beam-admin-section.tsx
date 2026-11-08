/** Admin screen part for Beam: totals (counts only) and pop-up announcements. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Divider, Field, Note, Row, Section, ToggleRow } from '@/components/ui';
import { decide, postAnnouncement, setFlag, takeDown, totals, watchAccessList, watchAnnouncements, watchMessageCount, type AccessRequest, type Announcement } from '@/lib/beam-extra';
import { useBeamFlags } from '@/lib/beam-on';

export function BeamAdminSection() {
  const [live, setLive] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<number | null>(null);
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [closable, setClosable] = useState(true);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const { waitlist } = useBeamFlags();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  useEffect(() => watchAccessList(setRequests), []);

  useEffect(() => watchMessageCount(setLive), []);
  useEffect(() => watchAnnouncements(setList), []);
  useEffect(() => {
    void totals()
      .then((t) => setAccounts(t.accounts))
      .catch(() => {});
  }, []);

  const post = async () => {
    try {
      await postAnnouncement(title, body, closable);
      setTitle('');
      setBody('');
      setMsg({ text: 'Posted. Everyone sees it now.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed', tone: 'error' });
    }
  };

  return (
    <>
      <Section title="Beam totals" footer="Counts only. Messages updates live.">
        <Row label="Messages sent" value={live === null ? '…' : live.toLocaleString()} />
        <Divider />
        <Row label="Accounts" value={accounts === null ? '…' : accounts.toLocaleString()} />
      </Section>

      <Section title="Waiting list" footer="On = everyone you have not let in yet must ask to join Beam and wait for you. Turn it on, then let in the people already using Beam.">
        <ToggleRow label="Waiting list" value={waitlist} onChange={(v) => void setFlag('waitlist', v).catch(() => {})} />
        {requests.length === 0 ? <Note>No one has asked yet.</Note> : null}
        {requests.map((r) => (
          <View key={r.uid}>
            <Divider />
            <Row
              label={r.num ? `#${r.num} ${r.username}` : r.username}
              sub={r.status === 'waiting' ? `Waiting since ${new Date(r.at).toLocaleString()}` : r.status === 'approved' ? 'Let in' : 'Denied'}
              right={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {r.status !== 'approved' ? <Button title="Let in" onPress={() => void decide(r.uid, 'approved').catch(() => {})} /> : null}
                  {r.status !== 'denied' ? <Button title="Deny" kind="danger" onPress={() => void decide(r.uid, 'denied').catch(() => {})} /> : null}
                </View>
              }
            />
          </View>
        ))}
      </Section>

      <Section title="Pop-up announcements" footer="Shows to everyone with Beam. A permanent one stays on screen until you take it down.">
        <View style={{ gap: 8, padding: 12 }}>
          <Field value={title} onChangeText={setTitle} placeholder="Title" maxLength={80} />
          <Field value={body} onChangeText={setBody} placeholder="Message" maxLength={600} multiline />
        </View>
        <ToggleRow label="People can close it" sub={closable ? 'Closable' : 'Permanent until you take it down'} value={closable} onChange={setClosable} />
        <View style={{ padding: 12 }}>
          <Button title="Post announcement" disabled={!title.trim()} onPress={() => void post()} />
        </View>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        {list.map((a) => (
          <View key={a.id}>
            <Divider />
            <Row label={a.title} sub={`${a.closable ? 'Closable' : 'Permanent'} · ${new Date(a.createdAt).toLocaleString()}`} right={<Button title="Take down" kind="danger" onPress={() => void takeDown(a.id).catch(() => {})} />} />
          </View>
        ))}
      </Section>
    </>
  );
}
