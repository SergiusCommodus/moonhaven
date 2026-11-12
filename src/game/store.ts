/**
 * Holds the one GameState, lets time pass, saves, and tells the screen when things change.
 * Every player action goes through `act`, which keeps time up to date first.
 */
import { now } from '../core/clock';
import { advance, type AdvanceResult, type Result } from '../core/rules';
import { loadGame, saveGame } from '../core/save';
import type { GameState } from '../core/state';

type Listener = () => void;

export interface StoreEvents {
  onStamps(ids: string[]): void;
  onFinished(r: AdvanceResult): void;
}

export class Store {
  state: GameState;
  readonly isNew: boolean;
  /** How long the player was away when the game opened (ms). */
  readonly awayMs: number;
  readonly finishedWhileAway: number;
  private listeners = new Set<Listener>();
  private events: StoreEvents = { onStamps: () => {}, onFinished: () => {} };

  constructor() {
    const t = now();
    const { state, isNew } = loadGame(t);
    this.state = state;
    this.isNew = isNew;
    this.awayMs = isNew ? 0 : Math.max(0, t - state.lastTick);
    const r = advance(this.state, t);
    this.finishedWhileAway = r.finished.length;
    this.save();
  }

  setEvents(e: StoreEvents) {
    this.events = e;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const l of this.listeners) l();
  }

  /** Let time pass. Called about once a second. */
  tick() {
    const r = advance(this.state, now());
    if (r.finished.length || r.stamps.length) {
      this.events.onFinished(r);
      if (r.stamps.length) this.events.onStamps(r.stamps);
      this.save();
    }
    this.notify();
  }

  act<T>(fn: (s: GameState, t: number) => Result<T>): Result<T> {
    const t = now();
    const pre = advance(this.state, t);
    if (pre.finished.length) this.events.onFinished(pre);
    const r = fn(this.state, t);
    const stamps = [...pre.stamps, ...(r.stamps ?? [])];
    if (stamps.length) this.events.onStamps(stamps);
    this.save();
    this.notify();
    return r;
  }

  save() {
    saveGame(this.state);
  }

  replace(state: GameState) {
    this.state = state;
    this.save();
    this.notify();
  }
}
