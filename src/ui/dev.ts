import { resetClock, skipAhead } from '../core/clock';
import { wipeSave } from '../core/save';
import { fireTestLaunch } from '../services/launches/testFeed';
import { h } from './dom';
import type { UI } from './App';

/**
 * Hidden test panel. Open it by tapping Earth 5 times quickly, or add ?test to the link.
 * "Fire real launch" goes through the same launch feed that Astro Radar will use later.
 */
export function openDevPanel(ui: UI) {
  const box = h('div', { class: 'modal dev', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Test panel' });
  const scrim = h('div', { class: 'modal-scrim' }, box);
  const close = () => {
    scrim.classList.remove('open');
    ui.setModal(false);
    setTimeout(() => scrim.remove(), 250);
  };
  const skip = (mins: number) => () => {
    skipAhead(mins * 60_000);
    ui.store.tick();
    ui.toast(`Skipped ahead ${mins >= 60 ? `${mins / 60}h` : `${mins}m`}.`);
  };
  box.append(
    h('h2', { class: 'modal-title' }, 'Test panel'),
    h('p', { class: 'muted small' }, 'For testing only. Players never see this.'),
    h('div', { class: 'dev-grid' },
      h('button', { class: 'btn btn-primary', 'data-test': 'fire-launch', onclick: () => { fireTestLaunch(); close(); } }, 'Fire real launch'),
      h('button', { class: 'btn', onclick: skip(1) }, 'Skip 1 min'),
      h('button', { class: 'btn', onclick: skip(30) }, 'Skip 30 min'),
      h('button', { class: 'btn', onclick: skip(120) }, 'Skip 2 hours'),
      h('button', { class: 'btn', onclick: skip(720) }, 'Skip 12 hours'),
      h('button', {
        class: 'btn',
        onclick: () => {
          ui.store.act((s) => {
            s.credits += 1000;
            s.parts += 40;
            return { ok: true };
          });
          ui.toast('+1000 credits, +40 parts');
        },
      }, 'Add credits'),
      h('button', {
        class: 'btn btn-danger',
        onclick: () => {
          if (!window.confirm('Start a brand new colony? This colony will be gone.')) return;
          wipeSave();
          resetClock();
          window.location.reload();
        },
      }, 'New colony'),
    ),
    h('div', { class: 'btn-row center' }, h('button', { class: 'btn btn-ghost', onclick: close }, 'Close')),
  );
  ui.root.append(scrim);
  ui.setModal(true);
  requestAnimationFrame(() => scrim.classList.add('open'));
}
