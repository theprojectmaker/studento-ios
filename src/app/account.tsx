/**
 * Settings > Account: a username and password, nothing else. Signing in restores your
 * classes, school and settings; deleting the account removes everything stored for it.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Divider, Field, Note, Row, Screen, Section } from '@/components/ui';
import { deleteMyAccount, pushNow, signIn, signOut, signUp } from '@/lib/account';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';
import { alpha, readableOn, type Theme } from '@/lib/themes';

const NAME_OK = /^[a-z0-9_.-]{3,24}$/;

function strength(p: string): { score: number; label: string } {
  if (!p) return { score: 0, label: '' };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s++;
  return { score: s, label: ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][s] };
}

/** A labeled input with an optional trailing action (show/hide). */
function Input({
  theme,
  label,
  hint,
  tone,
  right,
  ...props
}: React.ComponentProps<typeof TextInput> & { theme: Theme; label: string; hint?: string; tone?: 'ok' | 'error'; right?: React.ReactNode }) {
  const [focus, setFocus] = useState(false);
  const border = tone === 'error' ? '#ff453a' : focus ? theme.accent : alpha(theme.ink, 0.12);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: theme.muted, letterSpacing: 0.2 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: sz(12), borderWidth: 1.5, borderColor: border, backgroundColor: alpha(theme.ink, theme.light ? 0.04 : 0.06), paddingHorizontal: 14 }}>
        <TextInput
          placeholderTextColor={alpha(theme.ink, 0.3)}
          selectionColor={theme.accent}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          {...props}
          style={{ flex: 1, ...TYPE.regular, fontSize: sz(17), color: theme.ink, paddingVertical: sz(13) }}
        />
        {right}
      </View>
      {hint ? <Text style={{ ...TYPE.regular, fontSize: sz(12.5), color: tone === 'error' ? '#ff6b5e' : tone === 'ok' ? '#30d158' : theme.muted }}>{hint}</Text> : null}
    </View>
  );
}

