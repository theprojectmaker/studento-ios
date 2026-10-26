/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_ALERTS, planAlerts } from '../src/lib/alerts';
import { toPersonal } from '../src/lib/draft';
import { addDays, fmtTime, isNyDst, nyParts, nyWallToMs, weekdayOf } from '../src/lib/nytime';
import {
  ASSEMBLY_SCHEDULE,
  fmtCountdown,
  nowState,
  REGULAR_SCHEDULE,
  scheduleFor,
  validatePeriods,
  WEDNESDAY_SCHEDULE,
  type ScheduleData,
} from '../src/lib/schedule';

const EMPTY: ScheduleData = { customDays: [], override: null };
const ALL = { welcome: true, endWarning: true };

/** Reference conversion through Intl, which Node ships with full tz data. */
function intlNy(ms: number) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

test('NY offset matches Intl every 37 minutes across 2025-2028', () => {
  const start = Date.UTC(2025, 0, 1);
  const end = Date.UTC(2029, 0, 1);
  for (let t = start; t < end; t += 37 * 60_000) {
    const p = nyParts(t);
    const mine = `${p.date} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
    assert.equal(mine, intlNy(t), `at ${new Date(t).toISOString()}`);
  }
});

test('DST switch instants (2026: Mar 8 and Nov 1)', () => {
  assert.equal(isNyDst(Date.UTC(2026, 2, 8, 6, 59)), false);
  assert.equal(isNyDst(Date.UTC(2026, 2, 8, 7, 0)), true);
  assert.equal(isNyDst(Date.UTC(2026, 10, 1, 5, 59)), true);
  assert.equal(isNyDst(Date.UTC(2026, 10, 1, 6, 0)), false);
});

test('wall-clock to instant round-trips on both sides of DST', () => {
  for (const date of ['2026-03-06', '2026-03-09', '2026-10-30', '2026-11-02', '2027-01-15', '2027-07-01']) {
    for (const hhmm of ['08:00', '10:53', '14:33', '23:59', '00:00']) {
      const ms = nyWallToMs(date, hhmm);
      assert.equal(intlNy(ms), `${date} ${hhmm}`);
    }
  }
  // 8:00 AM is 13:00 UTC in winter and 12:00 UTC in summer.
  assert.equal(new Date(nyWallToMs('2026-11-02', '08:00')).toISOString(), '2026-11-02T13:00:00.000Z');
  assert.equal(new Date(nyWallToMs('2026-10-30', '08:00')).toISOString(), '2026-10-30T12:00:00.000Z');
  // Spring-forward gap resolves an hour later.
  assert.equal(intlNy(nyWallToMs('2026-03-08', '02:30')), '2026-03-08 03:30');
});

test('weekday picks the schedule', () => {
  assert.equal(weekdayOf('2026-10-19'), 'Mon');
  assert.equal(scheduleFor('2026-10-19', EMPTY).periods, REGULAR_SCHEDULE);
  assert.equal(scheduleFor('2026-10-21', EMPTY).periods, WEDNESDAY_SCHEDULE);
  assert.equal(scheduleFor('2026-10-21', EMPTY).kind, 'Wednesday Advisory');
  assert.equal(scheduleFor('2026-10-18', EMPTY).isSchoolDay, false);
  assert.equal(scheduleFor('2026-10-24', EMPTY).periods.length, 0);
});

test('override only counts on its own date; dated custom day wins', () => {
  const data: ScheduleData = { customDays: [], override: { date: '2026-10-19', type: 'assembly' } };
  assert.equal(scheduleFor('2026-10-19', data).periods, ASSEMBLY_SCHEDULE);
  assert.equal(scheduleFor('2026-10-20', data).periods, REGULAR_SCHEDULE);
  const custom = {
    id: 'x', date: '2026-10-19', label: 'Field day',
    periods: [{ period: '2', label: 'Period 2', start: '09:00', end: '10:00' }, { period: '1', label: 'Period 1', start: '08:00', end: '08:50' }],
  };
  const withDay: ScheduleData = { ...data, customDays: [custom] };
  const d = scheduleFor('2026-10-19', withDay);
  assert.equal(d.kind, 'Field day');
  assert.deepEqual(d.periods.map((p) => p.period), ['1', '2']);
  // Custom days apply even on a weekend.
  assert.equal(scheduleFor('2026-10-24', { ...EMPTY, customDays: [{ ...custom, date: '2026-10-24' }] }).isSchoolDay, true);
});

test('nowState: class, passing, before, after, weekend', () => {
  const mon = '2026-10-19';
  let s = nowState(nyWallToMs(mon, '09:30') + 15_000, EMPTY);
  assert.equal(s.phase, 'class');
  assert.equal(s.current?.period, '3');
  assert.equal(s.secondsLeft, 39 * 60 - 15);
  assert.equal(s.next?.period, '4');

  s = nowState(nyWallToMs(mon, '10:10'), EMPTY);
  assert.equal(s.phase, 'passing');
  assert.equal(s.next?.period, '4');
  assert.equal(s.secondsLeft, 120);

  s = nowState(nyWallToMs(mon, '07:15'), EMPTY);
  assert.equal(s.phase, 'before');
  assert.equal(s.secondsLeft, 45 * 60);

  // The bell instant itself belongs to the next period.
  s = nowState(nyWallToMs(mon, '08:41'), EMPTY);
  assert.equal(s.phase, 'passing');

  s = nowState(nyWallToMs(mon, '14:33'), EMPTY);
  assert.equal(s.phase, 'after');
  assert.equal(s.nextSchoolDay?.date, '2026-10-20');

  s = nowState(nyWallToMs('2026-10-23', '15:00'), EMPTY);
  assert.equal(s.nextSchoolDay?.date, '2026-10-26');

  s = nowState(nyWallToMs('2026-10-24', '12:00'), EMPTY);
  assert.equal(s.phase, 'off');
  assert.equal(s.nextSchoolDay?.weekday, 'Mon');
});

test('nowState works on the Monday after the fall DST switch', () => {
  // Nov 2 2026 is the first school day on EST.
  const s = nowState(Date.UTC(2026, 10, 2, 13, 5), EMPTY); // 08:05 EST
  assert.equal(s.current?.period, '1');
  assert.equal(nyParts(Date.UTC(2026, 10, 2, 13, 5)).hour, 8);
});

test('alerts: 3 min after start and 5 min before end, NY time', () => {
  const now = nyWallToMs('2026-10-19', '06:00');
  const plan = planAlerts(now, EMPTY, { '3': 'Biology' }, { '3': { room: '204' } }, ALL);
  const p3 = plan.find((a) => a.id === 'bell-2026-10-19-2-start');
  assert.ok(p3);
  if (!p3) return;
  assert.equal(intlNy(p3.at), '2026-10-19 09:31');
  assert.equal(p3.title, 'Welcome to Period 3');
  assert.equal(p3.body, 'Biology · 9:28 AM – 10:09 AM · Room 204');
  const e3 = plan.find((a) => a.id === 'bell-2026-10-19-2-end');
  assert.equal(intlNy(e3!.at), '2026-10-19 10:04');
  assert.equal(e3!.title, 'Period 3 ends in 5 min');
  assert.match(e3!.body, /Next: Period 4/);
  const last = plan.find((a) => a.id === 'bell-2026-10-19-8-end');
  assert.match(last!.body, /Last bell at 2:33 PM/);
});

test('alerts: never in the past, never more than 64, whole days only, sorted', () => {
  const now = nyWallToMs('2026-10-19', '09:40');
  const plan = planAlerts(now, EMPTY, {}, {}, ALL);
  assert.ok(plan.length <= 64);
  assert.ok(plan.filter((a) => a.kind !== 'reminder').length <= MAX_ALERTS);
  assert.ok(plan.every((a) => a.at > now));
  // Period 3 started 9:28 -> welcome 9:31 already passed, end warning 10:04 still ahead.
  assert.equal(plan.some((a) => a.id === 'bell-2026-10-19-2-start'), false);
  assert.equal(plan.some((a) => a.id === 'bell-2026-10-19-2-end'), true);
  const ids = new Set(plan.map((a) => a.id));
  assert.equal(ids.size, plan.length, 'ids are unique');
  // No weekend alerts.
  for (const a of plan) assert.notEqual(['Sat', 'Sun'].includes(nyParts(a.at).weekday) && a.kind !== 'reminder', true);
  // Exactly one reminder, on a school morning 15 min before first bell.
  const rem = plan.filter((a) => a.kind === 'reminder');
  assert.equal(rem.length, 1);
  assert.match(intlNy(rem[0].at), / 07:45$/);
  // Each covered day is complete: 18 alerts on a regular day, 20 on Wednesday.
  const perDay = new Map<string, number>();
  for (const a of plan) if (a.kind !== 'reminder') perDay.set(nyParts(a.at).date, (perDay.get(nyParts(a.at).date) ?? 0) + 1);
  for (const [d, n] of perDay) if (d !== '2026-10-19') assert.equal(n, weekdayOf(d) === 'Wed' ? 20 : 18, d);
});

test('alerts: turning both kinds off plans nothing; one kind halves it', () => {
  const now = nyWallToMs('2026-10-19', '06:00');
  assert.equal(planAlerts(now, EMPTY, {}, {}, { welcome: false, endWarning: false }).length, 0);
  const only = planAlerts(now, EMPTY, {}, {}, { welcome: true, endWarning: false });
  assert.ok(only.every((a) => a.kind !== 'end'));
});

test('alerts across the DST weekend keep the same wall-clock times', () => {
  const now = nyWallToMs('2026-10-30', '06:00'); // Friday before fall back
  const plan = planAlerts(now, EMPTY, {}, {}, ALL);
  const fri = plan.find((a) => a.id === 'bell-2026-10-30-0-start')!;
  const mon = plan.find((a) => a.id === 'bell-2026-11-02-0-start')!;
  assert.equal(intlNy(fri.at), '2026-10-30 08:03');
  assert.equal(intlNy(mon.at), '2026-11-02 08:03');
  assert.equal(new Date(mon.at).toISOString(), '2026-11-02T13:03:00.000Z');
});

test('helpers', () => {
  assert.equal(fmtTime('13:05'), '1:05 PM');
  assert.equal(fmtTime('00:10'), '12:10 AM');
  assert.equal(fmtTime('12:00'), '12:00 PM');
  assert.equal(fmtTime('08:00', true), '08:00');
  assert.equal(fmtCountdown(65), '1:05');
  assert.equal(fmtCountdown(3725), '1:02:05');
  assert.equal(fmtCountdown(0.2), '0:01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(validatePeriods([{ period: '1', label: '', start: '08:00', end: '08:40' }, { period: '2', label: '', start: '08:30', end: '09:00' }]), 'Period 1 and Period 2 overlap.');
  assert.equal(validatePeriods([{ period: '1', label: '', start: '09:00', end: '08:40' }]), 'Period 1 ends before it starts.');
  assert.equal(validatePeriods(REGULAR_SCHEDULE), null);
});

test('personal schedule replaces the built-in one (and ignores shared custom days/overrides)', () => {
  const rows = [
    { period: '1', label: 'Algebra', start: '07:45', end: '08:30', room: '112' },
    { period: 'lunch', label: 'Lunch', start: '10:15', end: '10:45' },
    { period: '2', label: 'English', start: '08:35', end: '09:20' },
  ];
  const personal = { name: 'My school', days: { Mon: rows, Tue: rows, Wed: [], Thu: rows, Fri: rows } };
  const data: ScheduleData = {
    customDays: [{ id: 'x', date: '2026-10-19', label: 'Assembly', periods: [{ period: '1', label: 'P1', start: '08:00', end: '09:00' }] }],
    override: { date: '2026-10-19', type: 'assembly' },
    personal,
  };
  const mon = scheduleFor('2026-10-19', data);
  assert.equal(mon.kind, 'My school');
  assert.deepEqual(mon.periods.map((p) => p.label), ['Algebra', 'English', 'Lunch']);
  assert.equal(scheduleFor('2026-10-21', data).isSchoolDay, false); // empty Wednesday = no school
  assert.equal(scheduleFor('2026-10-24', data).isSchoolDay, false); // Saturday

  const s = nowState(nyWallToMs('2026-10-19', '07:50'), data);
  assert.equal(s.current?.label, 'Algebra');
  assert.equal(s.secondsLeft, 40 * 60);

  const plan = planAlerts(nyWallToMs('2026-10-19', '06:00'), data, {}, {}, ALL);
  const first = plan.find((a) => a.id === 'bell-2026-10-19-0-start')!;
  assert.equal(intlNy(first.at), '2026-10-19 07:48');
  assert.equal(first.body, 'Algebra · 7:45 AM – 8:30 AM · Room 112');
  assert.ok(plan.every((a) => !a.id.startsWith('bell-2026-10-21')), 'no alerts on the empty Wednesday');
});

test('scanned classes keep North High bells (custom days still apply), with the scanned names and rooms', () => {
  const personal = toPersonal({ name: 'Me', days: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] }, classes: { '1': 'Algebra', '3': 'Biology' }, rooms: { '3': '204' }, hasTimes: false });
  assert.equal(personal.bells, 'school');
  // North mode runs the shared bells: scheduleFor gets personal: null, names/rooms come from the scan.
  const data: ScheduleData = { customDays: [], override: { date: '2026-10-19', type: 'assembly' }, personal: null };
  const mon = scheduleFor('2026-10-19', data);
  assert.equal(mon.kind, scheduleFor('2026-10-19', { ...data, override: { date: '2026-10-19', type: 'assembly' } }).kind);
  assert.ok(mon.periods.length > 0);
  const plan = planAlerts(nyWallToMs('2026-10-20', '06:00'), EMPTY, personal.classNames!, { '3': { room: '204' } }, ALL);
  const p3 = plan.find((a) => a.id.startsWith('bell-2026-10-20') && a.body.startsWith('Biology'));
  assert.ok(p3, 'Period 3 alert uses the scanned class name');
  assert.match(p3!.body, /Room 204/);
});

test('widget timeline: one entry per bell, live countdown windows, switches periods by itself', async () => {
  const { widgetTimeline, bellProps } = await import('../src/lib/widgetData');
  // Only colors are read; the real theme module pulls in font files Node cannot load.
  const theme = { bg: '#000000', ink: '#ffffff', muted: '#999999', accent: '#e8b84b' } as unknown as import('../src/lib/themes').Theme;
  const now = nyWallToMs('2026-10-19', '09:30');
  const tl = widgetTimeline(now, EMPTY, { '3': 'Biology', '4': 'Gym' }, { '3': { room: '204' } }, theme, false);
  assert.equal(tl[0].at, now);
  assert.equal(tl[0].props.mode, 'class');
  assert.equal(tl[0].props.title, 'Biology');
  assert.equal(tl[0].props.label, 'Period 3 · Room 204');
  assert.equal(tl[0].props.end, nyWallToMs('2026-10-19', '10:09'));
  assert.equal(tl[0].props.next, 'Next: Gym 10:12 AM');
  // Next entry is the 10:09 bell -> passing time counting down to 10:12.
  assert.equal(intlNy(tl[1].at), '2026-10-19 10:09');
  assert.equal(tl[1].props.mode, 'passing');
  assert.equal(tl[1].props.end, nyWallToMs('2026-10-19', '10:12'));
  // Sorted, unique, capped, all in the future after the first.
  for (let i = 1; i < tl.length; i++) assert.ok(tl[i].at > tl[i - 1].at);
  assert.ok(tl.length <= 90);
  // After the last bell it says done, with tomorrow's first bell.
  const done = tl.find((e) => intlNy(e.at) === '2026-10-19 14:33')!;
  assert.equal(done.props.mode, 'off');
  assert.equal(done.props.title, 'Done for today');
  assert.equal(done.props.next, 'First bell 8:00 AM');
  // After school the widget is a clock with seconds: a timer counting up from noon (PM) shows 2:33...
  assert.equal(done.props.ampm, 'PM');
  assert.equal(done.props.clockFrom, nyWallToMs('2026-10-19', '12:00'));
  // ...from midnight in the morning, and 12:xx counts from 12 hours earlier so it reads 12, not 0.
  const early = bellProps(nowState(nyWallToMs('2026-10-24', '05:30'), EMPTY), {}, {}, theme, false, nyWallToMs('2026-10-24', '05:30'), nyWallToMs('2026-10-24', '05:30'));
  assert.equal(early.clockFrom, nyWallToMs('2026-10-24', '00:00'));
  assert.equal(early.ampm, 'AM');
  const sat = nyWallToMs('2026-10-24', '12:30');
  const noon = bellProps(nowState(sat, EMPTY), {}, {}, theme, false, sat, sat);
  assert.equal(noon.clockFrom, nyWallToMs('2026-10-24', '12:00') - 12 * 3600_000);
  // 24-hour time always counts from midnight.
  assert.equal(bellProps(nowState(sat, EMPTY), {}, {}, theme, true, sat, sat).clockFrom, nyWallToMs('2026-10-24', '00:00'));
  // Test-mode style shift: timers move onto the real clock.
  const fake = nyWallToMs('2026-10-19', '09:38');
  const real = Date.UTC(2026, 9, 18, 23, 0);
  const p = bellProps(nowState(fake, EMPTY), {}, {}, theme, false, real, fake);
  assert.equal(p.end - real, nyWallToMs('2026-10-19', '10:09') - fake);
});

test('storage read: an unreadable saved copy is never mistaken for a fresh install (the wipe bug)', async () => {
  const { classifyStorage } = await import('../src/lib/storageKind');
  const keys = { prefs: 'p', backup: 'b', init: 'i' };
  // Brand-new install: nothing stored, no marker -> safe to start from defaults and save.
  assert.equal(classifyStorage({ p: null, b: null, i: null }, keys), 'fresh');
  assert.equal(classifyStorage({}, keys), 'fresh');
  // Normal launch: saved settings are there.
  assert.equal(classifyStorage({ p: '{"theme":"gold"}', b: null, i: '1' }, keys), 'ok');
  // Backup copy alone is enough to restore from.
  assert.equal(classifyStorage({ p: null, b: '{}', i: '1' }, keys), 'ok');
  // Phone locked / storage hiccup: the app has saved before (marker) but nothing came back.
  // This must NOT be treated as fresh, or the next save would wipe the student's data.
  assert.equal(classifyStorage({ p: null, b: null, i: '1' }, keys), 'unreadable');
  // Installs from before the marker existed still load fine.
  assert.equal(classifyStorage({ p: '{}', b: null, i: null }, keys), 'ok');
});

test('generic names: with no classes entered, every surface says "Period N" (never the owner classes)', async () => {
  // (The store module pulls in theme fonts Node cannot load, so this tests the pure pieces it uses.)
  const { nameFor, periodTitle, REGULAR_SCHEDULE, WEDNESDAY_SCHEDULE } = await import('../src/lib/schedule');
  // Fresh install: no class names at all.
  const names: Record<string, string> = {};
  assert.equal(nameFor(REGULAR_SCHEDULE[0], names), 'Period 1');
  assert.equal(nameFor(REGULAR_SCHEDULE[8], names), 'Period 9');
  assert.equal(nameFor(WEDNESDAY_SCHEDULE[0], names), 'Advisory');
  assert.equal(periodTitle({ period: 'lunch', label: 'Lunch', start: '10:12', end: '10:53' }), 'Lunch');
  // Alerts and the widget read the same way.
  const plan = planAlerts(nyWallToMs('2026-10-19', '06:00'), EMPTY, names, {}, ALL);
  const first = plan.find((a) => a.id === 'bell-2026-10-19-2-start')!;
  assert.equal(first.title, 'Welcome to Period 3');
  assert.ok(!/Biology|Geometry|Hebrew/.test(plan.map((a) => a.title + a.body).join(' ')), 'no owner classes leak');
  const { bellProps } = await import('../src/lib/widgetData');
  const theme = { bg: '#000000', ink: '#ffffff', muted: '#999999', accent: '#e8b84b', engine: 'flap', font: 'sans', light: false } as unknown as import('../src/lib/themes').Theme;
  const t = nyWallToMs('2026-10-19', '09:30');
  assert.equal(bellProps(nowState(t, EMPTY), names, {}, theme, false, t, t).title, 'Period 3');
});

test('setup wizard flow: steps, skipping the schedule step without a school, clamping', async () => {
  const { SETUP_STEPS, LAST_STEP, clampStep, nextStep, prevStep, visibleSteps } = await import('../src/lib/setupFlow');
  assert.equal(SETUP_STEPS[0].id, 'welcome');
  assert.equal(SETUP_STEPS[LAST_STEP].id, 'done');
  assert.equal(clampStep(undefined), 0);
  assert.equal(clampStep(99), LAST_STEP);
  assert.equal(clampStep(-3), 0);
  // With a school: welcome -> school -> schedule -> classes ...
  assert.equal(SETUP_STEPS[nextStep(1, { hasSchool: true })].id, 'schedule');
  // Without one: the schedule step is skipped both ways.
  assert.equal(SETUP_STEPS[nextStep(1, { hasSchool: false })].id, 'classes');
  assert.equal(SETUP_STEPS[prevStep(3, { hasSchool: false })].id, 'school');
  assert.equal(visibleSteps({ hasSchool: false }).length, SETUP_STEPS.length - 1);
  assert.equal(nextStep(LAST_STEP, { hasSchool: true }), LAST_STEP);
  assert.ok(SETUP_STEPS.filter((s) => s.optional).length >= 6, 'nearly everything is skippable');
});
