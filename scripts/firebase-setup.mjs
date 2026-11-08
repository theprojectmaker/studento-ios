/**
 * One-shot Firebase setup + move from the old Cloudflare D1 database (studento-clock).
 *
 *   node scripts/firebase-setup.mjs <service-account.json> [--rules] [--storage] [--indexes] [--auth] [--migrate] [--dry]
 *
 * --auth     turn on email/password sign-in (usernames sign in as <name>@users.studento.app)
 * --rules    publish firestore.rules
 * --storage  publish storage.rules (Beam videos; turn Storage on in the console first)
 * --indexes  create the composite indexes the app's queries need
 * --migrate  copy D1 -> Firebase: accounts (same passwords: PBKDF2 hashes imported as-is),
 *            saved data, schools, bell schedules, reports, share codes, chats, blocks, flags.
 *            Reads D1 with wrangler, so run it where wrangler is logged in. Safe to re-run.
 * The service account key never leaves this machine and must never be committed.
 */
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const saPath = args.find((a) => !a.startsWith('--'));
if (!saPath) throw new Error('Pass the service account JSON path first.');
const sa = JSON.parse(readFileSync(saPath, 'utf8'));
const P = sa.project_id;
const has = (f) => args.includes(f);
const DRY = has('--dry');

/* ---------- Google auth ---------- */
const b64url = (b) => Buffer.from(b).toString('base64url');
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${body}.${sig}` });
  const j = await r.json();
  if (!j.access_token) throw new Error('token: ' + JSON.stringify(j));
  return j.access_token;
}
const TOKEN = await accessToken();
async function g(method, url, body) {
  if (DRY && method !== 'GET') {
    console.log('[dry]', method, url.slice(0, 120));
    return {};
  }
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text || '{}');
  } catch {
    j = { raw: text };
  }
  if (!r.ok) {
    const e = new Error(`${method} ${url} -> ${r.status} ${text.slice(0, 400)}`);
    e.status = r.status;
    throw e;
  }
  return j;
}

/* ---------- auth provider ---------- */
if (has('--auth')) {
  try {
    await g('POST', `https://identitytoolkit.googleapis.com/v2/projects/${P}/identityPlatform:initializeAuth`, {});
  } catch (e) {
    if (!String(e.message).includes('already')) console.log('initializeAuth:', String(e.message).slice(0, 200));
  }
  await g('PATCH', `https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, { signIn: { email: { enabled: true, passwordRequired: true } } });
  console.log('auth: email/password sign-in on');
}

/* ---------- rules ---------- */
if (has('--rules')) {
  const content = readFileSync(join(root, 'firestore.rules'), 'utf8');
  const rs = await g('POST', `https://firebaserules.googleapis.com/v1/projects/${P}/rulesets`, { source: { files: [{ name: 'firestore.rules', content }] } });
  const name = `projects/${P}/releases/cloud.firestore`;
  try {
    await g('PATCH', `https://firebaserules.googleapis.com/v1/${name}`, { release: { name, rulesetName: rs.name } });
  } catch {
    await g('POST', `https://firebaserules.googleapis.com/v1/projects/${P}/releases`, { name, rulesetName: rs.name });
  }
  console.log('rules: published', rs.name);
}

/* ---------- storage rules (Beam videos); Storage must be turned on in the console first ---------- */
if (has('--storage')) {
  const content = readFileSync(join(root, 'storage.rules'), 'utf8');
  const rs = await g('POST', `https://firebaserules.googleapis.com/v1/projects/${P}/rulesets`, { source: { files: [{ name: 'storage.rules', content }] } });
  const name = `projects/${P}/releases/firebase.storage/${P}.firebasestorage.app`;
  try {
    await g('PATCH', `https://firebaserules.googleapis.com/v1/${name}`, { release: { name, rulesetName: rs.name } });
  } catch {
    await g('POST', `https://firebaserules.googleapis.com/v1/projects/${P}/releases`, { name, rulesetName: rs.name });
  }
  console.log('storage rules: published', rs.name);
}

