/**
 * The clock, modeled 1:1 on the Studento website with Liquid Glass:
 *   corner buttons (planner, settings, today/stats, themes), the class, the big
 *   countdown on the theme's board, and the small flap clock with seconds.
 * Three layouts (Settings): classic (the website), minimal (Lock Screen), cards.
 * During school the big number is always the countdown to the bell.
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { Board, InkBoard, SmallClock } from '@/components/boards';
import { MsReadout } from '@/components/millis';
import { Editable } from '@/components/editable';
import { LiveEffect } from '@/components/effects';
import { LockButton } from '@/components/lockmode';
import { Blink, burnInOffset, FlashOverlay, NightDim, useThemeShuffle, useWarning } from '@/components/clock-extras';
import { Glass, Icon } from '@/components/glass';
import { Timeline } from '@/components/timeline';
import { Button, GearIcon, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { fontStyle } from '@/lib/typefaces';
import { useNow, useTheme } from '@/lib/hooks';
import { getPermission, type Permission, requestPermission, rescheduleAlerts } from '@/lib/notify';
import { addDays, fmtDate, fmtTime, nyParts, toMin } from '@/lib/nytime';
import { usePlanner } from '@/lib/planner';
import { tickFocus } from '@/lib/tools';
import { syncLiveActivity } from '@/widgets';
import { fmtCountdown, nameFor, nowState, type NowState, periodTitle, rangeText, roomOf } from '@/lib/schedule';
import { type Prefs, setPref, useSchedule, useStore } from '@/lib/store';
import { alpha, readableOn, type Theme } from '@/lib/themes';

const CHROME_MS = 15000;

export default function ClockScreen() {
  const now = useNow();
  const baseTheme = useTheme();
  const rawPrefs = useStore((s) => s.prefs);
  const prefs = focusPrefs(rawPrefs);
  const homework = usePlanner((p) => p.homework);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const theme = baseTheme;

  const sched = useSchedule();
  const st = nowState(now, sched.data);
  const parts = nyParts(now);
  const copy = tweakCopy(describe(st, sched.names, sched.details, prefs.h24), st, prefs);
  const inSchool = copy.countdownSec != null;

  const flash = useWarning(st, copy.countdownSec, rawPrefs, sched.names);
  useThemeShuffle(st, rawPrefs);
  const blink = rawPrefs.blinkLast && copy.countdownSec != null && st.phase === 'class' && copy.countdownSec <= 60;
  const nudge = burnInOffset(parts.minute, rawPrefs.burnin);

  const tomorrow = addDays(st.date, 1);
  const dueSoon = homework.filter((h) => !h.done && h.due && h.due <= tomorrow).length;

  useEffect(() => {
    if (!prefs.keepAwake) return;
    void activateKeepAwakeAsync('clock').catch(() => {});
    return () => {
      void deactivateKeepAwake('clock').catch(() => {});
    };
  }, [prefs.keepAwake]);

  // Keep a running focus timer rolling (focus -> break) even while the clock is showing.
  useEffect(() => {
    const t = Date.now();
    tickFocus(t, nyParts(t).date);
  }, [now]);

  // At each bell while the app is open, move the Live Activity to the new period.
  const bellKey = `${st.date}|${st.phase}|${st.currentIndex}|${st.next?.start ?? ''}`;
  useEffect(() => {
    void syncLiveActivity();
  }, [bellKey]);

  // Bell alerts only work with iOS permission. Keep offering (and explain when iOS has blocked it)
  // until they are on; "Not now" only hides the card for this session.
  const [alertPerm, setAlertPerm] = useState<Permission | null>(null);
  const [snoozed, setSnoozed] = useState(false);
  useEffect(() => {
    const check = () => void getPermission().then(setAlertPerm);
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);
  const askAlerts = prefs.onboarded && prefs.alerts && alertPerm !== null && alertPerm !== 'granted' && !snoozed;

  // Customize mode opens only from Settings > Customize clock screen.
  const params = useLocalSearchParams<{ edit?: string }>();
  const [editing, setEditing] = useState(false);
  const [lastEditParam, setLastEditParam] = useState<string | undefined>(undefined);
  if (params.edit !== lastEditParam) {
    setLastEditParam(params.edit);
    if (params.edit && !rawPrefs.locked) setEditing(true);
  }

  // Corner buttons fade out after 15 s without a touch; any touch brings them back.
  const chrome = useSharedValue(1);
  const [chromeOn, setChromeOn] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!chromeOn) setChromeOn(true);
    chrome.value = withTiming(1, { duration: 200 });
    hideTimer.current = setTimeout(() => {
      chrome.value = withTiming(0, { duration: 700 });
      setChromeOn(false);
    }, CHROME_MS);
  };
  useEffect(() => {
    hideTimer.current = setTimeout(() => {
      chrome.value = withTiming(0, { duration: 700 });
      setChromeOn(false);
    }, CHROME_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [chrome]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  // Idle dim follows the same timer as the corner buttons: full while touched, 70% once they fade.
  const dimStyle = useAnimatedStyle(() => ({ opacity: 0.7 + chrome.value * 0.3 }));
  const locked = rawPrefs.locked;
  const showChrome = !locked && (chromeOn || editing || rawPrefs.corners);

  const v: V = {
    st,
    copy,
    theme,
    prefs,
    width,
    height,
    landscape: width > height && width > 600,
    clock: clockParts(parts.hour, parts.minute, parts.second, prefs.h24, prefs.seconds),
    bigText: inSchool ? countdownText(copy.countdownSec!, prefs.seconds) : clockParts(parts.hour, parts.minute, parts.second, prefs.h24, false).text,
    inSchool,
    editing,
    names: sched.names,
    blink,
  };

  const glassy = prefs.layout !== 'minimal';

  // First launch: ask whose schedule to run (default, scan, or type it).
  if (!prefs.onboarded) return <Redirect href="/setup" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }} onTouchStart={wake}>
      <LiveEffect theme={theme} motion={prefs.motion} />
      <NightDim hour={parts.hour} on={rawPrefs.night} />
      <FlashOverlay flash={flash} />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 70,
          paddingLeft: insets.left + 18,
          paddingRight: insets.right + 18,
        }}
      >
        <Animated.View style={[{ flex: 1, maxWidth: 900, width: '100%', alignSelf: 'center', transform: [{ translateX: nudge.x }, { translateY: nudge.y }] }, rawPrefs.idleDim ? dimStyle : null]}>
          {prefs.layout === 'minimal' ? <Minimal v={v} /> : prefs.layout === 'glass' ? <Cards v={v} /> : <Classic v={v} />}
        </Animated.View>
        {askAlerts && !locked ? (
          <View
            style={{
              maxWidth: 640,
              width: '100%',
              alignSelf: 'center',
              marginTop: 12,
            }}
          >
            <AlertsCard
              theme={theme}
              blocked={alertPerm === 'denied'}
              onDone={async (turnOn) => {
                if (!turnOn) return setSnoozed(true);
                if (alertPerm === 'denied') return void Linking.openSettings();
                const p = await requestPermission();
                setAlertPerm(p);
                setPref('alertsAsked', true);
                if (p === 'granted') void rescheduleAlerts();
              }}
            />
          </View>
        ) : null}
      </View>

      {editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done customizing"
          onPress={() => {
            tap();
            setEditing(false);
          }}
          style={[
            styles.testPill,
            {
              top: insets.top + 12,
              backgroundColor: theme.accent,
              borderColor: theme.accent,
              paddingHorizontal: 22,
              paddingVertical: 9,
            },
          ]}
        >
          <Text
            style={[
              styles.testText,
              {
                color: readableOn(theme.accent),
                fontSize: 14,
                letterSpacing: 0.3,
              },
            ]}
          >
            Done
          </Text>
        </Pressable>
      ) : null}

      {locked ? <LockButton theme={theme} /> : null}

      {/* The website's four corner buttons, plus the test pill; they fade when idle. Not rendered at all while locked. */}
      {locked ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, rawPrefs.corners ? { opacity: 1 } : chromeStyle]} pointerEvents={showChrome ? 'box-none' : 'none'}>
          {prefs.testPeriod3 && !editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Test mode is on. Tap to turn it off."
              onPress={() => {
                tap();
                setPref('testPeriod3', false);
              }}
              style={[
                styles.testPill,
                {
                  top: insets.top + 16,
                  backgroundColor: alpha(theme.accent, 0.16),
                  borderColor: alpha(theme.accent, 0.45),
                },
              ]}
            >
              <Text style={[styles.testText, { color: theme.accent }]}>TEST · PERIOD 3 · TAP TO END</Text>
            </Pressable>
          ) : null}
          <Corner theme={theme} glass={glassy} label="Planner" badge={dueSoon} style={{ top: insets.top + 8, left: insets.left + 14 }} onPress={() => router.push('/planner')}>
            <Icon name="checklist" color={theme.ink} size={18} fallback={<PlannerGlyph color={theme.ink} />} />
          </Corner>
          <Corner theme={theme} glass={glassy} label="Settings" style={{ top: insets.top + 8, right: insets.right + 14 }} onPress={() => router.push('/settings')}>
            <Icon name="gearshape" color={theme.ink} size={18} fallback={<GearIcon color={theme.ink} />} />
          </Corner>
          <Corner theme={theme} glass={glassy} label="Hub: today and tools" style={{ bottom: insets.bottom + 12, left: insets.left + 14 }} onPress={() => router.push('/hub')}>
            <Icon name="square.grid.2x2" color={theme.ink} size={17} fallback={<GridGlyph color={theme.ink} />} />
          </Corner>
          <Corner theme={theme} glass={glassy} label="Themes" style={{ bottom: insets.bottom + 12, right: insets.right + 14 }} onPress={() => router.push('/themes')}>
            <Icon name="paintpalette" color={theme.ink} size={17} fallback={<GridGlyph color={theme.ink} />} />
          </Corner>
        </Animated.View>
      )}
    </View>
  );
}

