/**
 * Scan (photo) or type a schedule. Everything happens on the phone: text recognition
 * reads the photo, a local parser turns the lines into periods, and the review screen
 * lets the student fix anything. Nothing is uploaded.
 */
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat, type ImageManipulatorContext, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { Button, Note, Screen } from '@/components/ui';
import { getToken } from '@/lib/account';
import * as api from '@/lib/api';
import { setDraft, toPersonal } from '@/lib/draft';
import { TYPE } from '@/lib/fonts';
import { setHeavyWork } from '@/lib/heavy';
import { useTheme } from '@/lib/hooks';
import { extractLines, ocrSupported } from '@/lib/ocr';
import { NORTH_BELLS } from '@/lib/schedule';
import { parsedSomething, parseScheduleText } from '@/lib/scheduleParser';
import { getState, useStore } from '@/lib/store';
import { alpha } from '@/lib/themes';

const EXAMPLE = `Period 1  Algebra  8:00-8:41  Room 112
Period 2  English  8:44-9:25
Period 3  Biology  9:28-10:09  Lab B
Lunch  10:12-10:53
...
Same every day (or add a "Wednesday" line before the rows that differ)`;

const NOTHING = "Couldn't find your classes. Try a clearer, straight-on photo, or type it out.";

function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return msg && msg.length < 140 && !/undefined|null|native|exception|TypeError/i.test(msg) ? msg : fallback;
}

export default function SetupSchedule() {
  const theme = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const scan = mode !== 'type';
  const account = useStore((s) => s.account);
  // Signed in: the server's reader (any photo). Signed out: on-device text recognition (installed app only).
  const canScan = !!account || ocrSupported();
  const [photo, setPhoto] = useState<{ uri: string; data?: string } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    setErr(null);
    // Coming back from the camera/photos makes the app "active" again; hold off the
    // foreground work until the photo is shrunk so the two never pile up.
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
      // Shrink ONCE to a sharp-enough copy (long side 2000 px, plenty for text recognition);
      // the preview and the reader both use this copy, never the full-size original.
      const a = res.assets[0];
      const long = Math.max(a.width || 2000, a.height || 2000);
      ctx = ImageManipulator.manipulate(a.uri);
      if (long > 2000) ctx.resize(a.width >= a.height ? { width: 2000 } : { height: 2000 });
      img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      setPhoto({ uri: out.uri, data: out.base64 ?? undefined });
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
      // Signed in: ask the server's reader (strongest model, structured output, confidence flags).
      // If it is paused or unreachable, fall back to reading on the phone.
      const st = getState();
      const token = await getToken();
      if (token && st.account) {
        try {
          const r = await api.readScheduleAI(token, scan && photo ? { image: { data: photo.data ?? '', mimeType: 'image/jpeg' } } : { text }, st.bellSet?.days ?? NORTH_BELLS);
          setDraft(toPersonal(r.schedule), { flags: r.flags, warnings: r.warnings });
          router.push('/schedule-review');
          return;
        } catch (e) {
          if (!(e instanceof api.ApiError) || !(e.status === 0 || e.status === 503)) throw e;
        }
      }
      const source = scan && photo ? (await extractLines(photo.uri)).join('\n') : text;
      const parsed = parseScheduleText(source);
      if (!parsedSomething(parsed)) return setErr(NOTHING);
      setDraft(toPersonal(parsed));
      router.push('/schedule-review');
    } catch (e) {
      setErr(friendly(e, NOTHING));
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
            {!canScan ? <Note tone="error">Scanning here needs the installed app, or an account (Settings &gt; Account). You can type your schedule instead.</Note> : null}
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
                  <Button title="Take photo" kind="plain" disabled={!canScan} onPress={() => pick(true)} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button title={photo ? 'Pick another' : 'Pick a photo'} kind="plain" disabled={!canScan} onPress={() => pick(false)} />
              </View>
            </View>
            {!canScan ? <Button title="Type it out instead" kind="plain" onPress={() => router.replace({ pathname: '/setup-schedule', params: { mode: 'type' } })} /> : null}
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
            <Text style={{ ...TYPE.medium, fontSize: 15, color: theme.muted }}>Reading your schedule…</Text>
          </View>
        ) : (
          <Button title="Read my schedule" onPress={read} disabled={scan ? !photo : text.trim().length < 3} />
        )}
        <Note>{scan ? (account ? "Your photo is sent once to Studento's reader and isn't kept. " : 'Your photo is read on this phone and never uploaded. ') : ''}The reader can make mistakes: next you check every class and time before anything is saved.</Note>
      </Screen>
    </KeyboardAvoidingView>
  );
}
