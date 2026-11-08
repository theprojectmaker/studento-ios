/**
 * Incoming Beam call banner. Polls while the app is open, only for signed-in users who
 * unlocked Beam. Accept opens the call screen; Decline tells the caller.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { isInCall } from '@/lib/calls';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';

export function IncomingCall() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const on = useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
  const [call, setCall] = useState<{ id: number; video: boolean; peer: string } | null>(null);

  useEffect(() => {
    if (!account || !on) return;
    let dead = false;
    const check = async () => {
      if (isInCall() || AppState.currentState !== 'active') return;
      const t = await getToken();
      if (!t) return;
      try {
        const c = await api.incomingCall(t);
        if (!dead) setCall(c);
      } catch {}
    };
    void check();
    const id = setInterval(() => void check(), 4000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [account, on]);

  if (!call) return null;
  const answer = async () => {
    const c = call;
    setCall(null);
    const t = await getToken();
    if (!t) return;
    try {
      await api.callAction(t, c.id, 'answer');
      router.push({ pathname: '/call', params: { id: String(c.id), role: 'callee', video: c.video ? '1' : '0', peer: c.peer } });
    } catch {}
  };
  const decline = async () => {
    const c = call;
    setCall(null);
    const t = await getToken();
    if (t) void api.callAction(t, c.id, 'decline').catch(() => {});
  };

  return (
    <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(160)} style={{ position: 'absolute', left: 12, right: 12, top: insets.top + 8, alignItems: 'center', zIndex: 1000 }}>
      <View style={{ width: '100%', maxWidth: sz(520), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: sz(20), backgroundColor: '#1c1c1e', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <View style={{ width: sz(44), height: sz(44), borderRadius: sz(22), backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(20), color: readableOn(theme.accent) }}>{call.peer.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.bold, fontSize: sz(16), color: '#ffffff' }} numberOfLines={1}>
            {call.peer}
          </Text>
          <Text style={{ ...TYPE.regular, fontSize: sz(13), color: alpha('#ffffff', 0.6) }}>{call.video ? 'Beam video call' : 'Beam audio call'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Decline" onPress={() => void decline()} style={{ width: sz(44), height: sz(44), borderRadius: sz(22), backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(18), color: '#fff' }}>✕</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Accept" onPress={() => void answer()} style={{ width: sz(44), height: sz(44), borderRadius: sz(22), backgroundColor: '#34c759', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(18), color: '#fff' }}>✓</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
