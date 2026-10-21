/** The day strip: one segment per period, filled up to "now". */
import { View } from 'react-native';

import { toMin } from '@/lib/nytime';
import type { Period } from '@/lib/schedule';
import { alpha, type Theme } from '@/lib/themes';

export function Timeline({ periods, secOfDay, theme }: { periods: Period[]; secOfDay: number; theme: Theme }) {
  if (!periods.length) return null;
  const first = toMin(periods[0].start) * 60;
  const last = toMin(periods[periods.length - 1].end) * 60;
  const total = Math.max(1, last - first);
  const nowFrac = Math.min(1, Math.max(0, (secOfDay - first) / total));
  return (
    <View style={{ height: 10, width: '100%', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ height: 8, flexDirection: 'row', position: 'relative' }}>
        {periods.map((p, i) => {
          const s = toMin(p.start) * 60;
          const e = toMin(p.end) * 60;
          const left = ((s - first) / total) * 100;
          const w = ((e - s) / total) * 100;
          const fill = Math.min(1, Math.max(0, (secOfDay - s) / (e - s)));
          return (
            <View
              key={`${p.period}-${i}`}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${w}%`,
                top: 0,
                bottom: 0,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: alpha(theme.ink, theme.light ? 0.12 : 0.14),
              }}>
              <View style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: fill >= 1 ? alpha(theme.accent, 0.55) : theme.accent }} />
            </View>
          );
        })}
        {nowFrac > 0 && nowFrac < 1 ? (
          <View
            style={{
              position: 'absolute',
              left: `${nowFrac * 100}%`,
              top: -4,
              bottom: -4,
              width: 3,
              marginLeft: -1.5,
              borderRadius: 2,
              backgroundColor: theme.ink,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
