import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BALANCE } from '../config/balance';
import { CREW } from '../config/crew';
import { isBusy, readyCount, solarCap, syncRocket } from '../core/rules';
import type { GameState, ModuleState } from '../core/state';
import * as art from './art';
import { computeLayout, seeded, tileAt, tileCenter, type Layout } from './layout';
import { C, JOB_COLOR } from './palette';

export interface WorldHandlers {
  onModule(id: string): void;
  onEmptyTile(col: number, row: number): void;
  onPad(): void;
  onRocketInFlight(): void;
  onCrew(id: string): void;
  onEarth(): void;
  onPlace(col: number, row: number): void;
}

interface ModuleView {
  root: Container;
  body: Graphics;
  bubble: Graphics;
  bar: Graphics;
  key: string;
  bubbleKey: string;
  barOn: boolean;
}

interface CrewWalker {
  id: string;
  root: Container;
  body: Graphics;
  sleepy: Graphics;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  step: number;
  lastDrawStep: number;
}

const DROP_FALL_MS = 6000;

export class World {
  readonly app: Application;
  L!: Layout;
  private reduced: boolean;
  private handlers: WorldHandlers;

  private sky = new Container();
  private stars: { s: Sprite; base: number; speed: number; phase: number }[] = [];
  private starLayer = new Container();
  private earth = new Container();
  private ground = new Container();
  private gridG = new Graphics();
  private placeG = new Graphics();
  private objects = new Container();
  private modules = new Map<string, ModuleView>();
  private pad = new Container();
  private rocket = new Container();
  private rocketBody = new Graphics();
  private flame = new Graphics();
  private rocketBubble = new Graphics();
  private pods = new Map<string, { root: Container; g: Graphics; bubble: Graphics; landed: boolean | null }>();
  private crew: CrewWalker[] = [];
  private textures: Texture[] = [];
  private earthRise = 0;
  private time = 0;
  private placing = false;
  private state: GameState | null = null;
  private now = 0;

  constructor(app: Application, reduced: boolean, handlers: WorldHandlers) {
    this.app = app;
    this.reduced = reduced;
    this.handlers = handlers;
    this.earthRise = reduced ? 1 : 0;
    this.objects.sortableChildren = true;
    app.stage.addChild(this.sky, this.starLayer, this.earth, this.ground, this.gridG, this.placeG, this.objects);
    this.rocket.addChild(this.flame, this.rocketBody, this.rocketBubble);
    this.objects.addChild(this.pad, this.rocket);
    app.stage.eventMode = 'static';
    app.stage.on('pointertap', (e) => this.tap(e.global.x, e.global.y));
    for (const c of CREW) {
      const root = new Container();
      const body = new Graphics();
      const sleepy = new Graphics();
      root.addChild(body, sleepy);
      this.objects.addChild(root);
      this.crew.push({ id: c.id, root, body, sleepy, x: 0, y: 0, tx: 0, ty: 0, wait: 0, step: 0, lastDrawStep: -1 });
    }
  }

  setReducedMotion(r: boolean) {
    this.reduced = r;
    if (r) this.earthRise = 1;
  }

