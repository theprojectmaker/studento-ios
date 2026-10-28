/** Pick which widgets show on the clock screen, and their order (up to 4). */
import { Pressable, Text, View } from 'react-native';

import { WIDGET_INFO } from '@/components/widgets';
import { Divider, Note, Screen, Section, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { setPref, useStore, WIDGET_IDS, type WidgetId } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { sz } from '@/lib/scale';

const MAX = 4;

export default function Widgets() {
  const theme = useTheme();
  const ids = useStore((s) => s.prefs.widgets);
  const unused = WIDGET_IDS.filter((id) => !ids.includes(id));

  const save = (next: WidgetId[]) => {
    tap();
    setPref('widgets', next);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    save(next);
  };

  return (
    <Screen>
      <Section title={`On the clock · ${ids.length} of ${MAX}`} footer="Tap a widget on the clock to open it.">
        {ids.length ? (
          ids.map((id, i) => (
            <View key={id}>
              {i ? <Divider inset={56} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                <RoundBtn label={`Remove ${WIDGET_INFO[id].name}`} color="#ff3b30" sign="−" onPress={() => save(ids.filter((x) => x !== id))} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...TYPE.medium, fontSize: sz(16), color: theme.ink }}>{WIDGET_INFO[id].name}</Text>
                  <Text style={{ ...TYPE.regular, fontSize: sz(13), color: theme.muted }}>{WIDGET_INFO[id].about}</Text>
                </View>
                <Arrow label="Move up" disabled={i === 0} up onPress={() => move(i, -1)} />
                <Arrow label="Move down" disabled={i === ids.length - 1} onPress={() => move(i, 1)} />
              </View>
            </View>
          ))
        ) : (
          <Text style={{ ...TYPE.regular, fontSize: sz(15), color: theme.muted, padding: 16 }}>No widgets. The clock stays clean.</Text>
        )}
      </Section>

      {unused.length ? (
        <Section title="More widgets">
          {unused.map((id, i) => (
            <View key={id}>
              {i ? <Divider inset={56} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, opacity: ids.length >= MAX ? 0.4 : 1 }}>
                <RoundBtn label={`Add ${WIDGET_INFO[id].name}`} color="#34c759" sign="+" disabled={ids.length >= MAX} onPress={() => save([...ids, id])} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...TYPE.medium, fontSize: sz(16), color: theme.ink }}>{WIDGET_INFO[id].name}</Text>
                  <Text style={{ ...TYPE.regular, fontSize: sz(13), color: theme.muted }}>{WIDGET_INFO[id].about}</Text>
                </View>
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      {ids.length >= MAX ? <Note>Up to {MAX} widgets. Remove one to add another.</Note> : null}
    </Screen>
  );
}

function RoundBtn({ label, color, sign, onPress, disabled }: { label: string; color: string; sign: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hitSlop={8} onPress={onPress} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...TYPE.heavy, color: '#ffffff', fontSize: sz(18), lineHeight: sz(20) }}>{sign}</Text>
    </Pressable>
  );
}

function Arrow({ label, up, disabled, onPress }: { label: string; up?: boolean; disabled?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hitSlop={6} onPress={onPress} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(theme.ink, 0.07), opacity: disabled ? 0.3 : 1 }}>
      <Text style={{ ...TYPE.bold, color: theme.ink, fontSize: sz(14) }}>{up ? '↑' : '↓'}</Text>
    </Pressable>
  );
}
