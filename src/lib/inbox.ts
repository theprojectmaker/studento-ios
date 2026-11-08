/**
 * Message alerts for invite-only chat. The text never says who or what: just
 * "1 new message in inbox". Runs while the app is open and in the background refresh.
 * There is no push server, so alerts arrive when Studento is open or iOS wakes it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getToken } from './account';
import * as api from './api';
import { getState } from './store';

const KEY = 'studento:inbox';

export async function checkInbox(): Promise<void> {
  if (Platform.OS === 'web') return;
  const s = getState();
  if (!s.account || !(s.prefs.unlocks ?? []).includes('messages')) return;
  const t = await getToken();
  if (!t) return;
  const threads = await api.listThreads(t);
  const unread = threads.reduce((a, x) => a + (x.unread || 0), 0);
  const seen = Number((await AsyncStorage.getItem(KEY)) || 0);
  await AsyncStorage.setItem(KEY, String(unread));
  if (unread > seen) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Studento', body: unread === 1 ? '1 new message in inbox' : `${unread} new messages in inbox`, sound: true, data: { kind: 'inbox' } },
      trigger: null,
    });
  }
}
