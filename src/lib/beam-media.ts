/**
 * Photos and videos for Beam. Photos are shrunk (long side 1000 px, JPEG ~0.55) and travel
 * inside the message itself as a data URI, so they work on any backend. Videos are kept short and
 * low quality so they travel inside the message too (no Storage bucket).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

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

/** Biggest video that fits in one message: base64 makes it 4/3 bigger, and a message holds 900 KB. */
const MAX_VIDEO_BYTES = 640 * 1024;

function toDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that video."));
    r.readAsDataURL(blob);
  });
}

/**
 * Pick or record a short, low-quality video and return it as a data URI that travels inside the
 * message itself (no Storage bucket). Long clips don't fit, so recording stops at 15 seconds.
 */
export async function getVideo(camera: boolean, onStage?: (s: string) => void): Promise<{ url: string; seconds: number } | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(camera ? 'Camera access is off. Turn it on in Settings.' : 'Photo access is off. Turn it on in Settings.');
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: 15, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Low, allowsEditing: true };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  onStage?.('Getting video ready…');
  const blob = await (await fetch(a.uri)).blob();
  if (blob.size > MAX_VIDEO_BYTES) throw new Error('That video is too long to send. Trim it to a few seconds.');
  return { url: await toDataUri(blob), seconds: Math.round((a.duration ?? 0) / 1000) };
}
