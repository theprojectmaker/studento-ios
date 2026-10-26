/**
 * Studento API (Cloudflare Pages Functions + D1 + Workers AI).
 *
 * The app works fully offline except for three things that live here:
 *   accounts   POST /api/auth/signup | login | logout, DELETE /api/auth/account, GET /api/me, PUT /api/me/data
 *   sharing    GET /api/schools?q=, POST /api/schools, GET /api/schools/:id, POST /api/schools/:id/schedules,
 *              PATCH|DELETE /api/schools/:id, PATCH|DELETE /api/schedules/:id   (admin or creator)
 *   AI reader  POST /api/ai-schedule  (signed in; image or text -> rows with confidence)
 *   reports    POST /api/reports (signed in), GET /api/reports, PATCH|DELETE /api/reports/:id (admin)
 * plus GET /api/config (kill switches: signup, sharing, ai; PATCH by admin) and GET /api/health.
 *
 * Passwords: PBKDF2-SHA256, 100k iterations (the Workers runtime maximum), 16-byte salt. Tokens: 32 random bytes, stored hashed.
 * The first account ever created is the owner: admin + their own classes seeded (see OWNER_*).
 */

interface Env {
  DB: D1Database;
  AI: Ai;
  /** Pages secrets. Reader order: Groq (Qwen 3.8, best + fastest in tests) -> Gemini -> Workers AI. */
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
}
type Ctx = EventContext<Env, string, unknown>;
type Period = { period: string; label: string; start: string; end: string };
type Days = Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri', Period[]>;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const PBKDF2_ITERS = 100_000; // Cloudflare Workers cap PBKDF2 at 100k iterations
const MAX_DATA_BYTES = 64 * 1024;

/* ---------------- the owner's starting data (first account ever) ---------------- */
const OWNER_SCHOOL_ID = 1; // Great Neck North High School (seed.sql)
const OWNER_SCHEDULE_ID = 1; // Regular day
const OWNER_CLASSES: Record<string, string> = {
  '1': 'Intro to business',
  '2': 'English',
  '3': 'Biology',
  '4': 'Gym/biology lab',
  '5': 'Lunch',
  '6': 'Health',
  '7': 'Hebrew',
  '8': 'Social studies',
  '9': 'Geometry',
  advisory: 'Advisory',
};

/* ---------------- helpers ---------------- */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS, ...extra } });
const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer);
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERS }, key, 256);
  return hex(bits);
}
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readJson<T>(req: Request, maxBytes = 256 * 1024): Promise<T> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'Too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Too large');
  try {
    return JSON.parse(text || '{}') as T;
  } catch {
    throw new HttpError(400, 'Bad JSON');
  }
}

/** Fixed-window rate limit kept in D1. Throws 429 when `max` is passed inside `windowSec`. */
async function limit(env: Env, key: string, max: number, windowSec: number) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT count, window_start FROM limits WHERE key = ?').bind(key).first<{ count: number; window_start: number }>();
  if (!row || now - row.window_start > windowSec * 1000) {
    await env.DB.prepare('INSERT OR REPLACE INTO limits (key, count, window_start) VALUES (?, 1, ?)').bind(key, now).run();
    return;
  }
  if (row.count >= max) throw new HttpError(429, 'Too many tries. Wait a bit and try again.');
  await env.DB.prepare('UPDATE limits SET count = count + 1 WHERE key = ?').bind(key).run();
}

async function getConfig(env: Env): Promise<Record<string, boolean>> {
  const rows = await env.DB.prepare('SELECT key, value FROM config').all<{ key: string; value: string }>();
  const out: Record<string, boolean> = { signup: true, sharing: true, ai: true };
  for (const r of rows.results ?? []) out[r.key] = r.value === '1';
  return out;
}

