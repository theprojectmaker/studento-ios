/** Scan (photo) or type a schedule; the server's AI reads it, then the review screen lets you fix it. */
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat, type ImageManipulatorContext, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { Button, Note, Screen } from '@/components/ui';
import { readScheduleAI } from '@/lib/api';
import { setDraft, toPersonal } from '@/lib/draft';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { setHeavyWork } from '@/lib/heavy';
import { alpha } from '@/lib/themes';

const EXAMPLE = `Period 1  Algebra  8:00-8:41  Room 112
Period 2  English  8:44-9:25
Period 3  Biology  9:28-10:09  Lab B
Lunch  10:12-10:53
...
Same every day (or say what's different on Wednesday)`;

function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  // Server messages are already written for people; native/JS errors are not.
  return msg && msg.length < 140 && !/undefined|null|native|exception|TypeError/i.test(msg) ? msg : fallback;
}

export default function SetupSchedule() {
  const theme = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const scan = mode !== 'type';
  const [photo, setPhoto] = useState<{ uri: string; data: string } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    setErr(null);
    // Coming back from the camera/photos makes the app "active" again; hold off the
    // foreground refresh until the photo is shrunk so the two never pile up.
    setHeavyWork(true);
    let ctx: ImageManipulatorContext | null = null;
    let img: ImageRef | null = null;
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return setErr(camera ? 'Camera access is off for Studento. Turn it on in Settings, or pick a photo instead.' : 'Photo access is off for Studento. Turn it on in Settings.');
      const res = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false, base64: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, base64: false, allowsMultipleSelection: false });
      if (res.canceled || !res.assets?.[0]) return;
      // Shrink ONCE to a sharp-enough small JPEG (long side 1500 px); the preview and
      // the upload both use this copy, never the full-size original.
      const a = res.assets[0];
      const long = Math.max(a.width || 1500, a.height || 1500);
      ctx = ImageManipulator.manipulate(a.uri);
      if (long > 1500) ctx.resize(a.width >= a.height ? { width: 1500 } : { height: 1500 });
      img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!out.base64) return setErr("Couldn't read that photo. Try another.");
      setPhoto({ uri: out.uri, data: out.base64 });
    } catch (e) {
      setErr(friendly(e, "Couldn't open that photo. Try another one, or a screenshot."));
    } finally {
      // Free the native bitmaps right away (a full-size photo is ~50 MB decoded).
      try {
        img?.release();
        ctx?.release();
      } catch {}
      setHeavyWork(false);
    }
  };

  const read = async () => {
    setErr(null);
    setBusy(true);
    try {
      const ai = await readScheduleAI(scan && photo ? { image: { data: photo.data, mimeType: 'image/jpeg' } } : { text });
      setDraft(toPersonal(ai));
      router.push('/schedule-review');
    } catch (e) {
      setErr(friendly(e, "Couldn't read your schedule. Check your internet and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Text style={{ ...TYPE.regular, fontSize: 16, lineHeight: 22, color: theme.muted, textAlign: 'center' }}>
          {scan ? 'Take a clear photo of your schedule, or pick a screenshot of it.' : 'List your classes and times. Any format works.'}
        </Text>

        {scan ? (
          <>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 18, backgroundColor: theme.panel }} contentFit="contain" />
            ) : (
              <View style={{ height: 180, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: alpha(theme.ink, 0.25), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.muted }}>No photo yet</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {Platform.OS !== 'web' ? (
                <View style={{ flex: 1 }}>
                  <Button title="Take photo" kind="plain" onPress={() => pick(true)} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button title={photo ? 'Pick another' : 'Pick a photo'} kind="plain" onPress={() => pick(false)} />
              </View>
            </View>
          </>
        ) : (
          <TextInput
            multiline
            value={text}
            onChangeText={setText}
            placeholder={EXAMPLE}
            placeholderTextColor={alpha(theme.ink, 0.35)}
            selectionColor={theme.accent}
            style={{ ...TYPE.regular, minHeight: 220, borderRadius: 18, padding: 14, fontSize: 16, lineHeight: 22, color: theme.ink, backgroundColor: theme.panel, textAlignVertical: 'top' }}
            accessibilityLabel="Your schedule"
          />
        )}

        {err ? <Note tone="error">{err}</Note> : null}
        {busy ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <ActivityIndicator color={theme.accent} />
            <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.muted }}>Reading your schedule… (10–20 seconds)</Text>
          </View>
        ) : (
          <Button title="Read my schedule" onPress={read} disabled={scan ? !photo : text.trim().length < 10} />
        )}
        <Note>{scan ? "Your photo is sent once to read it and isn't kept. " : ''}Next you can check every time and class before it is saved.</Note>
      </Screen>
    </KeyboardAvoidingView>
  );
}
