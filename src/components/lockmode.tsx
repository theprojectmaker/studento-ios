/**
 * Lock mode: the clock stays up and nothing else is reachable (no corner buttons, no
 * customize, no settings), like Guided Access. One small red button in the top corner;
 * press and HOLD it for 2 s to unlock. A quick tap just shows how to unlock.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TYPE } from '@/lib/fonts';
import { setPref } from '@/lib/store';
import type { Theme } from '@/lib/themes';

const HOLD_MS = 2000;
const RED = '#ff3b30';

export function LockButton({ theme }: { theme: Theme }) {
  const insets = useSafeAreaInsets();
  const [hint, setHint] = useState(false);
  const [holding, setHolding] = useState(false);
  const ring = useSharedValue(0);

  // The ring fills while the button is held; letting go early cancels it.
  useEffect(() => {
    if (holding) {
      ring.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
      const t = setTimeout(() => {
        setPref('locked', false);
        setHolding(false);
      }, HOLD_MS);
      return () => clearTimeout(t);
    }
    ring.set(withTiming(0, { duration: 160 }));
  }, [holding, ring]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 2200);
    return () => clearTimeout(t);
  }, [hint]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scale: 0.3 + ring.value * 0.7 }], opacity: 0.25 + ring.value * 0.75 }));

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'flex-end' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Locked. Press and hold for two seconds to unlock."
        hitSlop={14}
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        onPress={() => setHint(true)}
        style={{ position: 'absolute', top: insets.top + 10, right: insets.right + 16, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={[{ position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: RED }, fill]} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: RED, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }} />
      </Pressable>
      {hint ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} pointerEvents="none" style={{ position: 'absolute', top: insets.top + 48, right: insets.right + 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Text style={{ ...TYPE.semibold, fontSize: 13, color: '#ffffff' }}>Hold the red button to unlock</Text>
        </Animated.View>
      ) : null}
      {/* Keep the theme type happy and let future per-theme styling in without touching callers. */}
      {theme ? null : null}
    </View>
  );
}
