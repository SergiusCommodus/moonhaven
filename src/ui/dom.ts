/** Tiny helpers for building the on-screen buttons and panels. */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k === 'style') {
      el.setAttribute('style', String(v));
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** "45s", "12m", "1h 20m", "2d 3h" */
export function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rs = s % 60;
    return m < 5 && rs ? `${m}m ${rs}s` : `${m}m`;
  }
  const hr = Math.floor(m / 60);
  if (hr < 24) {
    const rm = m % 60;
    return rm ? `${hr}h ${rm}m` : `${hr}h`;
  }
  const d = Math.floor(hr / 24);
  const rh = hr % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

export function formatNum(n: number): string {
  const v = Math.floor(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString('en-US');
}

export const ICON = {
  credits: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#D99A2B"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#F6D27A" stroke-width="2"/></svg>',
  parts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#BDB7D6" d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/><circle cx="12" cy="12" r="3.5" fill="#0B0A1F"/></svg>',
  pantry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#C9955A" d="M3 9h18l-2 11H5z"/><path fill="none" stroke="#FFF4E0" stroke-width="2" d="M7 9l3-5M17 9l-3-5"/><circle cx="9" cy="14" r="1.6" fill="#E8475F"/><circle cx="14" cy="15" r="1.6" fill="#6FD36B"/></svg>',
  build: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EAE7F5" d="M3 18a9 9 0 0 1 18 0z"/><rect x="2" y="18" width="20" height="3" rx="1.5" fill="#D99A2B"/><circle cx="12" cy="13" r="2" fill="#D2558E"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#D2558E" d="M7 15l-3 6 5-2zM17 15l3 6-5-2z"/><path fill="#EAE7F5" d="M12 1c4 3 5 9 3 17H9C7 10 8 4 12 1z"/><circle cx="12" cy="9" r="2.2" fill="#1FB8A0"/></svg>',
  crew: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="6" fill="#F3F0FF"/><ellipse cx="12.5" cy="8" rx="4" ry="3" fill="#1FB8A0"/><rect x="6" y="14" width="12" height="8" rx="3" fill="#F3F0FF"/><rect x="6" y="17" width="12" height="2" fill="#D99A2B"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" fill="#7C5CFF"/><rect x="7" y="6" width="10" height="7" rx="1" fill="#FFF4E0"/><circle cx="12" cy="9.5" r="2" fill="#D2558E"/></svg>',
  postcard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" fill="#FFF4E0"/><rect x="4" y="7" width="10" height="10" rx="1" fill="#1FB8A0"/><circle cx="9" cy="11" r="2" fill="#D99A2B"/><rect x="16" y="7" width="4" height="4" fill="#D2558E"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFF4E0" d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" stroke="#1FB8A0" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFF4E0" d="M4 9h4l5-4v14l-5-4H4z"/><path stroke="#D2558E" stroke-width="2" stroke-linecap="round" d="M16 9l5 6M21 9l-5 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function icon(name: keyof typeof ICON, cls = 'ic'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = ICON[name];
  return s;
}
