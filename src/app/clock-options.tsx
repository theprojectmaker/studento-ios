/** Settings > Clock screen: everything about how the clock looks and behaves, in one place. */
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Divider, Row, Screen, Section, Segmented, ToggleRow } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { setPref, useStore } from '@/lib/store';
import { sz } from '@/lib/scale';

export default function ClockOptions() {
  const prefs = useStore((s) => s.prefs);
  const theme = useTheme();
  return (
    <Screen>
      <Section title="Layout">
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
        <Row label="Choose what shows" sub="Hide or show parts of the clock screen" icon={{ name: 'square.grid.2x2.fill', color: '#5856d6' }} onPress={() => router.navigate({ pathname: '/', params: { edit: String(Date.now()) } })} />
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
        <ToggleRow label="Tap the countdown to switch" sub="Seconds or whole minutes" icon={{ name: 'hand.tap.fill', color: '#30b0c7' }} value={prefs.tapToggle} onChange={(v) => setPref('tapToggle', v)} />
        <Divider />
        <View style={{ padding: 12, gap: 8 }}>
          <Text style={{ ...TYPE.medium, fontSize: sz(15), color: theme.ink }}>Sub-second readout</Text>
          <Segmented
            value={prefs.millis}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'tenths', label: '.1' },
              { value: 'centis', label: '.01' },
              { value: 'millis', label: '.001' },
            ]}
            onChange={(v) => setPref('millis', v)}
          />
        </View>
        <Divider />
        <ToggleRow label="Show the period number" sub="Now · Period 3" icon={{ name: 'number', color: '#007aff' }} value={prefs.periodNum} onChange={(v) => setPref('periodNum', v)} />
        <Divider />
        <ToggleRow label="Show when it ends" sub="left · ends 1:52 PM" icon={{ name: 'clock.badge.checkmark', color: '#34c759' }} value={prefs.endTime} onChange={(v) => setPref('endTime', v)} />
        <Divider />
        <ToggleRow label="Show today's date" icon={{ name: 'calendar', color: '#ff9500' }} value={prefs.showDate} onChange={(v) => setPref('showDate', v)} />
        <Divider />
        <ToggleRow label="24-hour time" icon={{ name: 'clock.fill', color: '#8e8e93' }} value={prefs.h24} onChange={(v) => setPref('h24', v)} />
      </Section>

      <Section title="Screen" footer="Focus mode shows just the class and the countdown.">
        <ToggleRow label="Focus mode" icon={{ name: 'scope', color: '#ff3b30' }} value={prefs.focus} onChange={(v) => setPref('focus', v)} />
        <Divider />
        <ToggleRow label="Keep screen on" sub="While the clock is open" icon={{ name: 'sun.max.fill', color: '#ffcc00' }} value={prefs.keepAwake} onChange={(v) => setPref('keepAwake', v)} />
        <Divider />
        <ToggleRow label="Always show the corner buttons" icon={{ name: 'square.grid.2x2', color: '#5856d6' }} value={prefs.corners} onChange={(v) => setPref('corners', v)} />
        <Divider />
        <ToggleRow label="Dim when idle" sub="Softens a little after 15 seconds without a touch" icon={{ name: 'circle.lefthalf.filled', color: '#8e8e93' }} value={prefs.idleDim} onChange={(v) => setPref('idleDim', v)} />
        <Divider />
        <ToggleRow label="Dim at night" sub="9 PM to 6 AM" icon={{ name: 'moon.fill', color: '#5856d6' }} value={prefs.night} onChange={(v) => setPref('night', v)} />
        <Divider />
        <ToggleRow label="Burn-in protection" sub="Nudges the clock a few pixels every minute" icon={{ name: 'rectangle.dashed', color: '#8e8e93' }} value={prefs.burnin} onChange={(v) => setPref('burnin', v)} />
      </Section>

      <Section title="Motion" footer="Live effects are the snow, petals, stars and so on that some themes have. Off = nothing moves except the numbers.">
        <ToggleRow label="Animations & live effects" icon={{ name: 'sparkles', color: '#ff2d55' }} value={prefs.motion} onChange={(v) => setPref('motion', v)} />
        <Divider />
        <ToggleRow label="Haptics" icon={{ name: 'iphone.radiowaves.left.and.right', color: '#8e8e93' }} value={prefs.haptics} onChange={(v) => setPref('haptics', v)} />
      </Section>

      <Section title="Themes" footer="Pick a fresh random theme by itself.">
        <ToggleRow label="New theme every period" icon={{ name: 'shuffle', color: '#af52de' }} value={prefs.shuffle} onChange={(v) => setPref('shuffle', v)} />
        <Divider />
        <ToggleRow label="New theme every day" icon={{ name: 'sparkles', color: '#ff2d55' }} value={prefs.daily} onChange={(v) => setPref('daily', v)} />
      </Section>
    </Screen>
  );
}
