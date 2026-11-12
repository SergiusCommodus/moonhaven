import { storage } from '../platform/storage';
import { migrate, type GameState } from './state';

const SAVE_KEY = 'moonhaven.save.v1';
const BACKUP_KEY = 'moonhaven.save.v1.backup';

export function loadGame(now: number): { state: GameState; isNew: boolean } {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const raw = storage.get(key);
      if (raw) return { state: migrate(JSON.parse(raw), now), isNew: false };
    } catch {
      /* broken save: try the backup, then start fresh */
    }
  }
  return { state: migrate(null, now), isNew: true };
}

let lastSaved = '';
let disabled = false;

export function saveGame(state: GameState): boolean {
  if (disabled) return false;
  try {
    const json = JSON.stringify(state);
    if (json === lastSaved) return true;
    if (lastSaved) storage.set(BACKUP_KEY, lastSaved);
    lastSaved = json;
    return storage.set(SAVE_KEY, json);
  } catch {
    return false;
  }
}

/** Erase the colony. Saving stays off until the page reloads. */
export function wipeSave() {
  disabled = true;
  lastSaved = '';
  storage.remove(SAVE_KEY);
  storage.remove(BACKUP_KEY);
}
