import { sfx } from '../audio/sound';
import { CREW } from '../config/crew';
import { now } from '../core/clock';
import { shareImage } from '../platform/share';
import { h } from './dom';
import type { UI } from './App';

/** Make a vintage postcard picture of the colony to save or share. */
export async function openPostcard(ui: UI) {
  sfx.open();
  let shot: ReturnType<UI['world']['snapshot']>;
  try {
    shot = ui.world.snapshot(ui.store.state, now());
  } catch {
    ui.toast('Could not take the picture this time. Try again in a moment.');
    return;
  }
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.load('48px Righteous');
  } catch {
    /* font is optional */
  }
  const card = compose(shot, ui);
  const blob = await new Promise<Blob | null>((res) => card.toBlob(res, 'image/png'));
  if (!blob) {
    ui.toast('Could not make the postcard.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const img = h('img', { class: 'postcard-img', src: url, alt: 'A postcard of your Moon colony' });
  const share = h('button', { class: 'btn btn-primary' }, 'Save or share');
  const close = h('button', { class: 'btn btn-ghost' }, 'Close');
  const box = h('div', { class: 'modal postcard', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Postcard' },
    h('h2', { class: 'modal-title' }, 'Your postcard'),
    img,
    h('p', { class: 'muted small' }, 'On a phone you can also press and hold the picture to save it.'),
    h('div', { class: 'btn-row center' }, share, close),
  );
  const scrim = h('div', { class: 'modal-scrim' }, box);
  ui.root.append(scrim);
  ui.setModal(true);
  requestAnimationFrame(() => scrim.classList.add('open'));
  const done = () => {
    scrim.classList.remove('open');
    ui.setModal(false);
    setTimeout(() => {
      scrim.remove();
      URL.revokeObjectURL(url);
    }, 250);
  };
  close.addEventListener('click', done);
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) done();
  });
  share.addEventListener('click', async () => {
    const r = await shareImage(blob, 'moonhaven-postcard.png', 'Greetings from Moonhaven');
    if (r === 'downloaded') ui.toast('Postcard saved to your downloads.', 'good');
  });
}

function compose(snap: ReturnType<UI['world']['snapshot']>, ui: UI): HTMLCanvasElement {
  const { canvas: shot, focus } = snap;
  const tall = focus.w / focus.h < 1;
  const m = 44;
  const top = 150;
  const bottom = 110;
  const W = tall ? 1000 : 1200;
  const pw = W - m * 2;
  // A tall phone picture gets a tall card, shaped to fit the colony.
  const ph = tall ? Math.round(pw * Math.max(1, Math.min(1.45, focus.h / focus.w))) : 900 - top - bottom;
  const H = top + ph + bottom;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  // Cream card with a rounded photo window
  c.fillStyle = '#FFF4E0';
  c.fillRect(0, 0, W, H);
  c.save();
  c.beginPath();
  c.roundRect(m, top, pw, ph, 28);
  c.clip();
  c.fillStyle = '#0B0A1F';
  c.fillRect(m, top, pw, ph);
  // Grow the focus area to the window's shape (keeping it centered), then fit inside the picture.
  const dr = pw / ph;
  let sw = focus.w;
  let sh = focus.h;
  if (sw / sh > dr) sh = sw / dr;
  else sw = sh * dr;
  if (sw > shot.width) {
    sw = shot.width;
    sh = sw / dr;
  }
  if (sh > shot.height) {
    sh = shot.height;
    sw = sh * dr;
  }
  const cx = focus.x + focus.w / 2;
  const cy = focus.y + focus.h / 2;
  const sx = Math.max(0, Math.min(shot.width - sw, cx - sw / 2));
  const sy = Math.max(0, Math.min(shot.height - sh, cy - sh / 2));
  c.drawImage(shot, sx, sy, sw, sh, m, top, pw, ph);
  c.restore();
  c.lineWidth = 6;
  c.strokeStyle = '#D99A2B';
  c.beginPath();
  c.roundRect(m, top, pw, ph, 28);
  c.stroke();

  // Title
  c.textAlign = 'left';
  c.fillStyle = '#D2558E';
  c.font = '40px Righteous, system-ui, sans-serif';
  c.fillText('Greetings from', m + 6, 66);
  c.fillStyle = '#7C5CFF';
  c.font = '76px Righteous, system-ui, sans-serif';
  c.fillText('MOONHAVEN', m, 132);

  // Stamp
  const sx0 = W - m - 130;
  c.save();
  c.translate(sx0 + 65, 78);
  c.rotate(0.08);
  c.fillStyle = '#1FB8A0';
  c.setLineDash([6, 5]);
  c.strokeStyle = '#1FB8A0';
  c.lineWidth = 3;
  c.strokeRect(-58, -52, 116, 104);
  c.setLineDash([]);
  c.fillStyle = '#0B0A1F';
  c.fillRect(-50, -44, 100, 88);
  c.fillStyle = '#D99A2B';
  c.beginPath();
  c.arc(14, -6, 22, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#EAE7F5';
  c.beginPath();
  c.moveTo(-18, -34);
  c.quadraticCurveTo(-6, -16, -10, 18);
  c.lineTo(-26, 18);
  c.quadraticCurveTo(-30, -16, -18, -34);
  c.fill();
  c.fillStyle = '#D2558E';
  c.fillRect(-32, 14, 28, 8);
  c.fillStyle = '#FFF4E0';
  c.font = '14px Righteous, system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('LUNA AIR', 0, 38);
  c.restore();

  // Footer
  const s = ui.store.state;
  const day = Math.max(1, Math.floor((now() - s.createdAt) / 86_400_000) + 1);
  const names = CREW.map((x) => x.name.split(' ')[0]);
  c.textAlign = 'left';
  c.fillStyle = '#1A1533';
  c.font = '30px Righteous, system-ui, sans-serif';
  c.fillText(`Colony day ${day}. Love from ${names[0]}, ${names[1]} & ${names[2]}.`, m + 4, H - 62);
  c.fillStyle = '#B07A1C';
  c.font = '22px system-ui, sans-serif';
  c.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), m + 4, H - 28);
  return cv;
}