interface User {
  id: number;
  username: string;
  is_admin: number;
}
async function userFromToken(env: Env, req: Request): Promise<User | null> {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const th = await sha256(token);
  const row = await env.DB.prepare('SELECT u.id, u.username, u.is_admin FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?').bind(th).first<User>();
  if (!row) return null;
  await env.DB.prepare('UPDATE tokens SET last_used = ? WHERE token_hash = ?').bind(Date.now(), th).run();
  return row;
}
async function requireUser(env: Env, req: Request): Promise<User> {
  const u = await userFromToken(env, req);
  if (!u) throw new HttpError(401, 'Sign in first.');
  return u;
}
async function issueToken(env: Env, userId: number): Promise<string> {
  const token = randomHex(32);
  await env.DB.prepare('INSERT INTO tokens (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, Date.now(), Date.now()).run();
  return token;
}
async function userData(env: Env, userId: number): Promise<{ data: unknown; updatedAt: number } | null> {
  const row = await env.DB.prepare('SELECT data, updated_at FROM user_data WHERE user_id = ?').bind(userId).first<{ data: string; updated_at: number }>();
  if (!row) return null;
  try {
    return { data: JSON.parse(row.data), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}
const publicUser = (u: User) => ({ id: u.id, username: u.username, admin: u.is_admin === 1 });

/* ---------------- validation ---------------- */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Clean one day's periods; throws on bad input. Sorted, ascending, non-overlapping. */
function cleanPeriods(list: unknown, where: string): Period[] {
  if (!Array.isArray(list)) throw new HttpError(400, `${where}: periods must be a list`);
  if (list.length > 16) throw new HttpError(400, `${where}: at most 16 periods`);
  const out: Period[] = list.map((p: Record<string, unknown>, i) => {
    const period = String(p?.period ?? '').trim().toLowerCase().slice(0, 12);
    const label = String(p?.label ?? '').trim().slice(0, 40) || (/^\d+$/.test(period) ? `Period ${period}` : period);
    const start = String(p?.start ?? '');
    const end = String(p?.end ?? '');
    if (!period) throw new HttpError(400, `${where}: row ${i + 1} needs a period id`);
    if (!TIME.test(start) || !TIME.test(end)) throw new HttpError(400, `${where}: row ${i + 1} times must be HH:MM`);
    if (toMin(end) <= toMin(start)) throw new HttpError(400, `${where}: ${label} ends before it starts`);
    return { period, label, start, end };
  });
  out.sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < out.length; i++) if (toMin(out[i].start) < toMin(out[i - 1].end)) throw new HttpError(400, `${where}: ${out[i].label} overlaps ${out[i - 1].label}`);
  return out;
}
function cleanDays(days: unknown): Days {
  if (!days || typeof days !== 'object') throw new HttpError(400, 'days must be an object with Mon..Fri');
  const out = {} as Days;
  let any = false;
  for (const d of DAYS) {
    out[d] = cleanPeriods((days as Record<string, unknown>)[d] ?? [], d);
    if (out[d].length) any = true;
  }
  if (!any) throw new HttpError(400, 'Add at least one period');
  return out;
}

/* ---------------- AI reader ---------------- */
const READ_PROMPT = `You read a student's school schedule (a photo, screenshot, or the student's own words) and return ONLY JSON, no prose, no code fences:
{"name": string, "classes": Class[], "regular": Row[], "differentDays": {"Mon"?: Row[], "Tue"?: Row[], "Wed"?: Row[], "Thu"?: Row[], "Fri"?: Row[]}}
Class = {"period": string, "name": string, "room": string, "teacher": string, "confidence": number}
Row = {"period": string, "name": string, "start": "HH:MM", "end": "HH:MM", "room": string, "confidence": number}
Rules:
- "classes" lists every class with its period, ALWAYS, even when no times are shown. One entry per period.
- "regular" is the normal school day WITH times. If the schedule shows no times, "regular" is [] and "differentDays" is {}.
- "differentDays" lists ONLY weekdays whose times or classes differ from "regular"; leave it {} when every day is the same.
- "period" is the period number as a string ("1", "2"...), or a short lowercase word for blocks without a number ("advisory", "homeroom", "lunch").
- "name" is the class/subject exactly as written (e.g. "Biology"). "room" and "teacher" are "" when not shown.
- Times are 24-hour HH:MM (1:05 PM -> "13:05"). School afternoon times like 1:05 without AM/PM are PM.
- "confidence" is 0 to 1: how sure you are you read that cell correctly (blurry, cut off or guessed = low).
- Rows sorted by start time. Never invent classes that are not there.`;

interface AiClass {
  period: string;
  name: string;
  room: string;
  teacher: string;
  confidence: number;
}
interface AiRow extends AiClass {
  start: string;
  end: string;
}

function extractJson(text: string): Record<string, unknown> {
  const s = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new HttpError(502, "The reader didn't answer in a usable way. Try again.");
  return JSON.parse(s.slice(a, b + 1));
}

/** Groq, OpenAI-style chat with an image. Qwen 3.8 27B read a test schedule photo perfectly in 4 s. */
async function askGroq(env: Env, text: string | undefined, image: { data: string; mimeType: string } | undefined): Promise<string> {
  const content: unknown[] = [{ type: 'text', text: READ_PROMPT + (text ? `\n\nThe student's schedule:\n${text.slice(0, 4000)}` : '') }];
  if (image) content.push({ type: 'image_url', image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}` } });
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY!}` },
    body: JSON.stringify({ model: 'qwen/qwen3.8-27b', temperature: 0.1, max_tokens: 2500, reasoning_format: 'hidden', messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new HttpError(502, `Reader error ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}

async function askGemini(env: Env, text: string | undefined, image: { data: string; mimeType: string } | undefined): Promise<string> {
  const parts: unknown[] = [{ text: READ_PROMPT + (text ? `\n\nThe student's schedule:\n${text.slice(0, 4000)}` : '') }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } });
  // gemini-3.6-flash: answered every time in tests; the newer 3.8 was mostly 503 and the pro models are quota-locked.
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
  });
  if (!res.ok) throw new HttpError(502, `Reader error ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

async function askWorkersAi(env: Env, text: string | undefined, image: { data: string; mimeType: string } | undefined): Promise<string> {
  const content: unknown[] = [{ type: 'text', text: READ_PROMPT + (text ? `\n\nThe student's schedule:\n${text.slice(0, 4000)}` : '') }];
  if (image) content.push({ type: 'image_url', image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}` } });
  const out = (await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct' as never, { messages: [{ role: 'user', content }], max_tokens: 2200, temperature: 0.1 } as never)) as { response?: unknown };
  return typeof out?.response === 'string' ? out.response : JSON.stringify(out?.response ?? out);
}

const cleanTime = (t: unknown): string => {
  const m = String(t ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const conf = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.5);
const cleanRoom = (s: unknown) =>
  String(s ?? '')
    .trim()
    .replace(/^(rm\.?|room)\s*/i, '')
    .slice(0, 20);
const cleanPeriodId = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/^period\s*/, '')
    .slice(0, 12);

function cleanAiRows(rows: unknown): AiRow[] {
  if (!Array.isArray(rows)) return [];
  const out: AiRow[] = rows
    .map((r: Record<string, unknown>) => ({
      period: cleanPeriodId(r?.period),
      name: String(r?.name ?? '')
        .trim()
        .slice(0, 60),
      start: cleanTime(r?.start),
      end: cleanTime(r?.end),
      room: cleanRoom(r?.room),
      teacher: String(r?.teacher ?? '')
        .trim()
        .slice(0, 40),
      confidence: conf(r?.confidence),
    }))
    .filter((r) => r.start && r.end && toMin(r.end) > toMin(r.start))
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .slice(0, 16);
  // Drop a row that overlaps the one before it (keep the earlier, flag nothing: the review screen shows the rest).
  const kept: AiRow[] = [];
  for (const r of out) {
    const prev = kept[kept.length - 1];
    if (prev && toMin(r.start) < toMin(prev.end)) {
      r.confidence = Math.min(r.confidence, 0.3);
      continue;
    }
    kept.push(r);
  }
  return kept;
}

/** Compare read times with the chosen school's bells: a start/end more than 3 min off any bell is suspicious. */
function bellMismatch(row: AiRow, bells: Days | null): boolean {
  if (!bells) return false;
  const all = DAYS.flatMap((d) => bells[d] ?? []);
  if (!all.length) return false;
  const near = (t: string) => all.some((p) => Math.abs(toMin(p.start) - toMin(t)) <= 3 || Math.abs(toMin(p.end) - toMin(t)) <= 3);
  return !(near(row.start) && near(row.end));
}

async function readSchedule(env: Env, body: { image?: { data: string; mimeType: string }; text?: string; bells?: unknown }) {
  const image = body.image?.data ? { data: String(body.image.data).slice(0, 6_000_000), mimeType: String(body.image.mimeType || 'image/jpeg') } : undefined;
  const text = body.text ? String(body.text) : undefined;
  if (!image && !text) throw new HttpError(400, 'Send a photo or some text.');
  let bells: Days | null = null;
  try {
    bells = body.bells ? cleanDays(body.bells) : null;
  } catch {
    bells = null;
  }

  // Try the readers in order of accuracy; each one is skipped when its key is missing or it fails.
  const chain: [string, () => Promise<string>][] = [];
  if (env.GROQ_API_KEY) chain.push(['groq-qwen3.8', () => askGroq(env, text, image)]);
  if (env.GEMINI_API_KEY) chain.push(['gemini-3.6-flash', () => askGemini(env, text, image)]);
  chain.push(['workers-ai', () => askWorkersAi(env, text, image)]);
  let parsed: Record<string, unknown> | null = null;
  let provider = '';
  let lastErr: unknown = null;
  for (const [name, ask] of chain) {
    try {
      parsed = extractJson(await ask());
      provider = name;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!parsed) throw lastErr instanceof HttpError ? lastErr : new HttpError(502, "The reader didn't answer. Try again in a moment.");

  const regular = cleanAiRows(parsed.regular);
  const days: Record<string, AiRow[]> = {};
  let fallback = regular;
  for (const d of DAYS) {
    const rows = cleanAiRows((parsed.differentDays as Record<string, unknown> | undefined)?.[d] ?? (parsed.days as Record<string, unknown> | undefined)?.[d]);
    days[d] = rows;
    if (!fallback.length && rows.length) fallback = rows;
  }
  for (const d of DAYS) if (!days[d].length) days[d] = fallback;

  const classes: Record<string, string> = {};
  const rooms: Record<string, string> = {};
  const teachers: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  const add = (c: Partial<AiClass>) => {
    const period = cleanPeriodId(c.period);
    const name = String(c.name ?? '')
      .trim()
      .slice(0, 60);
    if (!period || !name || /^period \d+$/i.test(name)) return;
    if (!classes[period]) classes[period] = name;
    const room = cleanRoom(c.room);
    if (room && !rooms[period]) rooms[period] = room;
    const t = String(c.teacher ?? '')
      .trim()
      .slice(0, 40);
    if (t && !teachers[period]) teachers[period] = t;
    confidence[period] = Math.min(confidence[period] ?? 1, conf(c.confidence));
  };
  (Array.isArray(parsed.classes) ? parsed.classes : []).forEach(add);
  fallback.forEach(add);
  if (!fallback.length && !Object.keys(classes).length) throw new HttpError(422, "Couldn't find your classes. Try a clearer photo, or type it out.");

  // Flags for the review screen: low confidence, or times that don't line up with the school's bells.
  const flags: Record<string, string[]> = {};
  const flag = (p: string, f: string) => {
    if (!p) return;
    (flags[p] = flags[p] ?? []).includes(f) || flags[p].push(f);
  };
  for (const [p, c] of Object.entries(confidence)) if (c < 0.6) flag(p, 'unsure');
  for (const r of fallback) {
    if (r.confidence < 0.6) flag(r.period, 'unsure');
    if (bellMismatch(r, bells)) flag(r.period, 'time');
  }
  const warnings: string[] = [];
  if (Object.values(flags).some((f) => f.includes('unsure'))) warnings.push('Some cells were hard to read. Check the highlighted rows.');
  if (Object.values(flags).some((f) => f.includes('time'))) warnings.push("Some times don't match your school's bells. Check them, or use the school's times.");

  return {
    schedule: { name: String(parsed.name || 'My schedule').slice(0, 40), days, classes, rooms, teachers, hasTimes: fallback.length > 0 },
    flags,
    warnings,
    provider,
  };
}

/* ---------------- router ---------------- */
export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const { request: req, env } = ctx;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  try {
    /* health + config */
    if (path === '/api/health' && req.method === 'GET') return json({ ok: true, config: await getConfig(env), time: Date.now() });
    if (path === '/api/config' && req.method === 'GET') return json({ ok: true, config: await getConfig(env) });
    if (path === '/api/config' && req.method === 'PATCH') {
      const u = await requireUser(env, req);
      if (!u.is_admin) throw new HttpError(403, 'Admins only.');
      const body = await readJson<Record<string, unknown>>(req);
      for (const k of ['signup', 'sharing', 'ai']) if (typeof body[k] === 'boolean') await env.DB.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').bind(k, body[k] ? '1' : '0').run();
      return json({ ok: true, config: await getConfig(env) });
    }

    /* auth */
    if (path === '/api/auth/signup' && req.method === 'POST') {
      const cfg = await getConfig(env);
      if (!cfg.signup) throw new HttpError(503, 'Sign-ups are paused right now.');
      await limit(env, `ip:${ip}:signup`, 5, 3600);
      const { username, password } = await readJson<{ username?: string; password?: string }>(req);
      const name = String(username ?? '')
        .trim()
        .toLowerCase();
      const pass = String(password ?? '');
      if (!/^[a-z0-9_.-]{3,24}$/.test(name)) throw new HttpError(400, 'Username: 3 to 24 letters, numbers, dots, dashes or underscores.');
      if (pass.length < 8 || pass.length > 200) throw new HttpError(400, 'Password: at least 8 characters.');
      const taken = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(name).first();
      if (taken) throw new HttpError(409, 'That username is taken.');
      const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n ?? 0;
      const isOwner = count === 0;
      const salt = randomHex(16);
      const hash = await pbkdf2(pass, salt);
      const ins = await env.DB.prepare('INSERT INTO users (username, salt, hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)').bind(name, salt, hash, isOwner ? 1 : 0, Date.now()).run();
      const id = Number(ins.meta.last_row_id);
      if (isOwner) {
        // The owner starts with their real classes on Great Neck North's Regular day.
        const data = { schoolId: OWNER_SCHOOL_ID, scheduleId: OWNER_SCHEDULE_ID, personal: { name: 'My schedule', bells: 'school', days: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] }, classNames: OWNER_CLASSES, rooms: {} } };
        await env.DB.prepare('INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)').bind(id, JSON.stringify(data), Date.now()).run();
      }
      const token = await issueToken(env, id);
      const u: User = { id, username: name, is_admin: isOwner ? 1 : 0 };
      return json({ ok: true, token, user: publicUser(u), data: await userData(env, id), owner: isOwner });
    }
    if (path === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = await readJson<{ username?: string; password?: string }>(req);
      const name = String(username ?? '')
        .trim()
        .toLowerCase();
      await limit(env, `ip:${ip}:login`, 20, 900);
      await limit(env, `user:${name}:login`, 10, 900);
      const row = await env.DB.prepare('SELECT id, username, is_admin, salt, hash FROM users WHERE username = ?').bind(name).first<User & { salt: string; hash: string }>();
      const ok = row ? sameHex(await pbkdf2(String(password ?? ''), row.salt), row.hash) : false;
      if (!row || !ok) throw new HttpError(401, 'Wrong username or password.');
      const token = await issueToken(env, row.id);
      return json({ ok: true, token, user: publicUser(row), data: await userData(env, row.id) });
    }
    if (path === '/api/auth/logout' && req.method === 'POST') {
      const h = req.headers.get('authorization') || '';
      const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
      if (token) await env.DB.prepare('DELETE FROM tokens WHERE token_hash = ?').bind(await sha256(token)).run();
      return json({ ok: true });
    }
    if (path === '/api/auth/account' && req.method === 'DELETE') {
      const u = await requireUser(env, req);
      const { password } = await readJson<{ password?: string }>(req);
      const row = await env.DB.prepare('SELECT salt, hash FROM users WHERE id = ?').bind(u.id).first<{ salt: string; hash: string }>();
      if (!row || !sameHex(await pbkdf2(String(password ?? ''), row.salt), row.hash)) throw new HttpError(401, 'Wrong password.');
      await env.DB.batch([
        env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(u.id),
        env.DB.prepare('DELETE FROM user_data WHERE user_id = ?').bind(u.id),
        env.DB.prepare('UPDATE schools SET created_by = NULL WHERE created_by = ?').bind(u.id),
        env.DB.prepare('UPDATE schedules SET created_by = NULL WHERE created_by = ?').bind(u.id),
        env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id),
      ]);
      return json({ ok: true });
    }
    if (path === '/api/me' && req.method === 'GET') {
      const u = await requireUser(env, req);
      return json({ ok: true, user: publicUser(u), data: await userData(env, u.id) });
    }
    if (path === '/api/me/data' && req.method === 'PUT') {
      const u = await requireUser(env, req);
      const text = await req.text();
      if (text.length > MAX_DATA_BYTES) throw new HttpError(413, 'Too much data to save (64 KB max).');
      try {
        JSON.parse(text);
      } catch {
        throw new HttpError(400, 'Bad JSON');
      }
      const now = Date.now();
      await env.DB.prepare('INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(u.id, text, now).run();
      return json({ ok: true, updatedAt: now });
    }

    /* schools + schedules */
    if (path === '/api/schools' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
      const rows = await env.DB.prepare(
        'SELECT s.id, s.name, (SELECT COUNT(*) FROM schedules x WHERE x.school_id = s.id AND x.hidden = 0) AS schedules FROM schools s WHERE s.hidden = 0 AND (? = \'\' OR s.name_lc LIKE ?) ORDER BY schedules DESC, s.name LIMIT 25'
      )
        .bind(q, `%${q}%`)
        .all<{ id: number; name: string; schedules: number }>();
      return json({ ok: true, schools: rows.results ?? [] });
    }
    if (path === '/api/schools' && req.method === 'POST') {
      const u = await requireUser(env, req);
      const cfg = await getConfig(env);
      if (!cfg.sharing) throw new HttpError(503, 'Adding schools is paused right now.');
      await limit(env, `user:${u.id}:school`, 10, 86400);
      const { name } = await readJson<{ name?: string }>(req);
      const clean = String(name ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      if (clean.length < 3) throw new HttpError(400, 'School name: at least 3 characters.');
      const existing = await env.DB.prepare('SELECT id, name FROM schools WHERE name_lc = ?').bind(clean.toLowerCase()).first<{ id: number; name: string }>();
      if (existing) return json({ ok: true, school: existing, existed: true });
      const ins = await env.DB.prepare('INSERT INTO schools (name, name_lc, created_by, created_at) VALUES (?, ?, ?, ?)').bind(clean, clean.toLowerCase(), u.id, Date.now()).run();
      return json({ ok: true, school: { id: Number(ins.meta.last_row_id), name: clean }, existed: false });
    }
    let m = path.match(/^\/api\/schools\/(\d+)$/);
    if (m && req.method === 'GET') {
      const school = await env.DB.prepare('SELECT id, name FROM schools WHERE id = ? AND hidden = 0').bind(Number(m[1])).first<{ id: number; name: string }>();
      if (!school) throw new HttpError(404, 'School not found.');
      const rows = await env.DB.prepare('SELECT id, name, days, created_by, created_at FROM schedules WHERE school_id = ? AND hidden = 0 ORDER BY id').bind(school.id).all<{ id: number; name: string; days: string; created_by: number | null; created_at: number }>();
      const schedules = (rows.results ?? []).map((r) => ({ id: r.id, name: r.name, days: JSON.parse(r.days) as Days, createdBy: r.created_by, createdAt: r.created_at }));
      return json({ ok: true, school, schedules }, 200, { 'Cache-Control': 'public, max-age=60' });
    }
    if (m && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const u = await requireUser(env, req);
      if (!u.is_admin) throw new HttpError(403, 'Admins only.');
      const id = Number(m[1]);
      if (req.method === 'DELETE') {
        await env.DB.batch([env.DB.prepare('DELETE FROM schedules WHERE school_id = ?').bind(id), env.DB.prepare('DELETE FROM schools WHERE id = ?').bind(id)]);
        return json({ ok: true });
      }
      const body = await readJson<{ name?: string; hidden?: boolean }>(req);
      if (typeof body.name === 'string' && body.name.trim().length >= 3) {
        const clean = body.name.replace(/\s+/g, ' ').trim().slice(0, 80);
        await env.DB.prepare('UPDATE schools SET name = ?, name_lc = ? WHERE id = ?').bind(clean, clean.toLowerCase(), id).run();
      }
      if (typeof body.hidden === 'boolean') await env.DB.prepare('UPDATE schools SET hidden = ? WHERE id = ?').bind(body.hidden ? 1 : 0, id).run();
      return json({ ok: true });
    }
    m = path.match(/^\/api\/schools\/(\d+)\/schedules$/);
    if (m && req.method === 'POST') {
      const u = await requireUser(env, req);
      const cfg = await getConfig(env);
      if (!cfg.sharing) throw new HttpError(503, 'Sharing schedules is paused right now.');
      await limit(env, `user:${u.id}:schedule`, 20, 86400);
      const schoolId = Number(m[1]);
      const school = await env.DB.prepare('SELECT id FROM schools WHERE id = ? AND hidden = 0').bind(schoolId).first();
      if (!school) throw new HttpError(404, 'School not found.');
      const body = await readJson<{ name?: string; days?: unknown }>(req);
      const name = String(body.name ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
      if (name.length < 2) throw new HttpError(400, 'Give the schedule a name, like "Regular day".');
      const days = cleanDays(body.days);
      const dup = await env.DB.prepare('SELECT id FROM schedules WHERE school_id = ? AND lower(name) = ? AND hidden = 0').bind(schoolId, name.toLowerCase()).first();
      if (dup) throw new HttpError(409, 'This school already has a schedule with that name.');
      const ins = await env.DB.prepare('INSERT INTO schedules (school_id, name, days, created_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(schoolId, name, JSON.stringify(days), u.id, Date.now()).run();
      return json({ ok: true, schedule: { id: Number(ins.meta.last_row_id), name, days, createdBy: u.id } });
    }
    m = path.match(/^\/api\/schedules\/(\d+)$/);
    if (m && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const u = await requireUser(env, req);
      const id = Number(m[1]);
      const row = await env.DB.prepare('SELECT created_by FROM schedules WHERE id = ?').bind(id).first<{ created_by: number | null }>();
      if (!row) throw new HttpError(404, 'Schedule not found.');
      if (!u.is_admin && row.created_by !== u.id) throw new HttpError(403, 'Only the person who added it, or an admin, can change it.');
      if (req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM schedules WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
      const body = await readJson<{ name?: string; days?: unknown; hidden?: boolean }>(req);
      if (typeof body.name === 'string' && body.name.trim().length >= 2) await env.DB.prepare('UPDATE schedules SET name = ? WHERE id = ?').bind(body.name.replace(/\s+/g, ' ').trim().slice(0, 40), id).run();
      if (body.days !== undefined) await env.DB.prepare('UPDATE schedules SET days = ? WHERE id = ?').bind(JSON.stringify(cleanDays(body.days)), id).run();
      if (typeof body.hidden === 'boolean' && u.is_admin) await env.DB.prepare('UPDATE schedules SET hidden = ? WHERE id = ?').bind(body.hidden ? 1 : 0, id).run();
      return json({ ok: true });
    }

    /* reports on shared content (Apple 1.2): anyone signed in can flag; admins review */
    if (path === '/api/reports' && req.method === 'POST') {
      const u = await requireUser(env, req);
      await limit(env, `user:${u.id}:report`, 20, 86400);
      const body = await readJson<{ kind?: string; targetId?: number; reason?: string; note?: string }>(req);
      const kind = body.kind === 'school' ? 'school' : body.kind === 'schedule' ? 'schedule' : null;
      const targetId = Number(body.targetId);
      const reason = String(body.reason ?? '')
        .trim()
        .slice(0, 40);
      const note = String(body.note ?? '')
        .trim()
        .slice(0, 500);
      if (!kind || !Number.isInteger(targetId) || !reason) throw new HttpError(400, 'Pick what to report and why.');
      const row =
        kind === 'school'
          ? await env.DB.prepare('SELECT name FROM schools WHERE id = ?').bind(targetId).first<{ name: string }>()
          : await env.DB.prepare('SELECT s.name || \' · \' || c.name AS name FROM schedules s JOIN schools c ON c.id = s.school_id WHERE s.id = ?').bind(targetId).first<{ name: string }>();
      if (!row) throw new HttpError(404, 'That item no longer exists.');
      await env.DB.prepare('INSERT INTO reports (kind, target_id, target_name, reason, note, user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, \'open\', ?)').bind(kind, targetId, row.name, reason, note, u.id, Date.now()).run();
      return json({ ok: true });
    }
    if (path === '/api/reports' && req.method === 'GET') {
      const u = await requireUser(env, req);
      if (!u.is_admin) throw new HttpError(403, 'Admins only.');
      const rows = await env.DB.prepare('SELECT id, kind, target_id, target_name, reason, note, status, created_at FROM reports ORDER BY (status = \'open\') DESC, created_at DESC LIMIT 200').all();
      return json({ ok: true, reports: (rows.results ?? []).map((r) => ({ id: r.id, kind: r.kind, targetId: r.target_id, targetName: r.target_name, reason: r.reason, note: r.note, status: r.status, createdAt: r.created_at })) });
    }
    m = path.match(/^\/api\/reports\/(\d+)$/);
    if (m && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const u = await requireUser(env, req);
      if (!u.is_admin) throw new HttpError(403, 'Admins only.');
      const id = Number(m[1]);
      if (req.method === 'DELETE') await env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(id).run();
      else await env.DB.prepare('UPDATE reports SET status = \'dismissed\' WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    /* AI reader */
    if (path === '/api/ai-schedule' && req.method === 'POST') {
      const u = await requireUser(env, req);
      const cfg = await getConfig(env);
      if (!cfg.ai) throw new HttpError(503, 'The schedule reader is paused right now. You can still type your schedule.');
      await limit(env, `user:${u.id}:ai`, 25, 86400);
      await limit(env, `ip:${ip}:ai`, 60, 86400);
      const body = await readJson<{ image?: { data: string; mimeType: string }; text?: string; bells?: unknown }>(req, 8 * 1024 * 1024);
      return json({ ok: true, ...(await readSchedule(env, body)) });
    }

    return fail('Not found', 404);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status);
    return fail(e instanceof Error ? e.message : 'Server error', 500);
  }
};
