/**
 * Decides what a read of the saved settings means, so the app never overwrites good
 * saved data with defaults.
 *
 * Why it matters: when iOS runs the background refresh while the phone is locked, the
 * storage can come back empty even though the data is there. If the app treated that as
 * "fresh install" and saved, it would wipe the student's theme, schedule and settings.
 * Every save also writes an `init` marker, so "marker present but nothing else" means
 * "unreadable right now", not "never used".
 */
export type StorageKind = 'fresh' | 'ok' | 'unreadable';

export function classifyStorage(m: Record<string, string | null | undefined>, keys: { prefs: string; backup: string; init: string }): StorageKind {
  if (m[keys.prefs] != null || m[keys.backup] != null) return 'ok';
  if (m[keys.init] != null) return 'unreadable';
  return 'fresh';
}
