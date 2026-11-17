/**
 * Liquid Glass theme: an iOS 26 style floating tab bar. A glass capsule sits at the bottom; a
 * clear glass bubble marks the current tab and slides (by frame only, so the glass stays real)
 * to whatever you tap, or follows your finger as you drag across the bar. Let go = open it.
 */
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { hasLiquidGlass } from '@/components/glass';
import { tap } from '@/components/ui';

export interface LiquidTab {
  key: string;
  label: string;
  icon: (color: string, big: boolean) => ReactNode;
  onOpen?: () => void;
}

// Only one tab bar is ever on screen, so the pending tap lives here.
let pending: ReturnType<typeof setTimeout> | null = null;
function cancel() {
  if (pending) clearTimeout(pending);
  pending = null;
}
function later(fn: () => void) {
  cancel();
  pending = setTimeout(fn, 240);
}
const H = 62;
const PAD = 4;
const EASE = Easing.bezier(0.25, 0.9, 0.3, 1);

/**
 * `selected` + `onSelect` make it a plain in-screen tab bar (Beam): the bubble rests on the
 * selected tab and taps switch at once. Without them it is the clock's launcher.
 */
export function LiquidTabBar({ tabs, bottom, maxWidth = 420, selected, onSelect }: { tabs: LiquidTab[]; bottom: number; maxWidth?: number; selected?: number; onSelect?: (i: number) => void }) {
  const glass = hasLiquidGlass();
  const [w, setW] = useState(0);
  const [hot, setHot] = useState(0);
  const tabW = w ? (w - PAD * 2) / tabs.length : 0;
  const x = useSharedValue(PAD);
  const grow = useSharedValue(0);

  const moveTo = useCallback(
    (i: number, ms = 280) => {
      setHot(i);
      x.set(withTiming(PAD + i * tabW, { duration: ms, easing: EASE }));
    },
    [tabW, x]
  );

  // Coming back to the clock: the bubble slides home to the first tab.
  useFocusEffect(
    useCallback(() => {
      cancel();
      if (tabW) moveTo(selected ?? 0, 320);
    }, [moveTo, tabW, selected])
  );

  const open = (i: number) => {
    tap();
    moveTo(i);
    cancel();
    if (onSelect) return onSelect(i);
    if (i === 0) return;
    later(() => tabs[i]?.onOpen?.());
  };

  const idx = (px: number) => Math.max(0, Math.min(tabs.length - 1, Math.floor((px - PAD) / Math.max(1, tabW))));
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(6)
    .onBegin(() => grow.set(withTiming(1, { duration: 160 })))
    .onUpdate((e) => {
      x.set(Math.max(PAD, Math.min(w - PAD - tabW, e.x - tabW / 2)));
      const i = idx(e.x);
      if (i !== hot) setHot(i);
    })
    .onEnd((e) => open(idx(e.x)))
    .onFinalize(() => grow.set(withTiming(0, { duration: 220 })));

  // The bubble only changes its frame (left/top/size): fading or scaling breaks real glass.
  const bubble = useAnimatedStyle(() => ({
    left: x.value - grow.value * 4,
    top: PAD - grow.value * 4,
    width: tabW + grow.value * 8,
    height: H - PAD * 2 + grow.value * 8,
    borderRadius: (H - PAD * 2 + grow.value * 8) / 2,
  }));

  const bar = { height: H, borderRadius: H / 2 };
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom, alignItems: 'center' }}>
      <GestureDetector gesture={pan}>
        <View style={{ width: '100%', maxWidth, height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {glass ? (
            <GlassContainer spacing={10} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
              <GlassView glassEffectStyle="regular" tintColor="rgba(20,20,24,0.35)" style={[{ position: 'absolute', left: 0, top: 0, right: 0 }, bar]} />
              {w ? (
                <Animated.View style={[{ position: 'absolute' }, bubble]}>
                  <GlassView glassEffectStyle="clear" isInteractive style={{ flex: 1, borderRadius: H }} />
                </Animated.View>
              ) : null}
            </GlassContainer>
          ) : (
            <>
              <View style={[{ position: 'absolute', left: 0, top: 0, right: 0, backgroundColor: 'rgba(40,40,46,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, bar]} />
              {w ? <Animated.View style={[{ position: 'absolute', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }, bubble]} /> : null}
            </>
          )}
          <View style={{ flexDirection: 'row', flex: 1, paddingHorizontal: PAD }}>
            {tabs.map((t, i) => {
              const on = i === hot;
              const color = on ? '#ffffff' : 'rgba(255,255,255,0.72)';
              return (
                <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} onPress={() => open(i)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  {t.icon(color, on)}
                  <Text style={{ color, fontSize: on ? 11 : 10, fontWeight: on ? '700' : '500' }} numberOfLines={1}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
