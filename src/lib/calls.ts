/** Beam calls (beta): start a call, and a tiny flag so the incoming-call banner stays quiet during a call. */
import { router } from 'expo-router';

import { getToken } from './account';
import * as api from './api';

let inCall = false;
export function setInCall(v: boolean) {
  inCall = v;
}
export function isInCall(): boolean {
  return inCall;
}

export async function startCall(username: string, video: boolean): Promise<void> {
  const t = await getToken();
  if (!t) throw new Error('Sign in first.');
  const c = await api.startCall(t, username, video);
  router.push({ pathname: '/call', params: { id: String(c.id), role: 'caller', video: video ? '1' : '0', peer: c.peer } });
}