/* ---------- indexes ---------- */
if (has('--indexes')) {
  const idx = [
    ['chats', [{ fieldPath: 'members', arrayConfig: 'CONTAINS' }, { fieldPath: 'lastAt', order: 'DESCENDING' }]],
    ['calls', [{ fieldPath: 'members', arrayConfig: 'CONTAINS' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ];
  for (const [group, fields] of idx) {
    try {
      await g('POST', `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/collectionGroups/${group}/indexes`, { queryScope: 'COLLECTION', fields });
      console.log('index: creating', group);
    } catch (e) {
      console.log('index:', group, e.status === 409 ? 'already exists' : String(e.message).slice(0, 200));
    }
  }
}

/* ---------- migrate ---------- */
function d1(sql) {
  const dir = args[args.indexOf('--from') + 1];
  if (args.includes('--from')) {
    // Files from scripts/export-d1.ps1: one <table>.json per table (wrangler --json output).
    const table = sql.match(/FROM (\w+)/)[1];
    const out = readFileSync(join(dir, table + '.json'), 'utf8').replace(/^﻿/, '');
    return JSON.parse(out.slice(out.indexOf('[')))[0]?.results ?? [];
  }
  const out = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'wrangler@4.128.0', 'd1', 'execute', 'studento-db', '--remote', '--json', '--command', process.platform === 'win32' ? `"${sql}"` : sql], { cwd: join(root, 'server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024 });
  const j = JSON.parse(out.slice(out.indexOf('[')));
  return j[0]?.results ?? [];
}
function d1try(sql) {
  try {
    return d1(sql);
  } catch (e) {
    console.log('  (skipped:', sql.slice(0, 50), ')');
    return [];
  }
}
function val(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, val(x)])) } };
}
const docName = (path) => `projects/${P}/databases/(default)/documents/${path}`;
const writes = [];
const put = (path, data) => writes.push({ update: { name: docName(path), fields: val(data).mapValue.fields } });
async function flush() {
  for (let i = 0; i < writes.length; i += 400) {
    await g('POST', `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents:commit`, { writes: writes.slice(i, i + 400) });
    console.log(`  wrote ${Math.min(i + 400, writes.length)}/${writes.length}`);
  }
  writes.length = 0;
}
const hexB64 = (h) => Buffer.from(h, 'hex').toString('base64');
const parse = (s, d = null) => {
  try {
    return JSON.parse(s);
  } catch {
    return d;
  }
};

