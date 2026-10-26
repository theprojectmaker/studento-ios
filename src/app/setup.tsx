/**
 * First-launch setup: a short wizard with a progress bar and Back / Next / Skip on every
 * optional step. The current step is saved, so killing the app mid-way resumes here, and
 * Settings > "Run setup again" starts it over. Plain fades only, no springs.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Board } from '@/components/boards';
import { SchedulePick, SchoolSearch } from '@/components/school-picker';
import { Button, Field, Note, tap } from '@/components/ui';
import { signIn, signUp } from '@/lib/account';
import type { BellSet } from '@/lib/api';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { getPermission, requestPermission, rescheduleAlerts } from '@/lib/notify';
import { clampStep, nextStep, prevStep, SETUP_STEPS, visibleSteps } from '@/lib/setupFlow';
import { setPref, useStore } from '@/lib/store';
import { alpha, readableOn, themeById, type Theme } from '@/lib/themes';
import { fontStyle } from '@/lib/typefaces';

const THEME_PICKS = ['departure', 'jackpot', 'gatsby', 'arctic'];

export default function Setup() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const prefs = useStore((s) => s.prefs);
  const school = useStore((s) => s.school);
  const bellSet = useStore((s) => s.bellSet);
  const personal = useStore((s) => s.personal);
  const account = useStore((s) => s.account);
  const step = clampStep(prefs.setupStep);
  const def = SETUP_STEPS[step];
  const hasSchool = !!school;
  const shown = visibleSteps({ hasSchool });
  const shownIndex = shown.findIndex((s) => s.id === def.id);
  const [schedules, setSchedules] = useState<BellSet[]>([]);
  const cachedSchedules = useStore((s) => s.schoolSchedules);

  const go = (n: number) => {
    tap();
    setPref('setupStep', n);
  };
  const next = () => go(nextStep(step, { hasSchool }));
  const back = () => go(prevStep(step, { hasSchool }));
  const finish = () => {
    tap();
    setPref('onboarded', true);
    setPref('setupStep', 0);
    router.replace('/');
  };

  const maxW = Math.min(width, 560);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 24, paddingHorizontal: 20, width: maxW, alignSelf: 'center', gap: 18 }} keyboardShouldPersistTaps="handled">
          {/* progress */}
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4 }} accessibilityLabel={`Step ${shownIndex + 1} of ${shown.length}: ${def.title}`}>
            {shown.map((s, i) => (
              <View key={s.id} style={{ height: 4, flex: 1, maxWidth: 46, borderRadius: 2, backgroundColor: i <= shownIndex ? theme.accent : alpha(theme.ink, 0.15) }} />
            ))}
          </View>

          <Animated.View key={def.id} entering={prefs.motion ? FadeIn.duration(200) : undefined} style={{ gap: 16 }}>
            {def.id === 'welcome' ? <WelcomeStep theme={theme} width={maxW - 40} /> : null}

            {def.id === 'school' ? (
              <StepText theme={theme} title="What school do you go to?" sub="Pick your school's bell times from the shared list, or add your school.">
                {school ? <Note tone="ok">{`Picked: ${school.name}. Choose another below, or tap Next.`}</Note> : null}
                <SchoolSearch
                  onPicked={(s, list) => {
                    setSchedules(list);
                    void (async () => {
                      const { setSchool } = await import('@/lib/store');
                      await setSchool(s, list.find((x) => x.id === bellSet?.id) ?? list[0] ?? null, list);
                      go(nextStep(step, { hasSchool: true }));
                    })();
                  }}
                />
              </StepText>
            ) : null}

            {def.id === 'schedule' && school ? (
              <StepText theme={theme} title="Which bell schedule?" sub="The one your school uses on a normal day. You can switch for a day anytime.">
                <SchedulePick school={school} schedules={schedules.length ? schedules : cachedSchedules} onPicked={() => undefined} />
              </StepText>
            ) : null}

            {def.id === 'classes' ? (
              <StepText theme={theme} title="Your classes" sub="So the clock shows “Biology” instead of “Period 3”. Skip and it just shows period numbers.">
                {personal ? <Note tone="ok">{`Got it: ${personal.name}. You can change it in Settings.`}</Note> : null}
                <Choice theme={theme} title="Scan a photo of my schedule" sub={account ? 'The reader fills in your classes and rooms; you check each row.' : 'Sign in on the last step for the best reader, or Studento reads it on your phone.'} onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'scan' } })} recommended />
                <Choice theme={theme} title="Type them in" sub="Like “1 Math 204, 2 English 112”." onPress={() => router.push({ pathname: '/setup-schedule', params: { mode: 'type' } })} />
              </StepText>
            ) : null}

            {def.id === 'alerts' ? <AlertsStep theme={theme} onDone={next} /> : null}

            {def.id === 'theme' ? (
              <StepText theme={theme} title="Pick a look" sub="More than 100 themes live in Settings. Start with one of these.">
                <ThemeGrid current={prefs.theme} width={maxW - 40} />
              </StepText>
            ) : null}

            {def.id === 'account' ? <AccountStep theme={theme} signedIn={!!account} username={account?.user.username} onDone={next} /> : null}

            {def.id === 'done' ? (
              <StepText theme={theme} title="All set" sub={`${school ? school.name : 'Built-in schedule'}${bellSet ? ` · ${bellSet.name}` : ''}${personal ? ` · ${personal.name}` : ' · period numbers'}${account ? ` · saved to ${account.user.username}` : ''}`}>
                <Note>Everything here can be changed in Settings. Long-press the Home Screen to add the Studento widget.</Note>
              </StepText>
            ) : null}
          </Animated.View>

          {/* nav */}
          {def.id !== 'alerts' && def.id !== 'account' ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              {step > 0 && def.id !== 'done' ? (
                <View style={{ flex: 1 }}>
                  <Button title="Back" kind="plain" onPress={back} />
                </View>
              ) : null}
              <View style={{ flex: 2 }}>
                {def.id === 'done' ? <Button title="Open the clock" onPress={finish} /> : <Button title={def.id === 'welcome' ? 'Get started' : def.id === 'classes' && !personal ? 'Skip for now' : 'Next'} onPress={next} />}
              </View>
            </View>
          ) : null}
          {def.optional && def.id !== 'alerts' && def.id !== 'account' && !(def.id === 'classes' && !personal) ? (
            <Pressable accessibilityRole="button" onPress={next} style={{ alignSelf: 'center', padding: 8 }}>
              <Text style={{ ...TYPE.medium, fontSize: 14, color: theme.muted }}>Skip this step</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepText({ theme, title, sub, children }: { theme: Theme; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ ...fontStyle(theme.type.title, '800'), fontSize: 30 * Math.min(1.1, theme.type.titleScale ?? 1), color: theme.ink }} maxFontSizeMultiplier={1.4}>
        {title}
      </Text>
      <Text style={{ ...TYPE.regular, fontSize: 16, lineHeight: 22, color: theme.muted }} maxFontSizeMultiplier={1.6}>
        {sub}
      </Text>
      {children}
    </View>
  );
}

