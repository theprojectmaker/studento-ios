/**
 * Beam is locked until the person proves it's them: Face ID / Touch ID (or the phone passcode)
 * when the app build has it, otherwise the Studento account password. It locks again when you
 * leave Beam or the app goes to the background.
 */
import { requireOptionalNativeModule } from 'expo';
import * as FA from 'firebase/auth';
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

import { currentUser } from './fb';

let unlocked = false;
const subs = new Set<() => void>();
function set(v: boolean) {
  unlocked = v;
  subs.forEach((f) => f());
}
AppState.addEventListener('change', (s) => {
  if (s === 'background') set(false);
});

export const lockBeam = () => set(false);
export const useBeamUnlocked = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => unlocked,
    () => unlocked
  );

/** Builds before 1.2.1 don't include the native module, so never import it unless it's there. */
const hasNative = !!requireOptionalNativeModule('ExpoLocalAuthentication');

/** 'face' | 'touch' | 'passcode' when the device can do it, or null (use the password). */
export async function biometricKind(): Promise<'face' | 'touch' | 'passcode' | null> {
  if (!hasNative) return null;
  const LA = await import('expo-local-authentication');
  if (!(await LA.hasHardwareAsync()) || !(await LA.isEnrolledAsync())) {
    return (await LA.getEnrolledLevelAsync()) >= LA.SecurityLevel.SECRET ? 'passcode' : null;
  }
  const t = await LA.supportedAuthenticationTypesAsync();
  return t.includes(LA.AuthenticationType.FACIAL_RECOGNITION) ? 'face' : 'touch';
}

export async function unlockWithBiometrics(): Promise<boolean> {
  if (!hasNative) return false;
  const LA = await import('expo-local-authentication');
  const r = await LA.authenticateAsync({ promptMessage: 'Unlock', cancelLabel: 'Use password', disableDeviceFallback: false });
  if (r.success) set(true);
  return r.success;
}

export async function unlockWithPassword(password: string): Promise<void> {
  const u = await currentUser();
  if (!u?.email) throw new Error('Sign in first.');
  try {
    await FA.reauthenticateWithCredential(u, FA.EmailAuthProvider.credential(u.email, password));
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    if (code.includes('too-many-requests')) throw new Error('Too many tries. Wait a bit and try again.');
    if (code.includes('network')) throw new Error("Can't check right now. Check your internet.");
    throw new Error('Wrong password.');
  }
  set(true);
}
