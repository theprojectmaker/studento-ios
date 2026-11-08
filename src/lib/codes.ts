/**
 * Redeem codes. Two kinds:
 *  - promo codes that unlock a beta feature (checked here, stored as hashes so the public repo
 *    does not spell them out), and
 *  - 6-character schedule share codes made on another device (checked on the server).
 */
import * as api from './api';
import { getState, setClassInfo, setPersonal, setPref, setSchool } from './store';

function hash(code: string): string {
  let x = 0x811c9dc5;
  for (const c of `studento:${code}`) {
    x ^= c.charCodeAt(0);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x.toString(36);
}

export interface Unlock {
  id: string;
  title: string;
  detail: string;
}

const PROMOS: Record<string, Unlock> = {
  x93xhm: { id: 'race', title: 'Race Track', detail: 'Two beta themes: a night circuit where eight cars race through your class. iPad only. Find them under Themes > Beta.' },
  '4au6o': { id: 'messages', title: 'Beam (beta)', detail: 'Chat and call other Studento users. A Beam button now sits in the bottom-right corner of the clock. Needs an account.' },
};

export const UNLOCK_INFO: Record<string, Unlock> = Object.fromEntries(Object.values(PROMOS).map((u) => [u.id, u]));

export function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Promo code -> unlock, saved to prefs. Null if it is not a promo code. */
export function redeemPromo(raw: string): Unlock | null {
  const u = PROMOS[hash(normalize(raw))];
  if (!u) return null;
  const have = getState().prefs.unlocks ?? [];
  if (!have.includes(u.id)) setPref('unlocks', [...have, u.id]);
  return u;
}

export function isShareCode(raw: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(normalize(raw));
}

/** What a schedule share code carries. */
export interface SharedSchedule {
  v: 1;
  personal: ReturnType<typeof getState>['personal'];
  school: ReturnType<typeof getState>['school'];
  bellSet: ReturnType<typeof getState>['bellSet'];
  schoolSchedules: ReturnType<typeof getState>['schoolSchedules'];
  classNames: Record<string, string>;
  classDetails: ReturnType<typeof getState>['shared']['classDetails'];
}

export function currentSchedule(): SharedSchedule {
  const s = getState();
  return { v: 1, personal: s.personal, school: s.school, bellSet: s.bellSet, schoolSchedules: s.schoolSchedules, classNames: s.shared.classNames, classDetails: s.shared.classDetails };
}

export async function fetchShared(raw: string): Promise<SharedSchedule> {
  const r = await api.getSharedSchedule(normalize(raw));
  const d = r.data as Partial<SharedSchedule> | null;
  if (!d || d.v !== 1) throw new Error('That code is not a Studento schedule.');
  return d as SharedSchedule;
}

export async function applyShared(d: SharedSchedule): Promise<void> {
  if (d.school && d.bellSet) await setSchool(d.school, d.bellSet, d.schoolSchedules ?? []);
  await setPersonal(d.personal ?? null);
  await setClassInfo(d.classNames ?? {}, d.classDetails ?? {});
}

/** One-line summary for the preview card. */
export function describeShared(d: SharedSchedule): string {
  const names = Object.values(d.personal?.classNames ?? d.classNames ?? {}).filter(Boolean);
  const bits = [d.school?.name, d.bellSet?.name, names.length ? `${names.length} classes` : 'period numbers'].filter(Boolean);
  return bits.join(' · ');
}
