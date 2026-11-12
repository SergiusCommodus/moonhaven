import { sfx } from '../audio/sound';
import { BALANCE } from '../config/balance';
import { now } from '../core/clock';
import * as R from '../core/rules';
import { formatNum, formatTime, h } from './dom';
import type { UI } from './App';

/** The "Welcome back" card: what happened while you were away, and one button to collect it all. */
export function maybeWelcomeBack(ui: UI, awayMs: number, buildsDone: number) {
  if (awayMs < BALANCE.idle.welcomeBackAfterSeconds * 1000) return;
  const s = ui.store.state;
  const t = now();
  const sum = R.awaySummary(s, awayMs, buildsDone, t);
  const lines: string[] = [];
  if (sum.solar > 0) lines.push(`Solar Farms earned ${formatNum(sum.solar)} credits${sum.solarFull ? ' (batteries full)' : ''}.`);
  if (sum.cropsReady > 0) lines.push(`${sum.cropsReady} crop${sum.cropsReady > 1 ? 's are' : ' is'} ready to harvest.`);
  if (sum.rocketLanded) lines.push('A rocket landed with cargo.');
  if (sum.podsLanded > 0) lines.push(`${sum.podsLanded} supply pod${sum.podsLanded > 1 ? 's' : ''} landed.`);
  if (sum.buildsDone > 0) lines.push(`Gus finished ${sum.buildsDone} job${sum.buildsDone > 1 ? 's' : ''}.`);
  if (!lines.length) lines.push('All quiet. The crew had a lovely rest.');

  const collect = h('button', { class: 'btn btn-primary' }, 'Collect everything');
  const box = h('div', { class: 'modal welcome', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome back' },
    h('h2', { class: 'modal-title' }, 'Welcome back!'),
    h('p', { class: 'muted' }, `You were away ${formatTime(awayMs)}.`),
    h('ul', { class: 'welcome-list' }, ...lines.map((l) => h('li', {}, l))),
    h('div', { class: 'btn-row center' }, collect),
  );
  const scrim = h('div', { class: 'modal-scrim' }, box);
  ui.root.append(scrim);
  ui.setModal(true);
  requestAnimationFrame(() => scrim.classList.add('open'));

  collect.addEventListener('click', () => {
    let credits = 0;
    let parts = 0;
    let crops = 0;
    ui.store.act((st, now) => {
      const sol = R.collectSolar(st);
      if (sol.ok) credits += sol.value!;
      for (const m of st.modules) {
        const hv = R.harvest(st, m.id, now);
        if (hv.ok) crops += Object.values(hv.value!).reduce((a, b) => a + (b ?? 0), 0);
        if (m.cooking && now >= m.cooking.readyAt) R.collectMeal(st, m.id, now);
      }
      for (const p of [...st.pods]) {
        const r = R.collectPod(st, p.id, now);
        if (r.ok) {
          credits += r.value!.credits;
          parts += r.value!.parts;
        }
      }
      const u = R.unloadRocket(st, now);
      const stamps = [...(u.stamps ?? [])];
      if (u.ok) {
        credits += u.value!.credits;
        parts += u.value!.parts;
      }
      return { ok: true, stamps };
    });
    sfx.coins();
    const bits = [credits ? `+${formatNum(credits)} credits` : '', parts ? `+${parts} parts` : '', crops ? `+${crops} crops` : ''].filter(Boolean);
    if (bits.length) ui.toast(bits.join('  '), 'good');
    scrim.classList.remove('open');
    ui.setModal(false);
    setTimeout(() => scrim.remove(), 250);
  });
}
