/**
 * Race Track board: just the countdown, big and bold, so it sits in the infield of the
 * raceway image. The car and the lap trail live in RacewayBackdrop, mapped onto the image's
 * own lane, so there is no second oval on screen.
 */
import { Text, View } from 'react-native';

import { TYPE } from '@/lib/fonts';

import type { BoardProps } from './boards';

export function RaceBoard({ text, theme, width, maxSize }: BoardProps) {
  const digits = Math.min(maxSize, width / 3.4);
  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center', paddingVertical: digits * 0.1 }} accessibilityLabel={text}>
      <Text
        allowFontScaling={false}
        style={{
          ...TYPE.heavy,
          fontSize: digits,
          lineHeight: digits * 1.1,
          letterSpacing: -digits * 0.03,
          color: theme.ink,
          fontVariant: ['tabular-nums'],
          textShadowColor: 'rgba(0,0,0,0.45)',
          textShadowRadius: digits * 0.08,
          textShadowOffset: { width: 0, height: digits * 0.02 },
        }}>
        {text}
      </Text>
    </View>
  );
}
