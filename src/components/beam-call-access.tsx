/**
 * Shown where the call buttons would be until the admin approves this person for calls.
 * Worded as early access (never "calls"), like the Beam waiting list.
 */
import { useState } from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';

import { BeamGlass, type BeamPalette } from '@/components/beam-ui';
import { useCallAccess } from '@/lib/beam-on';

function say(title: string, body: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${body}`);
  else Alert.alert(title, body);
}

export function earlyAccessLabel(status: string, place?: number): string {
  if (status === 'waiting') return place ? `#${place} in line` : 'In line';
  if (status === 'denied') return 'Not yet';
  return 'Early access';
}

export function CallAccessPill({ c, height = 44 }: { c: BeamPalette; height?: number }) {
  const ca = useCallAccess();
  const [busy, setBusy] = useState(false);
  const press = () => {
    if (ca.status === 'waiting') return say('Early access', `You're ${ca.place ? `#${ca.place} ` : ''}in line for early access to a new feature. You'll get a notification when it's ready for you.`);
    if (ca.status === 'denied') return say('Early access', "Early access isn't open to you this time.");
    setBusy(true);
    ca.request()
      .then(() => say('Early access', "You're in line. You'll get a notification when it's ready for you."))
      .catch((e) => say('Early access', e instanceof Error ? e.message : "Couldn't send that."))
      .finally(() => setBusy(false));
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Request early access" onPress={press} disabled={busy}>
      <BeamGlass c={c} radius={height / 2} interactive style={{ height, paddingHorizontal: 12, justifyContent: 'center' }}>
        <Text style={{ color: ca.status === 'none' ? c.blue : c.text2, fontSize: 13, fontWeight: '600' }}>{busy ? 'Asking…' : earlyAccessLabel(ca.status, ca.place)}</Text>
      </BeamGlass>
    </Pressable>
  );
}
