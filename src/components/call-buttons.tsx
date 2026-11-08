/** Round audio / video call buttons, in the theme's accent. Line glyphs, no emoji. */
import { Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { alpha } from '@/lib/themes';

export function CallButtons({ onAudio, onVideo }: { onAudio: () => void; onVideo: () => void }) {
  const theme = useTheme();
  const box = sz(36);
  const style = ({ pressed }: { pressed: boolean }) => ({ width: box, height: box, borderRadius: box / 2, backgroundColor: alpha(theme.accent, pressed ? 0.32 : 0.16), alignItems: 'center' as const, justifyContent: 'center' as const });
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Audio call" onPress={onAudio} hitSlop={6} style={style}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 4h3l1.6 4-2 1.3a11 11 0 0 0 5.1 5.1l1.3-2L18 14v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2Z" />
        </Svg>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Video call" onPress={onVideo} hitSlop={6} style={style}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Rect x={2.5} y={6.5} width={13} height={11} rx={2.5} />
          <Path d="M15.5 10.5 21 7.5v9l-5.5-3" />
        </Svg>
      </Pressable>
    </View>
  );
}
