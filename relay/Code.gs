/**
 * Studento's only server code, on Apps Script (free, and reachable on school Wi-Fi that blocks
 * pages.dev). Everything else (accounts, schools, chat, calls) is Firebase straight from the app.
 *
 * Deploy as a web app: Execute as "Me", Who has access "Anyone".
 * Script Properties (Project Settings > Script Properties), never in the repo:
 *   GROQ_API_KEY, GEMINI_API_KEY          schedule reader (Groq first, Gemini as backup)
 *   TURN_URL, TURN_USERNAME, TURN_CREDENTIAL   optional TURN relay for calls (comma-separated URLs)
 *
 * The app POSTs text/plain JSON: { action: 'read' | 'ice', idToken, ... }.
 * idToken is the caller's Firebase ID token; it is checked with Google before doing anything.
 */
var FIREBASE_API_KEY = 'AIzaSyBfriLiUR2sJo8Y_0_hZDbAXioAUJesLYY'; // public web key (studento-clock)
var PROJECT = 'studento-clock';
var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function HttpError(status, message) {
  this.status = status;
  this.message = message;
}
function prop(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

function doGet() {
  return out({ ok: true, time: Date.now() });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    if (raw.length > 8000000) throw new HttpError(413, 'Too large');
    var req = JSON.parse(raw);
    var uid = verify(req.idToken);
    if (req.action === 'ice') return out({ ok: true, iceServers: iceServers() });
    if (req.action === 'read') {
      if (!flag('ai')) throw new HttpError(503, 'The schedule reader is paused right now. You can still type your schedule.');
      limit('ai:' + uid, 25, 86400);
      var r = readSchedule(req);
      r.ok = true;
      return out(r);
    }
    throw new HttpError(400, 'Unknown action');
  } catch (err) {
    if (err instanceof HttpError) return out({ ok: false, error: err.message, status: err.status });
    return out({ ok: false, error: String((err && err.message) || err), status: 500 });
  }
}

/* ---------- auth, flags, limits ---------- */
/** Firebase ID token -> uid (Google checks the signature). Cached 10 minutes per token. */
function verify(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4000) throw new HttpError(401, 'Sign in first.');
  var cache = CacheService.getScriptCache();
  var key = 'tok:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var hit = cache.get(key);
  if (hit) return hit;
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true,
  });
  var j = JSON.parse(r.getContentText() || '{}');
  var uid = j.users && j.users[0] && j.users[0].localId;
  if (!uid) throw new HttpError(401, 'Sign in again.');
  cache.put(key, uid, 600);
  return uid;
}

/** Kill switches live in Firestore config/flags (public read). Missing = on. */
function flag(name) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('flags');
  var flags;
  if (hit) flags = JSON.parse(hit);
  else {
    flags = {};
    try {
      var r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/config/flags?key=' + FIREBASE_API_KEY, { muteHttpExceptions: true });
      var f = JSON.parse(r.getContentText() || '{}').fields || {};
      for (var k in f) flags[k] = f[k].booleanValue !== false;
    } catch (err) {}
    cache.put('flags', JSON.stringify(flags), 60);
  }
  return flags[name] !== false;
}

function limit(key, max, windowSec) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get('lim:' + key) || 0);
    if (n >= max) throw new HttpError(429, 'Too many tries. Wait a bit and try again.');
    cache.put('lim:' + key, String(n + 1), windowSec > 21600 ? 21600 : windowSec);
  } finally {
    lock.releaseLock();
  }
}

function iceServers() {
  var list = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  if (prop('TURN_URL') && prop('TURN_USERNAME') && prop('TURN_CREDENTIAL')) {
    list.push({ urls: prop('TURN_URL').split(',').map(function (x) { return x.trim(); }), username: prop('TURN_USERNAME'), credential: prop('TURN_CREDENTIAL') });
  }
  return list;
}

