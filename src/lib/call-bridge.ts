/**
 * Answers the call page's API requests from Firestore (see "Bridge mode" in server/public/call.html).
 * Signals and call status arrive through live listeners and wait in a buffer, so the page's
 * frequent polling costs nothing: Firestore only bills a read when something actually changes.
 */
import { addDoc, collection, doc, increment, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';

import * as api from './api';
import { currentUser, fbDb } from './fb';

type Signal = { id: number; kind: string; data: unknown };

export class CallBridge {
  private uid = '';
  private status = 'ringing';
  private signals: Signal[] = [];
  private stops: (() => void)[] = [];
  private ready: Promise<void>;

  constructor(private callId: number) {
    this.ready = this.start();
    this.ready.catch(() => {});
  }

  private async start() {
    const u = await currentUser();
    if (!u) throw new Error('Sign in first.');
    this.uid = u.uid;
    const db = fbDb();
    const ref = doc(db, 'calls', String(this.callId));
    this.stops.push(
      onSnapshot(ref, (s) => {
        const c = s.data() as api.CallDoc | undefined;
        if (!c) this.status = 'ended';
        else this.status = c.status === 'ringing' && Date.now() - c.createdAt > 40_000 ? 'missed' : c.status;
      }, () => {})
    );
    this.stops.push(
      onSnapshot(query(collection(ref, 'signals'), where('n', '>', 0), orderBy('n')), (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== 'added') continue;
          const d = ch.doc.data();
          if (d.from === this.uid) continue;
          let data: unknown = null;
          try {
            data = JSON.parse(String(d.data));
          } catch {}
          this.signals.push({ id: Number(d.n), kind: String(d.kind), data });
        }
      }, () => {})
    );
  }

  stop() {
    this.stops.forEach((f) => f());
    this.stops = [];
  }

  /** One request from the page: same paths and replies as the old server API. */
  async handle(path: string, method: string, body: { kind?: string; data?: unknown } | undefined): Promise<unknown> {
    await this.ready;
    const p = path.split('?')[0];
    if (p === '/api/ice') return { ok: true, iceServers: await api.iceServers() };
    if (p === '/api/usage') {
      // Relay bytes this call used since its last report -> this month's total (the 900 GB cap).
      const bytes = Math.min(Math.max(0, Math.round(Number((body as { bytes?: number } | undefined)?.bytes) || 0)), 200_000_000);
      if (bytes) await setDoc(doc(fbDb(), 'usage', new Date().toISOString().slice(0, 7)), { turnBytes: increment(bytes) }, { merge: true });
      return { ok: true };
    }
    const m = p.match(/^\/api\/calls\/(\d+)(?:\/(signal|end|answer|decline))?$/);
    if (!m || Number(m[1]) !== this.callId) throw new Error('Not found');
    const action = m[2];
    if (action === 'signal' && method === 'POST') {
      if (this.status !== 'ringing' && this.status !== 'active') throw new Error('That call is over.');
      const kind = body?.kind === 'offer' || body?.kind === 'answer' || body?.kind === 'ice' ? body.kind : null;
      if (!kind) throw new Error('Bad signal.');
      const n = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      await addDoc(collection(fbDb(), 'calls', String(this.callId), 'signals'), { n, from: this.uid, kind, data: JSON.stringify(body?.data ?? null) });
      return { ok: true };
    }
    if (action === 'signal') {
      const after = Number(new URLSearchParams(path.split('?')[1] ?? '').get('after') || 0);
      return { ok: true, status: this.status, signals: this.signals.filter((s) => s.id > after) };
    }
    if (action === 'end' || action === 'answer' || action === 'decline') {
      await api.callAction('', this.callId, action);
      return { ok: true };
    }
    return { ok: true, call: { id: this.callId, status: this.status } };
  }
}
