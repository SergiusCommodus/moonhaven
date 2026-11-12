/**
 * All the drawings, made from simple shapes. No image files.
 * Each function draws around (0, 0) = the middle of the tile floor.
 * `s` is the tile width in pixels.
 */
import { Graphics } from 'pixi.js';
import { C, CROP_COLOR } from './palette';

function halfEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, steps = 18) {
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI + (Math.PI * i) / steps;
    const x = cx + rx * Math.cos(t);
    const y = cy + ry * Math.sin(t);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
}

function dome(g: Graphics, cx: number, cy: number, r: number) {
  g.moveTo(cx - r, cy).arc(cx, cy, r, Math.PI, 0).closePath();
}

export function shadow(g: Graphics, s: number, wide = 0.44) {
  g.ellipse(0, s * 0.06, s * wide, s * 0.13).fill({ color: 0x120c2e, alpha: 0.35 });
}

function levelPips(g: Graphics, s: number, level: number) {
  const gap = s * 0.09;
  const start = -((level - 1) * gap) / 2;
  for (let i = 0; i < level; i++) {
    g.circle(start + i * gap, s * 0.17, s * 0.028).fill(C.gold).stroke({ width: 1, color: C.ink, alpha: 0.5 });
  }
}

export function drawHabitat(g: Graphics, s: number, level: number) {
  shadow(g, s, 0.46);
  const cy = -s * 0.08;
  // Side domes come with higher levels.
  if (level >= 2) {
    const r2 = s * 0.17;
    dome(g, -s * 0.33, cy + s * 0.04, r2);
    g.fill(C.chromeMid);
    g.circle(-s * 0.33, cy - r2 * 0.4 + s * 0.04, r2 * 0.22).fill(C.gold);
  }
  if (level >= 3) {
    const r3 = s * 0.15;
    dome(g, s * 0.34, cy + s * 0.05, r3);
    g.fill(C.chromeMid);
    g.circle(s * 0.34, cy - r3 * 0.4 + s * 0.05, r3 * 0.22).fill(C.gold);
  }
  g.roundRect(-s * 0.36, cy - s * 0.02, s * 0.72, s * 0.12, s * 0.05).fill(C.chromeDark);
  const R = s * (0.3 + 0.015 * level);
  dome(g, 0, cy, R);
  g.fill(C.chrome);
  // Shade the right side for a rounded look.
  g.moveTo(R * 0.25, cy).arc(0, cy, R, -Math.PI * 0.42, 0).closePath().fill({ color: C.chromeMid, alpha: 0.7 });
  g.rect(-R * 0.97, cy - R * 0.3, R * 1.94, R * 0.14).fill(C.rose);
  for (const x of [-0.5, 0, 0.5]) {
    g.circle(x * R, cy - R * 0.58, R * 0.12).fill(C.gold).stroke({ width: Math.max(1, s * 0.02), color: C.chromeDark });
  }
  g.ellipse(-R * 0.45, cy - R * 0.7, R * 0.12, R * 0.2).fill({ color: 0xffffff, alpha: 0.75 });
  // Antenna
  g.moveTo(0, cy - R).lineTo(0, cy - R - s * 0.16).stroke({ width: Math.max(1.5, s * 0.025), color: C.chromeDark });
  g.circle(0, cy - R - s * 0.17, s * 0.035).fill(level >= 5 ? C.gold : C.rose);
  if (level >= 4) {
    g.moveTo(R * 0.55, cy - R * 0.8).lineTo(R * 0.85, cy - R * 1.15).stroke({ width: Math.max(1, s * 0.02), color: C.chromeDark });
    g.ellipse(R * 0.88, cy - R * 1.18, s * 0.07, s * 0.035).fill(C.chromeMid);
  }
  g.roundRect(-s * 0.07, cy - s * 0.1, s * 0.14, s * 0.12, s * 0.05).fill(C.purple);
  levelPips(g, s, level);
}

export interface GreenhouseLook {
  plots: { crop: string | null; progress: number; ready: boolean }[];
}

