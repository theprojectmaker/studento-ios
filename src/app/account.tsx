/**
 * Settings > Account: a username and password, nothing else. Signing in restores your
 * classes, school and settings; deleting the account removes everything stored for it.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, Field, Note, Row, Screen, Section, Segmented } from '@/components/ui';
import { deleteMyAccount, pushNow, signIn, signOut, signUp } from '@/lib/account';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { useStore } from '@/lib/store';
import { sz } from '@/lib/scale';

export default function Account() {
  const theme = useTheme();
  const account = useStore((s) => s.account);
  const [mode, setMode] = useState<'in' | 'new'>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const go = async () => {
    setMsg(null);
    setBusy(true);
    try {
      if (mode === 'new') {
        const r = await signUp(username.trim(), password);
        setMsg({ text: r.owner ? "Account created. You're the first account, so you're the owner: your classes are set and you can manage shared schools in Settings > Admin." : 'Account created. Your schedule and settings will be saved to it.', tone: 'ok' });
      } else {
        await signIn(username.trim(), password);
        setMsg({ text: 'Signed in. Your schedule and settings are restored.', tone: 'ok' });
      }
      setPassword('');
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
        setMsg({ text: 'Your account and everything stored for it are deleted. This phone keeps its own copy.', tone: 'ok' });
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : "Couldn't delete the account.", tone: 'error' });
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') return void run();
    Alert.alert('Delete your account?', 'Your username and the schedule saved to it are removed from Studento for good. This phone keeps its own copy.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  };

  if (account) {
    return (
      <Screen>
        <Section title="Signed in" footer={account.syncedAt ? `Last saved ${new Date(account.syncedAt).toLocaleString()}.` : 'Not saved yet.'}>
          <Row label={account.user.username} sub={account.user.admin ? 'Owner · admin' : 'Your schedule and settings save to this account'} icon={{ name: 'person.crop.circle.fill', color: '#007aff' }} />
        </Section>
        <Button
          title="Save now"
          kind="plain"
          onPress={async () => {
            setMsg(null);
            setMsg((await pushNow()) ? { text: 'Saved.', tone: 'ok' } : { text: "Couldn't save right now. Check your internet.", tone: 'error' });
          }}
        />
        <Button
          title="Sign out"
          kind="plain"
          onPress={async () => {
            await signOut();
            router.back();
          }}
        />
        <Section title="Delete account" footer="Removes your username and everything saved to the account. Your phone keeps its own copy of your schedule.">
          <View style={{ padding: 12, gap: 10 }}>
            <Field value={delPassword} onChangeText={setDelPassword} placeholder="Your password" secureTextEntry autoCapitalize="none" accessibilityLabel="Password to delete the account" />
            <Button title="Delete my account" kind="danger" disabled={busy || delPassword.length < 8} onPress={confirmDelete} />
          </View>
        </Section>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Text style={{ ...TYPE.regular, fontSize: sz(15), lineHeight: sz(21), color: theme.muted, textAlign: 'center' }}>
          Optional. An account saves your classes, school and settings so you can get them back on another phone, and turns on the schedule reader. Just a username and a password, nothing else.
        </Text>
        <Segmented
          value={mode}
          options={[
            { value: 'in', label: 'Sign in' },
            { value: 'new', label: 'Create account' },
          ]}
          onChange={setMode}
        />
        <Section>
          <View style={{ padding: 12, gap: 10 }}>
            <Field value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" autoCorrect={false} textContentType="username" accessibilityLabel="Username" maxLength={24} />
            <Field value={password} onChangeText={setPassword} placeholder={mode === 'new' ? 'Password (8+ characters)' : 'Password'} secureTextEntry autoCapitalize="none" textContentType={mode === 'new' ? 'newPassword' : 'password'} accessibilityLabel="Password" />
          </View>
        </Section>
        <Button title={busy ? 'One moment…' : mode === 'new' ? 'Create account' : 'Sign in'} onPress={go} disabled={busy || username.trim().length < 3 || password.length < 8} />
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        <Note>Usernames: 3 to 24 letters, numbers, dots, dashes or underscores. We never ask for your name, email or phone.</Note>
      </Screen>
    </KeyboardAvoidingView>
  );
}