  resize(w: number, h: number, safeTop: number, safeBottom: number) {
    this.L = computeLayout(w, h, safeTop, safeBottom);
    this.app.stage.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h };
    this.buildBackdrop();
    for (const v of this.modules.values()) v.key = '';
    for (const p of this.pods.values()) p.landed = null;
    this.drawPad();
    this.drawRocketBody();
    this.placeCrewInitially();
    for (const c of this.crew) c.lastDrawStep = -1;
  }

  // ---------- Backdrop: sky, stars, Earth, ground ----------

  private canvasTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    const ctx = cv.getContext('2d')!;
    paint(ctx);
    const t = Texture.from(cv);
    this.textures.push(t);
    return t;
  }

  private buildBackdrop() {
    const L = this.L;
    for (const c of [...this.sky.removeChildren(), ...this.starLayer.removeChildren(), ...this.earth.removeChildren(), ...this.ground.removeChildren()]) c.destroy();
    for (const t of this.textures) t.destroy(true);
    this.textures = [];
    this.stars = [];

    const skyTex = this.canvasTexture(4, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#0B0A1F');
      g.addColorStop(0.45, '#1c1442');
      g.addColorStop(0.75, '#4a2468');
      g.addColorStop(0.9, '#b04a86');
      g.addColorStop(1, '#f2a65a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
    });
    const sky = new Sprite(skyTex);
    sky.width = L.w;
    sky.height = L.horizonY + 4;
    this.sky.addChild(sky);

    const glowTex = this.canvasTexture(256, 128, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,211,165,0.85)');
      g.addColorStop(0.4, 'rgba(242,166,90,0.35)');
      g.addColorStop(1, 'rgba(242,166,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
    });
    const glow = new Sprite(glowTex);
    glow.anchor.set(0.5, 1);
    glow.x = L.w * 0.28;
    glow.y = L.horizonY + 2;
    glow.width = Math.max(L.w * 0.9, 300);
    glow.height = Math.min(L.horizonY * 0.7, 200);
    this.sky.addChild(glow);

    const dot = this.canvasTexture(16, 16, (ctx) => {
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,244,224,0.8)');
      g.addColorStop(1, 'rgba(255,244,224,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 16);
    });
    const rnd = seeded(7);
    const count = Math.round(Math.min(110, (L.w * L.horizonY) / 2200));
    for (let i = 0; i < count; i++) {
      const s = new Sprite(dot);
      s.anchor.set(0.5);
      s.x = rnd() * L.w;
      s.y = Math.pow(rnd(), 1.4) * (L.horizonY - 20);
      const size = 3 + rnd() * 6;
      s.width = s.height = size;
      s.tint = rnd() < 0.15 ? C.peach : rnd() < 0.2 ? 0xc9bbff : 0xffffff;
      const base = 0.35 + rnd() * 0.6;
      s.alpha = base;
      this.starLayer.addChild(s);
      this.stars.push({ s, base, speed: 0.6 + rnd() * 1.6, phase: rnd() * 6.28 });
    }

    // Earth with its night side
    const e = new Graphics();
    art.drawEarth(e, L.earth.r);
    const shade = new Graphics();
    art.drawEarthShade(shade, L.earth.r);
    this.earth.addChild(e, shade);
    this.earth.x = L.earth.x;
    this.placeEarth();

    // Distant hills
    const hills = new Graphics();
    const rh = seeded(11);
    const pts: number[] = [0, L.horizonY + 14];
    for (let x = 0; x <= L.w + 40; x += 40) pts.push(x, L.horizonY - 4 - rh() * 16);
    pts.push(L.w, L.horizonY + 14);
    hills.poly(pts).fill(0x8c5f9e);
    const pts2: number[] = [0, L.horizonY + 14];
    for (let x = -20; x <= L.w + 60; x += 60) pts2.push(x, L.horizonY + 2 - rh() * 10);
    pts2.push(L.w, L.horizonY + 14);
    hills.poly(pts2).fill(0x7a5698);
    this.ground.addChild(hills);

    const groundTex = this.canvasTexture(4, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#a77aa6');
      g.addColorStop(0.18, '#7d64a8');
      g.addColorStop(0.6, '#5a4b92');
      g.addColorStop(1, '#3a2f6e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
    });
    const ground = new Sprite(groundTex);
    ground.y = L.horizonY + 6;
    ground.width = L.w;
    ground.height = L.h - L.horizonY - 6;
    this.ground.addChild(ground);

    // Craters, kept off the grid
    const cr = new Graphics();
    const rc = seeded(23);
    const gx0 = L.gridX - 10;
    const gx1 = L.gridX + L.cols * L.tileW + 10;
    const gy0 = L.gridY - L.tileW * 0.6;
    const gy1 = L.gridY + L.rows * L.tileH + 10;
    let placed = 0;
    for (let i = 0; i < 60 && placed < 14; i++) {
      const y = L.horizonY + 16 + rc() * (L.h - L.horizonY - 30);
      const x = rc() * L.w;
      const depth = (y - L.horizonY) / (L.h - L.horizonY);
      const rx = (8 + rc() * 22) * (0.5 + depth);
      if (x + rx > gx0 && x - rx < gx1 && y + rx > gy0 && y - rx < gy1) continue;
      placed++;
      cr.ellipse(x, y, rx, rx * 0.38).fill({ color: 0x2c2556, alpha: 0.45 });
      cr.ellipse(x, y + rx * 0.06, rx * 0.86, rx * 0.3).fill({ color: 0x3a2f6e, alpha: 0.6 });
      cr.moveTo(x - rx, y).arc(x, y, rx, Math.PI * 0.05, Math.PI * 0.95).stroke({ width: Math.max(1, rx * 0.08), color: 0xc8a8d8, alpha: 0.35 });
    }
    this.ground.addChild(cr);

    this.drawGrid();
  }

  private placeEarth() {
    const L = this.L;
    const e = 1 - Math.pow(1 - Math.min(1, this.earthRise), 3);
    this.earth.y = L.earth.y + (1 - e) * L.earth.r * 2.2;
  }

  private drawGrid() {
    const L = this.L;
    const g = this.gridG;
    g.clear();
    const inset = Math.max(2, L.tileW * 0.05);
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const x = L.gridX + c * L.tileW;
        const y = L.gridY + r * L.tileH;
        g.roundRect(x + inset, y + inset, L.tileW - inset * 2, L.tileH - inset * 2, Math.max(3, L.tileW * 0.08))
          .fill({ color: 0x9d8ad8, alpha: 0.16 })
          .stroke({ width: 1, color: 0xd8c8ff, alpha: 0.22 });
      }
    }
  }

  private drawPad() {
    const { pad } = BALANCE.grid;
    const p = tileCenter(this.L, pad.col, pad.row);
    this.pad.removeChildren().forEach((c) => c.destroy());
    const g = new Graphics();
    art.drawPad(g, this.L.tileW);
    this.pad.addChild(g);
    this.pad.x = p.x;
    this.pad.y = p.y;
    this.pad.zIndex = p.y - this.L.tileH;
  }

  private drawRocketBody() {
    this.rocketBody.clear();
    art.drawRocket(this.rocketBody, this.L.tileW);
    this.rocketBubble.clear();
    art.drawBubble(this.rocketBubble, this.L.tileW, { kind: 'crate' });
    this.rocketBubble.y = -this.L.tileW * 1.3;
  }

  // ---------- Placement mode ----------

  setPlacing(on: boolean) {
    this.placing = on;
    if (!on) this.placeG.clear();
  }

  private drawPlacing() {
    const g = this.placeG;
    g.clear();
    if (!this.placing || !this.state) return;
    const L = this.L;
    const pulse = this.reduced ? 0.5 : 0.35 + 0.25 * Math.sin(this.time * 4);
    const inset = Math.max(2, L.tileW * 0.05);
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        if (!this.tileFree(c, r)) continue;
        const x = L.gridX + c * L.tileW;
        const y = L.gridY + r * L.tileH;
        g.roundRect(x + inset, y + inset, L.tileW - inset * 2, L.tileH - inset * 2, Math.max(3, L.tileW * 0.08))
          .fill({ color: C.teal, alpha: pulse })
          .stroke({ width: 2, color: 0xbff5ea, alpha: 0.9 });
      }
    }
  }

  private tileFree(c: number, r: number) {
    const { pad } = BALANCE.grid;
    if (c === pad.col && r === pad.row) return false;
    return !this.state!.modules.some((m) => m.col === c && m.row === r);
  }

  // ---------- Each frame ----------

  update(state: GameState, now: number, dtMs: number) {
    this.state = state;
    this.now = now;
    const dt = Math.min(0.1, dtMs / 1000);
    this.time += dt;
    syncRocket(state, now);

    if (this.earthRise < 1) {
      this.earthRise = Math.min(1, this.earthRise + dt / 2.2);
      this.placeEarth();
    } else if (!this.reduced) {
      this.earth.y = this.L.earth.y + Math.sin(this.time * 0.4) * 1.5;
    }
    if (!this.reduced) {
      for (const st of this.stars) st.s.alpha = st.base * (0.7 + 0.3 * Math.sin(this.time * st.speed + st.phase));
    }

    this.syncModules(state, now);
    this.syncRocket(state, now);
    this.syncPods(state, now);
    this.syncCrew(state, dt);
    if (this.placing) this.drawPlacing();
  }

  private bob(phase = 0) {
    return this.reduced ? 0 : Math.sin(this.time * 3 + phase) * 3;
  }

  private syncModules(state: GameState, now: number) {
    const L = this.L;
    const s = L.tileW;
    const seen = new Set<string>();
    const cap = solarCap(state);
    for (const m of state.modules) {
      seen.add(m.id);
      let v = this.modules.get(m.id);
      if (!v) {
        const root = new Container();
        const body = new Graphics();
        const bar = new Graphics();
        const bubble = new Graphics();
        root.addChild(body, bar, bubble);
        this.objects.addChild(root);
        v = { root, body, bubble, bar, key: '', bubbleKey: '', barOn: false };
        this.modules.set(m.id, v);
      }
      const p = tileCenter(L, m.col, m.row);
      v.root.x = p.x;
      v.root.y = p.y;
      v.root.zIndex = p.y;

      const building = m.buildingUntil !== null && now < m.buildingUntil;
      const key = this.moduleKey(m, now, cap, state, building);
      if (key !== v.key) {
        v.key = key;
        v.body.clear();
        if (building) art.drawConstruction(v.body, s);
        else this.drawModule(v.body, m, now, state, cap);
      }

      // A quick squash-and-stretch when tapped.
      const pop = this.pops.get(m.id);
      if (pop !== undefined) {
        const k = Math.min(1, (this.time - pop) / 0.35);
        const sq = Math.sin(k * Math.PI) * 0.08 * (1 - k);
        v.body.scale.set(1 + sq, 1 - sq);
        if (k >= 1) this.pops.delete(m.id);
      }

      // Progress bar for building or upgrading
      if (isBusy(m, now)) {
        const until = (building ? m.buildingUntil : m.upgradingUntil)!;
        const total = this.busyTotal(m, building);
        v.bar.clear();
        art.drawProgress(v.bar, s, total > 0 ? 1 - (until - now) / total : 1);
        v.bar.y = s * 0.24;
        v.barOn = true;
      } else if (v.barOn) {
        v.bar.clear();
        v.barOn = false;
      }

      const icon = this.bubbleFor(m, now, state, cap);
      const bkey = icon ? JSON.stringify(icon) : '';
      if (bkey !== v.bubbleKey) {
        v.bubbleKey = bkey;
        v.bubble.clear();
        if (icon) art.drawBubble(v.bubble, s, icon);
      }
      v.bubble.visible = !!icon;
      v.bubble.y = -s * 0.78 + this.bob(m.col + m.row);
    }
    for (const [id, v] of this.modules) {
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        this.modules.delete(id);
      }
    }
  }

  private busyTotal(m: ModuleState, building: boolean): number {
    // Store the job length on first sight so the bar fills smoothly.
    const k = building ? 'b' : 'u';
    const until = (building ? m.buildingUntil : m.upgradingUntil)!;
    const id = `${m.id}:${k}:${until}`;
    let t = this.jobLengths.get(id);
    if (t === undefined) {
      if (building) {
        const n = this.state!.modules.filter((x) => x.kind === m.kind).indexOf(m);
        const secs = BALANCE.modules[m.kind].buildSeconds;
        t = secs[Math.min(Math.max(0, n), secs.length - 1)] * 1000;
      } else {
        t = BALANCE.upgrades.cost[Math.min(m.level - 1, BALANCE.upgrades.cost.length - 1)].seconds * 1000;
      }
      t = Math.max(t, until - this.now);
      this.jobLengths.set(id, t);
    }
    return t;
  }
  private jobLengths = new Map<string, number>();
  private pops = new Map<string, number>();

  /** Little bounce on a module when the player taps it. */
  pop(id: string) {
    if (!this.reduced) this.pops.set(id, this.time);
  }

  private moduleKey(m: ModuleState, now: number, cap: number, state: GameState, building: boolean) {
    if (building) return 'build';
    let extra = '';
    if (m.kind === 'greenhouse') {
      extra = m.plots.map((p) => (p.crop ? `${p.crop}${now >= p.readyAt ? 'R' : Math.floor(this.plotProgress(p, now) * 4)}` : '-')).join(',');
    } else if (m.kind === 'solar') {
      extra = String(cap > 0 ? Math.round((state.solarBank / cap) * 10) : 0);
    } else if (m.kind === 'galley') {
      extra = m.cooking ? 'c' : '';
    }
    return `${m.kind}${m.level}|${extra}`;
  }

  private plotProgress(p: { plantedAt: number; readyAt: number }, now: number) {
    const total = p.readyAt - p.plantedAt;
    return total > 0 ? Math.max(0, Math.min(1, (now - p.plantedAt) / total)) : 1;
  }

  private drawModule(g: Graphics, m: ModuleState, now: number, state: GameState, cap: number) {
    // Buildings are drawn a little larger than the tile so the base feels full and cozy.
    const s = this.L.tileW * 1.14;
    switch (m.kind) {
      case 'habitat':
        art.drawHabitat(g, s, m.level);
        break;
      case 'greenhouse':
        art.drawGreenhouse(g, s, m.level, {
          plots: m.plots.map((p) => ({ crop: p.crop, progress: this.plotProgress(p, now), ready: p.crop !== null && now >= p.readyAt })),
        });
        break;
      case 'solar':
        art.drawSolar(g, s, m.level, cap > 0 ? state.solarBank / cap : 0);
        break;
      case 'galley':
        art.drawGalley(g, s, m.level, !!m.cooking);
        break;
    }
  }

  private bubbleFor(m: ModuleState, now: number, state: GameState, cap: number): art.BubbleIcon | null {
    if (m.buildingUntil !== null && now < m.buildingUntil) return null;
    if (m.kind === 'greenhouse' && readyCount(m, now) > 0) {
      const p = m.plots.find((x) => x.crop && now >= x.readyAt)!;
      return { kind: 'crop', crop: p.crop! };
    }
    if (m.kind === 'solar') {
      const first = state.modules.find((x) => x.kind === 'solar' && x.buildingUntil === null);
      if (first?.id === m.id && state.solarBank >= Math.max(5, cap * 0.1)) return { kind: 'coin' };
    }
    if (m.kind === 'galley' && m.cooking && now >= m.cooking.readyAt) return { kind: 'meal' };
    return null;
  }

  private padPos() {
    const { pad } = BALANCE.grid;
    return tileCenter(this.L, pad.col, pad.row);
  }

  private flightPos(t: number) {
    const L = this.L;
    const pad = this.padPos();
    const s = L.tileW;
    const hover = { x: pad.x, y: pad.y - s * 2.6 };
    if (t < 0.9) {
      // A wide, lazy arc across the sky from Earth to above the pad.
      const u = t / 0.9;
      const x0 = L.earth.x - L.earth.r * 0.5;
      const y0 = L.earth.y - L.earth.r * 0.9;
      const x1 = L.w * 0.2;
      const y1 = L.topUI * 0.4;
      const x2 = L.w * 0.12;
      const y2 = L.horizonY * 0.95;
      const a = (1 - u) ** 3;
      const b = 3 * (1 - u) ** 2 * u;
      const c = 3 * (1 - u) * u * u;
      const d = u ** 3;
      const x = a * x0 + b * x1 + c * x2 + d * hover.x;
      const y = a * y0 + b * y1 + c * y2 + d * hover.y;
      return { x, y, scale: 0.28 + 0.4 * u, descending: false };
    }
    const u = (t - 0.9) / 0.1;
    return { x: pad.x, y: hover.y + (pad.y - hover.y) * u, scale: 0.68 + 0.32 * u, descending: true };
  }

  private syncRocket(state: GameState, now: number) {
    const r = state.rocket;
    const pad = this.padPos();
    this.flame.clear();
    if (r.status === 'home') {
      this.rocket.visible = false;
      return;
    }
    this.rocket.visible = true;
    if (r.status === 'landed') {
      this.rocket.x = pad.x;
      this.rocket.y = pad.y;
      this.rocket.scale.set(1);
      this.rocket.rotation = 0;
      this.rocket.zIndex = pad.y;
      this.rocketBubble.visible = true;
      this.rocketBubble.y = -this.L.tileW * 1.3 + this.bob(2);
      return;
    }
    this.rocketBubble.visible = false;
    const total = Math.max(1, r.arrivesAt - r.launchedAt);
    const t = Math.max(0, Math.min(1, (now - r.launchedAt) / total));
    const p = this.flightPos(t);
    this.rocket.x = p.x;
    this.rocket.y = p.y;
    this.rocket.scale.set(p.scale);
    this.rocket.zIndex = p.descending ? pad.y : -1000;
    if (p.descending) {
      this.rocket.rotation = 0;
      art.drawFlame(this.flame, this.L.tileW, this.reduced ? 0.5 : Math.random());
    } else {
      const ahead = this.flightPos(Math.min(1, t + 0.01));
      const ang = Math.atan2(ahead.y - p.y, ahead.x - p.x) + Math.PI / 2;
      this.rocket.rotation = ang;
      art.drawFlame(this.flame, this.L.tileW, this.reduced ? 0.5 : Math.random());
    }
  }

  private podPos(i: number) {
    const pad = this.padPos();
    const s = this.L.tileW;
    return { x: pad.x - s * 0.36 - i * s * 0.22, y: pad.y + this.L.tileH * 0.32 };
  }

  private syncPods(state: GameState, now: number) {
    const seen = new Set<string>();
    const s = this.L.tileW;
    state.pods.forEach((pod, i) => {
      seen.add(pod.id);
      let v = this.pods.get(pod.id);
      if (!v) {
        const root = new Container();
        const g = new Graphics();
        const bubble = new Graphics();
        root.addChild(g, bubble);
        this.objects.addChild(root);
        v = { root, g, bubble, landed: null };
        this.pods.set(pod.id, v);
      }
      const landed = now >= pod.arrivesAt;
      const home = this.podPos(i);
      if (landed !== v.landed) {
        v.landed = landed;
        v.g.clear();
        art.drawPod(v.g, s, !landed);
        v.bubble.clear();
        if (landed) art.drawBubble(v.bubble, s, { kind: 'crate' });
      }
      v.root.x = home.x;
      if (landed) {
        v.root.y = home.y;
        v.bubble.y = -s * 0.62 + this.bob(4 + i);
      } else {
        const left = pod.arrivesAt - now;
        const u = left > DROP_FALL_MS ? 0 : 1 - left / DROP_FALL_MS;
        v.root.y = left > DROP_FALL_MS ? -s * 2 : -s + (home.y + s) * u;
        if (!this.reduced) v.root.x = home.x + Math.sin(this.time * 2) * 4 * (1 - u);
      }
      v.root.zIndex = home.y + 1;
    });
    for (const [id, v] of this.pods) {
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        this.pods.delete(id);
      }
    }
  }

  // ---------- Crew ----------

  private freeSpots(): { x: number; y: number }[] {
    const st = this.state;
    const out: { x: number; y: number }[] = [];
    if (!st) return [{ x: 0.5, y: 0.5 }];
    const { pad } = BALANCE.grid;
    for (let r = 0; r < BALANCE.grid.rows; r++) {
      for (let c = 0; c < BALANCE.grid.cols; c++) {
        if (c === pad.col && r === pad.row) continue;
        if (st.modules.some((m) => m.col === c && m.row === r)) continue;
        out.push({ x: c + 0.5, y: r + 0.5 });
      }
    }
    return out.length ? out : [{ x: 0.5, y: 0.5 }];
  }

  private placeCrewInitially() {
    if (!this.state) return;
    const spots = this.freeSpots();
    this.crew.forEach((c, i) => {
      if (c.x === 0 && c.y === 0) {
        const sp = spots[(i * 3) % spots.length];
        c.x = c.tx = sp.x + (i - 1) * 0.15;
        c.y = c.ty = sp.y + 0.2;
        c.wait = 1 + i;
      }
    });
  }

  private syncCrew(state: GameState, dt: number) {
    const L = this.L;
    const s = L.tileW;
    for (const c of this.crew) {
      const cs = state.crew.find((x) => x.id === c.id)!;
      const profile = CREW.find((x) => x.id === c.id)!;
      const sleepy = cs.mood < BALANCE.crew.sleepy;
      const cheery = cs.mood >= BALANCE.crew.cheery;
      if (c.x === 0 && c.y === 0) this.placeCrewInitially();
      if (!this.reduced) {
        const dx = c.tx - c.x;
        const dy = c.ty - c.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.02) {
          c.wait -= dt;
          if (c.wait <= 0) {
            const spots = this.freeSpots();
            const sp = spots[Math.floor(Math.random() * spots.length)];
            c.tx = sp.x + (Math.random() - 0.5) * 0.5;
            c.ty = sp.y + (Math.random() - 0.3) * 0.4;
            c.wait = 2 + Math.random() * 5;
          }
        } else {
          const speed = (sleepy ? 0.25 : cheery ? 0.55 : 0.4) * dt;
          const k = Math.min(1, speed / d);
          c.x += dx * k;
          c.y += dy * k;
          c.step += dt * (sleepy ? 5 : 9);
        }
      }
      const px = L.gridX + c.x * L.tileW;
      const py = L.gridY + c.y * L.tileH;
      c.root.x = px;
      c.root.y = py;
      c.root.zIndex = py + 0.5;
      const step = Math.round(c.step * 2) / 2;
      if (step !== c.lastDrawStep) {
        c.lastDrawStep = step;
        c.body.clear();
        art.drawAstronaut(c.body, s, JOB_COLOR[profile.job], step);
      }
      c.sleepy.clear();
      if (sleepy) {
        const a = s * 0.21;
        const z = this.reduced ? 0 : (this.time * 0.8) % 1;
        c.sleepy.circle(a * 0.5, -a * 2 - z * a, a * 0.12).fill({ color: C.cream, alpha: 0.8 * (1 - z) });
        c.sleepy.circle(a * 0.75, -a * 2.4 - z * a, a * 0.08).fill({ color: C.cream, alpha: 0.6 * (1 - z) });
      }
    }
  }

  // ---------- Positions for hints and floating text ----------

  moduleScreenPos(id: string) {
    const m = this.state?.modules.find((x) => x.id === id);
    if (!m) return null;
    const p = tileCenter(this.L, m.col, m.row);
    return { x: p.x, y: p.y - this.L.tileW * 0.98 };
  }

  padScreenPos() {
    const p = this.padPos();
    return { x: p.x, y: p.y - this.L.tileW * 1.5 };
  }

  tileScreenPos(col: number, row: number) {
    return tileCenter(this.L, col, row);
  }

  crewScreenPos(id: string) {
    const c = this.crew.find((x) => x.id === id);
    if (!c) return null;
    return { x: c.root.x, y: c.root.y - this.L.tileW * 0.3 };
  }

  // ---------- Tapping ----------

  private tap(x: number, y: number) {
    const st = this.state;
    if (!st) return;
    const L = this.L;
    const s = L.tileW;
    if (this.placing) {
      const t = tileAt(L, x, y);
      if (t) this.handlers.onPlace(t.col, t.row);
      return;
    }
    // Rocket in the sky
    if (st.rocket.status === 'flying' && this.rocket.visible) {
      if (Math.hypot(x - this.rocket.x, y - (this.rocket.y - s * 0.4 * this.rocket.scale.y)) < s * 0.6) {
        this.handlers.onRocketInFlight();
        return;
      }
    }
    if (y < L.horizonY && Math.hypot(x - L.earth.x, y - this.earth.y) < L.earth.r * 1.2) {
      this.handlers.onEarth();
      return;
    }
    // Pad, landed rocket and supply pods
    const pad = this.padPos();
    const nearPad = Math.abs(x - (pad.x - s * 0.2)) < s * 0.75 && y > pad.y - s * 1.5 && y < pad.y + L.tileH * 0.75;
    if (nearPad) {
      this.handlers.onPad();
      return;
    }
    // Crew (generous touch target)
    let best: CrewWalker | null = null;
    let bestD = s * 0.32;
    for (const c of this.crew) {
      const d = Math.hypot(x - c.root.x, y - (c.root.y - s * 0.2));
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      this.handlers.onCrew(best.id);
      return;
    }
    // Modules: front rows first, each covers its tile plus the space above it
    const mods = [...st.modules].sort((a, b) => b.row - a.row);
    for (const m of mods) {
      const p = tileCenter(L, m.col, m.row);
      if (x > p.x - s * 0.5 && x < p.x + s * 0.5 && y < p.y + L.tileH * 0.5 && y > p.y - s * 0.95) {
        this.pop(m.id);
        this.handlers.onModule(m.id);
        return;
      }
    }
    const t = tileAt(L, x, y);
    if (t) this.handlers.onEmptyTile(t.col, t.row);
  }

  /**
   * A picture of the colony for the Postcard: the whole screen, plus the part
   * worth framing (from just above Earth down to the bottom of the base), in picture pixels.
   */
  snapshot(state: GameState, now: number): { canvas: HTMLCanvasElement; focus: { x: number; y: number; w: number; h: number } } {
    const L = this.L;
    const res = Math.min(2, window.devicePixelRatio || 1);
    // Make sure everything is drawn and Earth is fully up before the photo.
    this.earthRise = 1;
    this.placeEarth();
    this.update(state, now, 0);
    this.placeG.visible = false;
    this.app.renderer.render(this.app.stage);
    const canvas = this.app.renderer.extract.canvas({
      target: this.app.stage,
      frame: new Rectangle(0, 0, L.w, L.h),
      resolution: res,
    }) as HTMLCanvasElement;
    this.placeG.visible = true;
    const k = canvas.width / L.w;
    const x0 = Math.max(0, Math.min(L.gridX, L.earth.x - L.earth.r) - 16);
    const x1 = Math.min(L.w, Math.max(L.gridX + L.cols * L.tileW, L.earth.x + L.earth.r) + 16);
    const y0 = Math.max(0, L.earth.y - L.earth.r * 2.2);
    const y1 = Math.min(L.h, L.gridY + L.rows * L.tileH + 14);
    return { canvas, focus: { x: x0 * k, y: y0 * k, w: (x1 - x0) * k, h: (y1 - y0) * k } };
  }
}
