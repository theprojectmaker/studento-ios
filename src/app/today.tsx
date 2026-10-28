/** Today: quick stats for the day, then every period with its time. */
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Divider, Screen, Section } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useNow, useTheme } from '@/lib/hooks';
import { addDays, fmtDate, fmtTime, toMin, weekdayOf } from '@/lib/nytime';
import { type DaySchedule, nameFor, nowState, periodTitle, rangeText, roomOf } from '@/lib/schedule';
import { useSchedule, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { sz } from '@/lib/scale';

function hm(sec: number) {
  const m = Math.max(0, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function Today() {
  const now = useNow();
  const theme = useTheme();
  const h24 = useStore((s) => s.prefs.h24);
  const sched = useSchedule();
  const st = nowState(now, sched.data);
  const showing: DaySchedule | null = st.day.periods.length ? st.day : st.nextSchoolDay;
  const isToday = showing === st.day;

  const list = st.day.periods;
  const lastEnd = list.length ? toMin(list[list.length - 1].end) * 60 : 0;
  const done = list.filter((p) => toMin(p.end) * 60 <= st.secOfDay).length;
  const classLeft = list.reduce((acc, p) => {
    const s = Math.max(toMin(p.start) * 60, st.secOfDay);
    const e = toMin(p.end) * 60;
    return acc + Math.max(0, e - s);
  }, 0);
  let toWeekend = 0;
  for (let d = st.date; !['Sat', 'Sun'].includes(weekdayOf(d)) && toWeekend < 7; d = addDays(d, 1)) toWeekend++;

  const stats: [string, string][] = list.length
    ? [
        [lastEnd > st.secOfDay ? hm(lastEnd - st.secOfDay) : 'Done', 'until the last bell'],
        [`${done}/${list.length}`, 'periods done'],
        [hm(classLeft), 'of class left'],
        [list.length ? fmtTime(list[list.length - 1].end, h24) : '-', 'last bell'],
      ]
    : [
        ['0', 'periods today'],
        [st.nextSchoolDay ? fmtDate(st.nextSchoolDay.date).replace(/,.*$/, '') : '-', 'next school day'],
      ];
  if (list.length) stats.push([toWeekend <= 1 ? 'Tomorrow' : `${toWeekend} days`, 'to the weekend']);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stats.map(([big, small]) => (
          <View key={small} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: theme.panel, borderRadius: 18, padding: 14, gap: 2 }}>
            <Text style={{ ...TYPE.heavy, fontSize: sz(26), letterSpacing: -0.6, color: theme.ink, fontVariant: ['tabular-nums'] }}>{big}</Text>
            <Text style={{ ...TYPE.medium, fontSize: sz(13), color: theme.muted }}>{small}</Text>
          </View>
        ))}
      </View>

      {showing ? (
        <Section title={`${isToday ? 'Today' : 'Next school day'} · ${fmtDate(showing.date)}`} footer={`${showing.kind}${/schedule|day$/i.test(showing.kind) ? '' : ' schedule'}`}>
          {showing.periods.map((p, i) => {
            const isDone = isToday && st.secOfDay >= toMin(p.end) * 60;
            const on = isToday && i === st.currentIndex;
            const d = { ...sched.details[p.period], room: roomOf(p, sched.details) };
            return (
              <View key={`${p.period}-${i}`}>
                {i ? <Divider /> : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: on ? alpha(theme.accent, 0.16) : 'transparent',
                    opacity: isDone ? 0.45 : 1,
                  }}>
                  <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: on ? theme.accent : 'transparent' }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ ...TYPE.semibold, fontSize: sz(16), color: theme.ink }} numberOfLines={1}>
                      {nameFor(p, sched.names)}
                    </Text>
                    <Text style={{ ...TYPE.regular, fontSize: sz(13), color: theme.muted }} numberOfLines={1}>
                      {[nameFor(p, sched.names) !== periodTitle(p) ? periodTitle(p) : null, d?.room ? `Room ${d.room}` : null, d?.note || null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={{ ...TYPE.medium, fontSize: sz(14), color: on ? theme.accent : theme.muted, fontVariant: ['tabular-nums'] }}>{rangeText(p, h24)}</Text>
                </View>
              </View>
            );
          })}
        </Section>
      ) : null}
      <Button title="Edit my classes" kind="plain" onPress={() => router.push('/classes')} />
    </Screen>
  );
}
