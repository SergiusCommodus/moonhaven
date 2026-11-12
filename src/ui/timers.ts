import { formatTime } from './dom';

/** Fill in every live countdown and progress bar on screen. */
export function tickTimers(root: ParentNode, now: number) {
  root.querySelectorAll<HTMLElement>('[data-until]').forEach((el) => {
    const until = Number(el.dataset.until);
    const left = until - now;
    const done = el.dataset.done ?? 'Ready!';
    const text = left <= 0 ? done : formatTime(left);
    if (el.textContent !== text) el.textContent = text;
  });
  root.querySelectorAll<HTMLElement>('[data-from][data-to]').forEach((el) => {
    const from = Number(el.dataset.from);
    const to = Number(el.dataset.to);
    const t = to > from ? Math.max(0, Math.min(1, (now - from) / (to - from))) : 1;
    el.style.transform = `scaleX(${t.toFixed(3)})`;
  });
}
