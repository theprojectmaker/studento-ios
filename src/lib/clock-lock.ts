/**
 * Leaving clock lock mode: after the press-and-hold, ask for Face ID / Touch ID (falling back to
 * the device passcode). A phone with neither set up, the web, and older builds without the native
 * module unlock straight away, like before.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

const hasNative = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoLocalAuthentication');

/** True when the person may leave lock mode. */
export async function confirmUnlock(): Promise<boolean> {
  if (!hasNative) return true;
  try {
    const LA = await import('expo-local-authentication');
    const level = await LA.getEnrolledLevelAsync();
    if (level === LA.SecurityLevel.NONE) return true; // no biometrics and no passcode: nothing to ask
    const r = await LA.authenticateAsync({ promptMessage: 'Unlock the clock', disableDeviceFallback: false });
    return r.success;
  } catch {
    return true;
  }
}
