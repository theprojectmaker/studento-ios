/**
 * Set while something memory-heavy runs (shrinking a photo), so foreground
 * refreshes wait instead of piling on at the same moment.
 */
let heavy = false;

export function setHeavyWork(on: boolean) {
  heavy = on;
}

export function isHeavyWork(): boolean {
  return heavy;
}