function Choice({ theme, title, sub, onPress, recommended }: { theme: Theme; title: string; sub: string; onPress: () => void; recommended?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: theme.panel, borderRadius: 20, padding: 16, gap: 4, borderWidth: recommended ? 2 : 0, borderColor: theme.accent })}
    >
      {recommended ? <Text style={{ ...TYPE.bold, fontSize: 11, letterSpacing: 0.8, color: theme.accent }}>RECOMMENDED</Text> : null}
      <Text style={{ ...TYPE.bold, fontSize: 17, color: theme.ink }} maxFontSizeMultiplier={1.4}>
        {title}
      </Text>
      <Text style={{ ...TYPE.regular, fontSize: 14, lineHeight: 19, color: theme.muted }} maxFontSizeMultiplier={1.6}>
        {sub}
      </Text>
    </Pressable>
  );
}

function WelcomeStep({ theme, width }: { theme: Theme; width: number }) {
  return (
    <View style={{ gap: 18, alignItems: 'center', paddingTop: 10 }}>
      <View style={{ width, borderRadius: 24, backgroundColor: theme.panel, padding: 18, alignItems: 'center', gap: 8 }}>
        <Text style={{ ...TYPE.semibold, fontSize: 12, letterSpacing: 2, color: theme.muted }}>PERIOD 3 · BIOLOGY</Text>
        <Board text="21:33" theme={theme} width={width - 36} maxSize={width * 0.2} remaining={0.6} secondsLeft={21 * 60 + 33} motion={false} />
        <Text style={{ ...TYPE.medium, fontSize: 14, color: theme.muted }}>until the bell</Text>
      </View>
      <Text style={{ ...fontStyle(theme.type.title, '800'), fontSize: 32 * Math.min(1.1, theme.type.titleScale ?? 1), color: theme.ink, textAlign: 'center' }} maxFontSizeMultiplier={1.4}>
        Welcome to Studento
      </Text>
      <Text style={{ ...TYPE.regular, fontSize: 16, lineHeight: 22, color: theme.muted, textAlign: 'center' }} maxFontSizeMultiplier={1.6}>
        A clock for school: it counts down to every bell, on your phone, your Lock Screen and your widgets. Setup takes about a minute, and every step can be skipped.
      </Text>
    </View>
  );
}