interface V {
  st: NowState;
  copy: Copy;
  theme: Theme;
  prefs: Prefs;
  width: number;
  height: number;
  landscape: boolean;
  clock: { text: string; suffix: string };
  bigText: string;
  inSchool: boolean;
  editing: boolean;
  names: Record<string, string>;
  blink: boolean;
}

/** A removable piece of the clock screen, bound to one `show*` pref. */
function Piece({ v, k, label, children }: { v: V; k: ShowKey; label: string; children: ReactNode }) {
  return (
    <Editable editing={v.editing} shown={v.prefs[k]} label={label} onToggle={() => setPref(k, !v.prefs[k])}>
      {children}
    </Editable>
  );
}

type ShowKey = 'showEyebrow' | 'showTimes' | 'showUnit' | 'showClock' | 'showNext' | 'showTimeline' | 'showDay';

function Classic({ v }: { v: V }) {
  const { theme, copy, st, prefs } = v;
  // Landscape (iPad, phone on its side): countdown on the left, the rest on the right.
  // Everything is one centered column of equal width (also in landscape).
  const heroW = v.landscape ? Math.min(v.width - 36, 600) : Math.min(v.width - 36, 820);
  // Leave room for the widgets so nothing overlaps on smaller phones.
  const rows = Math.ceil(Math.min(prefs.widgets.length, 4) / 2);
  const maxDigit = v.landscape ? v.height * 0.18 : v.width >= 700 ? Math.min(v.height * (0.27 - rows * 0.02), 340) : Math.min(v.height * (0.17 - rows * 0.025), 210);
  const heroBlock = (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {copy.eyebrow || v.editing ? (
        <Piece v={v} k="showEyebrow" label="period label">
          <Text style={[styles.eyebrow, label(theme), { color: theme.muted }]} numberOfLines={1}>
            {copy.eyebrow || 'PERIOD LABEL'}
          </Text>
        </Piece>
      ) : null}
      <Title v={v} size={Math.min(v.landscape ? v.height * 0.075 : v.width * 0.115, 60)} />
      {copy.times ? (
        <Piece v={v} k="showTimes" label="period times">
          <Text style={[styles.times, fontStyle(theme.type.label, '500'), { color: theme.muted }]}>{copy.times}</Text>
        </Piece>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <Hero v={v} width={heroW} maxDigit={maxDigit} glass />
      </View>
      {theme.engine !== 'ring' || !v.inSchool ? (
        <Piece v={v} k="showUnit" label="countdown label">
          <Text style={[styles.unit, fontStyle(theme.type.label, '500'), { color: theme.muted }]}>{copy.unit}</Text>
          {v.inSchool ? <MsReadout theme={theme} kind="countdown" size={20} /> : null}
        </Piece>
      ) : null}
    </View>
  );
  // Landscape: widgets, clock and next/timeline sit side by side in ONE row under the countdown.
  const infoBlock = (
    <View style={v.landscape ? { gap: 10, alignItems: 'center', width: '100%', maxWidth: 470, alignSelf: 'center' } : { gap: 12, alignItems: 'center' }}>
      {v.inSchool ? (
        <Piece v={v} k="showClock" label="clock">
          <SmallClock text={v.clock.text} suffix={v.clock.suffix} theme={theme} motion={prefs.motion} glass />
          <MsReadout theme={theme} kind="clock" size={15} />
        </Piece>
      ) : null}
      <View style={{ width: '100%', gap: 10, alignItems: 'center' }}>
        {copy.next ? (
          <Piece v={v} k="showNext" label="next class">
            <View style={[styles.nextRow, { justifyContent: 'center' }]}>
              <Text
                style={[
                  styles.nextPill,
                  {
                    color: readableOn(theme.accent),
                    backgroundColor: theme.accent,
                  },
                ]}
              >
                {copy.next.label}
              </Text>
              <Text style={[styles.nextName, fontStyle(theme.type.title, '600'), { color: theme.ink }]} numberOfLines={1}>
                {copy.next.name}
              </Text>
              {copy.next.time ? (
                <Text style={[styles.nextTime, { color: theme.muted }]} numberOfLines={1}>
                  {copy.next.time}
                </Text>
              ) : null}
            </View>
          </Piece>
        ) : null}
        {st.day.periods.length ? (
          <Piece v={v} k="showTimeline" label="day timeline">
            <Timeline periods={st.day.periods} secOfDay={st.secOfDay} theme={theme} />
          </Piece>
        ) : null}
        <Piece v={v} k="showDay" label="date">
          <Text style={[styles.dayLabel, fontStyle(theme.type.label, '500'), { color: theme.muted, textAlign: 'center' }]} numberOfLines={1}>
            {dayCaption(st, prefs)}
          </Text>
        </Piece>
      </View>
    </View>
  );
  if (v.landscape) {
    return (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {heroBlock}
        {infoBlock}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      {heroBlock}
      {infoBlock}
    </View>
  );
}

function Minimal({ v }: { v: V }) {
  const { theme, copy, prefs } = v;
  return (
    <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: 4, alignSelf: 'stretch' }}>
        <Title v={v} size={Math.min(v.width * 0.08, 36)} weight="semibold" />
        {copy.times ? (
          <Piece v={v} k="showTimes" label="period times">
            <Text style={[styles.times, fontStyle(theme.type.label, '500'), { color: theme.muted }]}>{copy.times}</Text>
          </Piece>
        ) : null}
      </View>
      <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
        <InkBoard text={v.bigText} theme={theme} width={Math.min(v.width - 36, 900)} maxSize={v.landscape ? v.height * 0.34 : Math.min(v.height * 0.2, 220)} motion={prefs.motion} />
        <Piece v={v} k="showUnit" label="countdown label">
          <Text style={[styles.unit, fontStyle(theme.type.label, '500'), { color: theme.muted }]}>{copy.unit}</Text>
        </Piece>
      </View>
      <View style={{ alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
        {v.inSchool ? (
          <Piece v={v} k="showClock" label="clock">
            <Text style={[styles.minimalFoot, { color: theme.ink }]}>{`${v.clock.text} ${v.clock.suffix}`.trim()}</Text>
          </Piece>
        ) : null}
        {copy.next ? (
          <Piece v={v} k="showNext" label="next class">
            <Text style={[styles.minimalFoot, { color: theme.muted }]} numberOfLines={1}>
              Next: {copy.next.name}
            </Text>
          </Piece>
        ) : null}
      </View>
    </View>
  );
}

function Cards({ v }: { v: V }) {
  const { theme, copy, st } = v;
  const colW = Math.min(v.width - 36, 640);
  const maxDigit = v.landscape ? v.height * 0.26 : Math.min(v.height * 0.15, 180);
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'space-between',
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Piece v={v} k="showEyebrow" label="period label">
            <Text style={[styles.eyebrow, label(theme), { color: theme.muted }]}>{copy.eyebrow}</Text>
          </Piece>
          <Title v={v} size={Math.min(v.width * 0.11, 56)} />
          {copy.times ? (
            <Piece v={v} k="showTimes" label="period times">
              <Text style={[styles.times, fontStyle(theme.type.label, '500'), { color: theme.muted }]}>{copy.times}</Text>
            </Piece>
          ) : null}
        </View>
        <Glass
          theme={theme}
          radius={32}
          style={{
            paddingVertical: 20,
            paddingHorizontal: 16,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Hero v={v} width={colW - 32} maxDigit={maxDigit} />
          {theme.engine !== 'ring' || !v.inSchool ? (
            <Piece v={v} k="showUnit" label="countdown label">
              <Text style={[styles.unit, fontStyle(theme.type.label, '500'), { color: theme.muted, marginTop: 0 }]}>{copy.unit}</Text>
            </Piece>
          ) : null}
        </Glass>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {v.inSchool ? (
            <View style={{ flex: 1 }}>
              <Piece v={v} k="showClock" label="clock">
                <Glass theme={theme} radius={20} style={[styles.tile, { alignSelf: 'stretch' }]}>
                  <Text style={[styles.tileLabel, { color: theme.muted }]}>NOW</Text>
                  <Text style={[styles.tileValue, { color: theme.ink }]} numberOfLines={1}>
                    {v.clock.text} {v.clock.suffix}
                  </Text>
                </Glass>
              </Piece>
            </View>
          ) : null}
          {copy.next ? (
            <View style={{ flex: 1 }}>
              <Piece v={v} k="showNext" label="next class">
                <Glass theme={theme} radius={20} style={[styles.tile, { alignSelf: 'stretch' }]}>
                  <Text style={[styles.tileLabel, { color: theme.muted }]}>{copy.next.label}</Text>
                  <Text style={[styles.tileValue, { color: theme.ink }]} numberOfLines={1}>
                    {copy.next.name}
                  </Text>
                </Glass>
              </Piece>
            </View>
          ) : null}
        </View>
        {st.day.periods.length ? (
          <Piece v={v} k="showTimeline" label="day timeline">
            <Glass
              theme={theme}
              radius={20}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 13,
                gap: 9,
                alignSelf: 'stretch',
              }}
            >
              <Text style={[styles.tileLabel, { color: theme.muted }]} numberOfLines={1}>
                {dayCaption(st, v.prefs).toUpperCase()}
              </Text>
              <Timeline periods={st.day.periods} secOfDay={st.secOfDay} theme={theme} />
            </Glass>
          </Piece>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------ shared pieces ------------------------------ */

function Hero({ v, width, maxDigit, glass }: { v: V; width: number; maxDigit: number; glass?: boolean }) {
  const { theme, copy, prefs } = v;
  const flip = () => {
    if (!prefs.tapToggle || !v.inSchool) return;
    tap();
    setPref('seconds', !prefs.seconds);
  };
  if ((theme.engine === 'ring' || theme.engine === 'dial') && !v.inSchool) return <InkBoard text={v.bigText} theme={theme} width={width} maxSize={maxDigit} motion={prefs.motion} />;
  const maxSize = maxDigit * (prefs.digitSize === 'small' ? 0.8 : prefs.digitSize === 'large' ? 1.2 : 1);
  return (
    <Pressable onPress={flip} accessibilityRole={prefs.tapToggle ? 'button' : undefined} accessibilityHint={prefs.tapToggle ? 'Switches between seconds and whole minutes' : undefined}>
      <Blink on={v.blink}>
        <Board
          text={v.bigText}
          theme={theme}
          width={width}
          maxSize={maxSize}
          remaining={copy.remaining}
          caption={copy.ringCaption}
          secondsLeft={copy.countdownSec ?? 0}
          motion={prefs.motion}
          glass={glass}
        />
      </Blink>
    </Pressable>
  );
}

/** Small-caps style labels in the theme's label font and tracking. */
function label(theme: Theme) {
  return {
    ...fontStyle(theme.type.label, '600'),
    letterSpacing: theme.type.labelTracking ?? 2,
  };
}

function Title({ v, size, weight = 'heavy' }: { v: V; size: number; weight?: 'heavy' | 'semibold' }) {
  const t = v.theme.type;
  const custom = t.title !== 'system';
  const fs = size * (t.titleScale ?? 1);
  return (
    <Pressable disabled={v.prefs.locked} onPress={() => router.push('/classes')} accessibilityRole="button" accessibilityHint="Edit your class names">
      <Animated.View key={v.copy.title} entering={v.prefs.motion ? FadeIn.duration(220) : undefined} exiting={v.prefs.motion ? FadeOut.duration(160) : undefined}>
        <Text
          style={{
            ...(custom ? fontStyle(t.title) : TYPE[weight]),
            fontSize: fs,
            lineHeight: fs * 1.15,
            letterSpacing: custom ? 0 : -size * 0.025,
            color: v.theme.ink,
            textAlign: 'center',
          }}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {t.titleCaps ? v.copy.title.toUpperCase() : v.copy.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function Corner({
  theme,
  glass,
  label,
  style,
  onPress,
  children,
  badge = 0,
}: {
  theme: Theme;
  glass: boolean;
  label: string;
  style: object;
  onPress: () => void;
  children: ReactNode;
  badge?: number;
}) {
  const inner = glass ? (
    <Glass theme={theme} radius={22} style={styles.corner}>
      {children}
    </Glass>
  ) : (
    <View
      style={[
        styles.corner,
        {
          borderRadius: 22,
          borderWidth: 1,
          borderColor: alpha(theme.ink, 0.18),
        },
      ]}
    >
      {children}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} due soon` : label}
      hitSlop={10}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          position: 'absolute',
          opacity: pressed ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
    >
      {inner}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text
            style={{
              ...TYPE.bold,
              fontSize: 11,
              color: readableOn(theme.accent),
            }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function AlertsCard({ theme, blocked, onDone }: { theme: Theme; blocked: boolean; onDone: (turnOn: boolean) => void }) {
  return (
    <Glass theme={theme} radius={22} style={{ padding: 16, gap: 12 }}>
      <View>
        <Text style={{ ...TYPE.semibold, fontSize: 17, color: theme.ink }}>{blocked ? 'Bell alerts are blocked' : 'Turn on bell alerts'}</Text>
        <Text
          style={{
            ...TYPE.regular,
            fontSize: 14,
            lineHeight: 19,
            color: theme.muted,
          }}
        >
          {blocked
            ? "iPhone has notifications off for Studento, so the 5-minute alert can't reach you. Turn them on in Settings."
            : 'A calm alert 3 min into class and 5 min before the bell. Nothing else.'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={blocked ? 'Open Settings' : 'Turn On'} onPress={() => onDone(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Not Now" kind="plain" onPress={() => onDone(false)} />
        </View>
      </View>
    </Glass>
  );
}

function PlannerGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
      <Path d="M8 4.5h8a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
      <Path d="M9.5 9h5M9.5 12.5h5M9.5 16h3.2" />
    </Svg>
  );
}

function GridGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
      <Rect x={4} y={4} width={7} height={7} rx={1.5} />
      <Rect x={13} y={4} width={7} height={7} rx={1.5} />
      <Rect x={4} y={13} width={7} height={7} rx={1.5} />
      <Rect x={13} y={13} width={7} height={7} rx={1.5} />
    </Svg>
  );
}

/* ------------------------------ text ------------------------------ */

interface Copy {
  eyebrow: string;
  title: string;
  times: string | null;
  unit: string;
  countdownSec: number | null;
  remaining: number;
  ringCaption?: string;
  next: { label: string; name: string; time: string } | null;
}

function describe(st: NowState, names: Record<string, string>, details: Record<string, { room?: string; note?: string }>, h24: boolean): Copy {
  if (st.phase === 'class' && st.current) {
    const p = st.current;
    const d = { ...details[p.period], room: roomOf(p, details) };
    const after = st.day.periods[st.currentIndex + 1];
    const named = nameFor(p, names) !== periodTitle(p);
    const len = (toMin(p.end) - toMin(p.start)) * 60;
    return {
      eyebrow: [named ? periodTitle(p) : null, d?.room ? `Room ${d.room}` : null].filter(Boolean).join(' · ').toUpperCase(),
      title: nameFor(p, names),
      times: rangeText(p, h24) + (d?.note ? `  ·  ${d.note}` : ''),
      unit: 'left',
      countdownSec: st.secondsLeft,
      remaining: st.secondsLeft / len,
      ringCaption: `bell ${fmtTime(p.end, h24)}`,
      next: after
        ? {
            label: 'NEXT',
            name: nameFor(after, names),
            time: fmtTime(after.start, h24),
          }
        : { label: 'NEXT', name: 'Done for today', time: '' },
    };
  }
  if ((st.phase === 'passing' || st.phase === 'before') && st.next) {
    const p = st.next;
    const d = { ...details[p.period], room: roomOf(p, details) };
    const prev = st.phase === 'passing' ? [...st.day.periods].reverse().find((x) => toMin(x.end) * 60 <= st.secOfDay) : null;
    const gap = prev ? toMin(p.start) * 60 - toMin(prev.end) * 60 : 0;
    const after = st.day.periods[st.day.periods.indexOf(p) + 1];
    return {
      eyebrow: (st.phase === 'passing' ? `Passing · ${periodTitle(p)} next` : `School starts soon · ${periodTitle(p)}`).toUpperCase(),
      title: nameFor(p, names),
      times: rangeText(p, h24) + (d?.room ? `  ·  Room ${d.room}` : ''),
      unit: st.phase === 'passing' ? `until ${periodTitle(p)}` : 'until the first bell',
      countdownSec: st.secondsLeft,
      remaining: gap ? st.secondsLeft / gap : 1,
      ringCaption: `starts ${fmtTime(p.start, h24)}`,
      next: after
        ? {
            label: 'AFTER',
            name: nameFor(after, names),
            time: fmtTime(after.start, h24),
          }
        : null,
    };
  }
  const nd = st.nextSchoolDay;
  const weekendNow = st.day.weekday === 'Sat' || st.day.weekday === 'Sun' || (st.day.weekday === 'Fri' && st.phase === 'after');
  return {
    eyebrow: st.phase === 'after' ? 'DONE FOR TODAY' : 'ENJOY THE DAY',
    title: weekendNow ? 'Have a good weekend' : st.phase === 'after' ? 'See you tomorrow' : 'No school today',
    times: null,
    unit: nd ? `Next: ${fmtDate(nd.date).replace(/,.*$/, '')} · first bell ${fmtTime(nd.periods[0].start, h24)}` : fmtDate(st.date),
    countdownSec: null,
    remaining: 1,
    next: null,
  };
}

function dayCaption(st: NowState, prefs: Prefs): string {
  const kind = st.day.isSchoolDay ? (/schedule|day$/i.test(st.day.kind) ? st.day.kind : `${st.day.kind} schedule`) : 'No school';
  const list = st.day.periods;
  let stats = '';
  if (list.length) {
    const t0 = toMin(list[0].start) * 60;
    const t1 = toMin(list[list.length - 1].end) * 60;
    if (st.secOfDay < t0) stats = `Starts ${fmtTime(list[0].start, prefs.h24)} · ${list.length} periods today`;
    else if (st.secOfDay >= t1) stats = 'Done for today';
    else stats = `Out at ${fmtTime(list[list.length - 1].end, prefs.h24)} · ${longDuration(t1 - st.secOfDay)} to go`;
  }
  const date = prefs.showDate ? `${fmtDate(st.date).replace(/,.*$/, '')} · ` : '';
  return `${date}${kind}${stats ? ` · ${stats}` : ''}`;
}

function longDuration(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Focus mode (like the real Studento): just the class and the countdown. */
function focusPrefs(p: Prefs): Prefs {
  if (!p.focus) return p;
  return { ...p, showEyebrow: false, showTimes: false, showClock: false, showNext: false, showTimeline: false, showDay: false, millis: 'off' };
}

/** "Now · Period 3" and "left · ends 1:52 PM", when asked for. */
function tweakCopy(c: Copy, st: NowState, p: Prefs): Copy {
  if (st.phase !== 'class' || !st.current) return c;
  let out = c;
  if (p.periodNum) {
    const room = c.eyebrow.includes('ROOM') ? ` · ${c.eyebrow.slice(c.eyebrow.indexOf('ROOM'))}` : '';
    out = { ...out, eyebrow: `NOW · ${periodTitle(st.current).toUpperCase()}${room}` };
  }
  if (p.endTime) out = { ...out, unit: `left · ends ${fmtTime(st.current.end, p.h24)}` };
  return out;
}

function countdownText(sec: number, seconds: boolean): string {
  if (seconds) return fmtCountdown(sec, true);
  const mins = Math.ceil(sec / 60);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

/** Like the website: zero-padded "09:47:31" with the AM/PM beside it. */
function clockParts(h: number, m: number, s: number, h24: boolean, withSec: boolean): { text: string; suffix: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  const hh = h24 ? h : h % 12 === 0 ? 12 : h % 12;
  return {
    text: `${p(hh)}:${p(m)}${withSec ? `:${p(s)}` : ''}`,
    suffix: h24 ? '' : h < 12 ? 'AM' : 'PM',
  };
}

const styles = StyleSheet.create({
  eyebrow: {
    ...TYPE.semibold,
    fontSize: 14,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  times: {
    ...TYPE.medium,
    fontSize: 16,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  unit: { ...TYPE.medium, fontSize: 16, marginTop: 12, textAlign: 'center' },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  nextPill: {
    ...TYPE.heavy,
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    flexShrink: 0,
  },
  nextName: { ...TYPE.semibold, fontSize: 16, flexShrink: 1 },
  nextTime: {
    ...TYPE.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  dayLabel: { ...TYPE.medium, fontSize: 14, textAlign: 'center' },
  minimalFoot: { ...TYPE.medium, fontSize: 15, fontVariant: ['tabular-nums'] },
  tile: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  tileLabel: { ...TYPE.semibold, fontSize: 11.5, letterSpacing: 0.8 },
  tileValue: {
    ...TYPE.semibold,
    fontSize: 19,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  corner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  testPill: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  testText: { ...TYPE.bold, fontSize: 11, letterSpacing: 1 },
});
