import { now } from '../core/clock';
import * as R from '../core/rules';
import { h } from './dom';
import type { UI } from './App';

interface Target {
  x: number;
  y: number;
  label: string;
}

/**
 * First-time help: one bouncing arrow on the next thing to tap, with a few words.
 * The hint is worked out from the colony itself, so it never gets out of step.
 */
export class Hints {
  private el: HTMLDivElement;
  private labelEl: HTMLSpanElement;
  private last = '';

  constructor(private ui: UI) {
    this.labelEl = h('span', { class: 'hint-label' });
    this.el = h('div', { class: 'hint', 'aria-hidden': 'true' }, this.labelEl, h('span', { class: 'hint-arrow' }));
    ui.root.append(this.el);
  }

  private dom(sel: string, label: string): Target | null {
    const el = this.ui.root.querySelector<HTMLElement>(`[data-hint="${sel}"]`);
    if (!el || el.offsetParent === null) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: r.left + r.width / 2, y: r.top, label };
  }

  private pick(): Target | null {
    const ui = this.ui;
    if (ui.anyModalOpen) return null;
    const s = ui.store.state;
    const t = now();
    const tut = s.tutorial;
    const sheet = ui.sheet.isOpen ? ui.sheet.kind : '';
    const gh = s.modules.find((m) => m.kind === 'greenhouse');

    if (!tut.planted && gh) {
      if (sheet === `module:${gh.id}`) return this.dom('plant', 'Plant!');
      if (sheet) return null;
      const p = ui.world.moduleScreenPos(gh.id);
      return p ? { ...p, label: 'Tap the greenhouse' } : null;
    }
    if (!tut.harvested && gh && R.readyCount(gh, t) > 0) {
      if (sheet === `module:${gh.id}`) return this.dom('harvest', 'Harvest');
      if (sheet) return null;
      const p = ui.world.moduleScreenPos(gh.id);
      return p ? { ...p, label: 'Ready to harvest!' } : null;
    }
    if (!tut.built) {
      if (ui.placing) {
        const spot = [
          [2, 1],
          [3, 2],
          [1, 2],
          [3, 1],
          [0, 2],
        ].find(([c, r]) => R.isTileFree(s, c, r));
        if (!spot) return null;
        const p = ui.world.tileScreenPos(spot[0], spot[1]);
        return { x: p.x, y: p.y - 10, label: 'Tap here' };
      }
      if (sheet === 'build') return this.dom('build-solar', 'Solar Farm');
      if (sheet) return null;
      return this.dom('bar-build', 'Build a Solar Farm');
    }
    if (tut.harvested && !tut.ordered) {
      if (sheet === 'rocket') return this.dom('liftoff', 'Fly it yourself');
      if (sheet) return null;
      return this.dom('bar-rocket', 'Order a rocket');
    }
    if (tut.ordered && !tut.unloaded) {
      R.syncRocket(s, t);
      if (s.rocket.status !== 'landed') return null;
      if (sheet) return null;
      const p = ui.world.padScreenPos();
      return { ...p, label: 'Unload!' };
    }
    return null;
  }

  update() {
    const tgt = this.pick();
    if (!tgt) {
      if (this.last !== 'none') {
        this.el.classList.remove('show');
        this.last = 'none';
      }
      return;
    }
    this.el.style.transform = `translate(${Math.round(tgt.x)}px, ${Math.round(tgt.y)}px)`;
    if (this.labelEl.textContent !== tgt.label) this.labelEl.textContent = tgt.label;
    // Keep the label on screen near the edges.
    const w = this.labelEl.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, tgt.x - w / 2));
    this.labelEl.style.left = `${Math.round(left - tgt.x)}px`;
    if (this.last !== 'show') {
      this.el.classList.add('show');
      this.last = 'show';
    }
  }
}
