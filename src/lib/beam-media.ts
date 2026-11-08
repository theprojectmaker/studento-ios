/**
 * Photos and videos for Beam. Photos are shrunk (long side 1000 px, JPEG ~0.55) and travel
 * inside the message itself as a data URI, so they work on any backend. Videos will go to
 * Firebase Storage once that backend is live.
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

/** Videos need the Firebase Storage backend (see the side-session note); not live yet. */
 
export async function getVideo(_camera: boolean, _onStage?: (s: string) => void): Promise<{ url: string; seconds: number } | null> {
  throw new Error('Videos are coming soon.');
}
