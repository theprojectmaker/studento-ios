/**
 * "Liquid Glass" theme: real Apple glass (iOS 26) floating over a crisp dark wallpaper with a faint
 * grid that the glass visibly bends. Big glass bubbles drift and wobble like water and
 * melt together; slide a finger and a glass lens plus a pouring glass trail follow it, merging
 * with the bubbles and the clock's own glass (timer card, buttons) in one glass container.
 * Older iOS gets frosted bubbles instead. Runs on the UI thread; never blocks the clock's buttons.
 */
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useFrameCallback, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import { hasLiquidGlass } from '@/components/glass';
import type { Theme } from '@/lib/themes';

const DROPS = 12;

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

/* ---------- real Liquid Glass (iOS 26): shapes in one container melt into each other ---------- */
const AnimatedGlass = Animated.createAnimatedComponent(GlassView);

/**
 * Apple's glass is a live visual-effect view: fading it (opacity) or stretching it with scale /
 * rotate transforms makes iOS fall back to a flat, washed-out look. So every glass shape here
 * morphs the way Apple's do: by changing its real frame (left/top/width/height/radius) only.
 * Shapes appear by growing from nothing and leave by shrinking away, never by fading.
 */
function GlassDrop({ i, xs, ys, show }: { i: number; xs: SharedValue<number[]>; ys: SharedValue<number[]>; show: SharedValue<number> }) {
  const base = 92 - i * 6;
  const style = useAnimatedStyle(() => {
    const x = xs.value[i] ?? -300;
    const y = ys.value[i] ?? -300;
    const px = i === 0 ? x : (xs.value[i - 1] ?? x);
    const py = i === 0 ? y : (ys.value[i - 1] ?? y);
    // Water-like stretch toward the drop ahead, done with the real width/height.
    const sx = 1 + Math.min(Math.abs(px - x) / 50, 0.8);
    const sy = 1 + Math.min(Math.abs(py - y) / 50, 0.8);
    const k = show.value;
    const wd = base * k * sx;
    const ht = base * k * sy;
    return { left: x - wd / 2, top: y - ht / 2, width: wd, height: ht, borderRadius: Math.min(wd, ht) / 2 };
  });
  return <AnimatedGlass pointerEvents="none" glassEffectStyle="clear" style={[{ position: 'absolute' }, style]} />;
}

