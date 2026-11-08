/**
 * Is the screen being recorded, mirrored or shared right now? iOS reports it through the
 * CaptureGuard module (modules/capture-guard); on web and in Expo Go it is always false.
 */
import { requireOptionalNativeModule } from 'expo';
import { useSyncExternalStore } from 'react';

type Native = {
  isCaptured(): Promise<boolean>;
  addListener(event: 'onChange', cb: (e: { captured: boolean }) => void): { remove(): void };
};
const CaptureGuard = requireOptionalNativeModule<Native>('CaptureGuard');

let captured = false;
const subs = new Set<() => void>();
function set(v: boolean) {
  if (v === captured) return;
  captured = v;
  subs.forEach((f) => f());
}
if (CaptureGuard) {
  void CaptureGuard.isCaptured()
    .then(set)
    .catch(() => {});
  CaptureGuard.addListener('onChange', (e) => set(!!e.captured));
}

export const isCapturing = () => captured;
export function onCapture(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
export const useCapturing = () => useSyncExternalStore(onCapture, isCapturing, isCapturing);
