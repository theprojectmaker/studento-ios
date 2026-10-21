import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';

import { Button, Divider, Note, Row, Screen, Section, Segmented, ToggleRow } from '@/components/ui';
import { iconsSupported } from '@/lib/appIcon';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { getPermission, requestPermission, rescheduleAlerts, sendTestAlert, type Permission } from '@/lib/notify';
import { refresh, setPref, useStore } from '@/lib/store';
import { endLiveActivities, syncLiveActivity } from '@/widgets';

export default function Settings() {
  const prefs = useStore((s) => s.prefs);
  const personal = useStore((s) => s.personal);
  const sync = useStore((s) => s.sync);
  const theme = useTheme();
  const [perm, setPerm] = useState<Permission | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getPermission().then(setPerm);
    }, [])
  );

  const replan = async () => setScheduled(await rescheduleAlerts());

  return (
    <Screen>
      <Section title="Look">
        {iconsSupported() ? (
          <>
            <Row label="App icon" sub="Change the icon on your home screen" icon={{ name: 'app.fill', color: '#007aff' }} onPress={() => router.push('/app-icon')} />
            <Divider />
          </>
        ) : null}
        <Row label="Theme"
              icon={{ name: 'paintpalette.fill', color: '#af52de' }} value={theme.name} onPress={() => router.push('/themes')} />
        <Divider />
        <Row
          label="Customize clock screen"
          sub="Hide or show parts of the clock screen"
          icon={{ name: 'square.grid.2x2.fill', color: '#5856d6' }}
          onPress={() => router.navigate({ pathname: '/', params: { edit: String(Date.now()) } })}
        />
        <Divider />
        <ToggleRow label="Show seconds"
              icon={{ name: 'stopwatch.fill', color: '#8e8e93' }} value={prefs.seconds} onChange={(v) => setPref('seconds', v)} />
        <Divider />
        <View style={{ padding: 12, gap: 8 }}>
          <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.ink }}>Sub-second readout</Text>
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
          <Text style={{ ...TYPE.regular, fontSize: 13, color: theme.muted }}>Milliseconds next to the clock and under the countdown.</Text>
        </View>
        <Divider />
        <View style={{ padding: 12, gap: 8 }}>
          <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.ink }}>Countdown size</Text>
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
        <ToggleRow label="24-hour time"
              icon={{ name: 'clock.fill', color: '#8e8e93' }} value={prefs.h24} onChange={(v) => setPref('h24', v)} />
        <Divider />
        <ToggleRow label="Keep screen on"
              icon={{ name: 'sun.max.fill', color: '#ffcc00' }} sub="While the clock is open" value={prefs.keepAwake} onChange={(v) => setPref('keepAwake', v)} />
        <Divider />
        <ToggleRow label="Haptics"
              icon={{ name: 'iphone.radiowaves.left.and.right', color: '#8e8e93' }} value={prefs.haptics} onChange={(v) => setPref('haptics', v)} />
      </Section>

      <Section title="On the clock screen" footer="The same options as the Studento website.">
        <ToggleRow label="Focus mode" sub="Just the class and the countdown" icon={{ name: 'scope', color: '#ff3b30' }} value={prefs.focus} onChange={(v) => setPref('focus', v)} />
        <Divider />
        <ToggleRow label="Show the period number" sub="Now · Period 3" icon={{ name: 'number', color: '#007aff' }} value={prefs.periodNum} onChange={(v) => setPref('periodNum', v)} />
        <Divider />
        <ToggleRow label="Show when it ends" sub="left · ends 1:52 PM" icon={{ name: 'clock.badge.checkmark', color: '#34c759' }} value={prefs.endTime} onChange={(v) => setPref('endTime', v)} />
        <Divider />
        <ToggleRow label="Show today's date" icon={{ name: 'calendar', color: '#ff9500' }} value={prefs.showDate} onChange={(v) => setPref('showDate', v)} />
        <Divider />
        <ToggleRow label="Dim at night" sub="Softens the screen from 9 PM to 6 AM" icon={{ name: 'moon.fill', color: '#5856d6' }} value={prefs.night} onChange={(v) => setPref('night', v)} />
        <Divider />
        <ToggleRow label="Burn-in protection" sub="Nudges the clock a few pixels every minute" icon={{ name: 'rectangle.dashed', color: '#8e8e93' }} value={prefs.burnin} onChange={(v) => setPref('burnin', v)} />
        <Divider />
        <ToggleRow label="New theme every period" icon={{ name: 'shuffle', color: '#af52de' }} value={prefs.shuffle} onChange={(v) => setPref('shuffle', v)} />
        <Divider />
        <ToggleRow label="New theme every day" icon={{ name: 'sparkles', color: '#ff2d55' }} value={prefs.daily} onChange={(v) => setPref('daily', v)} />
      </Section>

      <Section title="Warnings while open" footer="Happens at the 5-minute warning while the app is open. Bell alerts are separate.">
        <ToggleRow label="Flash the screen" icon={{ name: 'bolt.fill', color: '#ffcc00' }} value={prefs.flashWarn} onChange={(v) => setPref('flashWarn', v)} />
        <Divider />
        <ToggleRow label="Announce out loud" sub="“Biology ends in five minutes. Next up, Lunch.”" icon={{ name: 'speaker.wave.2.fill', color: '#007aff' }} value={prefs.speak} onChange={(v) => setPref('speak', v)} />
        <Divider />
        <ToggleRow label="Buzz" icon={{ name: 'iphone.radiowaves.left.and.right', color: '#8e8e93' }} value={prefs.warnBuzz} onChange={(v) => setPref('warnBuzz', v)} />
        <Divider />
        <ToggleRow label="Blink the countdown in the last minute" icon={{ name: 'timer', color: '#ff3b30' }} value={prefs.blinkLast} onChange={(v) => setPref('blinkLast', v)} />
      </Section>

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
      </Section>

      <Section title="Motion" footer="Live effects are the falling snow, petals, stars and so on that some themes have.">
        <ToggleRow
          label="Animations & live effects"
          icon={{ name: 'sparkles', color: '#ff2d55' }}
          value={prefs.motion}
          onChange={(v) => setPref('motion', v)}
        />
      </Section>

      <Section
        title="Bell alerts"
        footer={
          Platform.OS === 'web'
            ? 'Alerts work in the phone app, not in a browser.'
            : 'Set on this phone, so they work offline. Studento plans a few school days ahead and tops up every time you open it.'
        }>
        {perm === 'granted' || Platform.OS === 'web' ? (
          <>
            <ToggleRow
              label="Bell alerts"
              icon={{ name: 'bell.fill', color: '#ff3b30' }}
              value={prefs.alerts}
              onChange={(v) => {
                setPref('alerts', v);
                void replan();
              }}
            />
            <Divider />
            <ToggleRow
              label="Welcome to class"
              icon={{ name: 'hand.wave.fill', color: '#34c759' }}
              sub="3 minutes after each period starts"
              value={prefs.welcome}
              disabled={!prefs.alerts}
              onChange={(v) => {
                setPref('welcome', v);
                void replan();
              }}
            />
            <Divider />
            <ToggleRow
              label="5-minute warning"
              icon={{ name: 'timer', color: '#ff9500' }}
              sub="5 minutes before each period ends"
              value={prefs.endWarning}
              disabled={!prefs.alerts}
              onChange={(v) => {
                setPref('endWarning', v);
                void replan();
              }}
            />
            <Divider />
            <ToggleRow
              label="Lock Screen countdown"
              sub="Live Activity for the current class (installed app, not Expo Go)"
              icon={{ name: 'lock.iphone', color: '#5856d6' }}
              value={prefs.liveActivity}
              onChange={(v) => {
                setPref('liveActivity', v);
                if (v) void syncLiveActivity();
                else void endLiveActivities();
              }}
            />
            <Divider />
            <Row label="Send a test alert"
              icon={{ name: 'paperplane.fill', color: '#007aff' }} onPress={async () => setMsg(await sendTestAlert())} />
          </>
        ) : perm === 'denied' ? (
          <Row label="Notifications are off for Studento" sub="Turn them on in the Settings app" onPress={() => void Linking.openSettings()} />
        ) : (
          <Row
            label="Turn on bell alerts"
              icon={{ name: 'bell.badge.fill', color: '#ff3b30' }}
            sub="3 min into class and 5 min before the bell"
            onPress={async () => {
              const p = await requestPermission();
              setPerm(p);
              setPref('alertsAsked', true);
              if (p === 'granted') void replan();
            }}
          />
        )}
      </Section>
      {msg ? <Note tone="ok">{msg}</Note> : null}
      {scheduled != null && perm === 'granted' ? <Note>{scheduled} alerts are set on this phone.</Note> : null}

      <Section title="My schedule" footer={personal ? 'Your own schedule, kept on this phone.' : 'The shared Great Neck schedule. Scan or type your own to switch.'}>
        <Row
          label={personal ? personal.name : 'Great Neck North (default)'}
          sub="Change: scan, type, or use the default"
          icon={{ name: 'calendar.badge.clock', color: '#34c759' }}
          onPress={() => router.push('/welcome')}
        />
        {personal ? (
          <>
            <Divider />
            <Row label="Edit my schedule" icon={{ name: 'pencil', color: '#007aff' }} onPress={() => router.push({ pathname: '/schedule-review', params: { edit: '1' } })} />
          </>
        ) : null}
      </Section>

      <Section title="Shared schedule" footer="Shared with every device that uses the default schedule.">
        <Row label="My classes"
              icon={{ name: 'book.fill', color: '#ff9500' }} sub="Names, rooms and notes" onPress={() => router.push('/classes')} />
        <Divider />
        <Row label="Schedules"
              icon={{ name: 'calendar', color: '#ff3b30' }} sub="Today's schedule and custom days" onPress={() => router.push('/schedules')} />
      </Section>

      <Section title="Tools" footer="Focus timer, this week, homework, countdowns, notes and grades all live in the Hub (bottom-left button on the clock).">
        <Row label="Open the Hub" icon={{ name: 'square.grid.2x2.fill', color: '#34c759' }} onPress={() => router.push('/hub')} />
      </Section>

      <Section title="Sync">
        <Row
          label={sync.status === 'syncing' ? 'Syncing…' : sync.status === 'offline' ? 'Offline' : 'Up to date'}
          sub={sync.at ? `Last synced ${new Date(sync.at).toLocaleString()}` : sync.error ?? 'Not synced yet'}
        />
      </Section>
      <Button title="Sync now" kind="plain" onPress={() => void refresh()} />

      <Section title="Test" footer="Shows the clock as if it's the middle of Period 3 on a school day, so you can try the app anytime. Bell alerts still use the real time.">
        <ToggleRow
          label="Pretend it's Period 3"
          icon={{ name: 'testtube.2', color: '#30b0c7' }}
          value={prefs.testPeriod3}
          onChange={(v) => setPref('testPeriod3', v)}
        />
      </Section>

      <Note>Studento {Constants.expoConfig?.version ?? ''}</Note>
    </Screen>
  );
}
