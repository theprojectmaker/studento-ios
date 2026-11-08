/**
 * Redeem: one box for every code. A 6-character schedule code from a friend's device loads
 * their schedule (after a preview); a promo code unlocks a beta feature. Below it, make a
 * share code for your own schedule.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Share, Text, View } from 'react-native';

import { Button, Divider, Field, Note, Row, Screen, Section } from '@/components/ui';
import * as api from '@/lib/api';
import { applyShared, currentSchedule, describeShared, fetchShared, isShareCode, redeemPromo, UNLOCK_INFO, type SharedSchedule } from '@/lib/codes';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';

export default function Redeem() {
  const theme = useTheme();
  const unlocks = useStore((s) => s.prefs.unlocks) ?? [];
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [found, setFound] = useState<SharedSchedule | null>(null);
  const [mine, setMine] = useState<{ code: string; expiresAt: number } | null>(null);

  const redeem = async () => {
    setMsg(null);
    setFound(null);
    const promo = redeemPromo(code);
    if (promo) {
      setMsg({ text: `Unlocked: ${promo.title}. ${promo.detail}`, tone: 'ok' });
      setCode('');
      return;
    }
    if (!isShareCode(code)) return setMsg({ text: 'That code did not work. Schedule codes are 6 letters and numbers.', tone: 'error' });
    setBusy(true);
    try {
      setFound(await fetchShared(code));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'That code did not work.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const applyIt = async () => {
    if (!found) return;
    await applyShared(found);
    setFound(null);
    setCode('');
    setMsg({ text: 'Done. The clock now runs that schedule.', tone: 'ok' });
  };

  const makeCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.shareSchedule(currentSchedule());
      setMine(r);
      if (Platform.OS !== 'web') void Share.share({ message: `My Studento schedule code: ${r.code}\nOpen Studento > Settings > Redeem a code.` }).catch(() => {});
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't make a code.", tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Section title="Enter a code" footer="A schedule code from another device, or a code for a beta feature.">
          <View style={{ padding: 14, gap: 10 }}>
            <Field value={code} onChangeText={setCode} placeholder="Code" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={() => void redeem()} accessibilityLabel="Code" style={{ fontSize: sz(20), letterSpacing: 2, textAlign: 'center' }} />
            <Button title={busy ? 'Checking…' : 'Redeem'} onPress={() => void redeem()} disabled={busy || !code.trim()} />
          </View>
        </Section>

        {found ? (
          <Section title="Schedule found" footer="Using it replaces the schedule and class names on this device.">
            <View style={{ padding: 14, gap: 10 }}>
              <Text style={{ ...TYPE.semibold, fontSize: sz(17), color: theme.ink }}>{found.personal?.name ?? 'Shared schedule'}</Text>
              <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted }}>{describeShared(found)}</Text>
              <Button title="Use this schedule" onPress={() => void applyIt()} />
              <Button title="Cancel" kind="plain" onPress={() => setFound(null)} />
            </View>
          </Section>
        ) : null}

        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}

        <Section title="Share my schedule" footer="Anyone with the code can load your schedule and class names for 30 days. No account needed.">
          <View style={{ padding: 14, gap: 10 }}>
            {mine ? (
              <View style={{ alignItems: 'center', gap: 4, paddingVertical: 6 }}>
                <Text selectable style={{ ...TYPE.heavy, fontSize: sz(36), letterSpacing: 6, color: theme.ink, fontVariant: ['tabular-nums'] }}>
                  {mine.code}
                </Text>
                <Text style={{ ...TYPE.regular, fontSize: sz(13), color: theme.muted }}>{`Works until ${new Date(mine.expiresAt).toLocaleDateString()}`}</Text>
              </View>
            ) : null}
            <Button title={mine ? 'Make a new code' : 'Make a share code'} kind={mine ? 'plain' : 'primary'} onPress={() => void makeCode()} disabled={busy} />
          </View>
        </Section>

        {unlocks.length ? (
          <Section title="Unlocked">
            {unlocks.map((id, i) => (
              <View key={id}>
                {i ? <Divider /> : null}
                <Row label={UNLOCK_INFO[id]?.title ?? id} sub={UNLOCK_INFO[id]?.detail} icon={{ name: 'checkmark.seal.fill', color: '#34c759' }} />
              </View>
            ))}
          </Section>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
