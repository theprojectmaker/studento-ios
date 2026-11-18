/**
 * Should Beam show? Only if this person redeemed the code AND the admin hasn't switched
 * messaging off. When it is off, the Beam button disappears for everyone except admin
 * accounts, who still see it so they can switch it back on from Admin.
 */
import { useEffect, useState } from 'react';

import { requestAccess, watchFlags, watchMyAccess, type AccessStatus } from './beam-extra';
import { useMyBan } from './my-ban';
import { useStore } from './store';

export function useBeamFlags(): { messaging: boolean; waitlist: boolean; callWaitlist: boolean } {
  const account = useStore((s) => s.account);
  const [f, setF] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!account) return;
    return watchFlags(setF);
  }, [account]);
  // Calls have their own early-access list, on unless the admin turns it off.
  return { messaging: f.messaging !== false, waitlist: f.waitlist === true, callWaitlist: f.callWaitlist !== false };
}

/** Has this person redeemed the Beam code? Without it Beam doesn't exist anywhere in the app. */
export function useBeamRedeemed(): boolean {
  return useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
}

export function useBeamVisible(): boolean {
  const unlocked = useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
  const admin = useStore((s) => !!s.account?.user.admin);
  const { messaging } = useBeamFlags();
  // Any ban (chatting off or full) hides Beam for that person.
  const ban = useMyBan();
  // The code is tied to an account: signed out, Beam stays hidden too.
  const signedIn = useStore((s) => !!s.account);
  return unlocked && signedIn && !ban && (messaging || admin);
}

/**
 * Calls are approved separately from Beam. "allowed" means they may start calls; otherwise show the
 * early-access request (never worded as calls).
 */
export function useCallAccess(): { allowed: boolean; status: AccessStatus; place?: number; request: () => Promise<void> } {
  const account = useStore((s) => s.account);
  const admin = !!account?.user.admin;
  const { callWaitlist } = useBeamFlags();
  const [st, setSt] = useState<{ s: AccessStatus; n?: number }>({ s: 'none' });
  useEffect(() => {
    if (!account || admin) return;
    return watchMyAccess((s, n) => setSt({ s, n }), 'callAccess');
  }, [account, admin]);
  return { allowed: admin || !callWaitlist || st.s === 'approved', status: st.s, place: st.n, request: () => requestAccess('callAccess') };
}
