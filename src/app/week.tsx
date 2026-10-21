/** The whole school week: pick a day, see every period, room and time. Custom days show too. */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Divider, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useNow, useTheme } from '@/lib/hooks';
import { addDays, fmtDate, nyParts, weekdayOf } from '@/lib/nytime';
import { nameFor, periodTitle, rangeText, roomOf, scheduleFor } from '@/lib/schedule';
import { useSchedule, useStore } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';

export default function Week() {
  const theme = useTheme();
  const now = useNow();
  const h24 = useStore((s) => s.prefs.h24);
  const today = nyParts(now).date;

  // Monday of this week (or next week on weekends).
  const wd = weekdayOf(today);
  const offset = { Mon: 0, Tue: -1, Wed: -2, Thu: -3, Fri: -4, Sat: 2, Sun: 1 }[wd];
  const monday = addDays(today, offset);
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const [pick, setPick] = useState(days.includes(today) ? today : days[0]);
  const sched = useSchedule();
  const data = sched.data;
  const day = scheduleFor(pick, data);

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => {
          const on = d === pick;
          const isToday = d === today;
          const kind = scheduleFor(d, data).kind;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                setPick(d);
              }}
              style={{ width: 64, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 2, backgroundColor: on ? theme.accent : theme.panel }}>
              <Text style={{ ...TYPE.semibold, fontSize: 12, color: on ? readableOn(theme.accent) : theme.muted }}>{weekdayOf(d).toUpperCase()}</Text>
              <Text style={{ ...TYPE.heavy, fontSize: 22, color: on ? readableOn(theme.accent) : theme.ink }}>{Number(d.slice(8))}</Text>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isToday ? (on ? readableOn(theme.accent) : theme.accent) : kind !== 'Regular' && kind !== 'Wednesday Advisory' ? alpha(theme.ink, 0.4) : 'transparent' }} />
            </Pressable>
          );
        })}
      </ScrollView>

      <Section title={fmtDate(pick)} footer={`${day.kind}${/schedule|day$/i.test(day.kind) ? '' : ' schedule'}`}>
        {day.periods.map((p, i) => {
          const d = { room: roomOf(p, sched.details) };
          return (
            <View key={`${p.period}-${i}`}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...TYPE.semibold, fontSize: 16, color: theme.ink }} numberOfLines={1}>
                    {nameFor(p, sched.names)}
                  </Text>
                  <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted }} numberOfLines={1}>
                    {[nameFor(p, sched.names) !== periodTitle(p) ? periodTitle(p) : null, d?.room ? `Room ${d.room}` : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ ...TYPE.medium, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>{rangeText(p, h24)}</Text>
              </View>
            </View>
          );
        })}
      </Section>
    </Screen>
  );
}
