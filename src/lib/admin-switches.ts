/**
 * Per-feature switches the admin flips live (stored in config/flags next to the old ones).
 * A missing switch counts as on. Admin accounts are never stopped, so they can test.
 *   calls, media, chess, friends   = Beam features
 *   maintenance (bool) + maintenanceMsg (string) = whole-app "be right back" screen
 */
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { watchFlags } from './beam-extra';
import { currentUser, fbDb } from './fb';
import { getState, useStore } from './store';

export type FeatureKey = 'calls' | 'media' | 'chess' | 'friends';
export const FEATURES: { key: FeatureKey; label: string; sub: string }[] = [
  { key: 'calls', label: 'Calls', sub: 'Audio and video calls' },
  { key: 'media', label: 'Photos and videos', sub: 'Sending pictures and clips in chats' },
  { key: 'chess', label: 'Chess', sub: 'Starting new chess games' },
  { key: 'friends', label: 'Friend requests', sub: 'Sending new friend requests' },
];
const OFF_TEXT: Record<FeatureKey, string> = {
  calls: 'Calls are turned off by the admin right now.',
  media: 'Photos and videos are turned off by the admin right now.',
  chess: 'Chess is turned off by the admin right now.',
  friends: 'Friend requests are turned off by the admin right now.',
};

/** Throws a friendly error if the admin turned this feature off (admins pass). A per-user
 *  override wins over the global flag: forced on lets this person through, forced off blocks them. */
export async function requireFeature(k: FeatureKey): Promise<void> {
  if (getState().account?.user.admin) return;
  const uid = (await currentUser().catch(() => null))?.uid;
  if (uid) {
    const ov = (await getDoc(doc(fbDb(), 'userOverrides', uid)).catch(() => null))?.data()?.flags as Record<string, boolean> | undefined;
    if (ov && k in ov) {
      if (ov[k] === false) throw new Error(OFF_TEXT[k]);
      return;
    }
  }
  const f = (await getDoc(doc(fbDb(), 'config', 'flags')).catch(() => null))?.data();
  if (f && f[k] === false) throw new Error(OFF_TEXT[k]);
}

export type Flags = Record<string, boolean | string | number>;
export function useFlags(): Flags {
  const account = useStore((s) => s.account);
  const [f, setF] = useState<Flags>({});
  useEffect(() => {
    if (!account) return;
    return watchFlags((x) => setF(x as Flags));
  }, [account]);
  return f;
}
