/**
 * While the screen is recorded, mirrored or shared, Studento drops back to the plain clock and
 * locks it: every open screen (chats, calls, settings) closes, an invisible layer swallows all
 * touches, and calls and message alerts stay quiet (incoming-call.tsx and call.tsx check
 * isCapturing). It unlocks by itself when sharing stops.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCapturing } from '@/lib/capture';

export function CaptureShield() {
  const captured = useCapturing();
  useEffect(() => {
    if (!captured) return;
    try {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    } catch {}
  }, [captured]);
  if (!captured) return null;
  return <View style={[StyleSheet.absoluteFill, { zIndex: 10000 }]} pointerEvents="auto" onStartShouldSetResponder={() => true} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
