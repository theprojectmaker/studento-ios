/** Class name, room and note for each period. Shared with every device. */
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Screen, Section } from '@/components/ui';
import type { ClassDetail } from '@/lib/alerts';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { PERIOD_IDS } from '@/lib/schedule';
import { getState, setClassInfo, useStore } from '@/lib/store';

export default function Classes() {
  const theme = useTheme();
  const shared = useStore((s) => s.shared);
  const [names, setNames] = useState<Record<string, string>>(() => ({ ...shared.classNames }));
  const [details, setDetails] = useState<Record<string, ClassDetail>>(() => ({ ...shared.classDetails }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const setDetail = (id: string, key: keyof ClassDetail, v: string) => setDetails((d) => ({ ...d, [id]: { ...d[id], [key]: v } }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const cleanNames: Record<string, string> = {};
    for (const [k, v] of Object.entries(names)) if (v.trim()) cleanNames[k] = v.trim().slice(0, 60);
    const cleanDetails: Record<string, ClassDetail> = {};
    for (const [k, v] of Object.entries(details)) {
      const room = (v.room ?? '').trim().slice(0, 20);
      const note = (v.note ?? '').trim().slice(0, 80);
      if (room || note) cleanDetails[k] = { room, note };
    }
    await setClassInfo(cleanNames, cleanDetails);
    setSaving(false);
    if (getState().sync.status === 'offline') setMsg({ text: 'Saved on this phone. It will sync when you are back online.', tone: 'error' });
    else router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Note>These show on the clock and in your alerts, on every device.</Note>
        <Section>
          {PERIOD_IDS.map((id, i) => {
            const label = id === 'advisory' ? 'Advisory' : `Period ${id}`;
            return (
              <View key={id}>
                {i ? <Divider /> : null}
                <View style={{ padding: 14, gap: 8 }}>
                  <Text style={{ ...TYPE.bold, fontSize: 12, letterSpacing: 1, color: theme.accent }}>{label.toUpperCase()}</Text>
                  <Field
                    value={names[id] ?? ''}
                    placeholder={label}
                    onChangeText={(v) => setNames((n) => ({ ...n, [id]: v }))}
                    accessibilityLabel={`${label} class name`}
                    maxLength={60}
                    returnKeyType="done"
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Field
                      style={{ width: 100 }}
                      value={details[id]?.room ?? ''}
                      placeholder="Room"
                      onChangeText={(v) => setDetail(id, 'room', v)}
                      accessibilityLabel={`${label} room`}
                      maxLength={20}
                    />
                    <Field
                      style={{ flex: 1 }}
                      value={details[id]?.note ?? ''}
                      placeholder="Note (teacher, bring…)"
                      onChangeText={(v) => setDetail(id, 'note', v)}
                      accessibilityLabel={`${label} note`}
                      maxLength={80}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </Section>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
