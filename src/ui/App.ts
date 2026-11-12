import { sfx, isMuted, setMuted, unlockAudio } from '../audio/sound';
import { BALANCE, CROP_IDS, RECIPE_IDS, type CropId, type ModuleKind, type RecipeId } from '../config/balance';
import { CREW, JOB_HELPS, JOB_LABEL } from '../config/crew';
import { STAMPS } from '../config/stamps';
import { now } from '../core/clock';
import * as R from '../core/rules';
import type { ModuleState } from '../core/state';
import type { Store } from '../game/store';
import type { World } from '../render/World';
import { hex, CROP_COLOR } from '../render/palette';
import { formatNum, formatTime, h, icon } from './dom';
import { Hints } from './hints';
import { openLiftoff } from './liftoff';
import { openPostcard } from './postcard';
import { Sheet } from './sheet';
import { tickTimers } from './timers';

const MODULE_BLURB: Record<ModuleKind, string> = {
  habitat: 'Home sweet dome. Your crew rest here and get their cheer back.',
  greenhouse: 'Grow crops under glass. More levels, more growing spots.',
  solar: 'Soaks up sunshine and earns Moon Credits, even while you are away.',
  galley: 'A little diner. Turns crops into meals that cheer up the whole crew.',
};

const MODULE_SWATCH: Record<ModuleKind, string> = {
  habitat: '#EAE7F5',
  greenhouse: '#9FE8DC',
  solar: '#3B2F8F',
  galley: '#D2558E',
};

export class UI {
  readonly root: HTMLElement;
  readonly sheet: Sheet;
  private hud!: HTMLElement;
  private bar!: HTMLElement;
  private credits!: HTMLElement;
  private parts!: HTMLElement;
  private pantryCount!: HTMLElement;
  private boostChip!: HTMLElement;
  private toasts!: HTMLElement;
  private placeBar!: HTMLElement;
  private muteBtn!: HTMLButtonElement;
  private rocketBadge!: HTMLElement;
  private hints: Hints;
  private placingKind: ModuleKind | null = null;
  selectedCrop: CropId = 'potato';
  private earthTaps: number[] = [];
  private modalOpen = false;

  constructor(
    root: HTMLElement,
    readonly store: Store,
    readonly world: World,
    private openDev: () => void,
  ) {
    this.root = root;
    this.buildChrome();
    this.sheet = new Sheet(root, () => this.store.notify());
    this.hints = new Hints(this);
    root.addEventListener('pointerdown', () => unlockAudio(), { once: true });
    document.addEventListener('pointerdown', () => unlockAudio(), { once: true });
  }

  // ---------- Layout ----------