/* ---------- schedule reader (ported from the old Cloudflare server) ---------- */
var READ_PROMPT = [
  "You read a student's school schedule (a photo, screenshot, or the student's own words) and return ONLY JSON, no prose, no code fences:",
  '{"name": string, "classes": Class[], "regular": Row[], "differentDays": {"Mon"?: Row[], "Tue"?: Row[], "Wed"?: Row[], "Thu"?: Row[], "Fri"?: Row[]}}',
  'Class = {"period": string, "name": string, "room": string, "teacher": string, "confidence": number}',
  'Row = {"period": string, "name": string, "start": "HH:MM", "end": "HH:MM", "room": string, "confidence": number}',
  'Rules:',
  '- "classes" lists every class with its period, ALWAYS, even when no times are shown. One entry per period.',
  '- "regular" is the normal school day WITH times. If the schedule shows no times, "regular" is [] and "differentDays" is {}.',
  '- "differentDays" lists ONLY weekdays whose times or classes differ from "regular"; leave it {} when every day is the same.',
  '- "period" is the period number as a string ("1", "2"...), or a short lowercase word for blocks without a number ("advisory", "homeroom", "lunch").',
  '- "name" is the class/subject exactly as written (e.g. "Biology"). "room" and "teacher" are "" when not shown.',
  '- Times are 24-hour HH:MM (1:05 PM -> "13:05"). School afternoon times like 1:05 without AM/PM are PM.',
  '- "confidence" is 0 to 1: how sure you are you read that cell correctly (blurry, cut off or guessed = low).',
  '- Rows sorted by start time. Never invent classes that are not there.',
].join('\n');

var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function toMin(t) {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
}

function extractJson(text) {
  var s = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  var a = s.indexOf('{');
  var b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new HttpError(502, "The reader didn't answer in a usable way. Try again.");
  return JSON.parse(s.slice(a, b + 1));
}

function promptFor(text) {
  return READ_PROMPT + (text ? "\n\nThe student's schedule:\n" + String(text).slice(0, 4000) : '');
}

function askGroq(text, image) {
  var content = [{ type: 'text', text: promptFor(text) }];
  if (image) content.push({ type: 'image_url', image_url: { url: 'data:' + (image.mimeType || 'image/jpeg') + ';base64,' + image.data } });
  var r = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + prop('GROQ_API_KEY') },
    payload: JSON.stringify({ model: 'qwen/qwen3.8-27b', temperature: 0.1, max_tokens: 2500, reasoning_format: 'hidden', messages: [{ role: 'user', content: content }] }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 400) throw new HttpError(502, 'Reader error ' + r.getResponseCode());
  var d = JSON.parse(r.getContentText());
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
}