export function drawGreenhouse(g: Graphics, s: number, level: number, look: GreenhouseLook) {
  shadow(g, s, 0.47);
  const cy = -s * 0.06;
  const R = s * (0.36 + 0.01 * level);
  g.roundRect(-R - s * 0.04, cy - s * 0.03, 2 * R + s * 0.08, s * 0.12, s * 0.05).fill(C.chromeDark);
  g.rect(-R - s * 0.04, cy, 2 * R + s * 0.08, s * 0.03).fill(C.gold);
  // Plants inside the glass.
  const n = look.plots.length;
  for (let i = 0; i < n; i++) {
    const p = look.plots[i];
    const x = -R * 0.72 + (R * 1.44 * (i + 0.5)) / n;
    const y = cy - s * 0.03;
    if (!p.crop) {
      g.ellipse(x, y, s * 0.045, s * 0.018).fill({ color: 0x5a3f2a, alpha: 0.8 });
      continue;
    }
    const grow = p.ready ? 1 : 0.35 + 0.65 * p.progress;
    const h = s * 0.16 * grow;
    g.moveTo(x, y).lineTo(x, y - h).stroke({ width: Math.max(1, s * 0.02), color: C.leafDark });
    g.ellipse(x - s * 0.035, y - h * 0.6, s * 0.04 * grow, s * 0.02 * grow).fill(C.leaf);
    g.ellipse(x + s * 0.035, y - h * 0.75, s * 0.04 * grow, s * 0.02 * grow).fill(C.leaf);
    if (p.ready) g.circle(x, y - h - s * 0.02, s * 0.04).fill(CROP_COLOR[p.crop] ?? C.gold);
  }
  dome(g, 0, cy, R);
  g.fill({ color: C.glass, alpha: 0.38 });
  const sw = Math.max(1, s * 0.018);
  for (const k of [0.38, 0.75]) {
    halfEllipse(g, 0, cy, R * k, R);
    g.stroke({ width: sw, color: C.chrome, alpha: 0.8 });
  }
  g.moveTo(-R * 0.87, cy - R * 0.5).lineTo(R * 0.87, cy - R * 0.5).stroke({ width: sw, color: C.chrome, alpha: 0.8 });
  dome(g, 0, cy, R);
  g.stroke({ width: Math.max(1.5, s * 0.03), color: C.chrome });
  g.ellipse(-R * 0.5, cy - R * 0.62, R * 0.1, R * 0.22).fill({ color: 0xffffff, alpha: 0.6 });
  g.circle(0, cy - R - s * 0.025, s * 0.035).fill(C.teal);
  levelPips(g, s, level);
}

export function drawSolar(g: Graphics, s: number, level: number, charge: number) {
  shadow(g, s, 0.46);
  const panels = Math.min(4, 1 + Math.ceil(level / 2));
  const pw = (s * 0.78) / panels;
  const legW = Math.max(1, s * 0.025);
  for (let i = 0; i < panels; i++) {
    const x0 = -s * 0.4 + i * pw + pw * 0.08;
    const w = pw * 0.84;
    const yb = -s * 0.1;
    const yt = -s * 0.36;
    g.moveTo(x0 + w * 0.5, s * 0.02).lineTo(x0 + w * 0.5, yb + s * 0.04).stroke({ width: legW, color: C.chromeDark });
    g.poly([x0, yb, x0 + w, yb, x0 + w * 0.92, yt, x0 + w * 0.08, yt]).fill(0x3b2f8f).stroke({ width: Math.max(1, s * 0.02), color: C.gold });
    g.moveTo(x0 + w * 0.04, (yb + yt) / 2).lineTo(x0 + w * 0.96, (yb + yt) / 2).stroke({ width: 1, color: C.purple, alpha: 0.9 });
    g.moveTo(x0 + w * 0.5, yb).lineTo(x0 + w * 0.5, yt).stroke({ width: 1, color: C.purple, alpha: 0.9 });
    g.poly([x0 + w * 0.12, yt + s * 0.02, x0 + w * 0.3, yt + s * 0.02, x0 + w * 0.22, yb - s * 0.02, x0 + w * 0.08, yb - s * 0.02]).fill({ color: 0xffffff, alpha: 0.18 });
  }
  // Battery box with a charge meter.
  const bx = s * 0.26;
  const by = -s * 0.02;
  g.roundRect(bx - s * 0.08, by - s * 0.14, s * 0.16, s * 0.16, s * 0.03).fill(C.chrome).stroke({ width: 1, color: C.chromeDark });
  g.roundRect(bx - s * 0.05, by - s * 0.11, s * 0.1, s * 0.1, s * 0.015).fill(C.ink);
  const fill = Math.max(0, Math.min(1, charge));
  if (fill > 0) g.roundRect(bx - s * 0.05, by - s * 0.01 - s * 0.1 * fill, s * 0.1, s * 0.1 * fill, s * 0.015).fill(C.gold);
  levelPips(g, s, level);
}

