/** Leave Beam for the clock, even when Beam was opened with nothing behind it (a notification, the capture lock). */
import { router } from 'expo-router';

export function goToClock() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/messages');
}