function askGemini(text, image) {
  var parts = [{ text: promptFor(text) }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } });
  var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': prop('GEMINI_API_KEY') },
    payload: JSON.stringify({ contents: [{ parts: parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 400) throw new HttpError(502, 'Reader error ' + r.getResponseCode());
  var d = JSON.parse(r.getContentText());
  var p = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
  return p.map(function (x) { return x.text || ''; }).join('');
}

function cleanTime(t) {
  var m = String(t == null ? '' : t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  var h = Number(m[1]);
  var mm = Number(m[2]);
  if (h > 23 || mm > 59) return '';
  return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
}
function conf(v) {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.5;
}
function cleanRoom(s) {
  return String(s == null ? '' : s).trim().replace(/^(rm\.?|room)\s*/i, '').slice(0, 20);
}
function cleanPeriodId(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/^period\s*/, '').slice(0, 12);
}

function cleanAiRows(rows) {
  if (!Array.isArray(rows)) return [];
  var list = rows
    .map(function (r) {
      r = r || {};
      return {
        period: cleanPeriodId(r.period),
        name: String(r.name == null ? '' : r.name).trim().slice(0, 60),
        start: cleanTime(r.start),
        end: cleanTime(r.end),
        room: cleanRoom(r.room),
        teacher: String(r.teacher == null ? '' : r.teacher).trim().slice(0, 40),
        confidence: conf(r.confidence),
      };
    })
    .filter(function (r) { return r.start && r.end && toMin(r.end) > toMin(r.start); })
    .sort(function (a, b) { return toMin(a.start) - toMin(b.start); })
    .slice(0, 16);
  var kept = [];
  list.forEach(function (r) {
    var prev = kept[kept.length - 1];
    if (prev && toMin(r.start) < toMin(prev.end)) return;
    kept.push(r);
  });
  return kept;
}

function cleanBells(days) {
  if (!days || typeof days !== 'object') return null;
  var outDays = {};
  var any = false;
  DAYS.forEach(function (d) {
    var l = Array.isArray(days[d]) ? days[d] : [];
    outDays[d] = l.filter(function (p) { return p && TIME.test(p.start) && TIME.test(p.end); });
    if (outDays[d].length) any = true;
  });
  return any ? outDays : null;
}

function bellMismatch(row, bells) {
  if (!bells) return false;
  var all = [];
  DAYS.forEach(function (d) { all = all.concat(bells[d] || []); });
  if (!all.length) return false;
  function near(t) {
    return all.some(function (p) { return Math.abs(toMin(p.start) - toMin(t)) <= 3 || Math.abs(toMin(p.end) - toMin(t)) <= 3; });
  }
  return !(near(row.start) && near(row.end));
}

function readSchedule(body) {
  var image = body.image && body.image.data ? { data: String(body.image.data).slice(0, 6000000), mimeType: String(body.image.mimeType || 'image/jpeg') } : null;
  var text = body.text ? String(body.text) : null;
  if (!image && !text) throw new HttpError(400, 'Send a photo or some text.');
  var bells = cleanBells(body.bells);

  var chain = [];
  if (prop('GROQ_API_KEY')) chain.push(['groq-qwen3.8', function () { return askGroq(text, image); }]);
  if (prop('GEMINI_API_KEY')) chain.push(['gemini-3.6-flash', function () { return askGemini(text, image); }]);
  if (!chain.length) throw new HttpError(503, 'The schedule reader is not set up yet.');
  var parsed = null;
  var provider = '';
  var lastErr = null;
  for (var i = 0; i < chain.length && !parsed; i++) {
    try {
      parsed = extractJson(chain[i][1]());
      provider = chain[i][0];
    } catch (err) {
      lastErr = err;
    }
  }
  if (!parsed) throw lastErr instanceof HttpError ? lastErr : new HttpError(502, "The reader didn't answer. Try again in a moment.");

  var regular = cleanAiRows(parsed.regular);
  var days = {};
  var fallback = regular;
  DAYS.forEach(function (d) {
    var src = (parsed.differentDays && parsed.differentDays[d]) || (parsed.days && parsed.days[d]);
    days[d] = cleanAiRows(src);
    if (!fallback.length && days[d].length) fallback = days[d];
  });
  DAYS.forEach(function (d) { if (!days[d].length) days[d] = fallback; });

  var classes = {}, rooms = {}, teachers = {}, confidence = {};
  function add(c) {
    c = c || {};
    var period = cleanPeriodId(c.period);
    var name = String(c.name == null ? '' : c.name).trim().slice(0, 60);
    if (!period || !name || /^period \d+$/i.test(name)) return;
    if (!classes[period]) classes[period] = name;
    var room = cleanRoom(c.room);
    if (room && !rooms[period]) rooms[period] = room;
    var t = String(c.teacher == null ? '' : c.teacher).trim().slice(0, 40);
    if (t && !teachers[period]) teachers[period] = t;
    confidence[period] = Math.min(confidence[period] == null ? 1 : confidence[period], conf(c.confidence));
  }
  (Array.isArray(parsed.classes) ? parsed.classes : []).forEach(add);
  fallback.forEach(add);
  if (!fallback.length && !Object.keys(classes).length) throw new HttpError(422, "Couldn't find your classes. Try a clearer photo, or type it out.");

  var flags = {};
  function flagRow(p, f) {
    if (!p) return;
    flags[p] = flags[p] || [];
    if (flags[p].indexOf(f) < 0) flags[p].push(f);
  }
  Object.keys(confidence).forEach(function (p) { if (confidence[p] < 0.6) flagRow(p, 'unsure'); });
  fallback.forEach(function (r) {
    if (r.confidence < 0.6) flagRow(r.period, 'unsure');
    if (bellMismatch(r, bells)) flagRow(r.period, 'time');
  });
  var all = Object.keys(flags).map(function (k) { return flags[k]; });
  var warnings = [];
  if (all.some(function (f) { return f.indexOf('unsure') >= 0; })) warnings.push('Some cells were hard to read. Check the highlighted rows.');
  if (all.some(function (f) { return f.indexOf('time') >= 0; })) warnings.push("Some times don't match your school's bells. Check them, or use the school's times.");

  return {
    schedule: { name: String(parsed.name || 'My schedule').slice(0, 40), days: days, classes: classes, rooms: rooms, teachers: teachers, hasTimes: fallback.length > 0 },
    flags: flags,
    warnings: warnings,
    provider: provider,
  };
}

/** Run once from the editor (Run > authorize) so the web app may call Groq/Gemini/Google. */
function authorize() {
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
}
