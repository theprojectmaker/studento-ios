/**
 * A best-effort background top-up (iOS decides when, roughly every 12h+), so
 * bell alerts and the widget keep rolling forward even if the app isn't opened for a while.
 * Everything is local: no network.
 * Not available in Expo Go on iOS; there the alerts refill on each app open.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { refreshWidget, syncLiveActivity } from '../widgets';
import { rescheduleAlerts } from './notify';
import { load } from './store';

const TASK = 'studento-refresh-bells';

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(TASK, async () => {
      try {
        // Phone locked / storage unreadable: do nothing rather than act on (or save) empty defaults.
        if (!(await load())) return BackgroundTask.BackgroundTaskResult.Failed;
        await rescheduleAlerts();
        refreshWidget();
        await syncLiveActivity();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    // Task manager missing (e.g. some Expo Go builds): foreground refresh still works.
  }
}

export async function registerBackgroundRefresh() {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 12 * 60 });
  } catch {
    // Not supported here; ignore.
  }
}
