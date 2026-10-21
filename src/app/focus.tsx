/** Focus timer (Pomodoro): a focus block, then a short break. One calm alert when a block ends. */
import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { RingBoard } from '@/components/boards';
import { Button, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { cancelFocusAlert, scheduleFocusAlert } from '@/lib/notify';
import { nyParts } from '@/lib/nytime';
import { useStore } from '@/lib/store';
import { focusLeft, pauseFocus, resumeFocus, setFocusLengths, startFocus, stopFocus, tickFocus, useTools } from '@/lib/tools';
import { alpha, readableOn } from '@/lib/themes';

const FOCUS_OPTIONS = [15, 25, 45, 50];
const BREAK_OPTIONS = [5, 10, 15];

function useRealNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function FocusScreen() {
  const theme = useTheme();
  const motion = useStore((s) => s.prefs.motion);
  const f = useTools((t) => t.focus);
  const now = useRealNow();
  const { width } = useWindowDimensions();
  const today = nyParts(now).date;

  // Roll from focus into break (and count it) when a block runs out.
  useEffect(() => {
    const finished = tickFocus(now, today);
    if (finished === 'focus') {
      const next = Date.now() + f.breakMin * 60_000;
      void scheduleFocusAlert(next, 'break');
    }
  }, [now, today, f.breakMin]);

  const total = (f.mode === 'break' ? f.breakMin : f.focusMin) * 60_000;
  const left = f.mode === 'idle' ? f.focusMin * 60_000 : focusLeft(f, now);
  const secs = Math.ceil(left / 1000);
  const text = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const running = f.mode !== 'idle' && f.pausedLeft == null;
  const doneToday = f.done[today] ?? 0;

  const start = () => {
    startFocus('focus');
    void scheduleFocusAlert(Date.now() + f.focusMin * 60_000, 'focus');
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8 }}>
        <Text style={{ ...TYPE.semibold, fontSize: 13, letterSpacing: 2, color: f.mode === 'break' ? '#34c759' : theme.accent }}>
          {f.mode === 'idle' ? 'READY' : f.mode === 'focus' ? (running ? 'FOCUSING' : 'PAUSED') : running ? 'BREAK' : 'BREAK PAUSED'}
        </Text>
        <RingBoard
          text={text}
          theme={f.mode === 'break' ? { ...theme, accent: '#34c759' } : theme}
          width={Math.min(width - 64, 340)}
          maxSize={140}
          remaining={f.mode === 'idle' ? 1 : left / total}
          caption={f.mode === 'break' ? 'stretch, drink water' : `${doneToday} done today`}
          motion={motion}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {f.mode === 'idle' ? (
          <View style={{ flex: 1 }}>
            <Button title={`Start ${f.focusMin} min focus`} onPress={start} />
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Button
                title={running ? 'Pause' : 'Resume'}
                onPress={() => {
                  if (running) {
                    pauseFocus();
                    void cancelFocusAlert();
                  } else {
                    resumeFocus();
                    void scheduleFocusAlert(Date.now() + left, f.mode === 'break' ? 'break' : 'focus');
                  }
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Stop"
                kind="plain"
                onPress={() => {
                  stopFocus();
                  void cancelFocusAlert();
                }}
              />
            </View>
          </>
        )}
      </View>

      <Section title="Focus length">
        <Options values={FOCUS_OPTIONS} value={f.focusMin} disabled={f.mode !== 'idle'} onPick={(m) => setFocusLengths(m, f.breakMin)} />
      </Section>
      <Section title="Break length" footer="You get one alert when a block ends, even if the app is closed. Nothing else.">
        <Options values={BREAK_OPTIONS} value={f.breakMin} disabled={f.mode !== 'idle'} onPick={(m) => setFocusLengths(f.focusMin, m)} />
      </Section>
    </Screen>
  );
}

function Options({ values, value, disabled, onPick }: { values: number[]; value: number; disabled: boolean; onPick: (m: number) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, opacity: disabled ? 0.45 : 1 }}>
      {values.map((m) => {
        const on = m === value;
        return (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            disabled={disabled}
            onPress={() => {
              tap();
              onPick(m);
            }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: on ? theme.accent : alpha(theme.ink, 0.08) }}>
            <Text style={{ ...TYPE.semibold, fontSize: 15, color: on ? readableOn(theme.accent) : theme.ink }}>{m} min</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
