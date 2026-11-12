import { storage } from '../platform/storage';

/**
 * The game clock. Normally the real time.
 * The hidden test panel can push it forward to test long waits.
 */
const OFFSET_KEY = 'moonhaven.dev.timeOffset';

let offset = Number(storage.get(OFFSET_KEY) ?? 0) || 0;

export function now(): number {
  return Date.now() + offset;
}

export function skipAhead(ms: number) {
  offset += ms;
  storage.set(OFFSET_KEY, String(offset));
}

export function resetClock() {
  offset = 0;
  storage.remove(OFFSET_KEY);
}