function ThemeGrid({ current, width }: { current: string; width: number }) {
  const w = (width - 12) / 2;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {THEME_PICKS.map((id) => {
        const t = themeById(id);
        const on = current === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.name} theme`}
            onPress={() => {
              tap();
              setPref('theme', id);
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ width: w, height: w * 0.9, borderRadius: 20, overflow: 'hidden', backgroundColor: t.bg, borderWidth: on ? 3 : 1, borderColor: on ? t.accent : alpha(t.ink, 0.12), padding: 10, justifyContent: 'space-between' }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Board text="21:33" theme={t} width={w - 24} maxSize={t.engine === 'dial' ? w * 0.13 : w * 0.19} remaining={0.6} secondsLeft={21 * 60 + 33} motion={false} />
              </View>
              <Text style={{ ...fontStyle(t.type.title, '600'), fontSize: 14, color: t.ink }} numberOfLines={1}>
                {on ? `✓ ${t.name}` : t.name}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function AlertsStep({ theme, onDone }: { theme: Theme; onDone: () => void }) {
  const [state, setState] = useState<'ask' | 'on' | 'off'>('ask');
  const turnOn = async () => {
    tap();
    const p = await requestPermission();
    setPref('alertsAsked', true);
    if (p === 'granted') {
      setPref('alerts', true);
      void rescheduleAlerts();
      setState('on');
    } else setState('off');
  };
  return (
    <StepText theme={theme} title="Bell alerts" sub="A quiet notification 3 minutes into each class and 5 minutes before the bell. Nothing else, ever. They are set on your phone and work offline.">
      {state === 'on' ? <Note tone="ok">Alerts are on. You can change them in Settings.</Note> : null}
      {state === 'off' ? <Note>No problem. Turn them on later in Settings &gt; Alerts.</Note> : null}
      <View style={{ gap: 10 }}>
        {state === 'ask' ? (
          <>
            <Button title="Turn on bell alerts" onPress={() => void turnOn()} />
            <Button
              title="Not now"
              kind="plain"
              onPress={() => {
                tap();
                void getPermission().then(() => setPref('alertsAsked', true));
                onDone();
              }}
            />
          </>
        ) : (
          <Button title="Next" onPress={onDone} />
        )}
      </View>
    </StepText>
  );
}

function AccountStep({ theme, signedIn, username, onDone }: { theme: Theme; signedIn: boolean; username?: string; onDone: () => void }) {
  const [mode, setMode] = useState<'new' | 'in'>('new');
  const [u, setU] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const name = u.trim();
    if (!/^[a-z0-9_.-]{3,24}$/i.test(name)) return setErr('Username: 3 to 24 letters, numbers, dots, dashes or underscores.');
    if (p1.length < 8) return setErr('Password: at least 8 characters.');
    if (mode === 'new' && p1 !== p2) return setErr("The two passwords don't match.");
    setBusy(true);
    try {
      if (mode === 'new') {
        const r = await signUp(name, p1);
        setOk(r.owner ? "Account created. You're the first account, so you're the owner." : 'Account created. Your schedule and settings now save to it.');
      } else {
        await signIn(name, p1);
        setOk('Signed in. Your schedule and settings are restored.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (signedIn || ok) {
    return (
      <StepText theme={theme} title="Saved" sub={ok ?? `Signed in as ${username}. Your schedule and settings save to your account.`}>
        <Button title="Next" onPress={onDone} />
      </StepText>
    );
  }
  return (
    <StepText theme={theme} title="Save your schedule across devices" sub="Optional. An account is just a username and a password; it keeps your classes, school and settings, and turns on the schedule reader.">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['new', 'in'] as const).map((m) => (
          <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: mode === m ? theme.accent : alpha(theme.ink, 0.08) }}>
            <Text style={{ ...TYPE.semibold, fontSize: 15, color: mode === m ? readableOn(theme.accent) : theme.ink }}>{m === 'new' ? 'Sign up' : 'I already have an account'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Field value={u} onChangeText={setU} placeholder="Username" autoCapitalize="none" autoCorrect={false} textContentType="username" accessibilityLabel="Username" maxLength={24} />
        <Field value={p1} onChangeText={setP1} placeholder={mode === 'new' ? 'Password (8+ characters)' : 'Password'} secureTextEntry={!show} autoCapitalize="none" textContentType={mode === 'new' ? 'newPassword' : 'password'} accessibilityLabel="Password" />
        {mode === 'new' ? <Field value={p2} onChangeText={setP2} placeholder="Confirm password" secureTextEntry={!show} autoCapitalize="none" textContentType="newPassword" accessibilityLabel="Confirm password" /> : null}
        <Pressable accessibilityRole="button" onPress={() => setShow((s) => !s)} style={{ alignSelf: 'flex-start', padding: 4 }}>
          <Text style={{ ...TYPE.medium, fontSize: 14, color: theme.accent }}>{show ? 'Hide password' : 'Show password'}</Text>
        </Pressable>
      </View>
      {err ? <Note tone="error">{err}</Note> : null}
      <Button title={busy ? 'One moment…' : mode === 'new' ? 'Create account' : 'Sign in'} onPress={() => void submit()} disabled={busy} />
      <Button title="Skip for now" kind="plain" onPress={onDone} />
      <Text style={{ ...TYPE.regular, fontSize: 12, color: theme.muted, textAlign: 'center' }}>We never ask for your name, email or phone. Delete the account anytime in Settings.</Text>
    </StepText>
  );
}
