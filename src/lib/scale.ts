import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const short = Math.min(width, height);

/** iPad (any screen 700pt+ on its short side) gets 1.3x bigger type, rows and controls. */
export const TABLET = short >= 700;
export const SCALE = TABLET ? 1.3 : 1;

/** Scale a point size for the device: 17 on a phone, 22 on an iPad. */
export function sz(n: number): number {
  return Math.round(n * SCALE * 2) / 2;
}
