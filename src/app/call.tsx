/** A Beam call (beta), full screen. The call itself runs in the hosted call page; this screen hands it the token and theme. */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { CallFrame } from '@/components/call-frame';
import { getToken } from '@/lib/account';
import { API_BASE } from '@/lib/api';
import { setInCall } from '@/lib/calls';
import { useTheme } from '@/lib/hooks';

export default function Call() {
  const theme = useTheme();
  const { id, role, video, peer } = useLocalSearchParams<{ id: string; role: string; video: string; peer: string }>();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setInCall(true);
    void getToken().then((t) => {
      const p = new URLSearchParams({ token: t ?? '', call: String(id ?? ''), role: role === 'callee' ? 'callee' : 'caller', video: video === '1' ? '1' : '0', peer: String(peer ?? ''), bg: theme.bg, ink: theme.ink, accent: theme.accent, api: API_BASE });
      setUrl(`${API_BASE}/call#${p.toString()}`);
    });
    return () => setInCall(false);
  }, [id, role, video, peer, theme.bg, theme.ink, theme.accent]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#000' }}>{url ? <CallFrame url={url} onClose={close} /> : null}</View>;
}
