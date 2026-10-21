/**
 * Sub-second readout (".381"). It owns its own timer, so only this tiny Text
 * re-renders (about 16 times a second), never the whole clock screen.
 * 'countdown' counts DOWN like the big timer; 'clock' counts up like the time of day.
 */
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { MONO } from '@/lib/fonts';
import { clockNow } from '@/lib/hooks';
import { useStore, type Millis } from '@/lib/store';
import { alpha, type Theme } from '@/lib/themes';

const DIGITS: Record<Exclude<Millis, 'off'>, number> = { tenths: 1, centis: 2, millis: 3 };

export function MsReadout({ theme, kind, size = 16 }: { theme: Theme; kind: 'clock' | 'countdown'; size?: number }) {
  const mode = useStore((s) => s.prefs.millis);
  const test = useStore((s) => s.prefs.testPeriod3);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (mode === 'off') return;
    const t = setInterval(() => setMs(clockNow(test) % 1000), 60);
    return () => clearInterval(t);
  }, [mode, test]);
  if (mode === 'off') return null;
  const n = DIGITS[mode];
  const frac = kind === 'clock' ? ms : (1000 - ms) % 1000;
  const text = '.' + String(Math.floor(frac)).padStart(3, '0').slice(0, n);
  return (
    <Text allowFontScaling={false} style={{ fontFamily: MONO, fontSize: size, color: alpha(theme.accent, 0.95), fontVariant: ['tabular-nums'], textAlign: 'center' }} accessibilityElementsHidden>
      {text}
    </Text>
  );
}
