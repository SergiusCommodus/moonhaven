/**
 * Game rules. Plain functions that read and change GameState.
 * No drawing, no browser APIs, so they are easy to test and reuse.
 * Every function takes `now` (ms) so time is fully under control.
 */
import { BALANCE, CROP_IDS, type CropId, type ModuleKind, type RecipeId } from '../config/balance';
import { CREW, type Job } from '../config/crew';
import { emptyPlots, makeModule, type Cargo, type GameState, type ModuleState } from './state';

const SEC = 1000;
const HOUR_MS = 3600 * SEC;

export interface Result<T = undefined> {
  ok: boolean;
  reason?: string;
  value?: T;
  /** Stamps newly earned by this action. */
  stamps?: string[];
}

const fail = (reason: string): Result<never> => ({ ok: false, reason });

// ---------- Crew ----------

export type MoodLabel = 'Cheery' | 'Steady' | 'Sleepy';

export function moodLabel(mood: number): MoodLabel {
  if (mood >= BALANCE.crew.cheery) return 'Cheery';
  if (mood < BALANCE.crew.sleepy) return 'Sleepy';
  return 'Steady';
}

export function crewByJob(state: GameState, job: Job) {
  const profile = CREW.find((c) => c.job === job)!;
  return state.crew.find((c) => c.id === profile.id)!;
}

/** Time multiplier for a job. Under 1 means faster. */
export function jobSpeed(state: GameState, job: Job): number {
  const label = moodLabel(crewByJob(state, job).mood);
  if (label === 'Cheery') return BALANCE.crew.speed.cheery;
  if (label === 'Sleepy') return BALANCE.crew.speed.sleepy;
  return BALANCE.crew.speed.steady;
}

function useMood(state: GameState, job: Job, amount: number) {
  const c = crewByJob(state, job);
  c.mood = Math.max(0, c.mood - amount);
}

function habitatLevel(state: GameState): number {
  const h = state.modules.find((m) => m.kind === 'habitat' && m.buildingUntil === null);
  return h ? h.level : 1;
}

export function moodPerHour(state: GameState): number {
  const table = BALANCE.modules.habitat.moodPerHour;
  return table[Math.min(habitatLevel(state), table.length) - 1];
}

export function sayHi(state: GameState, crewId: string, now: number): Result<string> {
  const c = state.crew.find((x) => x.id === crewId);
  const profile = CREW.find((x) => x.id === crewId);
  if (!c || !profile) return fail('No such crew member.');
  const line = profile.lines[Math.floor((now / 1000) % profile.lines.length)];
  const ready = now - c.lastHiAt >= BALANCE.crew.sayHi.cooldownSeconds * SEC;
  if (ready) {
    c.mood = Math.min(100, c.mood + BALANCE.crew.sayHi.mood);
    c.lastHiAt = now;
  }
  return { ok: true, value: line, stamps: checkCrewStamps(state) };
}

export function canSayHi(state: GameState, crewId: string, now: number): boolean {
  const c = state.crew.find((x) => x.id === crewId);
  return !!c && now - c.lastHiAt >= BALANCE.crew.sayHi.cooldownSeconds * SEC;
}

/** Share a snack: uses the cheapest crop in the pantry. */
export function shareSnack(state: GameState, crewId: string): Result<CropId> {
  const c = state.crew.find((x) => x.id === crewId);
  if (!c) return fail('No such crew member.');
  if (c.mood >= 100) return fail('Already full of beans!');
  const crop = [...CROP_IDS].sort((a, b) => BALANCE.crops[a].sellPrice - BALANCE.crops[b].sellPrice).find((id) => state.pantry[id] > 0);
  if (!crop) return fail('The pantry is empty. Harvest some crops first.');
  state.pantry[crop] -= 1;
  c.mood = Math.min(100, c.mood + BALANCE.crew.snackMood);
  return { ok: true, value: crop, stamps: checkCrewStamps(state) };
}

function checkCrewStamps(state: GameState): string[] {
  if (state.crew.every((c) => c.mood >= BALANCE.crew.cheery)) return award(state, 'all-cheery');
  return [];
}

// ---------- Stamps ----------

export function award(state: GameState, ...ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!state.stamps.includes(id)) {
      state.stamps.push(id);
      out.push(id);
    }
  }
  return out;
}

// ---------- Time passing ----------

export function solarRatePerHour(state: GameState): number {
  const table = BALANCE.modules.solar.creditsPerHour;
  return state.modules
    .filter((m) => m.kind === 'solar' && m.buildingUntil === null)
    .reduce((sum, m) => sum + table[Math.min(m.level, table.length) - 1], 0);
}

