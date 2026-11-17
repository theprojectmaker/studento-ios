/** A fully banned account sees only this screen; nothing else in the app works for it. */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { watchFlags } from '@/lib/beam-extra';
import { useStore } from '@/lib/store';

import { useTheme } from '@/lib/hooks';
import { useMyBan } from '@/lib/my-ban';

/** Maintenance mode: everyone but admins sees a "be right back" screen. */
export function MaintenanceGate() {
  const theme = useTheme();
  const admin = useStore((s) => !!s.account?.user.admin);
  const [f, setF] = useState<Record<string, unknown>>({});
  useEffect(() => watchFlags((x) => setF(x)), []);
  if (admin || f.maintenance !== true) return null;
  const text = typeof f.maintenanceMsg === 'string' && f.maintenanceMsg.trim() ? f.maintenanceMsg : 'Studento is getting an update. Check back soon.';
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 19999, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }]} onStartShouldSetResponder={() => true}>
      <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>Be right back</Text>
      <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

export function BanGate() {
  const theme = useTheme();
  const ban = useMyBan();
  if (ban?.level !== 'full') return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20000, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }]} onStartShouldSetResponder={() => true}>
      <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>{"Studento isn't available"}</Text>
      <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>This account has been blocked by the admin.</Text>
      {ban.until ? <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>Until {new Date(ban.until).toLocaleString()}</Text> : null}
      {ban.reason ? <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>{ban.reason}</Text> : null}
    </View>
  );
}
