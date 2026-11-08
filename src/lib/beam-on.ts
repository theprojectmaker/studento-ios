/**
 * Should Beam show? Only if this person redeemed the code AND the admin hasn't switched
 * messaging off. When it is off, the Beam button disappears for everyone except admin
 * accounts, who still see it so they can switch it back on from Admin.
 */
import { useEffect, useState } from 'react';

import { watchFlags } from './beam-extra';
import { useStore } from './store';

export function useBeamFlags(): { messaging: boolean; waitlist: boolean } {
  const account = useStore((s) => s.account);
  const [f, setF] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!account) return;
    return watchFlags(setF);
  }, [account]);
  return { messaging: f.messaging !== false, waitlist: f.waitlist === true };
}

export function useBeamVisible(): boolean {
  const unlocked = useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
  const admin = useStore((s) => !!s.account?.user.admin);
  const { messaging } = useBeamFlags();
  return unlocked && (messaging || admin);
}
