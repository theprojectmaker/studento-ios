/** "Unlock Beam": Face ID / Touch ID first (when the build has it), the account password otherwise. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useBeam } from '@/components/beam-ui';
import { biometricKind, unlockWithBiometrics, unlockWithPassword } from '@/lib/beam-lock';

export function BeamLockScreen() {
  const c = useBeam();
  const [kind, setKind] = useState<'face' | 'touch' | 'passcode' | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void biometricKind()
      .then((k) => {
        if (!live) return;
        setKind(k);
        if (k) void unlockWithBiometrics().catch(() => {});
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await unlockWithPassword(pw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Wrong password.');
      setPw('');
    } finally {
      setBusy(false);
    }
  };

  const bioLabel = kind === 'face' ? 'Use Face ID' : kind === 'touch' ? 'Use Touch ID' : 'Use passcode';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.sidebar, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <View style={{ width: '100%', maxWidth: 340, alignItems: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 22, height: 16, borderRadius: 4, backgroundColor: '#fff', marginTop: 10 }} />
          <View style={{ position: 'absolute', top: 13, width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff', borderBottomColor: 'transparent' }} />
        </View>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>Locked</Text>
        <Text style={{ color: c.text2, fontSize: 14.5, textAlign: 'center', lineHeight: 20 }}>{kind ? `${bioLabel.replace('Use ', '')} or your password to open.` : 'Enter your Studento password to open.'}</Text>
        {kind ? (
          <Pressable onPress={() => void unlockWithBiometrics().catch(() => {})} style={({ pressed }) => ({ alignSelf: 'stretch', backgroundColor: pressed ? '#0a6fd8' : c.blue, borderRadius: 12, paddingVertical: 13, alignItems: 'center' })}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{bioLabel}</Text>
          </Pressable>
        ) : null}
        <TextInput
          value={pw}
          onChangeText={setPw}
          placeholder="Password"
          placeholderTextColor={c.text3}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          style={{ alignSelf: 'stretch', color: c.text, fontSize: 16, backgroundColor: c.search, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
        />
        <Pressable disabled={!pw || busy} onPress={() => void submit()} style={{ alignSelf: 'stretch', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: kind ? c.search : c.blue, opacity: !pw || busy ? 0.5 : 1 }}>
          <Text style={{ color: kind ? c.text : '#fff', fontSize: 16, fontWeight: '600' }}>{busy ? 'Checking…' : 'Unlock'}</Text>
        </Pressable>
        {err ? <Text style={{ color: c.red, fontSize: 13.5 }}>{err}</Text> : null}
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginTop: 6 }}>
          <Text style={{ color: c.blue, fontSize: 16 }}>Back to the clock</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
