/** Report a shared school or schedule (wrong times, spam, offensive name...). Goes to the admin. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { Button, Field, Note, Screen, Section } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';
import { sz } from '@/lib/scale';

const REASONS = ['Wrong bell times', 'Not a real school', 'Duplicate', 'Offensive or spam', 'Something else'];

export default function Report() {
  const theme = useTheme();
  const account = useStore((s) => s.account);
  const { kind, id, name } = useLocalSearchParams<{ kind?: string; id?: string; name?: string }>();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const send = async () => {
    setMsg(null);
    const t = await getToken();
    if (!t || !account) return setMsg({ text: 'Sign in (Settings > Account) to send a report.', tone: 'error' });
    setBusy(true);
    try {
      await api.sendReport(t, kind === 'school' ? 'school' : 'schedule', Number(id), reason, note.trim());
      setMsg({ text: 'Thanks. The report went to the Studento admin.', tone: 'ok' });
      setTimeout(() => router.back(), 900);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't send it.", tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(21), color: theme.muted, textAlign: 'center' }}>{`Reporting “${name ?? 'this item'}”. Pick a reason; a note helps.`}</Text>
        <Section title="Reason">
          {REASONS.map((r) => {
            const on = r === reason;
            return (
              <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setReason(r)} style={({ pressed }) => ({ backgroundColor: pressed ? alpha(theme.ink, 0.06) : 'transparent' })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? theme.accent : alpha(theme.ink, 0.3), alignItems: 'center', justifyContent: 'center' }}>{on ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: theme.accent }} /> : null}</View>
                  <Text style={{ ...TYPE.medium, fontSize: sz(16), color: theme.ink }}>{r}</Text>
                </View>
              </Pressable>
            );
          })}
        </Section>
        <Section title="Note (optional)">
          <View style={{ padding: 12 }}>
            <Field value={note} onChangeText={setNote} placeholder="What's wrong?" multiline maxLength={500} style={{ minHeight: sz(90), textAlignVertical: 'top' }} accessibilityLabel="Note" />
          </View>
        </Section>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        <Button title={busy ? 'Sending…' : 'Send report'} onPress={() => void send()} disabled={busy} />
        {!account ? <Note>{"Reports need an account so they can't be spammed. Sign in under Settings > Account."}</Note> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
