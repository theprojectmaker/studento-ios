/**
 * Customize mode for the clock (opened only from Settings > Customize clock
 * screen, so it can't happen by accident). Each removable piece gets a badge:
 * ⊖ hides it, ⊕ brings it back. Outside customize mode a hidden piece isn't rendered.
 */
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TYPE } from '@/lib/fonts';
import { sz } from '@/lib/scale';

import { tap } from './ui';

export function Editable({ editing, shown, label, onToggle, children }: { editing: boolean; shown: boolean; label: string; onToggle: () => void; children: ReactNode }) {
  if (!editing) return shown ? <>{children}</> : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${label}`}
      onPress={() => {
        tap();
        onToggle();
      }}
      style={({ pressed }) => ({ alignSelf: 'stretch', alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ alignSelf: 'stretch', alignItems: 'center', opacity: shown ? 1 : 0.3 }}>
        <View pointerEvents="none" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          {children}
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          top: -10,
          left: 0,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: shown ? '#ff3b30' : '#34c759',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.9)',
        }}>
        <Text style={{ ...TYPE.heavy, color: '#ffffff', fontSize: sz(16), lineHeight: sz(18) }}>{shown ? '−' : '+'}</Text>
      </View>
    </Pressable>
  );
}
