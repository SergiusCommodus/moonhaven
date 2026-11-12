import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { createNewState, migrate } from '../src/core/state';
import * as R from '../src/core/rules';

const T0 = 1_700_000_000_000;
const SEC = 1000;
const HOUR = 3600 * SEC;

function fresh() {
  return createNewState(T0);
}
const gh = (s: ReturnType<typeof fresh>) => s.modules.find((m) => m.kind === 'greenhouse')!;

describe('crops', () => {
  it('first potatoes grow fast, later ones take the normal time', () => {
    const s = fresh();
    expect(R.plantAll(s, gh(s).id, 'potato', T0).ok).toBe(true);
    expect(gh(s).plots[0].readyAt - T0).toBe(BALANCE.crops.potato.firstGrowSeconds * SEC);
    expect(R.harvest(s, gh(s).id, T0 + 59 * SEC).ok).toBe(false);
    const h = R.harvest(s, gh(s).id, T0 + 60 * SEC);
    expect(h.ok).toBe(true);
    expect(s.pantry.potato).toBe(2);
    expect(h.stamps).toContain('harvest-potato');
    R.plantAll(s, gh(s).id, 'potato', T0 + 61 * SEC);
    const grow = gh(s).plots[0].readyAt - (T0 + 61 * SEC);
    expect(grow).toBeGreaterThanOrEqual(BALANCE.crops.potato.growSeconds * SEC * BALANCE.crew.speed.cheery - 1);
  });

  it('ready crops wait forever', () => {
    const s = fresh();
    R.plantAll(s, gh(s).id, 'potato', T0);
    expect(R.harvest(s, gh(s).id, T0 + 400 * 24 * HOUR).ok).toBe(true);
  });

  it('locked crop cannot be planted until upgrade', () => {
    const s = fresh();
    expect(R.plantAll(s, gh(s).id, 'pumpkin', T0).ok).toBe(false);
  });
});

describe('idle earning', () => {
  it('fills to the cap and stops, nothing lost', () => {
    const s = fresh();
    s.credits = 1000;
    expect(R.build(s, 'solar', 0, 0, T0).ok).toBe(true);
    const done = s.modules.find((m) => m.kind === 'solar')!.buildingUntil!;
    R.advance(s, done + 1 * HOUR);
    expect(Math.round(s.solarBank)).toBe(BALANCE.modules.solar.creditsPerHour[0]);
    R.advance(s, done + 100 * HOUR);
    expect(s.solarBank).toBe(R.solarCap(s));
    const before = s.credits;
    expect(R.collectSolar(s).value).toBe(R.solarCap(s));
    expect(s.credits).toBe(before + R.solarCap(s));
  });

  it('a clock moving backwards never removes anything', () => {
    const s = fresh();
    s.solarBank = 50;
    s.lastTick = T0 + HOUR;
    R.advance(s, T0);
    expect(s.solarBank).toBe(50);
  });
});

describe('crew', () => {
  it('cheery crew are faster, sleepy crew slower, and mood comes back', () => {
    const s = fresh();
    expect(R.jobSpeed(s, 'engineer')).toBe(BALANCE.crew.speed.cheery);
    R.crewByJob(s, 'engineer').mood = 10;
    expect(R.jobSpeed(s, 'engineer')).toBe(BALANCE.crew.speed.sleepy);
    R.advance(s, T0 + 10 * HOUR);
    expect(R.crewByJob(s, 'engineer').mood).toBe(100);
  });
});

describe('building', () => {
  it('cannot build on the pad or a taken tile, and costs are paid', () => {
    const s = fresh();
    const { pad } = BALANCE.grid;
    expect(R.build(s, 'solar', pad.col, pad.row, T0).ok).toBe(false);
    expect(R.build(s, 'solar', 1, 1, T0).ok).toBe(false);
    const c = s.credits;
    expect(R.build(s, 'solar', 0, 0, T0).ok).toBe(true);
    expect(s.credits).toBe(c - BALANCE.modules.solar.buildCost[0].credits);
  });

  it('upgrades finish over time and add greenhouse plots', () => {
    const s = fresh();
    s.credits = 1000;
    s.parts = 50;
    const g = gh(s);
    expect(R.upgrade(s, g.id, T0).ok).toBe(true);
    R.advance(s, T0 + 1 * HOUR);
    expect(g.level).toBe(2);
    expect(g.plots.length).toBe(BALANCE.modules.greenhouse.plots[1]);
  });
});

describe('rockets', () => {
  it('always arrives, liftoff speeds it up, cargo unloads', () => {
    const s = fresh();
    expect(R.orderRocket(s, T0).ok).toBe(true);
    expect(R.orderRocket(s, T0).ok).toBe(false);
    const trip = s.rocket.arrivesAt - T0;
    R.applyLiftoff(s, 1, T0);
    expect(s.rocket.arrivesAt - T0).toBe(trip - Math.round(trip * BALANCE.rocket.liftoff.maxSpeedup));
    expect(R.unloadRocket(s, T0).ok).toBe(false);
    const u = R.unloadRocket(s, T0 + trip);
    expect(u.value).toEqual(BALANCE.rocket.cargo);
    expect(s.rocket.status).toBe('home');
  });

  it('real launch doubles cargo for 24 hours and drops a pod', () => {
    const s = fresh();
    const r = R.receiveRealLaunch(s, { id: 'L1', vehicle: 'Falcon 9', at: T0 }, T0);
    expect(r.ok).toBe(true);
    expect(R.receiveRealLaunch(s, { id: 'L1', vehicle: 'Falcon 9', at: T0 }, T0).ok).toBe(false);
    R.orderRocket(s, T0 + HOUR);
    const u = R.unloadRocket(s, T0 + 2 * HOUR);
    expect(u.value!.credits).toBe(BALANCE.rocket.cargo.credits * 2);
    expect(R.cargoMultiplier(s, T0 + 25 * HOUR)).toBe(1);
    expect(R.collectPod(s, s.pods[0].id, T0).ok).toBe(false);
    expect(R.collectPod(s, s.pods[0].id, T0 + HOUR).ok).toBe(true);
  });
});

describe('galley', () => {
  it('cooks a meal and serving cheers everyone', () => {
    const s = fresh();
    s.credits = 1000;
    s.parts = 50;
    R.build(s, 'galley', 0, 4, T0);
    const g = s.modules.find((m) => m.kind === 'galley')!;
    R.advance(s, T0 + HOUR);
    s.pantry.potato = 3;
    expect(R.cook(s, g.id, 'fries', T0 + HOUR).ok).toBe(true);
    expect(R.collectMeal(s, g.id, T0 + 2 * HOUR).ok).toBe(true);
    for (const c of s.crew) c.mood = 20;
    expect(R.serveMeal(s, 'fries').ok).toBe(true);
    expect(s.crew[0].mood).toBe(20 + BALANCE.crew.mealMood);
  });
});

describe('save migration', () => {
  it('fills missing fields and survives junk', () => {
    expect(migrate(null, T0).credits).toBe(BALANCE.start.credits);
    const m = migrate({ credits: 5, pantry: { potato: 2 } }, T0);
    expect(m.credits).toBe(5);
    expect(m.pantry.potato).toBe(2);
    expect(m.pantry.pumpkin).toBe(0);
    expect(m.modules.length).toBe(2);
  });
});
