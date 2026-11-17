/**
 * Opening card when Beam opens: the word "Beam" eases in and up, holds a moment, and the card
 * fades away. About 1.05 s, no springs, tap anywhere to skip, and skipped with Reduce Motion.
 * The card is a plain view (no glass), so fading it is fine.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import type { BeamPalette } from '@/components/beam-ui';

const EASE = Easing.bezier(0.22, 0.8, 0.3, 1);

export function BeamIntro({ c, onDone }: { c: BeamPalette; onDone: () => void }) {
  const [gone, setGone] = useState(false);
  const word = useSharedValue(0);
  const card = useSharedValue(1);

  const finish = () => {
    setGone(true);
    onDone();
  };

  useEffect(() => {
    let dead = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (dead) return;
        if (reduce) return finish();
        word.set(withTiming(1, { duration: 380, easing: EASE }));
        card.set(withDelay(700, withTiming(0, { duration: 340, easing: Easing.out(Easing.quad) })));
        t = setTimeout(finish, 1060);
      })
      .catch(() => finish());
    return () => {
      dead = true;
      clearTimeout(t);
    };
    // run once when Beam opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 14 }] }));

  if (gone) return null;
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: c.dark ? '#000' : '#fff' }, cardStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={finish} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={wordStyle}>
          <Text style={{ color: c.text, fontSize: 52, fontWeight: '800', letterSpacing: -1.6 }}>Beam</Text>
          <Text style={{ color: c.text3, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4, letterSpacing: 0.3 }}>End-to-end encrypted</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
