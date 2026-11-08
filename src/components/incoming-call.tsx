/**
 * Invite-only chat and calls, in the background of the app: a small notification-style card
 * when someone calls (answer / decline), and "N new messages in inbox" alerts. Only runs for
 * signed-in users who entered the code; otherwise it renders nothing and makes no requests.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { isInCall } from '@/lib/calls';
import { TYPE } from '@/lib/fonts';
import { fbDb, currentUser } from '@/lib/fb';
import { notifyUnread } from '@/lib/inbox';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';

export function IncomingCall() {
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const on = useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
  const [call, setCall] = useState<{ id: number; video: boolean; peer: string } | null>(null);

  useEffect(() => {
    if (!account || !on) return;
    let dead = false;
    const stops: (() => void)[] = [];
    let expire: ReturnType<typeof setTimeout> | undefined;
    // Live Firestore listeners: a ringing call addressed to me, and my chats' unread counts.
    // One read per change instead of polling, and it all goes over googleapis.com.
    void currentUser().then((u) => {
      if (!u || dead) return;
      const db = fbDb();
      stops.push(
        onSnapshot(
          query(collection(db, 'calls'), where('to', '==', u.uid), where('status', '==', 'ringing')),
          (snap) => {
            const c = snap.docs
              .map((d) => ({ id: Number(d.id), d: d.data() as api.CallDoc }))
              .filter((x) => Date.now() - x.d.createdAt < 40_000)
              .sort((x, y) => y.d.createdAt - x.d.createdAt)[0];
            clearTimeout(expire);
            if (!c || isInCall()) return setCall(null);
            setCall({ id: c.id, video: c.d.video, peer: c.d.fromName });
            expire = setTimeout(() => setCall(null), Math.max(0, 40_000 - (Date.now() - c.d.createdAt)));
          },
          () => {}
        )
      );
      stops.push(
        onSnapshot(
          query(collection(db, 'chats'), where('members', 'array-contains', u.uid)),
          (snap) => {
            const total = snap.docs.reduce((n, d) => n + Number((d.data().unread as Record<string, number> | undefined)?.[u.uid] ?? 0), 0);
            void notifyUnread(total).catch(() => {});
          },
          () => {}
        )
      );
    });
    return () => {
      dead = true;
      clearTimeout(expire);
      stops.forEach((f) => f());
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

  const pill = (bg: string, label: string, d: string, fn: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={fn} hitSlop={6} style={{ width: sz(32), height: sz(32), borderRadius: sz(16), backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="#fff">
        <Path d={d} />
      </Svg>
    </Pressable>
  );
  const phone = 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z';
  return (
    <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(140)} style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 6, alignItems: 'center', zIndex: 1000 }}>
      <View style={{ width: '100%', maxWidth: sz(420), flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, borderRadius: sz(16), backgroundColor: 'rgba(30,30,32,0.96)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(11), letterSpacing: 0.4, color: alpha('#ffffff', 0.55) }}>STUDENTO · NOW</Text>
          <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: '#ffffff' }} numberOfLines={1}>
            {`${call.peer} is calling${call.video ? ' (video)' : ''}`}
          </Text>
        </View>
        {pill('#ff3b30', 'Decline', phone, () => void decline())}
        {pill('#34c759', 'Answer', phone, () => void answer())}
      </View>
    </Animated.View>
  );
}
