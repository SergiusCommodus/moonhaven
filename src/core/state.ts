import { BALANCE, CROP_IDS, RECIPE_IDS, type CropId, type ModuleKind, type RecipeId } from '../config/balance';
import { CREW } from '../config/crew';

export const SAVE_VERSION = 1;

export interface Cargo {
  credits: number;
  parts: number;
}

export interface PlotState {
  crop: CropId | null;
  plantedAt: number;
  readyAt: number;
}

export interface CookingState {
  recipe: RecipeId;
  readyAt: number;
}

export interface ModuleState {
  id: string;
  kind: ModuleKind;
  col: number;
  row: number;
  level: number;
  /** Time when construction finishes, or null if built. */
  buildingUntil: number | null;
  /** Time when the current upgrade finishes, or null. */
  upgradingUntil: number | null;
  plots: PlotState[];
  cooking: CookingState | null;
}

export interface CrewState {
  id: string;
  mood: number;
  lastHiAt: number;
}

export type RocketStatus = 'home' | 'flying' | 'landed';

export interface RocketState {
  status: RocketStatus;
  launchedAt: number;
  arrivesAt: number;
  /** Trip length before any Liftoff speed-up, in ms. */
  tripMs: number;
  liftoffScore: number | null;
}

export interface PodState {
  id: string;
  label: string;
  arrivesAt: number;
  cargo: Cargo;
}

export interface BoostState {
  eventId: string;
  vehicle: string;
  startsAt: number;
  endsAt: number;
}

export interface TutorialState {
  planted: boolean;
  built: boolean;
  harvested: boolean;
  ordered: boolean;
  unloaded: boolean;
}

export interface Stats {
  rocketsLaunched: number;
  rocketsLanded: number;
  liftoffTries: number;
  bestLiftoff: number;
  harvested: Record<CropId, number>;
  cooked: Record<RecipeId, number>;
  realLaunchesSeen: number;
  creditsEarned: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  lastTick: number;
  credits: number;
  parts: number;
  /** Solar earnings waiting to be collected. Capped by solarCap(). */
  solarBank: number;
  pantry: Record<CropId, number>;
  meals: Record<RecipeId, number>;
  modules: ModuleState[];
  crew: CrewState[];
  rocket: RocketState;
  pods: PodState[];
  boosts: BoostState[];
  seenLaunchIds: string[];
  stats: Stats;
  tutorial: TutorialState;
  stamps: string[];
  nextId: number;
}

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = 0;
  return out;
}

export function emptyPlots(count: number): PlotState[] {
  return Array.from({ length: count }, () => ({ crop: null, plantedAt: 0, readyAt: 0 }));
}

export function makeModule(id: string, kind: ModuleKind, col: number, row: number, buildingUntil: number | null): ModuleState {
  return {
    id,
    kind,
    col,
    row,
    level: 1,
    buildingUntil,
    upgradingUntil: null,
    plots: kind === 'greenhouse' ? emptyPlots(BALANCE.modules.greenhouse.plots[0]) : [],
    cooking: null,
  };
}

export function createNewState(now: number): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastTick: now,
    credits: BALANCE.start.credits,
    parts: BALANCE.start.parts,
    solarBank: 0,
    pantry: zeroRecord(CROP_IDS),
    meals: zeroRecord(RECIPE_IDS),
    modules: [makeModule('m1', 'habitat', 1, 1, null), makeModule('m2', 'greenhouse', 2, 3, null)],
    crew: CREW.map((c) => ({ id: c.id, mood: BALANCE.crew.startMood, lastHiAt: 0 })),
    rocket: { status: 'home', launchedAt: 0, arrivesAt: 0, tripMs: 0, liftoffScore: null },
    pods: [],
    boosts: [],
    seenLaunchIds: [],
    stats: {
      rocketsLaunched: 0,
      rocketsLanded: 0,
      liftoffTries: 0,
      bestLiftoff: 0,
      harvested: zeroRecord(CROP_IDS),
      cooked: zeroRecord(RECIPE_IDS),
      realLaunchesSeen: 0,
      creditsEarned: 0,
    },
    tutorial: { planted: false, built: false, harvested: false, ordered: false, unloaded: false },
    stamps: [],
    nextId: 3,
  };
}

/**
 * Fill in anything missing from an older or partial save, so new features
 * never break an existing colony.
 */
export function migrate(raw: unknown, now: number): GameState {
  const fresh = createNewState(now);
  if (!raw || typeof raw !== 'object') return fresh;
  const s = raw as Partial<GameState>;
  const merged: GameState = {
    ...fresh,
    ...s,
    version: SAVE_VERSION,
    pantry: { ...fresh.pantry, ...(s.pantry ?? {}) },
    meals: { ...fresh.meals, ...(s.meals ?? {}) },
    stats: {
      ...fresh.stats,
      ...(s.stats ?? {}),
      harvested: { ...fresh.stats.harvested, ...(s.stats?.harvested ?? {}) },
      cooked: { ...fresh.stats.cooked, ...(s.stats?.cooked ?? {}) },
    },
    tutorial: { ...fresh.tutorial, ...(s.tutorial ?? {}) },
    rocket: { ...fresh.rocket, ...(s.rocket ?? {}) },
    modules: Array.isArray(s.modules) && s.modules.length ? s.modules.map((m) => ({ ...makeModule(m.id, m.kind, m.col, m.row, null), ...m })) : fresh.modules,
    crew: fresh.crew.map((c) => ({ ...c, ...(s.crew?.find((x) => x.id === c.id) ?? {}) })),
    pods: Array.isArray(s.pods) ? s.pods : [],
    boosts: Array.isArray(s.boosts) ? s.boosts : [],
    seenLaunchIds: Array.isArray(s.seenLaunchIds) ? s.seenLaunchIds : [],
    stamps: Array.isArray(s.stamps) ? s.stamps : [],
  };
  for (const n of ['credits', 'parts', 'solarBank', 'lastTick', 'createdAt', 'nextId'] as const) {
    if (typeof merged[n] !== 'number' || !Number.isFinite(merged[n])) merged[n] = fresh[n];
  }
  // A clock that jumped backwards should never take anything away.
  if (merged.lastTick > now) merged.lastTick = now;
  return merged;
}
