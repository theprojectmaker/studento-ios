/**
 * End-to-end encryption for Beam. Each person has a Curve25519 keypair (tweetnacl box). The
 * secret key never leaves this device (expo-secure-store; localStorage on web); the public key is
 * published at keys/{uid} so the other person can encrypt to it.
 *
 * An encrypted body is self-describing:  E1.<senderPub>.<recipientPub>.<nonce>.<ciphertext>
 * (all base64). Both sides derive the same shared key (my secret + the other side's public key),
 * so I can read what I sent and they can read it too. The server only ever sees ciphertext.
 * Bodies without the E1 prefix are old plaintext messages and show as they are.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import nacl from 'tweetnacl';

nacl.setPRNG((x, n) => {
  const b = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = b[i];
});

export const E2E = 'E1.';
const KEY_NAME = 'beam.e2e.secret.v1';

/* base64 without depending on Buffer */
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 3) {
    const n = (u[i] << 16) | ((u[i + 1] ?? 0) << 8) | (u[i + 2] ?? 0);
    s += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < u.length ? A[(n >> 6) & 63] : '=') + (i + 2 < u.length ? A[n & 63] : '=');
  }
  return s;
}
export function unb64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (A.indexOf(clean[i]) << 18) | (A.indexOf(clean[i + 1]) << 12) | ((A.indexOf(clean[i + 2] ?? 'A') & 63) << 6) | (A.indexOf(clean[i + 3] ?? 'A') & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
// Hand-rolled UTF-8 so it works on Hermes builds without TextDecoder.
function utf8(s: string): Uint8Array {
  const bin = unescape(encodeURIComponent(s));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function unutf8(u: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return decodeURIComponent(escape(bin));
}

async function readSecret(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(KEY_NAME) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY_NAME);
}
async function writeSecret(v: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY_NAME, v);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(KEY_NAME, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}

let mine: Promise<nacl.BoxKeyPair> | null = null;
/** This device's keypair, made on first use. */
export function myKeys(): Promise<nacl.BoxKeyPair> {
  mine ??= (async () => {
    const s = await readSecret();
    if (s) {
      const k = unb64(s);
      if (k.length === nacl.box.secretKeyLength) return nacl.box.keyPair.fromSecretKey(k);
    }
    const kp = nacl.box.keyPair();
    await writeSecret(b64(kp.secretKey));
    return kp;
  })().catch((e) => {
    mine = null;
    throw e;
  });
  return mine;
}
export const myPublicKey = async () => b64((await myKeys()).publicKey);

/** Short safety number for both people to compare (same on both phones). */
export function safetyNumber(a: string, b: string): string {
  const h = nacl.hash(utf8([a, b].sort().join('|')));
  let out = '';
  for (let i = 0; i < 6; i++) out += String(((h[i * 2] << 8) | h[i * 2 + 1]) % 100000).padStart(5, '0') + (i < 5 ? ' ' : '');
  return out;
}

const shared = new Map<string, Uint8Array>();
function sharedKey(peerPub: string, kp: nacl.BoxKeyPair): Uint8Array {
  let k = shared.get(peerPub);
  if (!k) {
    k = nacl.box.before(unb64(peerPub), kp.secretKey);
    shared.set(peerPub, k);
  }
  return k;
}

export const isEncrypted = (body: string) => typeof body === 'string' && body.startsWith(E2E);

export async function encryptFor(peerPub: string, text: string): Promise<string> {
  const kp = await myKeys();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ct = nacl.box.after(utf8(text), nonce, sharedKey(peerPub, kp));
  return `${E2E}${b64(kp.publicKey)}.${peerPub}.${b64(nonce)}.${b64(ct)}`;
}

/** Plaintext of a body, or null if this device can't open it (a key from another device). */
export function decryptWith(kp: nacl.BoxKeyPair, body: string): string | null {
  if (!isEncrypted(body)) return body;
  const [pk, rk, n, ct] = body.slice(E2E.length).split('.');
  if (!pk || !rk || !n || !ct) return null;
  const me = b64(kp.publicKey);
  const peer = pk === me ? rk : rk === me ? pk : null;
  if (!peer) return null;
  try {
    const out = nacl.box.open.after(unb64(ct), unb64(n), sharedKey(peer, kp));
    return out ? unutf8(out) : null;
  } catch {
    return null;
  }
}

/** What a body that this device can't open shows instead. */
export const LOCKED_TEXT = '🔒 Encrypted on another device';
