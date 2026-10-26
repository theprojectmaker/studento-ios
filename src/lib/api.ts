/**
 * Studento's small server (server/ in this repo; Cloudflare Pages + Functions + D1).
 * Only three things need it: accounts, shared school schedules, and the schedule reader.
 * Everything else works offline. The address is a Pages domain, which does not drift.
 */
import type { Period, SchoolDay } from './schedule';

export const API_BASE = 'https://studento-app.pages.dev';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function call<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(API_BASE + path, {
      method: opts.method ?? 'GET',
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const j = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
    if (!res.ok || !j || j.ok === false) throw new ApiError(j?.error || `Server said ${res.status}`, res.status);
    return j;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('That took too long. Check your internet and try again.', 0);
    throw new ApiError("Can't reach Studento's server. Check your internet.", 0);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- types ---------------- */
export interface ServerConfig {
  signup: boolean;
  sharing: boolean;
  ai: boolean;
}
export interface AccountUser {
  id: number;
  username: string;
  admin: boolean;
}
/** What an account stores for the student (kept small; 64 KB max on the server). */
export interface AccountData {
  schoolId?: number | null;
  scheduleId?: number | null;
  personal?: unknown;
  prefs?: Record<string, unknown>;
}
export interface SchoolHit {
  id: number;
  name: string;
  schedules: number;
}
export interface BellSet {
  id: number;
  name: string;
  days: Record<SchoolDay, Period[]>;
  createdBy?: number | null;
}
export interface AiRow {
  period: string;
  name: string;
  start: string;
  end: string;
  room: string;
  teacher?: string;
  confidence?: number;
}
export interface AiSchedule {
  name: string;
  days: Record<SchoolDay, AiRow[]>;
  classes?: Record<string, string>;
  rooms?: Record<string, string>;
  teachers?: Record<string, string>;
  hasTimes?: boolean;
}
export interface AiResult {
  schedule: AiSchedule;
  /** Period id -> ['unsure' | 'time']: show these rows highlighted on the review screen. */
  flags: Record<string, string[]>;
  warnings: string[];
  provider: string;
}

/* ---------------- config ---------------- */
export const getConfig = () => call<{ config: ServerConfig }>('/api/config').then((r) => r.config);
export const setConfig = (token: string, patch: Partial<ServerConfig>) => call<{ config: ServerConfig }>('/api/config', { method: 'PATCH', body: patch, token }).then((r) => r.config);

/* ---------------- accounts ---------------- */
type AuthReply = { token: string; user: AccountUser; data: { data: AccountData; updatedAt: number } | null; owner?: boolean };
export const signup = (username: string, password: string) => call<AuthReply>('/api/auth/signup', { method: 'POST', body: { username, password }, timeoutMs: 30_000 });
export const login = (username: string, password: string) => call<AuthReply>('/api/auth/login', { method: 'POST', body: { username, password }, timeoutMs: 30_000 });
export const logout = (token: string) => call<object>('/api/auth/logout', { method: 'POST', token }).catch(() => undefined);
export const deleteAccount = (token: string, password: string) => call<object>('/api/auth/account', { method: 'DELETE', body: { password }, token, timeoutMs: 30_000 });
export const me = (token: string) => call<{ user: AccountUser; data: { data: AccountData; updatedAt: number } | null }>('/api/me', { token });
export const putData = (token: string, data: AccountData) => call<{ updatedAt: number }>('/api/me/data', { method: 'PUT', body: data, token }).then((r) => r.updatedAt);

/* ---------------- schools ---------------- */
export const searchSchools = (q: string) => call<{ schools: SchoolHit[] }>(`/api/schools?q=${encodeURIComponent(q)}`).then((r) => r.schools);
export const getSchool = (id: number) => call<{ school: { id: number; name: string }; schedules: BellSet[] }>(`/api/schools/${id}`);
export const addSchool = (token: string, name: string) => call<{ school: { id: number; name: string }; existed: boolean }>('/api/schools', { method: 'POST', body: { name }, token });
export const publishSchedule = (token: string, schoolId: number, name: string, days: Record<SchoolDay, Period[]>) =>
  call<{ schedule: BellSet }>(`/api/schools/${schoolId}/schedules`, { method: 'POST', body: { name, days }, token }).then((r) => r.schedule);
export const renameSchool = (token: string, id: number, name: string) => call<object>(`/api/schools/${id}`, { method: 'PATCH', body: { name }, token });
export const deleteSchool = (token: string, id: number) => call<object>(`/api/schools/${id}`, { method: 'DELETE', token });
export const renameSchedule = (token: string, id: number, name: string) => call<object>(`/api/schedules/${id}`, { method: 'PATCH', body: { name }, token });
export const deleteSchedule = (token: string, id: number) => call<object>(`/api/schedules/${id}`, { method: 'DELETE', token });

/* ---------------- reports on shared content ---------------- */
export interface Report {
  id: number;
  kind: 'school' | 'schedule';
  targetId: number;
  targetName: string;
  reason: string;
  note: string;
  status: 'open' | 'dismissed';
  createdAt: number;
}
export const sendReport = (token: string, kind: 'school' | 'schedule', targetId: number, reason: string, note: string) =>
  call<object>('/api/reports', { method: 'POST', body: { kind, targetId, reason, note }, token });
export const listReports = (token: string) => call<{ reports: Report[] }>('/api/reports', { token }).then((r) => r.reports);
export const dismissReport = (token: string, id: number) => call<object>(`/api/reports/${id}`, { method: 'PATCH', token });
export const deleteReport = (token: string, id: number) => call<object>(`/api/reports/${id}`, { method: 'DELETE', token });

/* ---------------- schedule reader ---------------- */
export const readScheduleAI = (token: string, input: { image?: { data: string; mimeType: string }; text?: string }, bells?: Record<SchoolDay, Period[]> | null) =>
  call<AiResult>('/api/ai-schedule', { method: 'POST', body: { ...input, bells: bells ?? undefined }, token, timeoutMs: 90_000 });
