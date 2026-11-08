/**
 * Settings > Account: a username and password, nothing else. Signing in restores your
 * classes, school and settings; deleting the account removes everything stored for it.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Divider, Field, Note, Row, Screen, Section } from '@/components/ui';
import { deleteMyAccount, pushNow, signIn, signOut, signUp } from '@/lib/account';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { sz } from '@/lib/scale';
import { useStore } from '@/lib/store';
import { alpha, readableOn } from '@/lib/themes';

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

export default function Account() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const hasBeam = useStore((s) => (s.prefs.unlocks ?? []).includes('messages'));
  const [mode, setMode] = useState<'in' | 'new'>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [delPassword, setDelPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const pwRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const name = username.trim().toLowerCase();
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
    Alert.alert('Delete your account?', 'Your username and saved schedule are removed from Studento for good. This device keeps its own copy of your schedule.', [
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
        <Section title="Delete account" footer="Removes your username and everything saved to the account. This device keeps its own copy of your schedule.">
          <View style={{ padding: 12, gap: 10 }}>
            <Field value={delPassword} onChangeText={setDelPassword} placeholder="Your password" secureTextEntry autoCapitalize="none" accessibilityLabel="Password to delete the account" />
            <Button title="Delete my account" kind="danger" disabled={busy || delPassword.length < 8} onPress={confirmDelete} />
          </View>
        </Section>
      </Screen>
    );
  }

  /* ---------------- signed out ---------------- */
  const line = alpha(theme.ink, 0.1);
  const fieldRow = (label: string, input: React.ReactNode, right?: React.ReactNode, last?: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: sz(54), paddingHorizontal: sz(16), borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: line }}>
      <Text style={{ ...TYPE.semibold, fontSize: sz(16), color: theme.ink, width: sz(96) }}>{label}</Text>
      <View style={{ flex: 1 }}>{input}</View>
      {right}
    </View>
  );
  const inputStyle = { ...TYPE.regular, fontSize: sz(17), color: theme.ink, paddingVertical: sz(14) };
  const ph = alpha(theme.ink, 0.3);
  const switchMode = (m: 'in' | 'new') => {
    setMode(m);
    setMsg(null);
    setConfirm('');
  };
  const problem = mismatch ? "Passwords don't match." : username && !NAME_OK.test(name) ? 'Username: 3 to 24 letters, numbers, dots, dashes or underscores.' : null;
  const perks = [
    ['Synced everywhere', 'Your classes, school and settings on every device'],
    ['Schedule reader', 'Snap a photo of your schedule, get your classes'],
    ...(hasBeam ? [['Beam', 'Chats and calls with friends']] : []),
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: sz(20), paddingBottom: insets.bottom + 40, gap: sz(20), maxWidth: sz(460), width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 6, paddingTop: sz(4) }}>
          <Text style={{ ...TYPE.heavy, fontSize: sz(34), letterSpacing: -0.8, color: theme.ink }}>{mode === 'in' ? 'Sign in' : 'Create account'}</Text>
          <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(21), color: theme.muted }}>{mode === 'in' ? 'Get your classes, school and settings back on this device.' : 'Only a username and a password. No name, email or phone.'}</Text>
        </View>

        <View style={{ flexDirection: 'row', padding: 3, borderRadius: sz(12), backgroundColor: alpha(theme.ink, 0.08) }}>
          {(['in', 'new'] as const).map((m) => (
            <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => switchMode(m)} style={{ flex: 1, height: sz(36), borderRadius: sz(10), alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? theme.bg : 'transparent' }}>
              <Text style={{ ...TYPE.semibold, fontSize: sz(15), color: mode === m ? theme.ink : theme.muted }}>{m === 'in' ? 'Sign in' : 'New account'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ borderRadius: sz(16), backgroundColor: theme.panel, overflow: 'hidden' }}>
          {fieldRow(
            'Username',
            <TextInput value={username} onChangeText={setUsername} placeholder="alex_k" placeholderTextColor={ph} selectionColor={theme.accent} autoCapitalize="none" autoCorrect={false} textContentType="username" maxLength={24} returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} style={inputStyle} accessibilityLabel="Username" />
          )}
          {fieldRow(
            'Password',
            <TextInput ref={pwRef} value={password} onChangeText={setPassword} placeholder={mode === 'new' ? '8+ characters' : 'Required'} placeholderTextColor={ph} selectionColor={theme.accent} secureTextEntry={!show} autoCapitalize="none" textContentType={mode === 'new' ? 'newPassword' : 'password'} returnKeyType={mode === 'in' ? 'go' : 'next'} onSubmitEditing={mode === 'in' ? () => void go() : () => confirmRef.current?.focus()} style={inputStyle} accessibilityLabel="Password" />,
            <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow((v) => !v)} hitSlop={10}>
              <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: theme.accent }}>{show ? 'Hide' : 'Show'}</Text>
            </Pressable>,
            mode === 'in'
          )}
          {mode === 'new'
            ? fieldRow(
                'Confirm',
                <TextInput ref={confirmRef} value={confirm} onChangeText={setConfirm} placeholder="Type it again" placeholderTextColor={ph} selectionColor={theme.accent} secureTextEntry={!show} autoCapitalize="none" textContentType="newPassword" returnKeyType="go" onSubmitEditing={() => void go()} style={inputStyle} accessibilityLabel="Confirm password" />,
                confirm && confirm === password ? <Text style={{ ...TYPE.semibold, fontSize: sz(14), color: '#30d158' }}>Match</Text> : undefined,
                true
              )
            : null}
        </View>

        {mode === 'new' && password ? (
          <View style={{ gap: 6, marginTop: -8, paddingHorizontal: 4 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= pw.score ? (pw.score <= 1 ? '#ff453a' : pw.score === 2 ? '#ffcc00' : '#34c759') : alpha(theme.ink, 0.12) }} />
              ))}
            </View>
            <Text style={{ ...TYPE.regular, fontSize: sz(12.5), color: theme.muted }}>{password.length < 8 ? `${8 - password.length} more characters` : `Password strength: ${pw.label}`}</Text>
          </View>
        ) : null}
        {problem ? <Text style={{ ...TYPE.regular, fontSize: sz(13.5), color: '#ff6b5e', marginTop: -8, paddingHorizontal: 4 }}>{problem}</Text> : null}

        <Pressable accessibilityRole="button" onPress={() => void go()} disabled={!ready || busy} style={({ pressed }) => ({ height: sz(54), borderRadius: sz(14), alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? theme.accent : alpha(theme.ink, 0.1), opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ ...TYPE.bold, fontSize: sz(17), color: ready ? readableOn(theme.accent) : theme.muted }}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>

        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}

        <View style={{ gap: 12, paddingHorizontal: 4, paddingTop: 4 }}>
          {perks.map(([t, d]) => (
            <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: sz(30), height: sz(30), borderRadius: sz(9), backgroundColor: alpha(theme.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: sz(10), height: sz(10), borderRadius: sz(5), backgroundColor: theme.accent }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.semibold, fontSize: sz(15), color: theme.ink }}>{t}</Text>
                <Text style={{ ...TYPE.regular, fontSize: sz(13.5), color: theme.muted }}>{d}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
