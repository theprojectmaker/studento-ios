/**
 * The shared Studento server (tests/period-notify, Cloudflare Worker + Durable Object).
 * Every device reads and writes the same class names, rooms, custom days and
 * "today" switch here. No accounts, on purpose.
 *
 * workers.dev subdomains have drifted before; if this stops answering, update it here.
 */
import type { ClassDetail } from './alerts';
import type { CustomDay, OverrideType, Period } from './schedule';

export const API_BASE = 'https://studento.greatneck.workers.dev';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(API_BASE + path, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) throw new Error(`Server said ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface RemoteSnapshot {
  classNames: Record<string, string>;
  classDetails: Record<string, ClassDetail>;
  customDays: CustomDay[];
  /** Today's switch, already limited to today by the server. */
  overrideType: OverrideType | null;
}

export async function fetchAll(): Promise<RemoteSnapshot> {
  const [classNames, classDetails, custom, override] = await Promise.all([
    call<Record<string, string>>('/api/classes'),
    call<Record<string, ClassDetail>>('/api/class-details'),
    call<{ upcoming: CustomDay[]; archived: CustomDay[] }>('/api/custom-schedules'),
    call<{ type: OverrideType | null }>('/api/override'),
  ]);
  return {
    classNames: classNames ?? {},
    classDetails: classDetails ?? {},
    customDays: [...(custom?.upcoming ?? []), ...(custom?.archived ?? [])],
    overrideType: override?.type ?? null,
  };
}

export const saveClassNames = (map: Record<string, string>) =>
  call<{ ok: boolean }>('/api/classes', { method: 'POST', body: JSON.stringify(map) });

export const saveClassDetails = (map: Record<string, ClassDetail>) =>
  call<{ ok: boolean }>('/api/class-details', { method: 'POST', body: JSON.stringify(map) });

export const saveOverride = (type: OverrideType | null) =>
  call<{ ok: boolean }>('/api/override', { method: 'POST', body: JSON.stringify({ type }) });

export const addCustomDay = (day: { date: string; label: string; periods: Period[] }) =>
  call<{ ok: boolean; entry?: CustomDay; error?: string }>('/api/custom-schedules', { method: 'POST', body: JSON.stringify(day) });

export const deleteCustomDay = (id: string) =>
  call<{ ok: boolean }>('/api/custom-schedules', { method: 'DELETE', body: JSON.stringify({ id }) });

export interface AiRow {
  period: string;
  name: string;
  start: string;
  end: string;
  room: string;
}
export interface AiSchedule {
  name: string;
  days: Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri', AiRow[]>;
  /** Period id -> class, even when the schedule shows no times. */
  classes?: Record<string, string>;
  rooms?: Record<string, string>;
  hasTimes?: boolean;
}

/** Ask the Studento server's AI to read a schedule from a photo (base64 JPEG) or typed text. */
export async function readScheduleAI(input: { image?: { data: string; mimeType: string }; text?: string }): Promise<AiSchedule> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(API_BASE + '/api/ai-schedule', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; schedule?: AiSchedule; error?: string } | null;
    if (!res.ok || !j?.ok || !j.schedule) throw new Error(j?.error || `Server said ${res.status}`);
    return j.schedule;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('That took too long. Check your internet and try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
