// Backpack widgets/games as the original app drives them: config bytes for SET_CONFIG, input codes
// for SET_INPUT, and the minimum firmware each needs.
import {
  MODE_CRAWLER, MODE_PIX_BLOCKS, MODE_PIXEL_BREAKER, MODE_STOPWATCH,
} from './constants';
import { toUint16Bytes } from './utils';

export type GameKey = 'pix-blocks' | 'crawler' | 'pixel-breaker';

export const GAMES: Record<GameKey, {
  label: string;
  about: string;
  config: number[];
  input: { up?: number; down?: number; left?: number; right?: number; a?: number };
  aLabel?: string;
  minFirmware: string;
}> = {
  'pix-blocks': {
    label: 'Pix Blocks',
    about: 'Falling-blocks game, played on the backpack with the arrows and A.',
    config: [MODE_PIX_BLOCKS, ...toUint16Bytes(400), 0],
    input: { up: 1, down: 2, left: 3, right: 4, a: 5 },
    aLabel: 'A',
    minFirmware: '2.2.5',
  },
  crawler: {
    label: 'Crawler',
    about: 'Steer the crawler with the arrows.',
    config: [MODE_CRAWLER, 0],
    input: { up: 1, down: 2, left: 3, right: 4 },
    minFirmware: '2.3.2',
  },
  'pixel-breaker': {
    label: 'Pixel Breaker',
    about: 'Brick-breaker game: move with ◄ ►, A to launch / act.',
    config: [MODE_PIXEL_BREAKER, 0],
    input: { left: 3, right: 4, a: 5 },
    aLabel: 'A',
    minFirmware: '2.4.1',
  },
};

export const STOPWATCH = {
  config: [MODE_STOPWATCH, 0, 1, ...toUint16Bytes(0), 255, 255, 255, 255],
  input: { start: 1, stop: 2, reset: 3, lap: 4 },
  minFirmware: '2.2.5',
};

export const MIN_FIRMWARE = {
  clock: '2.2.1',
  bike: '2.2.1',
  countdown: '2.2.5',
  stopwatch: STOPWATCH.minFirmware,
  dice: '2.3.2',
} as const;

// True if `fw` (e.g. "2.3.0") is at least `min`; unknown firmware counts as OK.
export function firmwareAtLeast(fw: string | undefined, min: string): boolean {
  if (!fw) return true;
  const a = fw.replace(/[^\d.]/g, '').split('.').map(Number);
  const b = min.split('.').map(Number);
  if (!a.length || a.some(isNaN)) return true;
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