/** A free-floating glass orb that wobbles like a drop of water and drifts on a figure-8. */
function GlassOrb({ i, w, h, motion }: { i: number; w: number; h: number; motion: boolean }) {
  const size = [160, 120, 96, 136][i];
  const t = useSharedValue(0);
  const wob = useSharedValue(0);
  useEffect(() => {
    if (!motion) return;
    t.set(withRepeat(withTiming(1, { duration: 9000 + i * 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    wob.set(withRepeat(withTiming(1, { duration: 1700 + i * 380, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [motion, i, t, wob]);
  const style = useAnimatedStyle(() => {
    const a = t.value * Math.PI * 2;
    const cx = w * (0.5 + Math.sin(a + i * 1.3) * 0.36);
    const cy = h * (0.52 + Math.sin(a * 2 + i * 0.9) * 0.3);
    const squish = Math.sin(wob.value * Math.PI * 2) * 0.12;
    const wd = size * (1 + squish);
    const ht = size * (1 - squish);
    return { left: cx - wd / 2, top: cy - ht / 2, width: wd, height: ht, borderRadius: Math.min(wd, ht) / 2 };
  });
  return <AnimatedGlass pointerEvents="none" glassEffectStyle="clear" style={[{ position: 'absolute' }, style]} />;
}

function GlassLayer({ w, h, fx, fy, xs, ys, show, motion }: { w: number; h: number; fx: SharedValue<number>; fy: SharedValue<number>; xs: SharedValue<number[]>; ys: SharedValue<number[]>; show: SharedValue<number>; motion: boolean }) {
  // The lens under the finger: grows in, stretches toward where the finger is heading.
  const lens = useAnimatedStyle(() => {
    const dx = Math.abs(fx.value - (xs.value[0] ?? fx.value));
    const dy = Math.abs(fy.value - (ys.value[0] ?? fy.value));
    const k = show.value;
    const wd = 180 * k * (1 + Math.min(dx / 90, 0.5));
    const ht = 180 * k * (1 + Math.min(dy / 90, 0.5));
    return { left: fx.value - wd / 2, top: fy.value - ht / 2, width: wd, height: ht, borderRadius: Math.min(wd, ht) / 2 };
  });
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <GlassOrb key={`o${i}`} i={i} w={w} h={h} motion={motion} />
      ))}
      <AnimatedGlass pointerEvents="none" glassEffectStyle="clear" style={[{ position: 'absolute' }, lens]} />
      {Array.from({ length: DROPS }, (_, i) => (
        <GlassDrop key={`d${i}`} i={i} xs={xs} ys={ys} show={show} />
      ))}
    </>
  );
}

/**
 * The wallpaper the glass floats on. Real glass only reads as glass when it bends sharp detail
 * behind it, so this is a clean gradient with crisp rings, fine lines and a dot grid (no soft
 * blobs). It slides a little with your finger, so the glass appears to warp it as you drag.
 */
function Backdrop({ theme, w, h, fx, fy, touch }: { theme: Theme; w: number; h: number; fx: SharedValue<number>; fy: SharedValue<number>; touch: SharedValue<number> }) {
  // Near-black with a faint grid (like Apple's glass demo, but dark): the glass bends the grid
  // lines, which is what makes it read as glass. A soft glow of the theme colour sits low down.
  const shift = useAnimatedStyle(() => ({
    transform: [{ translateX: (fx.value - w / 2) * -0.04 * touch.value }, { translateY: (fy.value - h / 2) * -0.04 * touch.value }, { scale: 1.06 }],
  }));
  const step = 64;
  const vs = Array.from({ length: Math.ceil(w / step) + 2 }, (_, i) => i * step);
  const hs = Array.from({ length: Math.ceil(h / step) + 2 }, (_, i) => i * step);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, shift]}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#050506" />
            <Stop offset="0.7" stopColor="#0b0c10" />
            <Stop offset="1" stopColor={theme.accent} stopOpacity={0.22} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="#050506" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#wall)" />
        {vs.map((x) => (
          <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#ffffff" strokeOpacity={0.09} strokeWidth={1} />
        ))}
        {hs.map((y) => (
          <Line key={`h${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#ffffff" strokeOpacity={0.09} strokeWidth={1} />
        ))}
      </Svg>
    </Animated.View>
  );
}

function GlassWrap({ children }: { children: ReactNode }) {
  return (
    <GlassContainer spacing={70} style={{ flex: 1 }}>
      {children}
    </GlassContainer>
  );
}
function PlainWrap({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
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
      // Slower follow = the trail stretches into one long, smooth blob of glass.
      nx[k] += (tx - nx[k]) * 0.24;
      ny[k] += (ty - ny[k]) * 0.24;
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

  // On iOS 26 one glass container holds the trail, the orbs AND the clock's own glass (timer card,
  // buttons), so all of it melts together when it touches. Elsewhere a plain view.
  const Wrap = glass ? GlassWrap : PlainWrap;
  return (
    <GestureDetector gesture={pan}>
      <Wrap>
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: theme.bg }]} pointerEvents="none">
          <Backdrop theme={theme} w={w} h={h} fx={fx} fy={fy} touch={touch} />
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }, ringStyle]} />
          {glass ? null : Array.from({ length: DROPS }, (_, i) => <Drop key={i} i={DROPS - 1 - i} xs={xs} ys={ys} show={show} glass={false} />)}
        </View>
        {glass ? <GlassLayer w={w} h={h} fx={fx} fy={fy} xs={xs} ys={ys} show={show} motion={motion} /> : null}
        {children}
      </Wrap>
    </GestureDetector>
  );
}
