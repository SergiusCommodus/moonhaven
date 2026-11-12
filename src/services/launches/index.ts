/**
 * Real rocket launches: the ONE place the game gets launch news from.
 *
 * Today the only source is the test feed (fired by hand from the hidden test panel).
 * To plug in Astro Radar later, write an `astroRadarFeed` that implements LaunchFeed
 * (poll or subscribe to Astro Radar, call `emit` for each new liftoff) and change
 * the `feed` line below. Nothing else in the game needs to change.
 */
import { testFeed } from './testFeed';
import type { LaunchFeed } from './types';

export type { LaunchEvent, LaunchFeed } from './types';

export const feed: LaunchFeed = testFeed;
