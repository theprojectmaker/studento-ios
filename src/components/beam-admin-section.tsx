/** Admin screen parts: Beam waiting list (with bulk tools) and scheduled, targeted announcements. */
import { deleteDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DurationPick, flipFlag } from '@/components/admin-control';
import { Button, Divider, Field, Note, Row, Section, Segmented, ToggleRow } from '@/components/ui';
import { audit } from '@/lib/admin-tools';
import { decide, postAnnouncement, takeDown, watchAccessList, watchAnnouncements, type AccessRequest, type Announcement } from '@/lib/beam-extra';
import { useBeamFlags } from '@/lib/beam-on';
import { registerAdmin } from '@/lib/beam-social';
import { fbDb } from '@/lib/fb';

type Tone = { text: string; tone: 'ok' | 'error' };
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Failed');

export function WaitlistAdmin() {
  const { waitlist } = useBeamFlags();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [show, setShow] = useState<'waiting' | 'approved' | 'denied'>('waiting');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<Tone | null>(null);
  useEffect(() => watchAccessList(setRequests), []);
  // Put this admin on the public list so nobody can block them.
  useEffect(() => {
    void registerAdmin().catch(() => {});
  }, []);

  const waiting = requests.filter((r) => r.status === 'waiting').sort((a, b) => (a.num ?? a.at) - (b.num ?? b.at));
  const bulk = async (list: AccessRequest[], status: 'approved' | 'denied' | 'remove', label: string) => {
    try {
      await Promise.all(list.map((r) => (status === 'remove' ? deleteDoc(doc(fbDb(), 'access', r.uid)) : decide(r.uid, status))));
      void audit(`waitlist.${status}`, `${list.length} people`);
      setMsg({ text: `${label}: ${list.length}.`, tone: 'ok' });
    } catch (e) {
      setMsg({ text: errText(e), tone: 'error' });
    }
  };
  const shown = requests.filter((r) => r.status === show).filter((r) => !q.trim() || r.username.includes(q.trim().toLowerCase()));
  const count = (s: string) => requests.filter((r) => r.status === s).length;

  return (
    <>
      <Section title="Waiting list" footer="On = everyone you have not let in yet must ask to join Beam and wait for you.">
        <ToggleRow label="Waiting list" value={waitlist} onChange={(v) => void flipFlag('waitlist', v).catch(() => {})} />
        <View style={{ padding: 12, gap: 8 }}>
          <Note>{`${count('waiting')} waiting · ${count('approved')} let in · ${count('denied')} denied`}</Note>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Button title="Let in next 10" disabled={!waiting.length} onPress={() => void bulk(waiting.slice(0, 10), 'approved', 'Let in')} />
            <Button title="Let in next 50" kind="plain" disabled={!waiting.length} onPress={() => void bulk(waiting.slice(0, 50), 'approved', 'Let in')} />
            <Button title="Let everyone in" kind="plain" disabled={!waiting.length} onPress={() => void bulk(waiting, 'approved', 'Let in')} />
            <Button title="Deny everyone waiting" kind="danger" disabled={!waiting.length} onPress={() => void bulk(waiting, 'denied', 'Denied')} />
            <Button title="Clear denied from list" kind="plain" disabled={!count('denied')} onPress={() => void bulk(requests.filter((r) => r.status === 'denied'), 'remove', 'Removed')} />
          </View>
        </View>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      </Section>
      <Section title="People">
        <View style={{ padding: 12, gap: 8 }}>
          <Segmented
            value={show}
            onChange={setShow}
            options={[
              { value: 'waiting', label: 'Waiting' },
              { value: 'approved', label: 'Let in' },
              { value: 'denied', label: 'Denied' },
            ]}
          />
          <Field value={q} onChangeText={setQ} placeholder="Find a username" autoCapitalize="none" autoCorrect={false} />
        </View>
        {shown.length === 0 ? <Note>No one here.</Note> : null}
        {shown.map((r) => (
          <View key={r.uid}>
            <Divider />
            <Row
              label={r.num ? `#${r.num} ${r.username}` : r.username}
              sub={new Date(r.at).toLocaleString()}
              right={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {r.status !== 'approved' ? <Button title="Let in" onPress={() => void bulk([r], 'approved', 'Let in')} /> : null}
                  {r.status !== 'denied' ? <Button title="Deny" kind="danger" onPress={() => void bulk([r], 'denied', 'Denied')} /> : null}
                </View>
              }
            />
          </View>
        ))}
      </Section>
    </>
  );
}

