/**
 * Beam profiles: an optional small photo and a short status line, public to signed-in Beam users
 * at profiles/{uid}. Holds nothing about contacts or chats. Cached here so avatars across the
 * app only read each profile once per session.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { currentUser, fbDb } from './fb';

export interface Profile {
  status: string;
  photo: string;
}
const EMPTY: Profile = { status: '', photo: '' };
export const STATUS_PRESETS = ['Available', 'At school', 'Busy', 'Studying', 'At practice', 'Sleeping', 'Battery low', 'Only urgent'];

const cache = new Map<string, Promise<Profile>>();
const subs = new Set<() => void>();
let version = 0;

async function uidFor(username: string): Promise<string | null> {
  const s = await getDoc(doc(fbDb(), 'usernames', username.trim().toLowerCase()));
  return s.exists() ? ((s.data().uid as string) ?? null) : null;
}

export function getProfile(username: string): Promise<Profile> {
  const k = username.toLowerCase();
  let p = cache.get(k);
  if (!p) {
    p = (async () => {
      const uid = await uidFor(k);
      if (!uid) return EMPTY;
      const d = (await getDoc(doc(fbDb(), 'profiles', uid))).data();
      return { status: String(d?.status ?? ''), photo: String(d?.photo ?? '') };
    })().catch(() => EMPTY);
    cache.set(k, p);
  }
  return p;
}

/** A person's profile (empty until loaded or if they never set one). */
export function useProfile(username: string | undefined): Profile {
  const [p, setP] = useState<Profile>(EMPTY);
  const [v, setV] = useState(version);
  useEffect(() => {
    const f = () => setV(version);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  useEffect(() => {
    if (!username) return;
    let dead = false;
    void getProfile(username).then((x) => !dead && setP(x));
    return () => {
      dead = true;
    };
  }, [username, v]);
  return p;
}

export async function saveMyProfile(username: string, p: Partial<Profile>): Promise<void> {
  const u = await currentUser();
  if (!u) throw new Error('Sign in first.');
  const cur = await getProfile(username);
  const next = { status: (p.status ?? cur.status).slice(0, 80), photo: p.photo ?? cur.photo };
  await setDoc(doc(fbDb(), 'profiles', u.uid), { ...next, at: Date.now() });
  cache.set(username.toLowerCase(), Promise.resolve(next));
  version++;
  subs.forEach((f) => f());
}

/** Pick a photo and shrink it to a 160 px JPEG data URI (fits easily in the profile doc). */
export async function pickProfilePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo access is off. Turn it on in Settings.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: true, aspect: [1, 1] });
  const a = res.canceled ? null : res.assets?.[0];
  if (!a) return null;
  const ctx = ImageManipulator.manipulate(a.uri);
  try {
    ctx.resize(a.width >= a.height ? { height: 160 } : { width: 160 });
    const img = await ctx.renderAsync();
    try {
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      return `data:image/jpeg;base64,${out.base64}`;
    } finally {
      img.release();
    }
  } finally {
    ctx.release();
  }
}
