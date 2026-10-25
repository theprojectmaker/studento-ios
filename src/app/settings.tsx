/** Settings: a short list. The many clock options live under "Clock screen". */
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { Divider, Note, Row, Screen, Section, ToggleRow } from '@/components/ui';
import { iconsSupported } from '@/lib/appIcon';
import { useTheme } from '@/lib/hooks';
import { getPermission, requestPermission, rescheduleAlerts, sendTestAlert, type Permission } from '@/lib/notify';
import { setPref, useStore } from '@/lib/store';
import { endLiveActivities, syncLiveActivity } from '@/widgets';

export default function Settings() {
  const prefs = useStore((s) => s.prefs);
  const personal = useStore((s) => s.personal);
  const account = useStore((s) => s.account);
  const school = useStore((s) => s.school);
  const bellSet = useStore((s) => s.bellSet);
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
      <Section title="Schedule">
        <Row label={school ? school.name : 'Pick your school'} sub={school ? (bellSet?.name ?? 'Bell schedule') : 'Search, pick a bell schedule, or add your school'} icon={{ name: 'building.columns.fill', color: '#ff9500' }} onPress={() => router.push('/school')} />
        <Divider />
        <Row label={personal ? personal.name : 'My classes'} sub={personal ? 'Scan again, type, or edit' : 'Scan or type your classes'} icon={{ name: 'calendar.badge.clock', color: '#34c759' }} onPress={() => router.push('/welcome')} />
        {personal ? (
          <>
            <Divider />
            <Row label="Edit my classes" icon={{ name: 'pencil', color: '#007aff' }} onPress={() => router.push({ pathname: '/schedule-review', params: { edit: '1' } })} />
          </>
        ) : null}
        <Divider />
        <Row label="Today and custom days" sub="Switch today's schedule, add an assembly or half day" icon={{ name: 'calendar', color: '#ff3b30' }} onPress={() => router.push('/schedules')} />
      </Section>

      <Section title="Look">
        <Row label="Theme" icon={{ name: 'paintpalette.fill', color: '#af52de' }} value={theme.name} onPress={() => router.push('/themes')} />
        <Divider />
        <Row label="Clock screen" sub="Layout, countdown, what shows, motion" icon={{ name: 'clock.fill', color: '#5856d6' }} onPress={() => router.push('/clock-options')} />
        {iconsSupported() ? (
          <>
            <Divider />
            <Row label="App icon" icon={{ name: 'app.fill', color: '#007aff' }} onPress={() => router.push('/app-icon')} />
          </>
        ) : null}
      </Section>

      <Section
        title="Alerts"
        footer={Platform.OS === 'web' ? 'Alerts work in the phone app, not in a browser.' : 'Set on this phone, so they work offline. The flash, voice and buzz happen at the 5-minute mark while the app is open.'}
      >
        {perm === 'granted' || Platform.OS === 'web' ? (
          <>
            <ToggleRow
              label="Bell alerts"
              sub="3 minutes into class and 5 minutes before the bell"
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
              sub="Live Activity for the current class"
              icon={{ name: 'lock.iphone', color: '#5856d6' }}
              value={prefs.liveActivity}
              onChange={(v) => {
                setPref('liveActivity', v);
                if (v) void syncLiveActivity();
                else void endLiveActivities();
              }}
            />
            <Divider />
            <ToggleRow label="Flash the screen" icon={{ name: 'bolt.fill', color: '#ffcc00' }} value={prefs.flashWarn} onChange={(v) => setPref('flashWarn', v)} />
            <Divider />
            <ToggleRow label="Announce out loud" sub="“Biology ends in five minutes. Next up, Lunch.”" icon={{ name: 'speaker.wave.2.fill', color: '#007aff' }} value={prefs.speak} onChange={(v) => setPref('speak', v)} />
            <Divider />
            <ToggleRow label="Buzz" icon={{ name: 'iphone.radiowaves.left.and.right', color: '#8e8e93' }} value={prefs.warnBuzz} onChange={(v) => setPref('warnBuzz', v)} />
            <Divider />
            <ToggleRow label="Blink in the last minute" icon={{ name: 'timer', color: '#ff3b30' }} value={prefs.blinkLast} onChange={(v) => setPref('blinkLast', v)} />
            <Divider />
            <Row label="Send a test alert" icon={{ name: 'paperplane.fill', color: '#007aff' }} onPress={async () => setMsg(await sendTestAlert())} />
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

      <Section title="Account" footer={account ? 'Your classes, school and settings save to this account.' : 'Optional. Saves your schedule across devices and turns on the schedule reader.'}>
        <Row
          label={account ? account.user.username : 'Sign in or create an account'}
          sub={account ? (account.user.admin ? 'Owner · admin' : 'Signed in') : 'Username and password, nothing else'}
          icon={{ name: 'person.crop.circle.fill', color: '#007aff' }}
          onPress={() => router.push('/account')}
        />
        {account?.user.admin ? (
          <>
            <Divider />
            <Row label="Admin" sub="Kill switches, shared schools and schedules" icon={{ name: 'wrench.and.screwdriver.fill', color: '#ff9500' }} onPress={() => router.push('/admin')} />
          </>
        ) : null}
      </Section>

      <Section title="More" footer="Lock mode hides every button so the clock can just sit there. Hold the red dot in the top-right corner for 2 seconds to unlock.">
        <Row label="Open the Hub" sub="Focus timer, this week, homework, notes, grades" icon={{ name: 'square.grid.2x2.fill', color: '#34c759' }} onPress={() => router.push('/hub')} />
        <Divider />
        <Row
          label="Lock the clock"
          icon={{ name: 'lock.fill', color: '#ff3b30' }}
          onPress={() => {
            setPref('locked', true);
            router.dismissAll();
            router.replace('/');
          }}
        />
        <Divider />
        <ToggleRow label="Pretend it's Period 3" sub="Try the countdown at any time of day" icon={{ name: 'testtube.2', color: '#30b0c7' }} value={prefs.testPeriod3} onChange={(v) => setPref('testPeriod3', v)} />
      </Section>

      <Note>Studento {Constants.expoConfig?.version ?? ''}</Note>
    </Screen>
  );
}
