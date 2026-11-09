/** Beam's own settings, kept on this device. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface BeamSettings {
  bubble: string;
  textSize: number;
  alerts: boolean;
  haptics: boolean;
  enterSends: boolean;
  bigEmoji: boolean;
  /** per-chat background by username: a preset id or a photo data URI */
  chatBgs: Record<string, string>;
}
export const BUBBLES = ['#0b84fe', '#34c759', '#af52de', '#ff2d55', '#ff9500', '#5e5ce6', '#30b0c7', '#1c1c1e', '#ff6482', '#64d2ff', '#bf5af2', '#a2845e'];
const DEFAULTS: BeamSettings = { bubble: BUBBLES[0], textSize: 16, alerts: true, haptics: true, enterSends: false, bigEmoji: true, chatBgs: {} };
const KEY = 'beam.settings';

let state: BeamSettings = DEFAULTS;
const subs = new Set<() => void>();
AsyncStorage.getItem(KEY)
  .then((s) => {
    if (!s) return;
    state = { ...DEFAULTS, ...(JSON.parse(s) as Partial<BeamSettings>) };
    subs.forEach((f) => f());
  })
  .catch(() => {});

export const getBeamSettings = () => state;
export function setBeamSetting<K extends keyof BeamSettings>(k: K, v: BeamSettings[K]) {
  state = { ...state, [k]: v };
  subs.forEach((f) => f());
  void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}
const sub = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const useBeamSettings = () => useSyncExternalStore(sub, getBeamSettings, getBeamSettings);


/** Background for one chat ('' = none). */
export function setChatBg(username: string, value: string) {
  const next = { ...state.chatBgs };
  if (value) next[username] = value;
  else delete next[username];
  setBeamSetting('chatBgs', next);
}