export function solarCap(state: GameState): number {
  return Math.floor(solarRatePerHour(state) * BALANCE.idle.capHours);
}

/**
 * Let time pass: solar earnings fill up (to the cap), crew rest,
 * and finished construction and upgrades complete.
 * Safe to call as often as you like. Never takes anything away.
 */
export interface AdvanceResult {
  stamps: string[];
  /** Modules whose construction or upgrade finished during this step. */
  finished: ModuleState[];
}

export function advance(state: GameState, now: number): AdvanceResult {
  const stamps: string[] = [];
  const finished: ModuleState[] = [];
  // Finish construction and upgrades in time order, so new farms earn from the moment they finish.
  const due = state.modules
    .flatMap((m) => [
      ...(m.buildingUntil !== null && now >= m.buildingUntil ? [{ m, at: m.buildingUntil, kind: 'build' as const }] : []),
      ...(m.upgradingUntil !== null && now >= m.upgradingUntil ? [{ m, at: m.upgradingUntil, kind: 'upgrade' as const }] : []),
    ])
    .sort((a, b) => a.at - b.at);
  for (const { m, at, kind } of due) {
    stepTime(state, at);
    finished.push(m);
    if (kind === 'build') {
      m.buildingUntil = null;
    } else {
      m.upgradingUntil = null;
      m.level = Math.min(BALANCE.upgrades.maxLevel, m.level + 1);
      if (m.kind === 'greenhouse') {
        const want = BALANCE.modules.greenhouse.plots[m.level - 1];
        while (m.plots.length < want) m.plots.push(...emptyPlots(1));
      }
      stamps.push(...award(state, 'upgrade-any'));
      if (m.level >= BALANCE.upgrades.maxLevel) stamps.push(...award(state, 'max-level'));
    }
  }
  stepTime(state, now);
  return { stamps, finished };
}

function stepTime(state: GameState, until: number) {
  const dt = until - state.lastTick;
  if (dt <= 0) return;
  const hours = dt / HOUR_MS;
  const cap = solarCap(state);
  if (state.solarBank < cap) state.solarBank = Math.min(cap, state.solarBank + solarRatePerHour(state) * hours);
  const regen = moodPerHour(state) * hours;
  for (const c of state.crew) c.mood = Math.min(100, c.mood + regen);
  state.lastTick = until;
}

export function collectSolar(state: GameState): Result<number> {
  const amount = Math.floor(state.solarBank);
  if (amount <= 0) return fail('The batteries are still charging.');
  state.solarBank -= amount;
  addCredits(state, amount);
  return { ok: true, value: amount };
}

function addCredits(state: GameState, n: number) {
  state.credits += n;
  state.stats.creditsEarned += n;
}

// ---------- Building ----------

export function countOf(state: GameState, kind: ModuleKind): number {
  return state.modules.filter((m) => m.kind === kind).length;
}

export function nextBuildCost(state: GameState, kind: ModuleKind): Cargo | null {
  const def = BALANCE.modules[kind];
  const n = countOf(state, kind);
  if (n >= def.maxCount) return null;
  return def.buildCost[Math.min(n, def.buildCost.length - 1)];
}

export function isTileFree(state: GameState, col: number, row: number): boolean {
  const { cols, rows, pad } = BALANCE.grid;
  if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
  if (col === pad.col && row === pad.row) return false;
  return !state.modules.some((m) => m.col === col && m.row === row);
}

export function build(state: GameState, kind: ModuleKind, col: number, row: number, now: number): Result<ModuleState> {
  const cost = nextBuildCost(state, kind);
  if (!cost) return fail(`You have all the ${BALANCE.modules[kind].name}s you can build.`);
  if (!isTileFree(state, col, row)) return fail('That spot is taken.');
  if (state.credits < cost.credits || state.parts < cost.parts) return fail(needText(state, cost));
  advance(state, now);
  state.credits -= cost.credits;
  state.parts -= cost.parts;
  const n = countOf(state, kind);
  const secs = BALANCE.modules[kind].buildSeconds[Math.min(n, BALANCE.modules[kind].buildSeconds.length - 1)];
  const m = makeModule(`m${state.nextId++}`, kind, col, row, now + Math.round(secs * jobSpeed(state, 'engineer') * SEC));
  state.modules.push(m);
  useMood(state, 'engineer', BALANCE.crew.moodCost.build);
  state.tutorial.built = state.tutorial.built || kind === 'solar';
  const stamps: string[] = [];
  if (kind === 'solar') stamps.push(...award(state, 'build-solar'));
  if (kind === 'greenhouse') stamps.push(...award(state, 'build-greenhouse'));
  if (kind === 'galley') stamps.push(...award(state, 'build-galley'));
  return { ok: true, value: m, stamps };
}

