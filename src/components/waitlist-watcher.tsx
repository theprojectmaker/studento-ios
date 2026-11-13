/**
 * Sends "You're in" when the admin lets this person off the Beam waiting list. Watches while
 * the app is open; the alert fires once (remembered on this device).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { watchMyAccess } from '@/lib/beam-extra';
import { markBeamUser } from '@/lib/beam-social';
import { useStore } from '@/lib/store';

const KEY = 'beam.waitlist.last';

export function WaitlistWatcher() {
  const account = useStore((s) => s.account);
  const unlocked = useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
  // Everyone who has Beam goes on the public beamers list (so suggestions don't grey them out).
  useEffect(() => {
    if (!account || !unlocked) return;
    void markBeamUser().catch(() => {});
  }, [account, unlocked]);
  useEffect(() => {
    if (!account || account.user.admin || !unlocked) return;
    return watchMyAccess((status) => {
      void (async () => {
        const last = await AsyncStorage.getItem(KEY);
        await AsyncStorage.setItem(KEY, status);
        if (status === 'approved' && last === 'waiting' && Platform.OS !== 'web') {
          await Notifications.scheduleNotificationAsync({ content: { title: 'Studento', body: "You're in. Open the app to start.", sound: true, data: { kind: 'waitlist' } }, trigger: null });
        }
      })().catch(() => {});
    });
  }, [account, unlocked]);
  return null;
}
