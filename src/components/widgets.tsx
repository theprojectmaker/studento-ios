/** The clock screen's widgets area: small glass tiles the student picks in Settings > Widgets. */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TYPE } from '@/lib/fonts';
import { useRealNow } from '@/lib/hooks';
import { addDays, fmtDate, fmtTime, toMin, weekdayOf } from '@/lib/nytime';
import { daysBetween, usePlanner } from '@/lib/planner';
import { focusLeft, useTools } from '@/lib/tools';
import { nameFor, type NowState } from '@/lib/schedule';
import { setPref, type WidgetId } from '@/lib/store';
import { alpha, type Theme } from '@/lib/themes';
import { sz } from '@/lib/scale';

import { Glass } from './glass';
import { tap } from './ui';

export const WIDGET_INFO: Record<WidgetId, { name: string; about: string }> = {
  progress: { name: 'Day progress', about: 'How much of the school day is done' },
  homework: { name: 'Homework', about: "What's due today and tomorrow" },
  countdown: { name: 'Countdown', about: 'Days until your next big day' },
  next: { name: 'Up next', about: 'The class after this one' },
  date: { name: 'Date', about: "Today's date and schedule" },
  weekend: { name: 'Weekend', about: 'School days left this week' },
  focus: { name: 'Focus', about: 'Your focus timer at a glance' },
  quote: { name: 'Today', about: 'A short line to start the day' },
};

// Original lines, one per day.
const LINES = [
  'Small steps still count.',
  'Do the next right thing.',
  'Ask the question. Someone else wants to know too.',
  'Start before you feel ready.',
  'Your future self says thanks.',
  'Ten focused minutes beat an hour of scrolling.',
  'Progress, not perfect.',
  'Drink some water. Seriously.',
  'One page at a time.',
  'Be the person who shows up.',
  'Hard things get easier by doing them.',
  'You have done harder days than this.',
  'Breathe in. Bell soon.',
  'Notes now, less stress later.',
  'Curiosity is a superpower.',
  'Kindness costs nothing.',
  'Finish strong.',
  'Mistakes are proof you are trying.',
  'Today is a good day to learn one new thing.',
  'Plan the work, then work the plan.',
  'Phone down, brain on.',
  'Help someone today.',
  'Rest is part of the plan.',
  'Stay curious, stay kind.',
  'Every expert was once a beginner.',
  'The bell always rings eventually.',
  'Make it a little better than yesterday.',
  'Read the question twice.',
  'You are allowed to take up space.',
  'Good work takes time. Give it some.',
];