export function upgradeCost(m: ModuleState) {
  if (m.level >= BALANCE.upgrades.maxLevel) return null;
  return BALANCE.upgrades.cost[m.level - 1];
}

export function upgrade(state: GameState, moduleId: string, now: number): Result {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m) return fail('Module not found.');
  if (m.buildingUntil !== null) return fail('Still being built.');
  if (m.upgradingUntil !== null) return fail('Already upgrading.');
  const cost = upgradeCost(m);
  if (!cost) return fail('Already at the top level.');
  if (state.credits < cost.credits || state.parts < cost.parts) return fail(needText(state, cost));
  advance(state, now);
  state.credits -= cost.credits;
  state.parts -= cost.parts;
  m.upgradingUntil = now + Math.round(cost.seconds * jobSpeed(state, 'engineer') * SEC);
  useMood(state, 'engineer', BALANCE.crew.moodCost.upgrade);
  return { ok: true };
}

export function needText(state: GameState, cost: Cargo): string {
  const parts: string[] = [];
  if (state.credits < cost.credits) parts.push(`${Math.ceil(cost.credits - state.credits)} more credits`);
  if (state.parts < cost.parts) parts.push(`${cost.parts - state.parts} more parts`);
  return `Need ${parts.join(' and ')}.`;
}

export function isBusy(m: ModuleState, now: number): boolean {
  return (m.buildingUntil !== null && now < m.buildingUntil) || (m.upgradingUntil !== null && now < m.upgradingUntil);
}

// ---------- Crops ----------

export function cropUnlocked(m: ModuleState, crop: CropId): boolean {
  return m.level >= BALANCE.crops[crop].unlockGreenhouseLevel;
}

export function growMs(state: GameState, crop: CropId): number {
  const def = BALANCE.crops[crop];
  const first = crop === 'potato' && !state.tutorial.planted;
  const base = first ? BALANCE.crops.potato.firstGrowSeconds : def.growSeconds;
  return Math.round(base * (first ? 1 : jobSpeed(state, 'botanist')) * SEC);
}

export function plantAll(state: GameState, moduleId: string, crop: CropId, now: number): Result<number> {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m || m.kind !== 'greenhouse') return fail('Not a greenhouse.');
  if (m.buildingUntil !== null && now < m.buildingUntil) return fail('Still being built.');
  if (!cropUnlocked(m, crop)) return fail(`Upgrade this Greenhouse to level ${BALANCE.crops[crop].unlockGreenhouseLevel} first.`);
  const free = m.plots.filter((p) => p.crop === null);
  if (free.length === 0) return fail('Every spot is growing something.');
  advance(state, now);
  const ms = growMs(state, crop);
  for (const p of free) {
    p.crop = crop;
    p.plantedAt = now;
    p.readyAt = now + ms;
  }
  useMood(state, 'botanist', BALANCE.crew.moodCost.plant);
  state.tutorial.planted = true;
  return { ok: true, value: free.length };
}

export function readyCount(m: ModuleState, now: number): number {
  return m.plots.filter((p) => p.crop !== null && now >= p.readyAt).length;
}

export function harvest(state: GameState, moduleId: string, now: number): Result<Partial<Record<CropId, number>>> {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m) return fail('Module not found.');
  const got: Partial<Record<CropId, number>> = {};
  const stamps: string[] = [];
  for (const p of m.plots) {
    if (p.crop !== null && now >= p.readyAt) {
      const crop = p.crop;
      got[crop] = (got[crop] ?? 0) + 1;
      state.pantry[crop] += 1;
      state.stats.harvested[crop] += 1;
      stamps.push(...award(state, `harvest-${crop}`));
      p.crop = null;
      p.plantedAt = 0;
      p.readyAt = 0;
    }
  }
  if (Object.keys(got).length === 0) return fail('Nothing is ready yet.');
  state.tutorial.harvested = true;
  return { ok: true, value: got, stamps };
}

export function sellCrop(state: GameState, crop: CropId, count: number): Result<number> {
  const n = Math.min(count, state.pantry[crop]);
  if (n <= 0) return fail('None to sell.');
  state.pantry[crop] -= n;
  const earned = n * BALANCE.crops[crop].sellPrice;
  addCredits(state, earned);
  return { ok: true, value: earned };
}

