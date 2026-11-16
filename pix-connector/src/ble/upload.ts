import type { Backpack } from './Backpack';
import { MODE_ANIMATION } from './constants';
import {
  SavedAnimation, durationsToBytes, frameToBytes, paletteTo3BytesRGB,
} from '../storage/AnimationStore';

// Sequence from original app (mod 739):
// clearScreen → resetFrameCount → palette → frames → durations → direction → setFrameCount → save
export async function uploadAnimation(
  device: Backpack, a: SavedAnimation, onProgress?: (msg: string) => void,
): Promise<void> {
  let max = 0;
  try { max = await device.readMaxFrameCount(); } catch (_) {}
  if (max > 0 && a.frames.length > max) {
    throw new Error(`The backpack holds at most ${max} frames; this animation has ${a.frames.length}.`);
  }
  await device.setRenderModeNone();
  await device.setFrameCount(0);                              // reset: erase previous animation
  await device.setPalette(paletteTo3BytesRGB(a.palette), 0);
  for (let i = 0; i < a.frames.length; i++) {
    onProgress?.(`Uploading frame ${i + 1}/${a.frames.length}…`);
    await device.setFrame(i, frameToBytes(a.frames[i]));     // 8bpp: one byte per palette index
  }
  await device.setFrameDurations(durationsToBytes(a.durations));
  await device.setAnimationDirection(a.animationDirection ?? 0);
  await device.setFrameCount(a.frames.length);                // set actual count last
  await device.saveAnimationToPersistentMemory();
  await device.setRenderMode(MODE_ANIMATION);
}
