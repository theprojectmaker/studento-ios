/**
 * Photos and videos for Beam. Photos are shrunk (long side 1000 px, JPEG ~0.55) and travel
 * inside the message itself as a data URI, so they work on any backend. Videos are too big for
 * that and go to Firebase Storage (beam/<uid>/...), which lives on googleapis.com.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { getApps } from 'firebase/app';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

import { currentUser, fbDb } from './fb';

async function shrink(a: ImagePicker.ImagePickerAsset): Promise<string> {
  const ctx = ImageManipulator.manipulate(a.uri);
  try {
    const long = Math.max(a.width || 1000, a.height || 1000);
    if (long > 1000) ctx.resize(a.width >= a.height ? { width: 1000 } : { height: 1000 });
    const img = await ctx.renderAsync();
    try {
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.55, base64: true });
      return `data:image/jpeg;base64,${out.base64}`;
    } finally {
      img.release();
    }
  } finally {
    ctx.release();
  }
}

/** Pick or take photos. Returns data URIs (at most 4), or [] if cancelled. */
export async function getPhotos(camera: boolean): Promise<string[]> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(camera ? 'Camera access is off. Turn it on in Settings.' : 'Photo access is off. Turn it on in Settings.');
  const res = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: true, selectionLimit: 4 });
  if (res.canceled || !res.assets?.length) return [];
  const out: string[] = [];
  for (const a of res.assets.slice(0, 4)) out.push(await shrink(a));
  return out;
}

/** Pick or record a video (60 s max) and upload it. Returns its link and length. */
export async function getVideo(camera: boolean, onStage?: (s: string) => void): Promise<{ url: string; seconds: number } | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(camera ? 'Camera access is off. Turn it on in Settings.' : 'Photo access is off. Turn it on in Settings.');
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if ((a.fileSize ?? 0) > 60 * 1024 * 1024) throw new Error('That video is too big. Pick one under a minute.');
  onStage?.('Uploading video…');
  fbDb();
  const u = await currentUser();
  if (!u) throw new Error('Sign in first.');
  const blob = await (await fetch(a.uri)).blob();
  const path = `beam/${u.uid}/${Date.now()}.mp4`;
  const r = ref(getStorage(getApps()[0]), path);
  await uploadBytes(r, blob, { contentType: a.mimeType || 'video/mp4' });
  return { url: await getDownloadURL(r), seconds: Math.round((a.duration ?? 0) / 1000) };
}