export function drawGalley(g: Graphics, s: number, level: number, cooking: boolean) {
  shadow(g, s, 0.46);
  const cy = -s * 0.04;
  const w = s * 0.74;
  const h = s * 0.3;
  g.roundRect(-w / 2, cy - h, w, h, s * 0.12).fill(C.cream);
  g.rect(-w / 2, cy - h * 0.36, w, h * 0.16).fill(C.rose);
  g.roundRect(-w * 0.38, cy - h * 0.86, w * 0.5, h * 0.4, s * 0.04).fill(C.teal).stroke({ width: 1, color: C.chromeDark });
  g.roundRect(w * 0.18, cy - h * 0.86, w * 0.2, h * 0.8, s * 0.03).fill(C.purple);
  // Sign on a pole
  g.moveTo(w * 0.42, cy - h).lineTo(w * 0.42, cy - h - s * 0.18).stroke({ width: Math.max(1.5, s * 0.025), color: C.chromeDark });
  g.circle(w * 0.42, cy - h - s * 0.22, s * 0.08).fill(C.gold).stroke({ width: 1, color: C.ink, alpha: 0.4 });
  g.roundRect(w * 0.42 - s * 0.035, cy - h - s * 0.25, s * 0.07, s * 0.06, s * 0.015).fill(C.cream);
  if (cooking) {
    g.circle(-w * 0.2, cy - h - s * 0.06, s * 0.04).fill({ color: 0xffffff, alpha: 0.6 });
    g.circle(-w * 0.14, cy - h - s * 0.13, s * 0.03).fill({ color: 0xffffff, alpha: 0.45 });
  }
  levelPips(g, s, level);
}

export function drawConstruction(g: Graphics, s: number) {
  shadow(g, s, 0.44);
  const cy = -s * 0.04;
  g.roundRect(-s * 0.36, cy - s * 0.04, s * 0.72, s * 0.08, s * 0.03).fill(C.chromeDark);
  const sw = Math.max(1.5, s * 0.025);
  for (const x of [-0.3, 0, 0.3]) g.moveTo(x * s, cy).lineTo(x * s, cy - s * 0.38).stroke({ width: sw, color: C.gold });
  for (const y of [0.13, 0.26, 0.38]) g.moveTo(-0.3 * s, cy - y * s).lineTo(0.3 * s, cy - y * s).stroke({ width: sw, color: C.gold });
  g.moveTo(-0.3 * s, cy).lineTo(0, cy - 0.38 * s).lineTo(0.3 * s, cy).stroke({ width: sw * 0.8, color: C.orange });
}

