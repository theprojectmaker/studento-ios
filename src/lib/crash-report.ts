/**
 * Crash catcher. A JavaScript error that would close the app is saved first; on the next
 * launch the app shows it once, so a crash can be reported without a Mac or Xcode. Native
 * crashes (camera, microphone, web view) leave nothing here, which also tells us something.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const KEY = 'crash.last';

type Handler = (e: unknown, fatal?: boolean) => void;
const EU = (globalThis as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;

if (EU) {
  const prev = EU.getGlobalHandler();
  EU.setGlobalHandler((e, fatal) => {
    if (fatal) {
      const err = e instanceof Error ? e : new Error(String(e));
      const text = `${err.name}: ${err.message}\n${(err.stack ?? '').split('\n').slice(0, 8).join('\n')}`;
      void AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), text })).catch(() => {});
    }
    prev(e, fatal);
  });
}

/** Call once after launch: shows the saved crash (if any) and clears it. */
export async function showLastCrash(): Promise<void> {
  const s = await AsyncStorage.getItem(KEY);
  if (!s) return;
  await AsyncStorage.removeItem(KEY);
  const { at, text } = JSON.parse(s) as { at: number; text: string };
  Alert.alert('Studento closed last time', `${new Date(at).toLocaleString()}\n\n${text.slice(0, 900)}\n\nSend a screenshot of this to the developer.`);
}
