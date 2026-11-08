/** One Beam conversation, full screen (phones, or a link from a notification). */
import { useLocalSearchParams } from 'expo-router';

import { BeamChat } from '@/components/beam-chat';
import { BeamLockScreen } from '@/components/beam-lock-screen';
import { useBeamUnlocked } from '@/lib/beam-lock';
import { goBack } from '@/lib/beam-nav';

export default function Chat() {
  const { u } = useLocalSearchParams<{ u: string }>();
  const unlocked = useBeamUnlocked();
  if (!unlocked) return <BeamLockScreen />;
  return <BeamChat username={String(u ?? '').toLowerCase()} onBack={goBack} />;
}