export function sellAllCrops(state: GameState): Result<number> {
  let total = 0;
  for (const c of CROP_IDS) {
    if (state.pantry[c] > 0) total += sellCrop(state, c, state.pantry[c]).value ?? 0;
  }
  if (total === 0) return fail('The pantry is empty.');
  return { ok: true, value: total };
}

// ---------- Rockets ----------

export function boostActive(state: GameState, at: number): boolean {
  return state.boosts.some((b) => at >= b.startsAt && at < b.endsAt);
}

export function activeBoost(state: GameState, now: number) {
  return state.boosts.filter((b) => now >= b.startsAt && now < b.endsAt).sort((a, b) => b.endsAt - a.endsAt)[0] ?? null;
}

export function cargoMultiplier(state: GameState, at: number): number {
  return boostActive(state, at) ? BALANCE.realLaunch.cargoMultiplier : 1;
}

/** Order a rocket. It launches right away on Auto and always arrives on its own. */
export function orderRocket(state: GameState, now: number): Result<number> {
  syncRocket(state, now);
  if (state.rocket.status === 'flying') return fail('A rocket is already on the way.');
  if (state.rocket.status === 'landed') return fail('Unload the rocket on the pad first.');
  advance(state, now);
  const first = state.stats.rocketsLaunched === 0;
  const ms = Math.round((first ? BALANCE.rocket.firstTravelSeconds : BALANCE.rocket.travelSeconds * jobSpeed(state, 'pilot')) * SEC);
  state.rocket = { status: 'flying', launchedAt: now, arrivesAt: now + ms, tripMs: ms, liftoffScore: null };
  state.stats.rocketsLaunched += 1;
  useMood(state, 'pilot', BALANCE.crew.moodCost.launch);
  state.tutorial.ordered = true;
  return { ok: true, value: ms };
}

/** Apply a Liftoff mini game score (0 to 1). Shortens the trip that is already under way. */
export function applyLiftoff(state: GameState, score: number, now: number): Result<number> {
  const r = state.rocket;
  if (r.status !== 'flying') return fail('No rocket in flight.');
  if (r.liftoffScore !== null) return fail('Liftoff already flown.');
  const s = Math.max(0, Math.min(1, score));
  r.liftoffScore = s;
  state.stats.liftoffTries += 1;
  state.stats.bestLiftoff = Math.max(state.stats.bestLiftoff, s);
  const saved = Math.round(r.tripMs * BALANCE.rocket.liftoff.maxSpeedup * s);
  r.arrivesAt = Math.max(now, r.arrivesAt - saved);
  const stamps = s >= 0.9 ? award(state, 'liftoff-smooth') : [];
  return { ok: true, value: saved, stamps };
}

export function syncRocket(state: GameState, now: number) {
  if (state.rocket.status === 'flying' && now >= state.rocket.arrivesAt) state.rocket.status = 'landed';
}

export function rocketCargo(state: GameState): Cargo {
  const mult = Math.max(cargoMultiplier(state, state.rocket.launchedAt), cargoMultiplier(state, state.rocket.arrivesAt));
  return { credits: BALANCE.rocket.cargo.credits * mult, parts: BALANCE.rocket.cargo.parts * mult };
}

export function unloadRocket(state: GameState, now: number): Result<Cargo> {
  syncRocket(state, now);
  if (state.rocket.status !== 'landed') return fail('No rocket on the pad.');
  const cargo = rocketCargo(state);
  addCredits(state, cargo.credits);
  state.parts += cargo.parts;
  state.rocket = { status: 'home', launchedAt: 0, arrivesAt: 0, tripMs: 0, liftoffScore: null };
  state.stats.rocketsLanded += 1;
  state.tutorial.unloaded = true;
  const stamps = award(state, 'rocket-landed');
  if (state.stats.rocketsLanded >= 10) stamps.push(...award(state, 'rockets-10'));
  return { ok: true, value: cargo, stamps };
}

// ---------- Real launches ----------

export interface LaunchInfo {
  id: string;
  vehicle: string;
  /** When the real rocket lifted off (ms). */
  at: number;
}