export default function Account() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const [mode, setMode] = useState<'in' | 'new'>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [delPassword, setDelPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const name = username.trim().toLowerCase();
  const nameHint = !username ? undefined : NAME_OK.test(name) ? (mode === 'new' ? 'Looks good.' : undefined) : '3 to 24 letters, numbers, dots, dashes or underscores.';
  const nameTone = !username ? undefined : NAME_OK.test(name) ? 'ok' : 'error';
  const pw = strength(password);
  const mismatch = mode === 'new' && confirm.length > 0 && confirm !== password;
  const ready = NAME_OK.test(name) && password.length >= 8 && (mode === 'in' || confirm === password);

  const go = async () => {
    if (!ready || busy) return;
    setMsg(null);
    setBusy(true);
    try {
      if (mode === 'new') {
        const r = await signUp(name, password);
        setMsg({ text: r.owner ? "Account created. You're the first account, so you're the owner." : 'Account created. Your schedule and settings now save to it.', tone: 'ok' });
      } else {
        await signIn(name, password);
        setMsg({ text: 'Signed in. Your schedule and settings are back.', tone: 'ok' });
      }
      setPassword('');
      setConfirm('');
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Something went wrong.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    const run = async () => {
      setMsg(null);
      setBusy(true);
      try {
        await deleteMyAccount(delPassword);
        setDelPassword('');
        setMsg({ text: 'Your account and everything stored for it are deleted. This device keeps its own copy.', tone: 'ok' });
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : "Couldn't delete the account.", tone: 'error' });
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') return void run();
    Alert.alert('Delete your account?', 'Your username, saved schedule and any messages are removed from Studento for good. This device keeps its own copy of your schedule.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  };

  /* ---------------- signed in ---------------- */
  if (account) {
    const initial = account.user.username.slice(0, 1).toUpperCase();
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: sz(84), height: sz(84), borderRadius: sz(42), backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...TYPE.heavy, fontSize: sz(36), color: readableOn(theme.accent) }}>{initial}</Text>
          </View>
          <Text style={{ ...TYPE.bold, fontSize: sz(24), letterSpacing: -0.4, color: theme.ink }}>{account.user.username}</Text>
          <Text style={{ ...TYPE.regular, fontSize: sz(14), color: theme.muted }}>
            {account.user.admin ? 'Owner · admin' : 'Signed in'} · {account.syncedAt ? `saved ${new Date(account.syncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'not saved yet'}
          </Text>
        </View>
        <Section>
          <Row
            label="Save now"
            icon={{ name: 'arrow.triangle.2.circlepath', color: '#34c759' }}
            onPress={async () => {
              setMsg(null);
              setMsg((await pushNow()) ? { text: 'Saved.', tone: 'ok' } : { text: "Couldn't save right now. Check your internet.", tone: 'error' });
            }}
          />
          <Divider inset={58} />
          <Row
            label="Sign out"
            icon={{ name: 'rectangle.portrait.and.arrow.right', color: '#8e8e93' }}
            onPress={async () => {
              await signOut();
              router.back();
            }}
          />
        </Section>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        <Section title="Delete account" footer="Removes your username, everything saved to the account and any messages. This device keeps its own copy of your schedule.">
          <View style={{ padding: 12, gap: 10 }}>
            <Field value={delPassword} onChangeText={setDelPassword} placeholder="Your password" secureTextEntry autoCapitalize="none" accessibilityLabel="Password to delete the account" />
            <Button title="Delete my account" kind="danger" disabled={busy || delPassword.length < 8} onPress={confirmDelete} />
          </View>
        </Section>
      </Screen>
    );
  }

  /* ---------------- signed out ---------------- */
  const showToggle = (
    <Pressable accessibilityRole="button" onPress={() => setShow((v) => !v)} hitSlop={10}>
      <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: theme.accent }}>{show ? 'Hide' : 'Show'}</Text>
    </Pressable>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: sz(20), paddingBottom: insets.bottom + 40, gap: sz(22), maxWidth: sz(480), width: '100%', alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: sz(8) }}>
          <View style={{ width: sz(68), height: sz(68), borderRadius: sz(20), backgroundColor: alpha(theme.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: sz(26), height: sz(26), borderRadius: sz(13), backgroundColor: theme.accent }} />
            <View style={{ width: sz(40), height: sz(14), borderTopLeftRadius: sz(20), borderTopRightRadius: sz(20), backgroundColor: theme.accent, marginTop: sz(4) }} />
          </View>
          <Text style={{ ...TYPE.bold, fontSize: sz(28), letterSpacing: -0.6, color: theme.ink, textAlign: 'center' }}>{mode === 'in' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(21), color: theme.muted, textAlign: 'center' }}>
            {mode === 'in' ? 'Sign in to get your classes, school and settings back.' : 'Just a username and a password. No name, email or phone, ever.'}
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <Input theme={theme} label="Username" value={username} onChangeText={setUsername} placeholder="e.g. alex_k" autoCapitalize="none" autoCorrect={false} textContentType="username" maxLength={24} hint={nameHint} tone={nameTone} returnKeyType="next" />
          <Input
            theme={theme}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'new' ? 'At least 8 characters' : 'Your password'}
            secureTextEntry={!show}
            autoCapitalize="none"
            textContentType={mode === 'new' ? 'newPassword' : 'password'}
            right={showToggle}
            onSubmitEditing={mode === 'in' ? () => void go() : undefined}
          />
          {mode === 'new' && password ? (
            <View style={{ gap: 6, marginTop: -8 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= pw.score ? (pw.score <= 1 ? '#ff453a' : pw.score === 2 ? '#ffcc00' : '#34c759') : alpha(theme.ink, 0.12) }} />
                ))}
              </View>
              <Text style={{ ...TYPE.regular, fontSize: sz(12.5), color: theme.muted }}>{password.length < 8 ? `${8 - password.length} more characters` : pw.label}</Text>
            </View>
          ) : null}
          {mode === 'new' ? (
            <Input theme={theme} label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Type it again" secureTextEntry={!show} autoCapitalize="none" textContentType="newPassword" hint={mismatch ? "Passwords don't match." : confirm && confirm === password ? 'Match.' : undefined} tone={mismatch ? 'error' : confirm && confirm === password ? 'ok' : undefined} onSubmitEditing={() => void go()} />
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void go()}
          disabled={!ready || busy}
          style={({ pressed }) => ({ height: sz(54), borderRadius: sz(14), alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? theme.accent : alpha(theme.ink, 0.12), opacity: pressed ? 0.75 : 1 })}>
          <Text style={{ ...TYPE.bold, fontSize: sz(17), color: ready ? readableOn(theme.accent) : theme.muted }}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>

        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === 'in' ? 'new' : 'in');
            setMsg(null);
            setConfirm('');
          }}
          style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={{ ...TYPE.regular, fontSize: sz(15), color: theme.muted }}>
            {mode === 'in' ? 'New to Studento? ' : 'Already have an account? '}
            <Text style={{ ...TYPE.semibold, color: theme.accent }}>{mode === 'in' ? 'Create an account' : 'Sign in'}</Text>
          </Text>
        </Pressable>

        <View style={{ gap: 10, padding: sz(16), borderRadius: sz(14), backgroundColor: theme.panel }}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: theme.muted, letterSpacing: 0.3 }}>AN ACCOUNT GIVES YOU</Text>
          {['Your classes, school and settings on every device', 'The schedule reader: snap a photo, get your classes', 'Beam (beta), if you have the code'].map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent, marginTop: sz(7) }} />
              <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(20), color: theme.ink, flex: 1 }}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
