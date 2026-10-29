/**
 * Bell alerts as LOCAL scheduled notifications. No push server.
 * The plan comes from planAlerts(); this file only talks to expo-notifications.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planAlerts } from './alerts';
import { addDays, nyParts, nyWallToMs } from './nytime';
import { getPlanner, subscribePlanner } from './planner';
import { detailsFor, getState, namesFor, scheduleData, subscribe, type State } from './store';

const CHANNEL = 'bells';

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type Permission = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<Permission> {
  if (Platform.OS === 'web') return 'denied';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<Permission> {
  if (Platform.OS === 'web') return 'denied';
  await ensureChannel();
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Bell alerts',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

let running: Promise<number> | null = null;
let again = false;

/**
 * Replace every scheduled bell alert with a fresh plan. Returns how many were set.
 * Calls that arrive while one is running collapse into a single re-run.
 */
export function rescheduleAlerts(): Promise<number> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let count = 0;
    try {
      count = await doReschedule(getState());
    } finally {
      running = null;
      if (again) {
        again = false;
        void rescheduleAlerts();
      }
    }
    return count;
  })();
  return running;
}

let lastSig = '';

async function cancelBells(pending: Notifications.NotificationRequest[]) {
  await Promise.all(pending.filter((n) => n.identifier.startsWith('bell-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

async function doReschedule(s: State): Promise<number> {
  if (Platform.OS === 'web') return 0;
  // Only clear bell alerts; a running focus timer keeps its own alert.
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (!s.prefs.alerts || (await getPermission()) !== 'granted') {
    await cancelBells(pending);
    lastSig = '';
    return 0;
  }
  await ensureChannel();
  const plan = planAlerts(Date.now(), scheduleData(s), namesFor(s), detailsFor(s), s.prefs, { h24: s.prefs.h24 });
  // Same alerts already queued (the usual case on every foreground)? Leave them alone
  // instead of cancelling and re-adding ~60 notifications.
  const sig = plan.map((a) => [a.id, a.at, a.title, a.body].join('|')).join('~');
  if (sig === lastSig && pending.filter((n) => n.identifier.startsWith('bell-')).length === plan.length) return plan.length;
  await cancelBells(pending);
  lastSig = sig;
  for (const a of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: a.id,
      content: { title: a.title, body: a.body, sound: true, data: { kind: a.kind } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(a.at), channelId: CHANNEL },
    });
  }
  return plan.length;
}

let lastTest = 0;

/** One test alert in 5 seconds; at most one every 20 seconds. */
export async function sendTestAlert(): Promise<string> {
  if (Platform.OS === 'web') return 'Alerts only work on a phone.';
  if (Date.now() - lastTest < 20_000) return 'One test at a time. Try again in a few seconds.';
  if ((await getPermission()) !== 'granted') return 'Turn on notifications for Studento first.';
  lastTest = Date.now();
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: 'studento-test',
    content: { title: 'Studento test', body: 'This is how a bell alert will look.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return 'Test alert coming in 5 seconds. Lock the phone to see it.';
}

/** Re-plan whenever the inputs to the plan change (debounced). */
export function watchForReschedule(): () => void {
  let key = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    const s = getState();
    if (!s.loaded) return;
    const next = JSON.stringify([s.shared, s.personal, s.prefs.alerts, s.prefs.welcome, s.prefs.endWarning, s.prefs.warnMin, s.prefs.h24]);
    if (next === key) return;
    key = next;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rescheduleAlerts(), 800);
  };
  check();
  return subscribe(check);
}

const HW_PREFIX = 'hw-';
const HW_MAX = 12;
const HW_HOUR = '19:00';

/**
 * One quiet reminder at 7 PM the evening before each homework due date
 * (or at 7 AM on the day, when it was added the night before). Replaces the old set.
 */
export async function rescheduleHomework(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pending.filter((n) => n.identifier.startsWith(HW_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const s = getState();
  if (!s.prefs.alerts || !s.prefs.homeworkReminders || (await getPermission()) !== 'granted') return 0;
  await ensureChannel();
  const now = Date.now();
  const today = nyParts(now).date;
  const names = namesFor(s);
  const list = getPlanner()
    .homework.filter((h) => !h.done && h.due && h.due >= today)
    .map((h) => {
      const eve = nyWallToMs(addDays(h.due, -1), HW_HOUR);
      const at = eve > now ? eve : nyWallToMs(h.due, '07:00');
      return { h, at };
    })
    .filter((x) => x.at > now)
    .sort((a, b) => a.at - b.at)
    .slice(0, HW_MAX);
  for (const { h, at } of list) {
    const cls = h.period ? names[h.period] || (h.period === 'advisory' ? 'Advisory' : `Period ${h.period}`) : '';
    await Notifications.scheduleNotificationAsync({
      identifier: HW_PREFIX + h.id,
      content: { title: at < nyWallToMs(h.due, '00:00') ? 'Due tomorrow' : 'Due today', body: cls ? `${h.title} · ${cls}` : h.title, sound: true, data: { kind: 'homework' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL },
    });
  }
  return list.length;
}

/** Re-plan homework reminders when the list or the setting changes (debounced). */
export function watchHomework(): () => void {
  let key = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    const s = getState();
    const p = getPlanner();
    if (!s.loaded || !p.loaded) return;
    const next = JSON.stringify([p.homework.map((h) => [h.id, h.due, h.done, h.title, h.period]), s.prefs.alerts, s.prefs.homeworkReminders, s.shared.classNames, s.personal]);
    if (next === key) return;
    key = next;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rescheduleHomework(), 1200);
  };
  check();
  const a = subscribe(check);
  const b = subscribePlanner(check);
  return () => {
    a();
    b();
  };
}

const FOCUS_ID = 'focus-end';

/** One alert when the focus block (or break) the student just started runs out. */
export async function scheduleFocusAlert(endsAt: number, mode: 'focus' | 'break') {
  if (Platform.OS === 'web') return;
  await cancelFocusAlert();
  if ((await getPermission()) !== 'granted') return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_ID,
    content: {
      title: mode === 'focus' ? 'Focus block done' : 'Break is over',
      body: mode === 'focus' ? 'Nice work. Take a short break.' : 'Ready for another focus block?',
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt), channelId: CHANNEL },
  });
}

export async function cancelFocusAlert() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}