if (has('--migrate')) {
  console.log('reading D1…');
  const users = d1('SELECT id, username, salt, hash, is_admin, created_at FROM users');
  const data = d1('SELECT user_id, data, updated_at FROM user_data');
  const schools = d1('SELECT id, name, name_lc, created_by, created_at, hidden FROM schools');
  const schedules = d1('SELECT id, school_id, name, days, created_by, created_at, hidden FROM schedules');
  const reports = d1try('SELECT id, kind, target_id, target_name, reason, note, user_id, status, created_at FROM reports');
  const shares = d1try(`SELECT code, data, created_at, expires_at FROM share_codes WHERE expires_at > ${Date.now()}`);
  const messages = d1try('SELECT id, from_id, to_id, body, created_at, read_at FROM messages ORDER BY id');
  const blocks = d1try('SELECT user_id, blocked_id FROM blocks');
  const config = d1try('SELECT key, value FROM config');
  console.log(`  ${users.length} users, ${schools.length} schools, ${schedules.length} schedules, ${messages.length} messages, ${reports.length} reports, ${shares.length} share codes`);

  // Accounts: Firebase verifies the same PBKDF2-SHA256 (100k rounds) hashes, so passwords keep working.
  const email = (u) => `${u.username.toLowerCase()}@users.studento.app`;
  for (let i = 0; i < users.length; i += 500) {
    const r = await g('POST', `https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:batchCreate`, {
      hashAlgorithm: 'PBKDF2_SHA256',
      rounds: 100000,
      allowOverwrite: true,
      users: users.slice(i, i + 500).map((u) => ({ localId: String(u.id), email: email(u), emailVerified: true, passwordHash: hexB64(u.hash), salt: hexB64(u.salt), createdAt: String(u.created_at) })),
    });
    if (r.error?.length) console.log('  auth import errors:', JSON.stringify(r.error).slice(0, 500));
  }
  console.log('auth: imported', users.length);

  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const dataBy = Object.fromEntries(data.map((d) => [d.user_id, d]));
  for (const u of users) {
    const d = dataBy[u.id];
    put(`users/${u.id}`, { username: u.username.toLowerCase(), num: u.id, admin: u.is_admin === 1, data: d ? parse(d.data) : null, updatedAt: d?.updated_at ?? 0 });
    put(`usernames/${u.username.toLowerCase()}`, { uid: String(u.id), num: u.id });
  }
  for (const s of schools) put(`schools/${s.id}`, { name: s.name, nameLc: s.name_lc, createdBy: s.created_by ? String(s.created_by) : null, createdAt: s.created_at, hidden: s.hidden === 1 });
  for (const s of schedules) put(`schedules/${s.id}`, { schoolId: s.school_id, name: s.name, nameLc: s.name.toLowerCase(), days: parse(s.days, {}), createdBy: s.created_by ? String(s.created_by) : null, createdByNum: s.created_by ?? null, createdAt: s.created_at, hidden: s.hidden === 1 });

  // Chats: one doc per pair (key = sorted uids, same as the app), messages underneath.
  const key = (a, b) => [String(a), String(b)].sort().join('_');
  const msgKey = {};
  const chats = {};
  for (const m of messages) {
    const a = byId[m.from_id];
    const b = byId[m.to_id];
    if (!a || !b) continue;
    const k = key(m.from_id, m.to_id);
    const id = m.created_at * 1000 + (m.id % 1000);
    msgKey[m.id] = { k, id };
    put(`chats/${k}/msgs/${id}`, { id, from: String(m.from_id), body: m.body, createdAt: m.created_at });
    const c = (chats[k] ??= { members: [String(m.from_id), String(m.to_id)].sort(), names: { [m.from_id]: a.username.toLowerCase(), [m.to_id]: b.username.toLowerCase() }, nums: { [m.from_id]: m.from_id, [m.to_id]: m.to_id }, lastAt: 0, lastBody: '', unread: { [m.from_id]: 0, [m.to_id]: 0 } });
    if (m.created_at >= c.lastAt) {
      c.lastAt = m.created_at;
      c.lastBody = m.body;
    }
    if (!m.read_at) c.unread[m.to_id] += 1;
  }
  for (const [k, c] of Object.entries(chats)) put(`chats/${k}`, c);

  const blk = {};
  for (const b of blocks) (blk[b.user_id] ??= []).push(String(b.blocked_id));
  for (const [uid, ids] of Object.entries(blk)) put(`blocks/${uid}`, { ids });

  for (const r of reports) {
    const mk = r.kind === 'message' ? msgKey[r.target_id] : null;
    put(`reports/${r.id}`, { kind: r.kind, targetId: mk ? mk.id : r.target_id, targetName: r.target_name, chat: mk ? mk.k : null, reason: r.reason, note: r.note ?? '', uid: r.user_id ? String(r.user_id) : null, status: r.status, createdAt: r.created_at });
  }
  for (const s of shares) put(`shares/${s.code}`, { data: parse(s.data, {}), createdAt: s.created_at, expiresAt: s.expires_at });

  const flags = { signup: true, sharing: true, ai: true, messaging: true };
  for (const c of config) if (c.key in flags) flags[c.key] = c.value === '1';
  put('config/flags', flags);

  const max = (rows) => rows.reduce((n, r) => Math.max(n, r.id), 0) + 1;
  put('counters/users', { next: max(users) });
  put('counters/schools', { next: max(schools) });
  put('counters/schedules', { next: max(schedules) });
  put('counters/reports', { next: max(reports) });

  console.log('firestore: writing', writes.length, 'docs');
  await flush();
  console.log('migrate: done');
}
