/** Every Studento theme, in the website's groups, each previewed with its own board. */
import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Board } from '@/components/boards';
import { Icon } from '@/components/glass';
import { Screen, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { fontStyle } from '@/lib/typefaces';
import { useTheme } from '@/lib/hooks';
import { setPref } from '@/lib/store';
import { alpha, GROUPS, THEMES, type Effect, type Theme } from '@/lib/themes';
import { sz } from '@/lib/scale';

const EFFECT_LABEL: Record<Effect, string> = {
  none: '',
  stars: 'Twinkling stars',
  snow: 'Falling snow',
  petals: 'Falling petals',
  embers: 'Rising embers',
  fireflies: 'Fireflies',
  bubbles: 'Bubbles',
  rain: 'Rain',
  scanlines: 'CRT scanlines',
  dust: 'Floating dust',
  glints: 'Gold glints',
  bokeh: 'Soft lights',
};

export default function Themes() {
  const current = useTheme();
  const { width } = useWindowDimensions();
  const cols = width > 700 ? 3 : 2;
  const cardW = (Math.min(width, 680) - 32 - (cols - 1) * 12) / cols;
  // Build the 89 previews a few groups at a time instead of all in one frame.
  const [shown, setShown] = useState(2);
  useEffect(() => {
    if (shown >= GROUPS.length) return;
    const t = setTimeout(() => setShown((n) => n + 2), 120);
    return () => clearTimeout(t);
  }, [shown]);
  return (
    <Screen>
      <Text style={{ ...TYPE.regular, fontSize: sz(15), color: current.muted, paddingHorizontal: 4 }}>
        All {THEMES.length} themes from Studento. Some have a live effect; turn effects off in Settings.
      </Text>
      {GROUPS.slice(0, shown).map((g) => (
        <View key={g} style={{ gap: 10 }}>
          <Text style={{ ...TYPE.bold, fontSize: sz(20), letterSpacing: -0.4, color: current.ink, paddingHorizontal: 4 }}>{g}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {THEMES.filter((t) => t.group === g).map((t) => (
              <Card key={t.id} t={t} on={t.id === current.id} w={cardW} />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Card({ t, on, w }: { t: Theme; on: boolean; w: number }) {
  const sample = '21:33';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${t.name} theme`}
      onPress={() => {
        tap();
        setPref('theme', t.id);
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: w, height: w * 0.95, borderRadius: 22, overflow: 'hidden', backgroundColor: t.bg, borderWidth: on ? 3 : 1, borderColor: on ? t.accent : alpha(t.ink, 0.1) }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <Board text={sample} theme={t} width={w - 24} maxSize={t.engine === 'dial' ? w * 0.13 : w * 0.19} remaining={0.6} secondsLeft={21 * 60 + 33} motion={false} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...fontStyle(t.type.title, '600'), fontSize: 15 * Math.min(1.15, t.type.titleScale ?? 1), color: t.ink }} numberOfLines={1}>
              {t.type.titleCaps ? t.name.toUpperCase() : t.name}
            </Text>
            {t.effect !== 'none' ? (
              <Text style={{ ...TYPE.regular, fontSize: sz(11), color: alpha(t.ink, 0.55) }} numberOfLines={1}>
                {EFFECT_LABEL[t.effect]}
              </Text>
            ) : null}
          </View>
          {on ? <Icon name="checkmark.circle.fill" color={t.accent} size={20} fallback={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.accent }} />} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
