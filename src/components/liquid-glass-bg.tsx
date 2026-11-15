/**
 * "Liquid Glass" theme background: soft colour blobs that slowly drift and morph, a glass
 * sheen over them, and a finger trail. Slide a finger anywhere and a chain of glass droplets
 * follows it (real Liquid Glass on iOS 26, frosted bubbles elsewhere), a ripple rings out where
 * you touch, and the blobs lean toward your finger and swell, so the whole wallpaper warps.
 *
 * Everything runs on the UI thread (Reanimated); the gesture never blocks the clock's buttons
 * (it only starts after the finger moves a few points).
 */
import { GlassView } from 'expo-glass-effect';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useFrameCallback, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { hasLiquidGlass } from '@/components/glass';
import type { Theme } from '@/lib/themes';

const BLOBS = [
  { c: 'accent', x: 0.15, y: 0.2, s: 1.0, dur: 17000 },
  { c: '#b48cff', x: 0.85, y: 0.25, s: 0.9, dur: 21000 },
  { c: '#ff8fd1', x: 0.3, y: 0.8, s: 1.05, dur: 19000 },
  { c: '#5ef0d0', x: 0.8, y: 0.75, s: 0.85, dur: 23000 },
  { c: '#ffd36e', x: 0.5, y: 0.5, s: 0.7, dur: 26000 },
];
const DROPS = 12;

function Blob({ i, color, w, h, fx, fy, touch, motion }: { i: number; color: string; w: number; h: number; fx: SharedValue<number>; fy: SharedValue<number>; touch: SharedValue<number>; motion: boolean }) {
  const b = BLOBS[i];
  const size = Math.max(w, h) * 0.75 * b.s;
  const t = useSharedValue(0);
  useEffect(() => {
    if (!motion) return;
    t.set(withRepeat(withTiming(1, { duration: b.dur, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [motion, b.dur, t]);
  const style = useAnimatedStyle(() => {
    const cx = b.x * w + Math.sin(t.value * Math.PI * 2 + i) * w * 0.12;
    const cy = b.y * h + Math.cos(t.value * Math.PI * 2 + i * 1.7) * h * 0.08;
    // Lean toward the finger, more for blobs that are close to it.
    const dx = fx.value - cx;
    const dy = fy.value - cy;
    const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (Math.max(w, h) * 0.8));
    const pull = touch.value * (0.22 + near * 0.25);
    const morph = 1 + Math.sin(t.value * Math.PI * 4 + i) * 0.08 + touch.value * near * 0.28;
    return {
      transform: [{ translateX: cx + dx * pull - size / 2 }, { translateY: cy + dy * pull - size / 2 }, { scaleX: morph }, { scaleY: 2 - morph }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`lg${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#lg${i})`} />
      </Svg>
    </Animated.View>
  );
}

function Drop({ i, xs, ys, show, glass }: { i: number; xs: SharedValue<number[]>; ys: SharedValue<number[]>; show: SharedValue<number>; glass: boolean }) {
  const size = 58 - i * 3.4;
  const style = useAnimatedStyle(() => ({
    opacity: show.value * (1 - i / (DROPS + 2)),
    transform: [{ translateX: (xs.value[i] ?? -200) - size / 2 }, { translateY: (ys.value[i] ?? -200) - size / 2 }, { scale: 0.6 + show.value * 0.4 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      {glass ? (
        <GlassView glassEffectStyle="clear" style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' }}>
          <View style={{ position: 'absolute', left: size * 0.22, top: size * 0.16, width: size * 0.3, height: size * 0.16, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>
      )}
    </Animated.View>
  );
}

export function LiquidGlassScene({ theme, motion, children }: { theme: Theme; motion: boolean; children: ReactNode }) {
  const { width: w, height: h } = useWindowDimensions();
  const glass = hasLiquidGlass();
  const fx = useSharedValue(w / 2);
  const fy = useSharedValue(h / 2);
  const touch = useSharedValue(0);
  const show = useSharedValue(0);
  const xs = useSharedValue<number[]>(Array(DROPS).fill(-200));
  const ys = useSharedValue<number[]>(Array(DROPS).fill(-200));
  const rx = useSharedValue(-500);
  const ry = useSharedValue(-500);
  const ring = useSharedValue(1);

  // Each droplet eases toward the one ahead of it: a smooth, liquid chain.
  useFrameCallback(() => {
    const nx = xs.value.slice();
    const ny = ys.value.slice();
    for (let k = 0; k < DROPS; k++) {
      const tx = k === 0 ? fx.value : nx[k - 1];
      const ty = k === 0 ? fy.value : ny[k - 1];
      nx[k] += (tx - nx[k]) * 0.32;
      ny[k] += (ty - ny[k]) * 0.32;
    }
    xs.set(nx);
    ys.set(ny);
  });

  const pan = Gesture.Pan()
    .minDistance(3)
    .onBegin((e) => {
      fx.set(e.x);
      fy.set(e.y);
      xs.set(Array(DROPS).fill(e.x));
      ys.set(Array(DROPS).fill(e.y));
      rx.set(e.x);
      ry.set(e.y);
      ring.set(0);
      ring.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
      touch.set(withTiming(1, { duration: 260 }));
      show.set(withTiming(1, { duration: 160 }));
    })
    .onUpdate((e) => {
      fx.set(e.x);
      fy.set(e.y);
    })
    .onFinalize(() => {
      touch.set(withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) }));
      show.set(withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 700 })));
    });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.8,
    transform: [{ translateX: rx.value - 60 }, { translateY: ry.value - 60 }, { scale: 0.3 + ring.value * 1.6 }],
  }));

  const colors = BLOBS.map((b) => (b.c === 'accent' ? theme.accent : b.c));
  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: theme.bg }]} pointerEvents="none">
          {colors.map((c, i) => (
            <Blob key={i} i={i} color={c} w={w} h={h} fx={fx} fy={fy} touch={touch} motion={motion} />
          ))}
          {/* Glass sheen: a light diagonal wash over the colour, like light on a pane. */}
          <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
            <Defs>
              <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0.16} />
                <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0.02} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0.1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={w} height={h} fill="url(#sheen)" />
          </Svg>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }, ringStyle]} />
          {Array.from({ length: DROPS }, (_, i) => (
            <Drop key={i} i={DROPS - 1 - i} xs={xs} ys={ys} show={show} glass={glass} />
          ))}
        </View>
        {children}
      </View>
    </GestureDetector>
  );
}