/** In customize mode each tile gets a red ⊖ that removes it, and an "Add widget" tile appears. */
export function WidgetArea({ ids, st, theme, names, h24, editing = false }: { ids: WidgetId[]; st: NowState; theme: Theme; names: Record<string, string>; h24: boolean; editing?: boolean }) {
  const homework = usePlanner((p) => p.homework);
  const countdowns = usePlanner((p) => p.countdowns);
  const focus = useTools((t) => t.focus);
  const realNow = useRealNow();
  if (!ids.length && !editing) return null;

  const render = (id: WidgetId): { big: string; small: string; go: '/planner' | '/today' | '/focus'; bar?: number; wrap?: boolean } => {
    const list = st.day.periods;
    switch (id) {
      case 'progress': {
        if (!list.length) return { big: 'No school', small: 'today', go: '/today' };
        const a = toMin(list[0].start) * 60;
        const b = toMin(list[list.length - 1].end) * 60;
        const f = Math.min(1, Math.max(0, (st.secOfDay - a) / (b - a)));
        return { big: `${Math.round(f * 100)}%`, small: 'of the school day', go: '/today', bar: f };
      }
      case 'homework': {
        const tomorrow = addDays(st.date, 1);
        const due = homework.filter((h) => !h.done && h.due && h.due <= tomorrow);
        if (!due.length) return { big: 'All clear', small: 'nothing due soon', go: '/planner' };
        return { big: `${due.length} due`, small: due[0].title, go: '/planner' };
      }
      case 'countdown': {
        const c = countdowns.find((x) => x.date >= st.date);
        if (!c) return { big: 'Add one', small: 'countdown to a big day', go: '/planner' };
        const n = daysBetween(st.date, c.date);
        return { big: n === 0 ? 'Today!' : `${n} ${n === 1 ? 'day' : 'days'}`, small: `${c.emoji} ${c.title}`, go: '/planner' };
      }
      case 'next': {
        const after = st.current ? list[st.currentIndex + 1] : st.next;
        if (!after) return { big: 'Done', small: 'no more classes today', go: '/today' };
        return { big: nameFor(after, names), small: fmtTime(after.start, h24), go: '/today' };
      }
      case 'date':
        return { big: fmtDate(st.date).replace(/^\w+, /, ''), small: st.day.isSchoolDay ? st.day.kind : weekdayOf(st.date) === 'Sat' || weekdayOf(st.date) === 'Sun' ? 'Weekend' : 'No school', go: '/today' };
      case 'focus': {
        if (focus.mode === 'idle') return { big: 'Start', small: `${focus.focusMin} min focus`, go: '/focus' };
        const left = Math.ceil(focusLeft(focus, realNow) / 1000);
        const t = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        return { big: t, small: focus.mode === 'break' ? 'break' : focus.pausedLeft != null ? 'paused' : 'focusing', go: '/focus' };
      }
      case 'quote': {
        const n = Number(st.date.replace(/-/g, '')) % LINES.length;
        return { big: LINES[n], small: fmtDate(st.date).replace(/,.*$/, ''), go: '/today', wrap: true };
      }
      case 'weekend': {
        let n = 0;
        for (let d = st.date; !['Sat', 'Sun'].includes(weekdayOf(d)) && n < 7; d = addDays(d, 1)) n++;
        return { big: n === 0 ? 'Weekend!' : n === 1 ? 'Last day' : `${n} days`, small: n === 0 ? 'enjoy it' : 'of school this week', go: '/today' };
      }
    }
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' }}>
      {ids.slice(0, 4).map((id) => {
        const w = render(id);
        return (
          <Tile key={id} theme={theme} label={WIDGET_INFO[id].name} editing={editing} onRemove={() => setPref('widgets', ids.filter((x) => x !== id))} onPress={() => router.push(w.go)}>
            <Text style={{ ...TYPE.bold, fontSize: w.wrap ? 15 : 19, letterSpacing: -0.4, color: theme.ink, textAlign: 'center' }} numberOfLines={w.wrap ? 2 : 1}>
              {w.big}
            </Text>
            {w.bar != null ? (
              <View style={{ alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: alpha(theme.ink, 0.14), overflow: 'hidden', marginVertical: 3 }}>
                <View style={{ width: `${w.bar * 100}%`, height: '100%', backgroundColor: theme.accent }} />
              </View>
            ) : null}
            <Text style={{ ...TYPE.regular, fontSize: sz(12.5), color: theme.muted, textAlign: 'center' }} numberOfLines={1}>
              {w.small}
            </Text>
          </Tile>
        );
      })}
      {editing && ids.length < 4 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a widget"
          onPress={() => {
            tap();
            router.push('/widgets');
          }}
          style={{ flexGrow: 1, flexBasis: '46%', minHeight: sz(64), borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: alpha(theme.ink, 0.3), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: theme.muted }}>+ Add widget</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Tile({ theme, label, onPress, children, editing, onRemove }: { theme: Theme; label: string; onPress: () => void; children: ReactNode; editing: boolean; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={editing ? `Remove ${label}` : label}
      onPress={() => {
        tap();
        if (editing) onRemove();
        else onPress();
      }}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: '46%', opacity: pressed ? 0.75 : 1 })}>
      <Glass theme={theme} radius={18} style={{ paddingHorizontal: 14, paddingVertical: 11, gap: 1, alignItems: 'center' }}>
        <Text style={{ ...TYPE.semibold, fontSize: sz(11), letterSpacing: 0.8, color: theme.muted, textAlign: 'center' }}>{label.toUpperCase()}</Text>
        {children}
      </Glass>
      {editing ? (
        <View style={{ position: 'absolute', top: -8, left: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' }}>
          <Text style={{ ...TYPE.heavy, color: '#ffffff', fontSize: sz(16), lineHeight: sz(18) }}>−</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
