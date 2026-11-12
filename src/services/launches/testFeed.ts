import type { LaunchEvent, LaunchFeed } from './types';

const VEHICLES: [string, string][] = [
  ['Falcon 9', 'SpaceX'],
  ['Electron', 'Rocket Lab'],
  ['New Glenn', 'Blue Origin'],
  ['Ariane 6', 'Arianespace'],
  ['Vulcan', 'ULA'],
  ['Starship', 'SpaceX'],
];

const listeners = new Set<(e: LaunchEvent) => void>();

/** A pretend launch feed. `fireTestLaunch` is called from the hidden test panel. */
export const testFeed: LaunchFeed = {
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  async recent() {
    return [];
  },
};

let n = 0;

export function fireTestLaunch(at = Date.now()): LaunchEvent {
  const [vehicle, provider] = n === 0 ? VEHICLES[0] : VEHICLES[Math.floor(Math.random() * VEHICLES.length)];
  n++;
  const e: LaunchEvent = { id: `test-${at}-${Math.random().toString(36).slice(2, 8)}`, vehicle, provider, at, source: 'test' };
  for (const l of listeners) l(e);
  return e;
}
