import { engineHum, sfx } from '../audio/sound';
import { BALANCE } from '../config/balance';
import { h } from './dom';
import type { UI } from './App';

/**
 * Liftoff mini game. Hold to throttle up, let go to ease off.
 * Keep the needle in the green band. Time in the band = a faster trip.
 * Nobody can fail: the rocket is already on its way. Auto Launch is always one tap away.
 */
export function openLiftoff(ui: UI, done: (score: number) => void) {
  const cfg = BALANCE.rocket.liftoff;
  const easy = ui.store.state.stats.liftoffTries < cfg.easyTries;
  const band = easy ? cfg.bandEasy : cfg.bandNormal;
  const drift = easy ? cfg.driftEasy : cfg.driftNormal;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = h('canvas', { class: 'lift-canvas', 'aria-label': 'Liftoff gauge' }) as HTMLCanvasElement;
  const status = h('p', { class: 'lift-status' }, 'Hold the button to fire the engines. Keep the needle in the green.');
  const hold = h('button', { class: 'btn btn-hold' }, 'HOLD');
  const auto = h('button', { class: 'btn btn-ghost' }, 'Auto Launch');
  const box = h('div', { class: 'modal lift', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Liftoff' },
    h('h2', { class: 'modal-title' }, 'Liftoff!'),
    canvas,
    status,
    h('div', { class: 'lift-buttons' }, hold, auto),
  );
  const scrim = h('div', { class: 'modal-scrim' }, box);
  ui.root.append(scrim);
  ui.setModal(true);
  requestAnimationFrame(() => scrim.classList.add('open'));

  const ctx = canvas.getContext('2d')!;
  let W = 0;
  let H = 0;
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();

  let holding = false;
  let throttle = 0;
  let elapsed = -1.2; // short countdown before the engines light
  let inBand = 0;
  let finished = false;
  let raf = 0;
  let last = performance.now();
  const hum = engineHum();

  const down = (e: Event) => {
    e.preventDefault();
    holding = true;
    hold.classList.add('on');
  };
  const up = () => {
    holding = false;
    hold.classList.remove('on');
  };
  hold.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  const key = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (e.type === 'keydown') down(e);
      else up();
    }
  };
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', key);

  const close = (score: number) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    hum.stop();
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('keydown', key);
    window.removeEventListener('keyup', key);
    scrim.classList.remove('open');
    setTimeout(() => scrim.remove(), 250);
    ui.setModal(false);
    done(score);
  };

  auto.addEventListener('click', () => close(0));

  const center = (t: number) => 0.55 + drift * Math.sin(t * 1.1) + drift * 0.5 * Math.sin(t * 2.3 + 1);

  const draw = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0B0A1F');
    g.addColorStop(0.7, '#3a1f5c');
    g.addColorStop(1, '#d2558e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Earth ground and tower
    ctx.fillStyle = '#2f9a58';
    ctx.fillRect(0, H - 18, W, 18);
    const rise = Math.max(0, elapsed) / cfg.durationSeconds;
    const rx = W * 0.36;
    const ry = H - 18 - rise * (H * 0.55);
    ctx.fillStyle = '#7f78a0';
    ctx.fillRect(rx - 46, H - 18 - H * 0.42, 6, H * 0.42);
    // Flame
    if (elapsed > 0 && throttle > 0.02) {
      const fl = 18 + throttle * 46 + (reduced ? 0 : Math.random() * 8);
      ctx.fillStyle = '#F2A65A';
      ctx.beginPath();
      ctx.moveTo(rx - 9, ry);
      ctx.lineTo(rx + 9, ry);
      ctx.lineTo(rx, ry + fl);
      ctx.fill();
      ctx.fillStyle = '#FFD3A5';
      ctx.beginPath();
      ctx.moveTo(rx - 5, ry);
      ctx.lineTo(rx + 5, ry);
      ctx.lineTo(rx, ry + fl * 0.6);
      ctx.fill();
    }
    // Rocket
    const s = 1;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.scale(s, s);
    ctx.fillStyle = '#D2558E';
    ctx.beginPath();
    ctx.moveTo(-8, -26);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-8, -4);
    ctx.moveTo(8, -26);
    ctx.lineTo(22, 0);
    ctx.lineTo(8, -4);
    ctx.fill();
    ctx.fillStyle = '#EAE7F5';
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.quadraticCurveTo(16, -56, 10, -22);
    ctx.lineTo(8, -2);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-10, -22);
    ctx.quadraticCurveTo(-16, -56, 0, -78);
    ctx.fill();
    ctx.fillStyle = '#1FB8A0';
    ctx.beginPath();
    ctx.arc(0, -46, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Gauge
    const gx = W - 64;
    const gy = 20;
    const gh = H - 50;
    ctx.fillStyle = 'rgba(11,10,31,0.8)';
    ctx.beginPath();
    ctx.roundRect(gx, gy, 40, gh, 12);
    ctx.fill();
    const c = center(t);
    const bandTop = gy + gh * (1 - Math.min(1, c + band / 2));
    const bandBot = gy + gh * (1 - Math.max(0, c - band / 2));
    ctx.fillStyle = '#1FB8A0';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(gx + 4, bandTop, 32, bandBot - bandTop, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    const ny = gy + gh * (1 - throttle);
    const ok = Math.abs(throttle - c) <= band / 2;
    ctx.fillStyle = ok ? '#FFF4E0' : '#D99A2B';
    ctx.beginPath();
    ctx.moveTo(gx - 12, ny - 8);
    ctx.lineTo(gx + 2, ny);
    ctx.lineTo(gx - 12, ny + 8);
    ctx.fill();
    ctx.fillRect(gx + 2, ny - 2, 36, 4);
    // Progress
    ctx.fillStyle = 'rgba(255,244,224,0.25)';
    ctx.fillRect(16, 14, W - 110, 6);
    ctx.fillStyle = '#D99A2B';
    ctx.fillRect(16, 14, (W - 110) * Math.max(0, Math.min(1, rise)), 6);
    if (elapsed < 0) {
      ctx.fillStyle = '#FFF4E0';
      ctx.font = '700 44px Righteous, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(-elapsed / 0.4)), W * 0.4, H * 0.45);
    }
  };

  const loop = (ts: number) => {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    elapsed += dt;
    const t = Math.max(0, elapsed);
    if (elapsed > 0) {
      throttle += (holding ? cfg.throttleUp : -cfg.throttleDown) * dt;
      throttle = Math.max(0, Math.min(1, throttle));
      if (Math.abs(throttle - center(t)) <= band / 2) inBand += dt;
      hum.set(throttle);
    }
    draw(t);
    if (elapsed >= cfg.durationSeconds) {
      const score = Math.min(1, inBand / (cfg.durationSeconds * 0.85));
      finished = true;
      hum.stop();
      showResult(score);
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const showResult = (score: number) => {
    const pct = Math.round(score * 100);
    const words = score >= 0.9 ? 'Picture perfect!' : score >= 0.6 ? 'Smooth flying!' : score >= 0.25 ? 'Nice and steady.' : 'Off she goes!';
    const saved = Math.round(BALANCE.rocket.liftoff.maxSpeedup * score * 100);
    sfx.done();
    status.textContent = `${words} ${pct}% in the green, so the trip is ${saved}% shorter.`;
    hold.remove();
    auto.textContent = 'Lovely';
    auto.classList.remove('btn-ghost');
    auto.classList.add('btn-primary');
    finished = false;
    auto.replaceWith(auto.cloneNode(true));
    const btn = box.querySelector<HTMLButtonElement>('.lift-buttons .btn')!;
    btn.addEventListener('click', () => close(score));
    btn.focus();
  };
}
