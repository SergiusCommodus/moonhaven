import { h, icon } from './dom';

/**
 * A panel that slides up from the bottom. Its content is re-drawn only when it
 * actually changes, so buttons never jump while you are tapping them.
 * Live timers use <span data-until="ms"> and bars use data-from/data-to; `tickTimers` fills them.
 */
export class Sheet {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  private render: (() => Node) | null = null;
  private lastHtml = '';
  private onClose: (() => void) | null = null;
  kind = '';

  constructor(root: HTMLElement, private closed: () => void) {
    this.titleEl = h('h2', { class: 'sheet-title' });
    this.body = h('div', { class: 'sheet-body' });
    const close = h('button', { class: 'sheet-close', 'aria-label': 'Close', onclick: () => this.close() });
    close.append(icon('close'));
    this.el = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'false' }, h('div', { class: 'sheet-head' }, this.titleEl, close), this.body);
    const scrim = h('div', { class: 'sheet-scrim', onclick: () => this.close() });
    root.append(scrim, this.el);
    this.scrim = scrim;
  }
  private scrim: HTMLDivElement;

  get isOpen() {
    return this.render !== null;
  }

  open(kind: string, title: string, render: () => Node, onClose?: () => void) {
    if (this.onClose && this.kind !== kind) this.onClose();
    this.kind = kind;
    this.titleEl.textContent = title;
    this.render = render;
    this.onClose = onClose ?? null;
    this.lastHtml = '';
    this.refresh();
    this.el.classList.add('open');
    this.scrim.classList.add('open');
    this.body.scrollTop = 0;
  }

  setTitle(t: string) {
    this.titleEl.textContent = t;
  }

  refresh() {
    if (!this.render) return;
    const node = this.render();
    const tmp = document.createElement('div');
    tmp.append(node);
    const html = tmp.innerHTML;
    if (html !== this.lastHtml) {
      this.lastHtml = html;
      this.body.replaceChildren(...Array.from(tmp.childNodes));
    }
  }

  close() {
    if (!this.render) return;
    this.render = null;
    this.kind = '';
    this.el.classList.remove('open');
    this.scrim.classList.remove('open');
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
    this.closed();
  }
}