/** A real rocket lifted off on Earth: double cargo for a while and a free supply pod. */
export function receiveRealLaunch(state: GameState, launch: LaunchInfo, now: number): Result<string> {
  if (state.seenLaunchIds.includes(launch.id)) return fail('Already seen.');
  state.seenLaunchIds.push(launch.id);
  if (state.seenLaunchIds.length > 100) state.seenLaunchIds.splice(0, state.seenLaunchIds.length - 100);
  const startsAt = Math.min(launch.at, now);
  const endsAt = startsAt + BALANCE.realLaunch.boostHours * HOUR_MS;
  if (endsAt <= now) return fail('That launch boost is already over.');
  state.boosts.push({ eventId: launch.id, vehicle: launch.vehicle, startsAt, endsAt });
  state.boosts = state.boosts.filter((b) => b.endsAt > now);
  const drop = BALANCE.realLaunch.supplyDrop;
  state.pods.push({
    id: `p${state.nextId++}`,
    label: `${launch.vehicle} supply drop`,
    arrivesAt: now + drop.arriveSeconds * SEC,
    cargo: { credits: drop.credits, parts: drop.parts },
  });
  state.stats.realLaunchesSeen += 1;
  return { ok: true, value: launch.vehicle, stamps: award(state, 'real-launch') };
}

export function collectPod(state: GameState, podId: string, now: number): Result<Cargo> {
  const i = state.pods.findIndex((p) => p.id === podId);
  if (i < 0) return fail('No such pod.');
  const pod = state.pods[i];
  if (now < pod.arrivesAt) return fail('Still on the way.');
  state.pods.splice(i, 1);
  addCredits(state, pod.cargo.credits);
  state.parts += pod.cargo.parts;
  return { ok: true, value: pod.cargo };
}

// ---------- Galley ----------

export function canCook(state: GameState, recipe: RecipeId): boolean {
  const needs = BALANCE.galley.recipes[recipe].needs as Partial<Record<CropId, number>>;
  return (Object.keys(needs) as CropId[]).every((c) => state.pantry[c] >= (needs[c] ?? 0));
}

export function cook(state: GameState, moduleId: string, recipe: RecipeId, now: number): Result {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m || m.kind !== 'galley') return fail('Not a galley.');
  if (isBusy(m, now)) return fail('The Galley is still being built.');
  if (m.cooking) return fail('Something is already cooking.');
  if (!canCook(state, recipe)) return fail('Not enough crops in the pantry.');
  advance(state, now);
  const def = BALANCE.galley.recipes[recipe];
  const needs = def.needs as Partial<Record<CropId, number>>;
  for (const c of Object.keys(needs) as CropId[]) state.pantry[c] -= needs[c] ?? 0;
  // A higher-level Galley cooks faster.
  const speed = 1 - 0.1 * (m.level - 1);
  m.cooking = { recipe, readyAt: now + Math.round(def.cookSeconds * speed * SEC) };
  useMood(state, 'botanist', BALANCE.crew.moodCost.cook);
  return { ok: true };
}

export function collectMeal(state: GameState, moduleId: string, now: number): Result<RecipeId> {
  const m = state.modules.find((x) => x.id === moduleId);
  if (!m || !m.cooking) return fail('Nothing cooking.');
  if (now < m.cooking.readyAt) return fail('Not ready yet.');
  const r = m.cooking.recipe;
  state.meals[r] += 1;
  state.stats.cooked[r] += 1;
  m.cooking = null;
  return { ok: true, value: r, stamps: award(state, 'meal-cooked') };
}

export function serveMeal(state: GameState, recipe: RecipeId): Result {
  if (state.meals[recipe] <= 0) return fail('No meal to serve.');
  state.meals[recipe] -= 1;
  for (const c of state.crew) c.mood = Math.min(100, c.mood + BALANCE.crew.mealMood);
  return { ok: true, stamps: checkCrewStamps(state) };
}

export function sellMeal(state: GameState, recipe: RecipeId): Result<number> {
  if (state.meals[recipe] <= 0) return fail('No meal to sell.');
  state.meals[recipe] -= 1;
  const price = BALANCE.galley.recipes[recipe].sellPrice;
  addCredits(state, price);
  return { ok: true, value: price };
}

// ---------- Welcome back ----------

export interface AwaySummary {
  awayMs: number;
  solar: number;
  solarFull: boolean;
  cropsReady: number;
  rocketLanded: boolean;
  podsLanded: number;
  buildsDone: number;
}

export function awaySummary(state: GameState, awayMs: number, buildsDone: number, now: number): AwaySummary {
  syncRocket(state, now);
  return {
    awayMs,
    solar: Math.floor(state.solarBank),
    solarFull: solarCap(state) > 0 && state.solarBank >= solarCap(state) - 0.5,
    cropsReady: state.modules.reduce((n, m) => n + readyCount(m, now), 0),
    rocketLanded: state.rocket.status === 'landed',
    podsLanded: state.pods.filter((p) => now >= p.arrivesAt).length,
    buildsDone,
  };
}
