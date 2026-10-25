/**
 * On-device text recognition for the schedule scan (Apple Vision on iOS, ML Kit on
 * Android, via expo-text-extractor). The photo never leaves the phone.
 *
 * The native module is missing in Expo Go and on the web, so it is loaded lazily inside
 * try/catch and `ocrSupported()` says whether scanning is available here.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type OcrLib = typeof import('expo-text-extractor');
let lib: OcrLib | null | undefined;

function load(): OcrLib | null {
  if (lib !== undefined) return lib;
  lib = null;
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return lib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-text-extractor') as OcrLib;
    lib = m.isSupported ? m : null;
  } catch {
    lib = null;
  }
  return lib;
}

export function ocrSupported(): boolean {
  return load() !== null;
}

/** Lines of text found in the image, top to bottom. */
export async function extractLines(uri: string): Promise<string[]> {
  const m = load();
  if (!m) throw new Error('Scanning works in the installed app, not here. Type your schedule instead.');
  const out = await m.extractTextFromImage(uri);
  return (out ?? []).map((s) => String(s).trim()).filter(Boolean);
}
