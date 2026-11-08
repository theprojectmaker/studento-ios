/** One Beam conversation, full screen (phones, or a link from a notification). */
import { router, useLocalSearchParams } from 'expo-router';

import { BeamChat } from '@/components/beam-chat';

export default function Chat() {
  const { u } = useLocalSearchParams<{ u: string }>();
  return <BeamChat username={String(u ?? '').toLowerCase()} onBack={() => router.back()} />;
}
