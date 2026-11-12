import '@fontsource/righteous';
import './ui/styles.css';
import { Application } from 'pixi.js';
import { sfx } from './audio/sound';
import { BALANCE } from './config/balance';
import { now } from './core/clock';
import * as R from './core/rules';
import { Store } from './game/store';
import { World } from './render/World';
import { feed } from './services/launches';
import { UI } from './ui/App';
import { openDevPanel } from './ui/dev';
import { h } from './ui/dom';
import { maybeWelcomeBack } from './ui/welcome';

function safeAreas() {
  const probe = h('div', { style: 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)' });
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  return { top, bottom };
}

async function start() {
  const store = new Store();
  const gameEl = document.getElementById('game')!;
  const uiEl = document.getElementById('ui')!;
  const app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    background: 0x0b0a1f,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    powerPreference: 'low-power',
  });
  gameEl.append(app.canvas);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.toggle('reduced', motion.matches);

  // eslint-disable-next-line prefer-const
  let ui: UI;
  const world = new World(app, motion.matches, {
    onModule: (id) => ui.tapModule(id),
    onEmptyTile: () => ui.tapEmptyTile(),
    onPad: () => ui.tapPad(),
    onRocketInFlight: () => ui.openRocket(),
    onCrew: (id) => ui.tapCrew(id),
    onEarth: () => ui.tapEarth(),
    onPlace: (c, r) => ui.place(c, r),
  });
  ui = new UI(uiEl, store, world, () => openDevPanel(ui));

  motion.addEventListener?.('change', () => {
    world.setReducedMotion(motion.matches);
    document.documentElement.classList.toggle('reduced', motion.matches);
  });

  const resize = () => {
    const w = window.innerWidth;
    const hh = window.innerHeight;
    app.renderer.resize(w, hh);
    const sa = safeAreas();
    world.resize(w, hh, sa.top, sa.bottom);
    document.documentElement.style.setProperty('--hud-top', `${sa.top}px`);
  };
  resize();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 80);
  });

  store.setEvents({
    onStamps: (ids) => ui.stamps(ids),
    onFinished: (r) => {
      for (const m of r.finished) {
        if (m.buildingUntil === null && m.upgradingUntil === null) {
          ui.toast(`${BALANCE.modules[m.kind].name} is ready!`, 'good');
        }
      }
      if (r.finished.length) sfx.done();
    },
  });

  // Real launches arrive through the one launch feed module.
  feed.subscribe((e) => {
    const r = store.act((s, t) => R.receiveRealLaunch(s, { id: e.id, vehicle: e.vehicle, at: e.at }, t));
    if (r.ok) {
      ui.banner(`${e.vehicle} just lifted off. Supply drop on the way.`);
      sfx.chime();
    }
  });

  // Notice rockets and pods landing while you watch.
  let lastRocket = store.state.rocket.status;
  let landedPods = new Set(store.state.pods.filter((p) => now() >= p.arrivesAt).map((p) => p.id));
  const watchLandings = () => {
    const s = store.state;
    const t = now();
    R.syncRocket(s, t);
    if (lastRocket === 'flying' && s.rocket.status === 'landed') {
      sfx.land();
      ui.toast('Rocket landed! Tap it to unload.', 'good');
    }
    lastRocket = s.rocket.status;
    const nowLanded = new Set(s.pods.filter((p) => t >= p.arrivesAt).map((p) => p.id));
    for (const id of nowLanded) {
      if (!landedPods.has(id)) {
        sfx.land();
        ui.toast('Supply pod landed by the pad!', 'good');
      }
    }
    landedPods = nowLanded;
  };

  store.subscribe(() => ui.refresh());
  app.ticker.add(() => {
    world.update(store.state, now(), app.ticker.deltaMS);
    ui.frame();
  });
  setInterval(() => {
    store.tick();
    watchLandings();
  }, 1000);

  // Save when the page is hidden; greet the player when they come back.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = now();
      store.save();
    } else {
      const away = hiddenAt ? now() - hiddenAt : 0;
      store.tick();
      if (!ui.anyModalOpen) maybeWelcomeBack(ui, away, 0);
    }
  });
  window.addEventListener('pagehide', () => store.save());

  ui.refresh();
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 600);
  }
  maybeWelcomeBack(ui, store.awayMs, store.finishedWhileAway);

  const params = new URLSearchParams(window.location.search);
  if (params.has('test')) {
    uiEl.append(h('button', { class: 'test-btn', onclick: () => openDevPanel(ui) }, 'Test'));
  }
  // Handy for automated checks.
  (window as unknown as { moonhaven: unknown }).moonhaven = { store, world, ui };
}

start().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.append(h('p', { class: 'boot-error' }, 'Moonhaven could not start on this browser. Try reloading.'));
});