const STARTS: [string, number][] = [
  ['Now', 0],
  ['In 1 hour', 3600_000],
  ['Tomorrow 8am', -1],
  ['In 7 days', 7 * 86400_000],
];
function startTime(choice: number): number {
  if (choice === 0) return 0;
  if (choice > 0) return Date.now() + choice;
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

export function AnnouncementsAdmin() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [closable, setClosable] = useState(true);
  const [lasts, setLasts] = useState(0);
  const [start, setStart] = useState(0);
  const [audience, setAudience] = useState<'all' | 'beam'>('all');
  const [now] = useState(() => Date.now());
  const [msg, setMsg] = useState<Tone | null>(null);
  useEffect(() => watchAnnouncements(setList), []);

  const post = async () => {
    try {
      const startAt = startTime(start);
      const from = startAt || Date.now();
      await postAnnouncement(title, body, closable, lasts ? from + lasts : 0, { startAt, audience });
      void audit('announce', `${title.trim().slice(0, 50)} → ${audience}${startAt ? ` @ ${new Date(startAt).toLocaleString()}` : ''}`);
      setTitle('');
      setBody('');
      setMsg({ text: startAt ? `Scheduled for ${new Date(startAt).toLocaleString()}.` : 'Posted.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: errText(e), tone: 'error' });
    }
  };

  return (
    <Section title="Announcements" footer="Pop-ups for everyone signed in, or only people with Beam. Schedule one for later, and it can take itself down.">
      <View style={{ gap: 8, padding: 12 }}>
        <Field value={title} onChangeText={setTitle} placeholder="Title" maxLength={80} />
        <Field value={body} onChangeText={setBody} placeholder="Message" maxLength={600} multiline />
        <Note>Who sees it</Note>
        <Segmented
          value={audience}
          onChange={setAudience}
          options={[
            { value: 'all', label: 'Everyone signed in' },
            { value: 'beam', label: 'Beam users' },
          ]}
        />
      </View>
      <ToggleRow label="People can close it" sub={closable ? 'Closable' : 'Permanent until you take it down'} value={closable} onChange={setClosable} />
      <View style={{ paddingHorizontal: 12, gap: 6 }}>
        <Note>Starts</Note>
        <DurationPick value={start} onChange={setStart} options={STARTS} />
        <Note>Takes itself down after</Note>
        <DurationPick value={lasts} onChange={setLasts} />
      </View>
      <View style={{ padding: 12 }}>
        <Button title={start ? 'Schedule announcement' : 'Post announcement'} disabled={!title.trim()} onPress={() => void post()} />
      </View>
      {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      {list.map((a) => {
        const state = a.startAt && a.startAt > now ? `starts ${new Date(a.startAt).toLocaleString()}` : a.until && a.until <= now ? 'ended' : 'live';
        return (
          <View key={a.id}>
            <Divider />
            <Row
              label={a.title}
              sub={`${state} · ${a.audience === 'all' ? 'everyone' : 'Beam users'} · ${a.closable ? 'closable' : 'permanent'}${a.until && a.until > now ? ` · ends ${new Date(a.until).toLocaleString()}` : ''}`}
              right={<Button title="Take down" kind="danger" onPress={() => void takeDown(a.id).then(() => audit('announce.down', a.title)).catch(() => {})} />}
            />
          </View>
        );
      })}
    </Section>
  );
}
