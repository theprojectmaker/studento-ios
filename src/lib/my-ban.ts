/** This account's ban, live (one listener for the whole app). */
import { useEffect, useSyncExternalStore } from 'react';

import { watchMyBan, type Ban } from './beam-extra';
import { useStore } from './store';

let ban: Ban | null = null;
let stop: (() => void) | null = null;
let forUser = '';
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function sub(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

export function useMyBan(): Ban | null {
  const user = useStore((s) => (s.account && !s.account.user.admin ? s.account.user.username : ''));
  useEffect(() => {
    if (user === forUser) return;
    forUser = user;
    stop?.();
    stop = null;
    ban = null;
    emit();
    if (user)
      stop = watchMyBan((b) => {
        ban = b;
        emit();
      });
  }, [user]);
  return useSyncExternalStore(sub, () => ban, () => ban);
}
