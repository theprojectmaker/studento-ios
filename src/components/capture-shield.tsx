/**
 * While the screen is being recorded, mirrored or shared, the whole app is covered by a plain
 * screen that shows only the time. iOS reports capture through the CaptureGuard module
 * (modules/capture-guard); on web and in Expo Go the module is missing and this does nothing.
 */
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TYPE } from '@/lib/fonts';
import { useRealNow, useTheme } from '@/lib/hooks';
import { fmtTime, nyParts } from '@/lib/nytime';
import { useStore } from '@/lib/store';

type Native = {
  isCaptured(): Promise<boolean>;
  addListener(event: 'onChange', cb: (e: { captured: boolean }) => void): { remove(): void };
};
const CaptureGuard = requireOptionalNativeModule<Native>('CaptureGuard');

function useCaptured(): boolean {
  const [captured, setCaptured] = useState(false);
  useEffect(() => {
    if (!CaptureGuard) return;
    let live = true;
    void CaptureGuard.isCaptured().then((v) => live && setCaptured(v)).catch(() => {});
    const sub = CaptureGuard.addListener('onChange', (e) => setCaptured(!!e.captured));
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return captured;
}

function TimeOnly() {
  const theme = useTheme();
  const now = useRealNow();
  const h24 = useStore((s) => s.prefs.h24);
  const p = nyParts(now);
  const hhmm = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', zIndex: 10000 }]} pointerEvents="auto">
      <Text style={{ ...TYPE.heavy, fontSize: 96, letterSpacing: -2, color: theme.ink, fontVariant: ['tabular-nums'] }}>{fmtTime(hhmm, h24).replace(/\s?[AP]M$/i, '')}</Text>
    </View>
  );
}

export function CaptureShield() {
  return useCaptured() ? <TimeOnly /> : null;
}
