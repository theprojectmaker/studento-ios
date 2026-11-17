/**
 * Settings, in Apple-style groups: Schedule, Look, Clock, Bell alerts, On the clock screen,
 * Display, Lock, Fun, Account, More. Layout options live under "Clock screen".
 */
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';

import { VOICES } from '@/components/clock-extras';
import { Divider, Note, Row, Screen, Section, Segmented, ToggleRow } from '@/components/ui';
import { iconsSupported } from '@/lib/appIcon';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { getPermission, requestPermission, rescheduleAlerts, sendTestAlert, type Permission } from '@/lib/notify';
import { sz } from '@/lib/scale';
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
  const nightKey = `${prefs.nightFrom}-${prefs.nightTo}` as '20-6' | '21-6' | '22-7' | '23-7';
  const pick = (label: string, control: React.ReactNode) => (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      <Text style={{ ...TYPE.medium, fontSize: sz(15), color: theme.ink }}>{label}</Text>
      {control}
    </View>
  );

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

      <Section title="Clock">
        <ToggleRow label="24-hour time" icon={{ name: 'clock.fill', color: '#8e8e93' }} value={prefs.h24} onChange={(v) => setPref('h24', v)} />
        <Divider />
        <ToggleRow label="Show seconds" sub="Off shows whole minutes, like 0:42" icon={{ name: 'stopwatch.fill', color: '#ff9500' }} value={prefs.seconds} onChange={(v) => setPref('seconds', v)} />
        <Divider />
        {pick(
          'Countdown shows',
          <Segmented
            value={prefs.countMode}
            options={[
              { value: 'left', label: 'Time left' },
              { value: 'elapsed', label: 'Time so far' },
            ]}
            onChange={(v) => setPref('countMode', v)}
          />
        )}
        <Divider />
        <ToggleRow label="Haptics" sub="Light taps on buttons and switches" icon={{ name: 'hand.tap.fill', color: '#30b0c7' }} value={prefs.haptics} onChange={(v) => setPref('haptics', v)} />
      </Section>

      <Section
        title="Bell alerts"
        footer={Platform.OS === 'web' ? 'Alerts work in the phone app, not in a browser.' : 'Set on this phone, so they work offline. The flash, voice and buzz happen at the 5-minute mark while the app is open.'}
      >
        {perm === 'granted' || Platform.OS === 'web' ? (
          <>
            <ToggleRow
              label="Bell alerts"
              sub={`3 minutes into class and ${prefs.warnMin ?? 5} minutes before the bell`}
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
              label={`${prefs.warnMin ?? 5}-minute warning`}
              icon={{ name: 'timer', color: '#ff9500' }}
              value={prefs.endWarning}
              disabled={!prefs.alerts}
              onChange={(v) => {
                setPref('endWarning', v);
                void replan();
              }}
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 }}>
              <Segmented
                value={String(prefs.warnMin ?? 5) as '2' | '3' | '5' | '10'}
                options={[
                  { value: '2', label: '2 min' },
                  { value: '3', label: '3 min' },
                  { value: '5', label: '5 min' },
                  { value: '10', label: '10 min' },
                ]}
                onChange={(v) => {
                  setPref('warnMin', Number(v));
                  void replan();
                }}
              />
            </View>
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

      <Section title="On the clock screen" footer={`These happen while Studento is open, at the ${prefs.warnMin ?? 5}-minute mark.`}>
        <ToggleRow label="Flash the screen" icon={{ name: 'bolt.fill', color: '#ffcc00' }} value={prefs.flashWarn} onChange={(v) => setPref('flashWarn', v)} />
        <Divider />
        <ToggleRow label="Buzz" icon={{ name: 'iphone.radiowaves.left.and.right', color: '#8e8e93' }} value={prefs.warnBuzz} onChange={(v) => setPref('warnBuzz', v)} />
        <Divider />
        <ToggleRow label="Announce out loud" sub="“Biology ends in five minutes. Next up, Lunch.”" icon={{ name: 'speaker.wave.2.fill', color: '#007aff' }} value={prefs.speak} onChange={(v) => setPref('speak', v)} />
        {prefs.speak
          ? pick(
              'Voice',
              <Segmented
                value={prefs.voice}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'robot', label: 'Robot' },
                  { value: 'chipmunk', label: 'Chipmunk' },
                  { value: 'deep', label: 'Deep' },
                ]}
                onChange={(v) => {
                  setPref('voice', v);
                  void import('expo-speech').then((Speech) => {
                    void Speech.stop();
                    Speech.speak('Biology ends in five minutes.', VOICES[v]);
                  });
                }}
              />
            )
          : null}
        <Divider />
        <ToggleRow label="Warn again at 1 minute" icon={{ name: 'timer', color: '#ff9500' }} value={prefs.warn1} onChange={(v) => setPref('warn1', v)} />
        <Divider />
        <ToggleRow label="Blink in the last minute" icon={{ name: 'timer', color: '#ff3b30' }} value={prefs.blinkLast} onChange={(v) => setPref('blinkLast', v)} />
        <Divider />
        <ToggleRow label="Tick the last 10 seconds" sub="A light tap each second before the bell" icon={{ name: 'metronome.fill', color: '#5856d6' }} value={prefs.finalTicks} onChange={(v) => setPref('finalTicks', v)} />
      </Section>

      <Section title="Display" footer={prefs.night ? 'Darkens the clock on this schedule so it is easy on the eyes at night.' : undefined}>
        <ToggleRow label="Keep screen on" sub="While the clock is open" icon={{ name: 'sun.max.fill', color: '#ffcc00' }} value={prefs.keepAwake} onChange={(v) => setPref('keepAwake', v)} />
        <Divider />
        <ToggleRow label="Auto-dim" icon={{ name: 'moon.fill', color: '#5856d6' }} value={prefs.night} onChange={(v) => setPref('night', v)} />
        {prefs.night ? (
          <>
            {pick(
              'When',
              <Segmented
                value={nightKey}
                options={[
                  { value: '20-6', label: '8P–6A' },
                  { value: '21-6', label: '9P–6A' },
                  { value: '22-7', label: '10P–7A' },
                  { value: '23-7', label: '11P–7A' },
                ]}
                onChange={(v) => {
                  const [from, to] = v.split('-').map(Number);
                  setPref('nightFrom', from);
                  setPref('nightTo', to);
                }}
              />
            )}
            {pick(
              'How dark',
              <Segmented
                value={prefs.nightLevel}
                options={[
                  { value: 'light', label: 'A little' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'dark', label: 'A lot' },
                ]}
                onChange={(v) => setPref('nightLevel', v)}
              />
            )}
          </>
        ) : null}
      </Section>

      <Section title="Lock" footer="Lock mode hides every button so the clock can just sit there. Hold the red dot in the top-right corner for 2 seconds to unlock.">
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
        <ToggleRow label="Unlock with Face ID" sub="Or Touch ID or your passcode, after the hold" icon={{ name: 'faceid', color: '#34c759' }} value={prefs.lockAuth} onChange={(v) => setPref('lockAuth', v)} />
      </Section>

      <Section title="Fun">
        {pick(
          'Confetti at the last bell',
          <Segmented
            value={prefs.celebrate}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'fridays', label: 'Fridays' },
              { value: 'always', label: 'Every day' },
            ]}
            onChange={(v) => setPref('celebrate', v)}
          />
        )}
        <Divider />
        <ToggleRow label="Breathing clock" sub="Slowly grows and shrinks while you leave it alone" icon={{ name: 'wind', color: '#30b0c7' }} value={prefs.breathe} disabled={!prefs.motion} onChange={(v) => setPref('breathe', v)} />
        <Divider />
        <ToggleRow label="Random theme each day" icon={{ name: 'shuffle', color: '#af52de' }} value={prefs.daily} onChange={(v) => setPref('daily', v)} />
        <Divider />
        <ToggleRow label="Random theme each period" icon={{ name: 'dice.fill', color: '#ff2d55' }} value={prefs.shuffle} onChange={(v) => setPref('shuffle', v)} />
      </Section>

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

      <Section title="More">
        <Row label="Open the Hub" sub="Focus timer, this week, countdowns, grades" icon={{ name: 'square.grid.2x2.fill', color: '#34c759' }} onPress={() => router.push('/hub')} />
        <Divider />
        <ToggleRow label="Pretend it's Period 3" sub="Try the countdown at any time of day" icon={{ name: 'testtube.2', color: '#30b0c7' }} value={prefs.testPeriod3} onChange={(v) => setPref('testPeriod3', v)} />
        <Divider />
        <Row
          label="Run setup again"
          sub="School, schedule, classes, alerts, theme, account"
          icon={{ name: 'arrow.counterclockwise', color: '#8e8e93' }}
          onPress={() => {
            setPref('setupStep', 0);
            router.push('/setup');
          }}
        />
        <Divider />
        <Row label="Redeem a code" sub="Schedule codes from friends and promo codes" icon={{ name: 'ticket.fill', color: '#ff9500' }} onPress={() => router.push('/redeem')} />
        <Divider />
        <Row label="Back up & restore" sub="Copy everything to another device, no account needed" icon={{ name: 'arrow.up.doc.fill', color: '#5856d6' }} onPress={() => router.push('/backup')} />
        <Divider />
        <Row label="Help" sub="studentoclockapp@gmail.com" icon={{ name: 'envelope.fill', color: '#007aff' }} onPress={() => void Linking.openURL('mailto:studentoclockapp@gmail.com?subject=Studento')} />
      </Section>

      <Note>Studento {Constants.expoConfig?.version ?? ''}</Note>
    </Screen>
  );
}