export function drawPad(g: Graphics, s: number) {
  const rx = s * 0.44;
  const ry = rx * 0.62;
  g.ellipse(0, 0, rx, ry).fill(0x3a3170).stroke({ width: Math.max(2, s * 0.04), color: C.gold });
  g.ellipse(0, 0, rx * 0.7, ry * 0.7).stroke({ width: Math.max(1, s * 0.02), color: C.gold, alpha: 0.6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.circle(Math.cos(a) * rx * 0.86, Math.sin(a) * ry * 0.86, s * 0.022).fill(i % 2 ? C.rose : C.teal);
  }
  g.ellipse(0, 0, rx * 0.22, ry * 0.22).fill(C.rose);
}

/** Classic finned rocket, standing on its fins at (0, 0). */
export function drawRocket(g: Graphics, s: number) {
  const H = s * 1.0;
  const W = s * 0.26;
  g.poly([-W * 0.45, -H * 0.34, -W * 1.15, 0, -W * 0.42, -H * 0.06]).fill(C.rose);
  g.poly([W * 0.45, -H * 0.34, W * 1.15, 0, W * 0.42, -H * 0.06]).fill(C.rose);
  g.rect(-W * 0.24, -H * 0.06, W * 0.48, H * 0.07).fill(C.chromeDark);
  g.moveTo(0, -H)
    .quadraticCurveTo(W * 0.8, -H * 0.72, W * 0.5, -H * 0.28)
    .lineTo(W * 0.4, -H * 0.05)
    .lineTo(-W * 0.4, -H * 0.05)
    .lineTo(-W * 0.5, -H * 0.28)
    .quadraticCurveTo(-W * 0.8, -H * 0.72, 0, -H)
    .closePath()
    .fill(C.chrome);
  g.moveTo(W * 0.1, -H * 0.95)
    .quadraticCurveTo(W * 0.75, -H * 0.7, W * 0.48, -H * 0.28)
    .lineTo(W * 0.38, -H * 0.05)
    .lineTo(W * 0.12, -H * 0.05)
    .closePath()
    .fill({ color: C.chromeMid, alpha: 0.6 });
  g.poly([0, -H, W * 0.32, -H * 0.83, -W * 0.32, -H * 0.83]).fill(C.rose);
  g.rect(-W * 0.6, -H * 0.4, W * 1.2, H * 0.05).fill(C.rose);
  g.circle(0, -H * 0.6, W * 0.26).fill(C.teal).stroke({ width: Math.max(1.5, s * 0.03), color: C.chromeMid });
  g.circle(-W * 0.08, -H * 0.63, W * 0.08).fill({ color: 0xffffff, alpha: 0.7 });
  g.rect(-W * 0.06, -H * 0.3, W * 0.12, H * 0.25).fill(C.rose);
}

export function drawFlame(g: Graphics, s: number, flicker: number) {
  const W = s * 0.26;
  const len = s * (0.32 + 0.08 * flicker);
  g.poly([-W * 0.28, 0, W * 0.28, 0, 0, len]).fill({ color: C.orange, alpha: 0.95 });
  g.poly([-W * 0.14, 0, W * 0.14, 0, 0, len * 0.6]).fill({ color: C.peach });
}

export function drawPod(g: Graphics, s: number, chute: boolean) {
  const r = s * 0.16;
  if (chute) {
    const top = -s * 0.85;
    for (const x of [-r * 1.6, 0, r * 1.6]) g.moveTo(x * 0.9, top + r * 0.2).lineTo(0, -r * 1.5).stroke({ width: 1, color: C.cream, alpha: 0.8 });
    for (let i = 0; i < 4; i++) {
      const x0 = -r * 2 + i * r;
      g.moveTo(x0, top + r * 0.2).arc(x0 + r * 0.5, top + r * 0.2, r * 0.5, Math.PI, 0).closePath().fill(i % 2 ? C.cream : C.rose);
    }
  } else {
    g.ellipse(0, s * 0.03, r * 1.3, r * 0.4).fill({ color: 0x120c2e, alpha: 0.35 });
  }
  g.poly([-r * 0.55, -r * 1.5, r * 0.55, -r * 1.5, r, 0, -r]).fill(C.chrome);
  g.rect(-r, -r * 0.25, r * 2, r * 0.25).fill(C.gold);
  g.circle(0, -r * 0.85, r * 0.28).fill(C.teal);
}

export function drawAstronaut(g: Graphics, s: number, jobColor: number, step: number) {
  const a = s * 0.21;
  g.ellipse(0, a * 0.05, a * 0.42, a * 0.13).fill({ color: 0x120c2e, alpha: 0.35 });
  const legSwing = Math.sin(step) * a * 0.08;
  g.roundRect(-a * 0.24 + legSwing, -a * 0.38, a * 0.18, a * 0.4, a * 0.06).fill(0xf3f0ff);
  g.roundRect(a * 0.06 - legSwing, -a * 0.38, a * 0.18, a * 0.4, a * 0.06).fill(0xf3f0ff);
  g.roundRect(-a * 0.42, -a * 0.98, a * 0.84, a * 0.66, a * 0.2).fill(C.chromeMid);
  g.roundRect(-a * 0.34, -a * 1.0, a * 0.68, a * 0.68, a * 0.22).fill(0xf3f0ff);
  g.rect(-a * 0.34, -a * 0.6, a * 0.68, a * 0.1).fill(jobColor);
  g.circle(0, -a * 1.28, a * 0.38).fill(0xf3f0ff).stroke({ width: Math.max(1, s * 0.012), color: C.chromeMid });
  g.ellipse(a * 0.06, -a * 1.27, a * 0.27, a * 0.2).fill(jobColor);
  g.ellipse(-a * 0.02, -a * 1.33, a * 0.08, a * 0.05).fill({ color: 0xffffff, alpha: 0.7 });
}

export type BubbleIcon = { kind: 'crop'; crop: string } | { kind: 'coin' } | { kind: 'crate' } | { kind: 'meal' } | { kind: 'wrench' };

export function drawBubble(g: Graphics, s: number, icon: BubbleIcon) {
  const r = Math.max(11, s * 0.16);
  g.poly([-r * 0.3, r * 0.75, r * 0.3, r * 0.75, 0, r * 1.25]).fill(C.cream);
  g.circle(0, 0, r).fill(C.cream).stroke({ width: 2, color: C.ink, alpha: 0.25 });
  switch (icon.kind) {
    case 'crop':
      g.circle(0, r * 0.08, r * 0.5).fill(CROP_COLOR[icon.crop] ?? C.gold);
      g.ellipse(-r * 0.12, -r * 0.48, r * 0.22, r * 0.12).fill(C.leaf);
      g.ellipse(r * 0.14, -r * 0.5, r * 0.22, r * 0.12).fill(C.leafDark);
      g.circle(-r * 0.18, -r * 0.08, r * 0.12).fill({ color: 0xffffff, alpha: 0.5 });
      break;
    case 'coin':
      g.circle(0, 0, r * 0.58).fill(C.gold);
      g.circle(0, 0, r * 0.4).stroke({ width: Math.max(1.5, r * 0.1), color: 0xf6d27a });
      break;
    case 'crate':
      g.roundRect(-r * 0.52, -r * 0.45, r * 1.04, r * 0.9, r * 0.12).fill(C.orange);
      g.moveTo(-r * 0.52, -r * 0.45).lineTo(r * 0.52, r * 0.45).stroke({ width: Math.max(1.5, r * 0.1), color: 0xb36a2a });
      g.moveTo(r * 0.52, -r * 0.45).lineTo(-r * 0.52, r * 0.45).stroke({ width: Math.max(1.5, r * 0.1), color: 0xb36a2a });
      break;
    case 'meal':
      g.ellipse(0, r * 0.15, r * 0.62, r * 0.28).fill(0xffffff).stroke({ width: 1, color: C.chromeMid });
      g.moveTo(-r * 0.5, r * 0.1).arc(0, r * 0.1, r * 0.5, Math.PI, 0).closePath().fill(C.chromeMid);
      g.circle(0, -r * 0.45, r * 0.1).fill(C.chromeDark);
      break;
    case 'wrench':
      g.moveTo(-r * 0.4, r * 0.4).lineTo(r * 0.25, -r * 0.25).stroke({ width: r * 0.22, color: C.chromeDark, cap: 'round' });
      g.circle(r * 0.32, -r * 0.32, r * 0.24).fill(C.chromeDark);
      g.circle(r * 0.4, -r * 0.4, r * 0.1).fill(C.cream);
      break;
  }
}

export function drawProgress(g: Graphics, s: number, t: number) {
  const w = s * 0.6;
  const h = Math.max(5, s * 0.07);
  g.roundRect(-w / 2, 0, w, h, h / 2).fill({ color: C.ink, alpha: 0.75 });
  g.roundRect(-w / 2 + 1, 1, Math.max(h - 2, (w - 2) * Math.max(0, Math.min(1, t))), h - 2, (h - 2) / 2).fill(C.teal);
}

export function drawEarth(g: Graphics, r: number) {
  g.circle(0, 0, r * 1.18).fill({ color: C.teal, alpha: 0.12 });
  g.circle(0, 0, r * 1.07).fill({ color: C.teal, alpha: 0.2 });
  g.circle(0, 0, r).fill(C.ocean);
  g.ellipse(-r * 0.35, -r * 0.25, r * 0.32, r * 0.42).fill(C.land);
  g.ellipse(-r * 0.15, r * 0.35, r * 0.18, r * 0.3).fill(C.land);
  g.ellipse(r * 0.35, -r * 0.1, r * 0.22, r * 0.18).fill(C.land);
  g.ellipse(r * 0.1, -r * 0.62, r * 0.4, r * 0.1).fill({ color: 0xffffff, alpha: 0.85 });
  g.ellipse(-r * 0.4, r * 0.15, r * 0.3, r * 0.08).fill({ color: 0xffffff, alpha: 0.75 });
  g.ellipse(r * 0.3, r * 0.5, r * 0.35, r * 0.08).fill({ color: 0xffffff, alpha: 0.7 });
}

export function drawEarthShade(g: Graphics, r: number) {
  // Night side, as a crescent of shadow on the right.
  g.moveTo(r * 0.2, -r * 0.98)
    .arc(0, 0, r, -Math.PI * 0.44, Math.PI * 0.44)
    .quadraticCurveTo(r * 0.75, 0, r * 0.2, -r * 0.98)
    .closePath()
    .fill({ color: C.night, alpha: 0.55 });
}
