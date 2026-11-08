/** Settings > Clock screen: the few choices that change what you see. Advanced toggles live under "More options". */
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Divider, Row, Screen, Section, Segmented, ToggleRow } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { setPref, useStore } from '@/lib/store';
import { sz } from '@/lib/scale';

export default function ClockOptions() {
  const prefs = useStore((s) => s.prefs);
  const theme = useTheme();
  const [more, setMore] = useState(false);
  return (
    <Screen>
      <Section title="Layout" footer="Classic is the full screen. Minimal is just the numbers. Cards puts everything in panels.">
        <View style={{ padding: 12 }}>
          <Segmented
            value={prefs.layout}
            options={[
              { value: 'classic', label: 'Classic' },
              { value: 'minimal', label: 'Minimal' },
              { value: 'glass', label: 'Cards' },
            ]}
            onChange={(v) => setPref('layout', v)}
          />
        </View>
        <Divider />
        <Row label="Choose what shows" sub="Tap parts of the clock to hide or show them" icon={{ name: 'square.grid.2x2.fill', color: '#5856d6' }} onPress={() => router.navigate({ pathname: '/', params: { edit: String(Date.now()) } })} />
      </Section>

      <Section title="Countdown">
        <View style={{ padding: 12, gap: 8 }}>
          <Text style={{ ...TYPE.medium, fontSize: sz(15), color: theme.ink }}>Size</Text>
          <Segmented
            value={prefs.digitSize}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
            ]}
            onChange={(v) => setPref('digitSize', v)}
          />
        </View>
        <Divider />
        <ToggleRow label="Show seconds" icon={{ name: 'stopwatch.fill', color: '#8e8e93' }} value={prefs.seconds} onChange={(v) => setPref('seconds', v)} />
        <Divider />
        <ToggleRow label="Show the period number" sub="Now · Period 3" icon={{ name: 'number', color: '#007aff' }} value={prefs.periodNum} onChange={(v) => setPref('periodNum', v)} />
        <Divider />
        <ToggleRow label="Show when it ends" sub="left · ends 1:52 PM" icon={{ name: 'clock.badge.checkmark', color: '#34c759' }} value={prefs.endTime} onChange={(v) => setPref('endTime', v)} />
        <Divider />
        <ToggleRow label="Show today's date" icon={{ name: 'calendar', color: '#ff9500' }} value={prefs.showDate} onChange={(v) => setPref('showDate', v)} />
        <Divider />
        <ToggleRow label="24-hour time" icon={{ name: 'clock.fill', color: '#8e8e93' }} value={prefs.h24} onChange={(v) => setPref('h24', v)} />
      </Section>

      <Section title="Screen">
        <ToggleRow label="Keep screen on" sub="While the clock is open" icon={{ name: 'sun.max.fill', color: '#ffcc00' }} value={prefs.keepAwake} onChange={(v) => setPref('keepAwake', v)} />
        <Divider />
        <ToggleRow label="Dim at night" sub="9 PM to 6 AM" icon={{ name: 'moon.fill', color: '#5856d6' }} value={prefs.night} onChange={(v) => setPref('night', v)} />
        <Divider />
        <ToggleRow label="Animations" sub="Flips, rolls and the live effects some themes have" icon={{ name: 'sparkles', color: '#ff2d55' }} value={prefs.motion} onChange={(v) => setPref('motion', v)} />
      </Section>

      <Section footer={more ? 'These are rarely needed. Each one is off unless you turned it on.' : undefined}>
        <Row label={more ? 'Hide more options' : 'More options'} sub={more ? undefined : 'Focus view, dimming, burn-in, haptics, theme shuffle'} icon={{ name: 'ellipsis.circle.fill', color: '#8e8e93' }} onPress={() => setMore((m) => !m)} />
        {more ? (
          <>
            <Divider />
            <ToggleRow label="Focus view" sub="Just the class and the countdown" icon={{ name: 'scope', color: '#ff3b30' }} value={prefs.focus} onChange={(v) => setPref('focus', v)} />
            <Divider />
            <ToggleRow label="Tap the countdown to switch" sub="Between seconds and whole minutes" icon={{ name: 'hand.tap.fill', color: '#30b0c7' }} value={prefs.tapToggle} onChange={(v) => setPref('tapToggle', v)} />
            <Divider />
            <ToggleRow label="Always show the corner buttons" icon={{ name: 'square.grid.2x2', color: '#5856d6' }} value={prefs.corners} onChange={(v) => setPref('corners', v)} />
            <Divider />
            <ToggleRow label="Dim when idle" sub="After 15 seconds without a touch" icon={{ name: 'circle.lefthalf.filled', color: '#8e8e93' }} value={prefs.idleDim} onChange={(v) => setPref('idleDim', v)} />
            <Divider />
            <ToggleRow label="Burn-in protection" sub="Nudges the clock a few pixels every minute" icon={{ name: 'rectangle.dashed', color: '#8e8e93' }} value={prefs.burnin} onChange={(v) => setPref('burnin', v)} />
            <Divider />
            <ToggleRow label="Haptics" icon={{ name: 'iphone.radiowaves.left.and.right', color: '#8e8e93' }} value={prefs.haptics} onChange={(v) => setPref('haptics', v)} />
            <Divider />
            <ToggleRow label="New theme every day" icon={{ name: 'shuffle', color: '#af52de' }} value={prefs.daily} onChange={(v) => setPref('daily', v)} />
          </>
        ) : null}
      </Section>
    </Screen>
  );
}
