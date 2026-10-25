/** Hub: today at a glance plus big tiles for every tool. Opened from the clock's bottom-left button. */
import { router, type Href } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/glass';
import { Screen, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useNow, useRealNow, useTheme } from '@/lib/hooks';
import { addDays, fmtDate, fmtTime, toMin } from '@/lib/nytime';
import { usePlanner } from '@/lib/planner';
import { nameFor, nowState } from '@/lib/schedule';
import { useSchedule, useStore } from '@/lib/store';
import { focusLeft, useTools } from '@/lib/tools';
import { alpha } from '@/lib/themes';
import { fontStyle } from '@/lib/typefaces';

interface Tile {
  title: string;
  sub: string;
  icon: SFSymbol;
  color: string;
  href: Href;
}

export default function Hub() {
  const theme = useTheme();
  const now = useNow();
  const realNow = useRealNow();
  const { width } = useWindowDimensions();
  const h24 = useStore((s) => s.prefs.h24);
  const prefsMotion = useStore((s) => s.prefs.motion);
  const homework = usePlanner((p) => p.homework);
  const countdowns = usePlanner((p) => p.countdowns);
  const focus = useTools((t) => t.focus);
  const notes = useTools((t) => t.notes);
  const grades = useTools((t) => t.grades);

  const sched = useSchedule();
  const st = nowState(now, sched.data);
  const list = st.day.periods;
  const lastEnd = list.length ? toMin(list[list.length - 1].end) * 60 : 0;
  const left = Math.max(0, lastEnd - st.secOfDay);
  const done = list.filter((p) => toMin(p.end) * 60 <= st.secOfDay).length;
  const tomorrow = addDays(st.date, 1);
  const due = homework.filter((h) => !h.done && h.due && h.due <= tomorrow).length;
  const nextCd = countdowns.find((c) => c.date >= st.date);
  const focusText =
    focus.mode === 'idle'
      ? `${focus.focusMin} min block`
      : (() => {
          const s = Math.ceil(focusLeft(focus, realNow) / 1000);
          return `${focus.mode === 'break' ? 'Break' : 'Focusing'} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        })();

  const headline = !list.length
    ? 'No school today'
    : left > 0
      ? `${Math.floor(left / 3600) ? `${Math.floor(left / 3600)}h ` : ''}${Math.round((left % 3600) / 60)}m of school left`
      : 'School is done for today';

  const tiles: Tile[] = [
    { title: 'Today', sub: list.length ? `${done}/${list.length} periods done` : 'Schedule & stats', icon: 'clock.fill', color: '#ff9500', href: '/today' },
    {
      title: 'My schedule',
      sub: sched.personal ? sched.personal.name : 'Scan yours in seconds',
      icon: 'camera.viewfinder',
      color: '#30b0c7',
      href: sched.personal ? { pathname: '/schedule-review', params: { edit: '1' } } : '/welcome',
    },
    { title: 'This week', sub: 'Every day at a glance', icon: 'calendar', color: '#007aff', href: '/week' },
    { title: 'Focus', sub: focusText, icon: 'timer', color: '#ff3b30', href: '/focus' },
    { title: 'Homework', sub: due ? `${due} due soon` : 'All clear', icon: 'checklist', color: '#34c759', href: '/planner' },
    { title: 'Countdowns', sub: nextCd ? `${nextCd.emoji} ${nextCd.title}` : 'Count down to big days', icon: 'hourglass', color: '#af52de', href: '/planner' },
    { title: 'Notes', sub: notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'Jot something down', icon: 'note.text', color: '#ffcc00', href: '/notes' },
    { title: 'Grades', sub: grades.length ? `${grades.length} classes` : 'Average & GPA', icon: 'graduationcap.fill', color: '#5856d6', href: '/grades' },
    { title: 'Themes', sub: theme.name, icon: 'paintpalette.fill', color: '#ff2d55', href: '/themes' },
  ];
  const cols = width > 700 ? 3 : 2;
  const tileW = (Math.min(width, 680) - 32 - (cols - 1) * 12) / cols;

  return (
    <Screen>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Text style={{ ...fontStyle(theme.type.label, '600'), fontSize: 13, letterSpacing: theme.type.labelTracking ?? 2, color: theme.muted }}>{fmtDate(st.date).toUpperCase()}</Text>
        <Text style={{ ...fontStyle(theme.type.title, '800'), fontSize: 30 * Math.min(1.1, theme.type.titleScale ?? 1), color: theme.ink }}>{headline}</Text>
        {st.current ? (
          <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.muted }}>
            Now: {nameFor(st.current, sched.names)} until {fmtTime(st.current.end, h24)}
          </Text>
        ) : st.next ? (
          <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.muted }}>
            Next: {nameFor(st.next, sched.names)} at {fmtTime(st.next.start, h24)}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((t, i) => (
          <Animated.View key={t.title} entering={prefsMotion ? FadeIn.delay(Math.min(i, 8) * 25).duration(180) : undefined}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.title}. ${t.sub}`}
              onPress={() => {
                tap();
                router.push(t.href);
              }}
              style={({ pressed }) => ({ width: tileW, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <View style={{ backgroundColor: theme.panel, borderRadius: 22, padding: 16, gap: 14, minHeight: 124 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: t.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={t.icon} color="#ffffff" size={20} fallback={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: alpha('#ffffff', 0.9) }} />} />
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={{ ...TYPE.bold, fontSize: 17, color: theme.ink }}>{t.title}</Text>
                  <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted }} numberOfLines={1}>
                    {t.sub}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}
