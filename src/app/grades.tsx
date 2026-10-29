/** Grade calculator: add classes with a percent, see the average, letter and GPA. Saved on this phone. */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { useClasses } from '@/lib/store';
import { addGrade, deleteGrade, gradeSummary, letter, updateGrade, useTools } from '@/lib/tools';
import { alpha, readableOn } from '@/lib/themes';
import { sz } from '@/lib/scale';
import { neededOnFinal } from '@/lib/calc';

const LEVELS = [
  { w: 1, label: 'Regular' },
  { w: 1.1, label: 'Honors' },
  { w: 1.2, label: 'AP' },
];

export default function Grades() {
  const theme = useTheme();
  const grades = useTools((t) => t.grades);
  const { ids: classIds, names } = useClasses();
  const [name, setName] = useState('');
  const [score, setScore] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<string | null>(null);
  const [finalPct, setFinalPct] = useState('20');
  const [target, setTarget] = useState('90');
  const sum = gradeSummary(grades);
  const wi = grades.find((g) => g.id === whatIf) ?? grades[0];
  const need = wi && Number(finalPct) > 0 && Number(target) > 0 ? neededOnFinal(wi.score, Number(finalPct), Number(target)) : null;
  const suggestions = classIds.map((id) => names[id]).filter((n): n is string => !!n && !grades.some((g) => g.name === n));

  const add = (n = name) => {
    const s = Number(score);
    if (!n.trim()) return setErr('Name the class.');
    if (!score.trim() || !Number.isFinite(s) || s < 0 || s > 110) return setErr('Score should be a percent, like 92.');
    addGrade(n.trim().slice(0, 40), s, 1);
    setName('');
    setScore('');
    setErr(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            [sum ? `${sum.average.toFixed(1)}%` : '–', 'average'],
            [sum ? letter(sum.average) : '–', 'letter'],
            [sum ? sum.gpa.toFixed(2) : '–', 'GPA (weighted)'],
          ].map(([big, small]) => (
            <View key={small} style={{ flex: 1, backgroundColor: theme.panel, borderRadius: 18, padding: 14, alignItems: 'center' }}>
              <Text style={{ ...TYPE.heavy, fontSize: sz(26), color: theme.ink, fontVariant: ['tabular-nums'] }}>{big}</Text>
              <Text style={{ ...TYPE.medium, fontSize: sz(12), color: theme.muted }}>{small}</Text>
            </View>
          ))}
        </View>

        {grades.length ? (
          <Section title="Classes">
            {grades.map((g, i) => (
              <View key={g.id}>
                {i ? <Divider /> : null}
                <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ ...TYPE.semibold, fontSize: sz(16), color: theme.ink, flex: 1 }} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={{ ...TYPE.heavy, fontSize: sz(17), color: theme.ink, fontVariant: ['tabular-nums'] }}>
                      {g.score}% · {letter(g.score)}
                    </Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${g.name}`} hitSlop={8} onPress={() => deleteGrade(g.id)}>
                      <Text style={{ fontSize: sz(20), color: alpha(theme.ink, 0.35) }}>×</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {LEVELS.map((l) => {
                      const on = Math.abs(g.weight - l.w) < 0.01;
                      return (
                        <Pressable
                          key={l.label}
                          onPress={() => {
                            tap();
                            updateGrade(g.id, { weight: l.w });
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? theme.accent : alpha(theme.ink, 0.08) }}>
                          <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: on ? readableOn(theme.accent) : theme.ink }}>{l.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Add a class">
          <View style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field style={{ flex: 1 }} value={name} onChangeText={setName} placeholder="Class" accessibilityLabel="Class name" />
              <Field style={{ width: 90 }} value={score} onChangeText={setScore} placeholder="%" keyboardType="decimal-pad" accessibilityLabel="Percent" />
            </View>
            {suggestions.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {suggestions.slice(0, 8).map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => {
                      tap();
                      setName(n);
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: alpha(theme.ink, 0.08) }}>
                    <Text style={{ ...TYPE.medium, fontSize: sz(13), color: theme.ink }}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {err ? <Note tone="error">{err}</Note> : null}
            <Button title="Add" onPress={() => add()} />
          </View>
        </Section>
        {grades.length ? (
          <Section title="What do I need on the final?" footer="Final worth 20% and you want a 90 overall: this is the score that gets you there.">
            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {grades.map((g) => {
                  const on = wi?.id === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        tap();
                        setWhatIf(g.id);
                      }}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? theme.accent : alpha(theme.ink, 0.08) }}>
                      <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: on ? readableOn(theme.accent) : theme.ink }}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted, flex: 1 }}>Final is worth</Text>
                <Field style={{ width: 80 }} value={finalPct} onChangeText={setFinalPct} keyboardType="decimal-pad" accessibilityLabel="Final weight percent" />
                <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted }}>%</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted, flex: 1 }}>I want to end with</Text>
                <Field style={{ width: 80 }} value={target} onChangeText={setTarget} keyboardType="decimal-pad" accessibilityLabel="Target percent" />
                <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted }}>%</Text>
              </View>
              {need != null && wi ? (
                <View style={{ backgroundColor: alpha(theme.accent, 0.14), borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 }}>
                  <Text style={{ ...TYPE.heavy, fontSize: sz(30), color: need > 100 ? '#ff453a' : theme.ink, fontVariant: ['tabular-nums'] }}>{need <= 0 ? 'Any score' : `${Math.ceil(need)}%`}</Text>
                  <Text style={{ ...TYPE.medium, fontSize: sz(13), color: theme.muted, textAlign: 'center' }}>
                    {need > 100 ? `Out of reach: even 100% leaves ${wi.name} at ${(wi.score * (1 - Number(finalPct) / 100) + Number(finalPct)).toFixed(1)}%.` : need <= 0 ? `${wi.name} stays at or above ${target}% no matter what.` : `on the ${wi.name} final (you have ${wi.score}% now)`}
                  </Text>
                </View>
              ) : null}
            </View>
          </Section>
        ) : null}
        <Note>GPA uses the common 4.0 letter scale; Honors and AP count a little more.</Note>
      </Screen>
    </KeyboardAvoidingView>
  );
}