  private buildChrome() {
    this.credits = h('span', { class: 'num' });
    this.parts = h('span', { class: 'num' });
    this.pantryCount = h('span', { class: 'num' });
    this.boostChip = h('button', { class: 'boost-chip', hidden: true, onclick: () => this.openRocket() });
    this.hud = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'pill', title: 'Moon Credits' }, icon('credits'), this.credits),
      h('div', { class: 'pill', title: 'Spare parts' }, icon('parts'), this.parts),
      h('button', { class: 'pill pill-btn', 'aria-label': 'Pantry', 'data-hint': 'pantry', onclick: () => this.openPantry() }, icon('pantry'), this.pantryCount),
      this.boostChip,
    );
    this.muteBtn = h('button', { class: 'barbtn', 'aria-label': 'Sound on or off', onclick: () => this.toggleMute() }) as HTMLButtonElement;
    this.rocketBadge = h('span', { class: 'badge', hidden: true });
    const btn = (name: 'build' | 'rocket' | 'crew' | 'book' | 'postcard', label: string, fn: () => void, extra?: Node) =>
      h('button', { class: 'barbtn', 'data-hint': `bar-${name}`, onclick: () => { sfx.tap(); fn(); } }, icon(name), h('span', { class: 'lbl' }, label), extra ?? null);
    this.bar = h(
      'nav',
      { class: 'bar' },
      btn('build', 'Build', () => this.openBuild()),
      btn('rocket', 'Rocket', () => this.openRocket(), this.rocketBadge),
      btn('crew', 'Crew', () => this.openCrew()),
      btn('book', 'Book', () => this.openBook()),
      btn('postcard', 'Postcard', () => this.postcard()),
      this.muteBtn,
    );
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.placeBar = h('div', { class: 'placebar', hidden: true });
    this.root.append(this.hud, this.bar, this.toasts, this.placeBar);
    this.drawMute();
  }

  private drawMute() {
    const muted = isMuted();
    this.muteBtn.replaceChildren(icon(muted ? 'soundOff' : 'soundOn'), h('span', { class: 'lbl' }, muted ? 'Muted' : 'Sound'));
    this.muteBtn.setAttribute('aria-pressed', String(!muted));
  }

  private toggleMute() {
    setMuted(!isMuted());
    this.drawMute();
    if (!isMuted()) sfx.tap();
  }

  // ---------- Every frame / every second ----------

  /** Called once a second and after every action. */
  refresh() {
    const s = this.store.state;
    const t = now();
    this.credits.textContent = formatNum(s.credits);
    this.parts.textContent = formatNum(s.parts);
    const pantry = CROP_IDS.reduce((n, c) => n + s.pantry[c], 0) + RECIPE_IDS.reduce((n, r) => n + s.meals[r], 0);
    this.pantryCount.textContent = formatNum(pantry);
    const boost = R.activeBoost(s, t);
    this.boostChip.hidden = !boost;
    if (boost) {
      const left = boost.endsAt - t;
      this.boostChip.textContent = `2× cargo · ${left > 3_600_000 ? `${Math.ceil(left / 3_600_000)}h` : formatTime(left)}`;
    }
    R.syncRocket(s, t);
    const landedPods = s.pods.filter((p) => t >= p.arrivesAt).length;
    this.rocketBadge.hidden = !(s.rocket.status === 'landed' || landedPods > 0);
    this.rocketBadge.textContent = '!';
    this.sheet.refresh();
    tickTimers(this.root, t);
  }

  /** Called every animation frame. */
  frame() {
    this.hints.update();
  }

  get anyModalOpen() {
    return this.modalOpen;
  }

  setModal(open: boolean) {
    this.modalOpen = open;
    this.root.classList.toggle('modal-open', open);
  }

  // ---------- Feedback ----------

  toast(text: string, kind: 'info' | 'good' | 'stamp' = 'info') {
    const el = h('div', { class: `toast toast-${kind}` }, text);
    this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  floatText(x: number, y: number, text: string, color = '#FFF4E0') {
    const half = Math.min(window.innerWidth / 2 - 4, text.length * 4.6 + 8);
    const cx = Math.max(half + 4, Math.min(window.innerWidth - half - 4, x));
    const el = h('div', { class: 'float', style: `left:${cx}px;top:${y}px;color:${color}` }, text);
    this.root.append(el);
    setTimeout(() => el.remove(), 1600);
  }

  banner(text: string) {
    const el = h('div', { class: 'banner', role: 'status' }, icon('rocket'), h('span', {}, text));
    this.root.append(el);
    this.root.classList.add('has-banner');
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => el.classList.remove('in'), 7000);
    setTimeout(() => {
      el.remove();
      if (!this.root.querySelector('.banner')) this.root.classList.remove('has-banner');
    }, 7800);
  }

  stamps(ids: string[]) {
    for (const id of ids) {
      const st = STAMPS.find((s) => s.id === id);
      if (st) {
        this.toast(`${st.icon} New stamp: ${st.title}`, 'stamp');
        sfx.stamp();
      }
    }
  }

  fail(r: R.Result<unknown>) {
    if (!r.ok && r.reason) {
      this.toast(r.reason);
      sfx.soft();
    }
    return r.ok;
  }

  // ---------- World taps ----------

  tapModule(id: string) {
    if (this.placingKind) return;
    const s = this.store.state;
    const m = s.modules.find((x) => x.id === id);
    if (!m) return;
    const t = now();
    const pos = this.world.moduleScreenPos(id);
    if (m.kind === 'greenhouse' && R.readyCount(m, t) > 0) {
      this.harvest(m.id);
      // Let the "+2 Potatoes" float up before the panel slides in to replant.
      setTimeout(() => {
        if (!this.sheet.isOpen && !this.modalOpen && !this.placingKind) this.openModule(id);
      }, 900);
      return;
    }
    if (m.kind === 'solar' && Math.floor(s.solarBank) > 0 && !R.isBusy(m, t)) {
      const r = this.store.act((st) => R.collectSolar(st));
      if (r.ok && pos) {
        this.floatText(pos.x, pos.y, `+${r.value} credits`, '#F6D27A');
        sfx.coins();
      }
      return;
    }
    if (m.kind === 'galley' && m.cooking && t >= m.cooking.readyAt) {
      const r = this.store.act((st, tt) => R.collectMeal(st, m.id, tt));
      if (r.ok && pos) {
        this.floatText(pos.x, pos.y, `+1 ${BALANCE.galley.recipes[r.value!].name}`);
        sfx.harvest();
      }
    }
    sfx.open();
    this.openModule(id);
  }

  tapEmptyTile() {
    if (this.placingKind) return;
    sfx.tap();
    this.openBuild();
  }

  tapPad() {
    const s = this.store.state;
    const t = now();
    const pads = this.world.padScreenPos();
    let did = false;
    for (const pod of [...s.pods]) {
      if (t >= pod.arrivesAt) {
        const r = this.store.act((st, tt) => R.collectPod(st, pod.id, tt));
        if (r.ok) {
          this.floatText(pads.x - 30, pads.y, `+${r.value!.credits} credits  +${r.value!.parts} parts`, '#F6D27A');
          did = true;
        }
      }
    }
    R.syncRocket(s, t);
    if (s.rocket.status === 'landed') {
      const r = this.store.act((st, tt) => R.unloadRocket(st, tt));
      if (r.ok) {
        this.floatText(pads.x, pads.y - 20, `+${r.value!.credits} credits  +${r.value!.parts} parts`, '#F6D27A');
        did = true;
      }
    }
    if (did) {
      sfx.coins();
      return;
    }
    sfx.open();
    this.openRocket();
  }

  tapCrew(id: string) {
    sfx.hi();
    this.openCrew(id);
  }

  tapEarth() {
    const t = Date.now();
    this.earthTaps = this.earthTaps.filter((x) => t - x < 4000);
    this.earthTaps.push(t);
    if (this.earthTaps.length >= 5) {
      this.earthTaps = [];
      this.openDev();
    }
  }

  // ---------- Actions ----------

  harvest(moduleId: string) {
    const r = this.store.act((st, t) => R.harvest(st, moduleId, t));
    if (!this.fail(r)) return;
    const pos = this.world.moduleScreenPos(moduleId);
    const parts = Object.entries(r.value!).map(([c, n]) => `+${n} ${BALANCE.crops[c as CropId].short}`);
    if (pos) this.floatText(pos.x, pos.y, parts.join('  '), '#B8F5C8');
    sfx.harvest();
  }

  plant(moduleId: string) {
    const crop = this.selectedCrop;
    const r = this.store.act((st, t) => R.plantAll(st, moduleId, crop, t));
    if (!this.fail(r)) return;
    const pos = this.world.moduleScreenPos(moduleId);
    if (pos) this.floatText(pos.x, pos.y, `Planted ${r.value} ${BALANCE.crops[crop].short}`, '#B8F5C8');
    sfx.plant();
    this.sheet.close();
  }

  // ---------- Building ----------

  startPlacing(kind: ModuleKind) {
    this.sheet.close();
    this.placingKind = kind;
    this.world.setPlacing(true);
    this.placeBar.hidden = false;
    this.placeBar.replaceChildren(
      h('span', {}, `Tap a glowing spot for your ${BALANCE.modules[kind].name}`),
      h('button', { class: 'btn btn-ghost', onclick: () => this.stopPlacing() }, 'Cancel'),
    );
    this.store.notify();
  }

  stopPlacing() {
    this.placingKind = null;
    this.world.setPlacing(false);
    this.placeBar.hidden = true;
    this.store.notify();
  }

  get placing() {
    return this.placingKind;
  }

  place(col: number, row: number) {
    const kind = this.placingKind;
    if (!kind) return;
    if (!R.isTileFree(this.store.state, col, row)) {
      sfx.soft();
      return;
    }
    const r = this.store.act((st, t) => R.build(st, kind, col, row, t));
    this.stopPlacing();
    if (!this.fail(r)) return;
    sfx.build();
    const p = this.world.tileScreenPos(col, row);
    this.floatText(p.x, p.y - 30, `Building ${BALANCE.modules[kind].name}`);
  }

  // ---------- Panels ----------

  openModule(id: string) {
    const m = this.store.state.modules.find((x) => x.id === id);
    if (!m) return;
    const title = () => {
      const mm = this.store.state.modules.find((x) => x.id === id);
      return mm ? `${BALANCE.modules[mm.kind].name} · Level ${mm.level}` : '';
    };
    this.sheet.open(`module:${id}`, title(), () => {
      const mm = this.store.state.modules.find((x) => x.id === id);
      if (!mm) return h('div', {});
      this.sheet.setTitle(title());
      return this.modulePanel(mm);
    });
    this.refresh();
  }

  private modulePanel(m: ModuleState): Node {
    const t = now();
    const s = this.store.state;
    const wrap = h('div', { class: 'panel' });
    if (m.buildingUntil !== null && t < m.buildingUntil) {
      wrap.append(
        h('p', { class: 'lead' }, `Gus is building it. Ready in `, h('b', { 'data-until': m.buildingUntil }), '.'),
        h('p', { class: 'muted' }, MODULE_BLURB[m.kind]),
      );
      return wrap;
    }
    if (m.kind === 'greenhouse') wrap.append(this.greenhousePanel(m));
    if (m.kind === 'solar') wrap.append(this.solarPanel());
    if (m.kind === 'habitat') wrap.append(this.habitatPanel());
    if (m.kind === 'galley') wrap.append(this.galleyPanel(m));
    wrap.append(this.upgradeBlock(m));
    void s;
    return wrap;
  }

  private greenhousePanel(m: ModuleState): Node {
    const t = now();
    const s = this.store.state;
    const free = m.plots.filter((p) => p.crop === null).length;
    const ready = R.readyCount(m, t);
    const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Pick a crop' });
    for (const c of CROP_IDS) {
      const def = BALANCE.crops[c];
      const locked = !R.cropUnlocked(m, c);
      const sel = this.selectedCrop === c;
      chips.append(
        h(
          'button',
          {
            class: `chip${sel ? ' sel' : ''}${locked ? ' locked' : ''}`,
            role: 'radio',
            'aria-checked': String(sel),
            'data-hint': `crop-${c}`,
            onclick: () => {
              if (locked) {
                this.toast(`Upgrade this Greenhouse to level ${def.unlockGreenhouseLevel} to grow ${def.short}.`);
                return;
              }
              this.selectedCrop = c;
              sfx.tap();
              this.sheet.refresh();
            },
          },
          h('span', { class: 'dot', style: `background:${hex(CROP_COLOR[c])}` }),
          h('span', { class: 'chip-name' }, def.short),
          h('span', { class: 'chip-sub' }, locked ? `Level ${def.unlockGreenhouseLevel}` : `${formatTime(R.growMs(s, c))} · ${def.sellPrice}¢`),
        ),
      );
    }
    const plots = h('div', { class: 'plots' });
    for (const p of m.plots) {
      if (!p.crop) {
        plots.append(h('div', { class: 'plot empty' }, h('span', {}, 'Empty')));
      } else {
        const isReady = t >= p.readyAt;
        plots.append(
          h(
            'div',
            { class: `plot${isReady ? ' ready' : ''}`, style: `--crop:${hex(CROP_COLOR[p.crop])}` },
            h('span', { class: 'plot-name' }, BALANCE.crops[p.crop].short),
            isReady ? h('span', { class: 'plot-time' }, 'Ready!') : h('span', { class: 'plot-time', 'data-until': p.readyAt }),
            isReady ? null : h('div', { class: 'plot-bar' }, h('i', { 'data-from': p.plantedAt, 'data-to': p.readyAt })),
          ),
        );
      }
    }
    const actions = h('div', { class: 'actions' });
    if (ready > 0) actions.append(h('button', { class: 'btn btn-go', 'data-hint': 'harvest', onclick: () => this.harvest(m.id) }, `Harvest ${ready}`));
    if (free > 0) {
      actions.append(
        h('button', { class: 'btn btn-primary', 'data-hint': 'plant', onclick: () => this.plant(m.id) }, `Plant ${BALANCE.crops[this.selectedCrop].short}${free > 1 ? ` ×${free}` : ''}`),
      );
    }
    const bot = R.crewByJob(s, 'botanist');
    return h(
      'div',
      {},
      chips,
      plots,
      actions,
      h('p', { class: 'muted small' }, `Dot is ${R.moodLabel(bot.mood)}. ${JOB_HELPS.botanist} Ripe crops wait for you forever.`),
    );
  }

  private solarPanel(): Node {
    const s = this.store.state;
    const cap = R.solarCap(s);
    const bank = Math.floor(s.solarBank);
    const full = cap > 0 && s.solarBank >= cap - 0.5;
    return h(
      'div',
      {},
      h('div', { class: 'meter' }, h('i', { style: `transform:scaleX(${cap > 0 ? Math.min(1, s.solarBank / cap).toFixed(3) : 0})` })),
      h('p', { class: 'lead' }, `${formatNum(bank)} of ${formatNum(cap)} credits stored`),
      h('p', { class: 'muted small' }, `All your Solar Farms earn ${formatNum(R.solarRatePerHour(s))} credits an hour. The batteries hold ${BALANCE.idle.capHours} hours of sunshine${full ? '. They are full: collect to keep earning.' : '.'}`),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-go', disabled: bank <= 0, onclick: () => this.collectSolar() }, bank > 0 ? `Collect ${formatNum(bank)}` : 'Charging…')),
    );
  }

  collectSolar() {
    const r = this.store.act((st) => R.collectSolar(st));
    if (!this.fail(r)) return;
    sfx.coins();
    this.toast(`+${formatNum(r.value!)} credits`, 'good');
  }

  private habitatPanel(): Node {
    const s = this.store.state;
    const list = h('div', { class: 'crew-mini' });
    for (const c of CREW) {
      const cs = s.crew.find((x) => x.id === c.id)!;
      list.append(
        h(
          'button',
          { class: 'crew-row', onclick: () => this.openCrew(c.id) },
          h('span', { class: `job job-${c.job}` }),
          h('span', { class: 'crew-name' }, c.name.split(' ')[0]),
          h('span', { class: 'moodbar' }, h('i', { style: `transform:scaleX(${(cs.mood / 100).toFixed(2)})` })),
          h('span', { class: `mood mood-${R.moodLabel(cs.mood).toLowerCase()}` }, R.moodLabel(cs.mood)),
        ),
      );
    }
    return h('div', {}, list, h('p', { class: 'muted small' }, `Crew get back ${R.moodPerHour(s)} cheer an hour while they rest here. Upgrade for faster rest.`));
  }

  private galleyPanel(m: ModuleState): Node {
    const s = this.store.state;
    const t = now();
    const box = h('div', {});
    if (m.cooking) {
      const def = BALANCE.galley.recipes[m.cooking.recipe];
      const ready = t >= m.cooking.readyAt;
      box.append(
        h(
          'div',
          { class: 'cooking' },
          h('span', {}, ready ? `${def.name} is ready!` : `Cooking ${def.name}: `),
          ready ? null : h('b', { 'data-until': m.cooking.readyAt }),
          ready
            ? h('button', {
                class: 'btn btn-go',
                onclick: () => {
                  const r = this.store.act((st, tt) => R.collectMeal(st, m.id, tt));
                  if (this.fail(r)) sfx.harvest();
                },
              }, 'Take it out')
            : null,
        ),
      );
    }
    const list = h('div', { class: 'recipes' });
    for (const id of RECIPE_IDS) {
      const def = BALANCE.galley.recipes[id];
      const needs = Object.entries(def.needs).map(([c, n]) => `${n} ${BALANCE.crops[c as CropId].short}`).join(' + ');
      const can = R.canCook(s, id) && !m.cooking;
      list.append(
        h(
          'div',
          { class: 'recipe' },
          h('div', {}, h('b', {}, def.name), h('div', { class: 'muted small' }, `${needs} · ${formatTime(def.cookSeconds * 1000)}`)),
          h('button', {
            class: 'btn btn-small',
            disabled: !can,
            onclick: () => {
              const r = this.store.act((st, tt) => R.cook(st, m.id, id, tt));
              if (this.fail(r)) sfx.plant();
            },
          }, 'Cook'),
        ),
      );
    }
    box.append(list, this.mealsBlock());
    return box;
  }

  private mealsBlock(): Node {
    const s = this.store.state;
    const have = RECIPE_IDS.filter((r) => s.meals[r] > 0);
    if (!have.length) return h('p', { class: 'muted small' }, 'Serve a meal to cheer up the whole crew at once.');
    const box = h('div', { class: 'recipes' }, h('h3', {}, 'Meals'));
    for (const id of have) {
      const def = BALANCE.galley.recipes[id];
      box.append(
        h(
          'div',
          { class: 'recipe' },
          h('div', {}, h('b', {}, `${def.name} ×${s.meals[id]}`)),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn btn-small btn-go', onclick: () => this.serve(id) }, 'Serve crew'),
            h('button', { class: 'btn btn-small', onclick: () => this.sellMeal(id) }, `Sell ${def.sellPrice}¢`),
          ),
        ),
      );
    }
    return box;
  }

  private serve(id: RecipeId) {
    const r = this.store.act((st) => R.serveMeal(st, id));
    if (!this.fail(r)) return;
    sfx.hi();
    this.toast(`The crew loved the ${BALANCE.galley.recipes[id].name}!`, 'good');
  }

  private sellMeal(id: RecipeId) {
    const r = this.store.act((st) => R.sellMeal(st, id));
    if (!this.fail(r)) return;
    sfx.coins();
    this.toast(`+${r.value} credits`, 'good');
  }

  private upgradeBlock(m: ModuleState): Node {
    const t = now();
    const s = this.store.state;
    if (m.upgradingUntil !== null && t < m.upgradingUntil) {
      return h('div', { class: 'upgrade' }, h('span', {}, `Upgrading to level ${m.level + 1}… `), h('b', { 'data-until': m.upgradingUntil }));
    }
    const cost = R.upgradeCost(m);
    if (!cost) return h('div', { class: 'upgrade' }, h('span', {}, 'Top level reached. Shiny!'));
    const next = m.level + 1;
    const gain: Record<ModuleKind, string> = {
      habitat: `Rest ${BALANCE.modules.habitat.moodPerHour[next - 1]} cheer/hour`,
      greenhouse: `${BALANCE.modules.greenhouse.plots[next - 1]} growing spots${next === 2 ? ', Pumpkins' : ''}`,
      solar: `${BALANCE.modules.solar.creditsPerHour[next - 1]} credits/hour`,
      galley: 'Cooks 10% faster',
    };
    const afford = s.credits >= cost.credits && s.parts >= cost.parts;
    const secs = Math.round(cost.seconds * R.jobSpeed(s, 'engineer')) * 1000;
    return h(
      'div',
      { class: 'upgrade' },
      h(
        'div',
        { class: 'upgrade-text' },
        h('b', {}, `Level ${next}: `),
        gain[m.kind],
        h('div', { class: 'muted small' }, `${cost.credits} credits · ${cost.parts} parts · ${formatTime(secs)}`),
        afford ? null : h('div', { class: 'need small' }, R.needText(s, cost)),
      ),
      h('button', {
        class: `btn btn-small${afford ? ' btn-primary' : ' btn-dim'}`,
        'data-hint': 'upgrade',
        onclick: () => {
          const r = this.store.act((st, tt) => R.upgrade(st, m.id, tt));
          if (this.fail(r)) {
            sfx.build();
            this.toast(`Gus is on it!`, 'good');
          }
        },
      }, 'Upgrade'),
    );
  }

  openBuild() {
    if (this.placingKind) return;
    this.sheet.open('build', 'Build', () => {
      const s = this.store.state;
      const list = h('div', { class: 'build-list' });
      for (const kind of ['solar', 'greenhouse', 'galley', 'habitat'] as ModuleKind[]) {
        const def = BALANCE.modules[kind];
        const n = R.countOf(s, kind);
        const cost = R.nextBuildCost(s, kind);
        const afford = !!cost && s.credits >= cost.credits && s.parts >= cost.parts;
        const free = (BALANCE.grid.cols * BALANCE.grid.rows - 1) > s.modules.length;
        list.append(
          h(
            'div',
            { class: 'build-item' },
            h('span', { class: 'swatch', style: `background:${MODULE_SWATCH[kind]}` }),
            h('div', { class: 'build-text' }, h('b', {}, def.name), h('span', { class: 'muted small' }, ` ${n}/${def.maxCount}`), h('div', { class: 'muted small' }, MODULE_BLURB[kind])),
            cost
              ? h('button', {
                  class: `btn btn-small${afford ? ' btn-primary' : ''}`,
                  'data-hint': `build-${kind}`,
                  disabled: !free,
                  onclick: () => {
                    if (!afford) {
                      this.toast(R.needText(s, cost));
                      sfx.soft();
                      return;
                    }
                    sfx.tap();
                    this.startPlacing(kind);
                  },
                }, cost.credits === 0 && cost.parts === 0 ? 'Free' : `${cost.credits}¢${cost.parts ? ` · ${cost.parts} parts` : ''}`)
              : h('span', { class: 'muted small' }, 'All built'),
          ),
        );
      }
      return list;
    });
    this.refresh();
  }

  openRocket() {
    if (this.placingKind) return;
    this.sheet.open('rocket', 'Supply Rocket', () => {
      const s = this.store.state;
      const t = now();
      R.syncRocket(s, t);
      const box = h('div', { class: 'panel' });
      const boost = R.activeBoost(s, t);
      if (boost) box.append(h('p', { class: 'boost-note' }, `${boost.vehicle} launch bonus: double cargo for `, h('b', { 'data-until': boost.endsAt }), '.'));
      const r = s.rocket;
      const mult = R.cargoMultiplier(s, t);
      const cargo = `${BALANCE.rocket.cargo.credits * mult} credits and ${BALANCE.rocket.cargo.parts * mult} parts`;
      if (r.status === 'home') {
        const first = s.stats.rocketsLaunched === 0;
        const trip = first ? BALANCE.rocket.firstTravelSeconds * 1000 : BALANCE.rocket.travelSeconds * R.jobSpeed(s, 'pilot') * 1000;
        box.append(
          h('p', { class: 'lead' }, `Order a free supply rocket from Earth. It brings ${cargo}.`),
          h('p', { class: 'muted small' }, `Trip: about ${formatTime(trip)}. Fly the Liftoff yourself to get here sooner, or let Vera auto launch. It always arrives.`),
          h('div', { class: 'actions' },
            h('button', { class: 'btn btn-primary', 'data-hint': 'liftoff', onclick: () => this.order(true) }, 'Liftoff!'),
            h('button', { class: 'btn', 'data-hint': 'autolaunch', onclick: () => this.order(false) }, 'Auto Launch'),
          ),
        );
      } else if (r.status === 'flying') {
        box.append(
          h('p', { class: 'lead' }, 'On the way! Lands in ', h('b', { 'data-until': r.arrivesAt }), '.'),
          h('div', { class: 'meter' }, h('i', { 'data-from': r.launchedAt, 'data-to': r.arrivesAt })),
          h('p', { class: 'muted small' }, `Carrying ${cargo}. Close the game if you like; it lands on its own.`),
        );
      } else {
        const c = R.rocketCargo(s);
        box.append(
          h('p', { class: 'lead' }, `Touchdown! Cargo: ${c.credits} credits and ${c.parts} parts.`),
          h('div', { class: 'actions' }, h('button', { class: 'btn btn-go', 'data-hint': 'unload', onclick: () => { this.sheet.close(); this.tapPad(); } }, 'Unload')),
        );
      }
      const pods = s.pods;
      if (pods.length) {
        const list = h('div', { class: 'recipes' }, h('h3', {}, 'Supply pods'));
        for (const p of pods) {
          const landed = t >= p.arrivesAt;
          list.append(
            h('div', { class: 'recipe' },
              h('div', {}, h('b', {}, p.label), h('div', { class: 'muted small' }, `${p.cargo.credits} credits · ${p.cargo.parts} parts`)),
              landed
                ? h('button', { class: 'btn btn-small btn-go', onclick: () => { this.sheet.close(); this.tapPad(); } }, 'Collect')
                : h('span', { class: 'muted small' }, 'Lands in ', h('b', { 'data-until': p.arrivesAt })),
            ),
          );
        }
        box.append(list);
      }
      box.append(h('p', { class: 'muted small' }, `Rockets landed: ${s.stats.rocketsLanded}. ${JOB_HELPS.pilot}`));
      return box;
    });
    this.refresh();
  }

  order(fly: boolean) {
    const r = this.store.act((st, t) => R.orderRocket(st, t));
    if (!this.fail(r)) return;
    this.sheet.close();
    sfx.launch();
    if (fly) {
      openLiftoff(this, (score) => {
        const res = this.store.act((st, t) => R.applyLiftoff(st, score, t));
        if (res.ok && res.value! > 0) this.toast(`Smooth flying! ${formatTime(res.value!)} sooner.`, 'good');
        else this.toast('Rocket on the way!', 'good');
      });
    } else {
      this.toast('Auto Launch! Rocket on the way.', 'good');
    }
  }

  openCrew(focus?: string) {
    this.sheet.open('crew', 'Your Crew', () => {
      const s = this.store.state;
      const t = now();
      const list = h('div', { class: 'crew-list' });
      for (const c of CREW) {
        const cs = s.crew.find((x) => x.id === c.id)!;
        const label = R.moodLabel(cs.mood);
        const hiReady = R.canSayHi(s, c.id, t);
        list.append(
          h(
            'div',
            { class: `crew-card${focus === c.id ? ' focus' : ''}` },
            h('div', { class: 'crew-top' },
              h('span', { class: `job job-${c.job}` }),
              h('div', {}, h('b', {}, c.name), h('div', { class: 'muted small' }, `${JOB_LABEL[c.job]} · ${c.quirk}`)),
            ),
            h('div', { class: 'crew-mood' },
              h('span', { class: 'moodbar' }, h('i', { style: `transform:scaleX(${(cs.mood / 100).toFixed(2)})` })),
              h('span', { class: `mood mood-${label.toLowerCase()}` }, label),
            ),
            h('p', { class: 'muted small' }, JOB_HELPS[c.job]),
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn btn-small', onclick: () => this.sayHi(c.id) }, hiReady ? 'Say hi' : 'Chat'),
              h('button', { class: 'btn btn-small', onclick: () => this.snack(c.id) }, 'Share a snack'),
            ),
          ),
        );
      }
      list.append(h('p', { class: 'muted small' }, 'Cheery crew work faster. Sleepy crew just go a little slower, and cheer comes back on its own while they rest.'));
      return list;
    });
    this.refresh();
  }

  private sayHi(id: string) {
    const r = this.store.act((st, t) => R.sayHi(st, id, t));
    if (!r.ok) return;
    const c = CREW.find((x) => x.id === id)!;
    sfx.hi();
    this.toast(`${c.name.split(' ')[0]}: "${r.value}"`);
  }

  private snack(id: string) {
    const r = this.store.act((st) => R.shareSnack(st, id));
    if (!this.fail(r)) return;
    sfx.plant();
    const c = CREW.find((x) => x.id === id)!;
    this.toast(`${c.name.split(' ')[0]} munches some ${BALANCE.crops[r.value!].short}. Yum!`, 'good');
  }

  openPantry() {
    sfx.open();
    this.sheet.open('pantry', 'Pantry', () => {
      const s = this.store.state;
      const list = h('div', { class: 'recipes' });
      let any = false;
      for (const c of CROP_IDS) {
        if (s.pantry[c] <= 0) continue;
        any = true;
        const def = BALANCE.crops[c];
        list.append(
          h('div', { class: 'recipe' },
            h('div', { class: 'row-left' }, h('span', { class: 'dot', style: `background:${hex(CROP_COLOR[c])}` }), h('b', {}, `${def.short} ×${s.pantry[c]}`), h('span', { class: 'muted small' }, ` ${def.sellPrice}¢ each`)),
            h('button', {
              class: 'btn btn-small',
              onclick: () => {
                const r = this.store.act((st) => R.sellCrop(st, c, st.pantry[c]));
                if (this.fail(r)) {
                  sfx.coins();
                  this.toast(`Sent to Earth: +${r.value} credits`, 'good');
                }
              },
            }, 'Sell all'),
          ),
        );
      }
      const box = h('div', { class: 'panel' });
      if (!any) box.append(h('p', { class: 'lead' }, 'Nothing in the pantry yet. Harvest crops from a Greenhouse.'));
      box.append(list);
      if (any) {
        box.append(
          h('div', { class: 'actions' }, h('button', {
            class: 'btn btn-go',
            onclick: () => {
              const r = this.store.act((st) => R.sellAllCrops(st));
              if (this.fail(r)) {
                sfx.coins();
                this.toast(`Sent to Earth: +${r.value} credits`, 'good');
              }
            },
          }, 'Sell all crops')),
        );
      }
      box.append(this.mealsBlock(), h('p', { class: 'muted small' }, 'Crops also make great snacks for your crew.'));
      return box;
    });
    this.refresh();
  }

  openBook() {
    this.sheet.open('book', 'Collection Book', () => {
      const s = this.store.state;
      const grid = h('div', { class: 'stamps' });
      for (const st of STAMPS) {
        const got = s.stamps.includes(st.id);
        grid.append(
          h('div', { class: `stamp${got ? ' got' : ''}`, title: st.hint },
            h('span', { class: 'stamp-icon' }, got ? st.icon : '?'),
            h('b', {}, got ? st.title : '???'),
            h('span', { class: 'muted small' }, st.hint),
          ),
        );
      }
      return h('div', {}, h('p', { class: 'muted small' }, `${s.stamps.length} of ${STAMPS.length} stamps collected.`), grid);
    });
    this.refresh();
  }

  postcard() {
    this.sheet.close();
    openPostcard(this);
  }
}
