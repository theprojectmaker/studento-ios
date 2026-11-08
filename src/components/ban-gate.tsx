/** A fully banned account sees only this screen; nothing else in the app works for it. */
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/hooks';
import { useMyBan } from '@/lib/my-ban';

export function BanGate() {
  const theme = useTheme();
  const ban = useMyBan();
  if (ban?.level !== 'full') return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20000, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }]} onStartShouldSetResponder={() => true}>
      <Text style={{ color: theme.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>{"Studento isn't available"}</Text>
      <Text style={{ color: theme.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>This account has been blocked by the admin.</Text>
      {ban.reason ? <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>{ban.reason}</Text> : null}
    </View>
  );
}
