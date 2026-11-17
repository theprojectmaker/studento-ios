/** One Beam conversation, full screen (phones, or a link from a notification). */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { BeamChat } from '@/components/beam-chat';
import { BeamLockScreen } from '@/components/beam-lock-screen';
import { useBeamUnlocked } from '@/lib/beam-lock';
import { goBack } from '@/lib/beam-nav';
import { useBeamRedeemed } from '@/lib/beam-on';

export default function Chat() {
  const { u } = useLocalSearchParams<{ u: string }>();
  const redeemed = useBeamRedeemed();
  const unlocked = useBeamUnlocked();
  // Without the code, Beam doesn't exist: a stray link just lands on the clock.
  if (!redeemed) return <Redirect href="/" />;
  if (!unlocked) return <BeamLockScreen />;
  return <BeamChat username={String(u ?? '').toLowerCase()} onBack={goBack} />;
}
