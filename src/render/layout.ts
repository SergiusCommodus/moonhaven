import { BALANCE } from '../config/balance';

export interface Layout {
  w: number;
  h: number;
  portrait: boolean;
  topUI: number;
  bottomUI: number;
  horizonY: number;
  tileW: number;
  tileH: number;
  gridX: number;
  gridY: number;
  cols: number;
  rows: number;
  earth: { x: number; y: number; r: number };
}

export function computeLayout(w: number, h: number, safeTop: number, safeBottom: number): Layout {
  const { cols, rows } = BALANCE.grid;
  const portrait = h >= w;
  const topUI = 62 + safeTop;
  const bottomUI = 84 + safeBottom;
  const mid = h - topUI - bottomUI;
  const horizonY = Math.round(topUI + mid * (portrait ? 0.26 : 0.3));
  const groundTop = horizonY + 10;
  const groundBottom = h - bottomUI - 6;
  const availH = groundBottom - groundTop;
  const tileW = Math.floor(Math.min((w - 20) / cols, availH / (rows * 0.62 + 0.75), 150));
  // On tall phone screens, use the spare height to space rows out a little (reads more top-down).
  const ratio = Math.max(0.62, Math.min(0.82, (availH - tileW * 1.1) / (rows * tileW)));
  const tileH = Math.round(tileW * ratio);
  const gridW = cols * tileW;
  const gridH = rows * tileH;
  const gridX = Math.round((w - gridW) / 2);
  const spare = availH - gridH - tileW * 0.6;
  const gridY = Math.round(groundBottom - gridH - Math.max(4, spare * 0.45));
  const r = Math.round(Math.max(24, Math.min(Math.min(w, h) * 0.085, 64)));
  const earth = { x: Math.round(w * (portrait ? 0.74 : 0.78)), y: Math.round(horizonY - r * 0.75), r };
  return { w, h, portrait, topUI, bottomUI, horizonY, tileW, tileH, gridX, gridY, cols, rows, earth };
}

/** Center of a tile's floor, in screen pixels. */
export function tileCenter(L: Layout, col: number, row: number) {
  return { x: L.gridX + (col + 0.5) * L.tileW, y: L.gridY + (row + 0.5) * L.tileH };
}

export function tileAt(L: Layout, x: number, y: number): { col: number; row: number } | null {
  const col = Math.floor((x - L.gridX) / L.tileW);
  const row = Math.floor((y - L.gridY) / L.tileH);
  if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return null;
  return { col, row };
}

/** Seeded random numbers, so the craters and stars stay put between visits. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
