/**
 * Soft sounds made in code with the Web Audio API. No sound files.
 * Sound is on by default; the mute choice is remembered.
 */
import { storage } from '../platform/storage';

const MUTE_KEY = 'moonhaven.muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = storage.get(MUTE_KEY) === '1';

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from the first tap so iPhones allow sound. */
export function unlockAudio() {
  audio();
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  storage.set(MUTE_KEY, m ? '1' : '0');
  if (m && ctx) void ctx.suspend().catch(() => {});
  if (!m) unlockAudio();
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(start: number, dur: number, gain: number, from: number, to: number) {
  const a = audio();
  if (!a || !master) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  const t0 = a.currentTime + start;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  tap: () => tone(660, 0, 0.08, { type: 'triangle', gain: 0.07 }),
  open: () => tone(523, 0, 0.12, { type: 'sine', gain: 0.09, slideTo: 659 }),
  plant: () => {
    tone(392, 0, 0.12, { type: 'triangle', gain: 0.12 });
    tone(523, 0.08, 0.16, { type: 'triangle', gain: 0.1 });
  },
  harvest: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.22, { type: 'sine', gain: 0.12 })),
  coins: () => [880, 1175, 1397].forEach((f, i) => tone(f, i * 0.05, 0.14, { type: 'triangle', gain: 0.08 })),
  build: () => {
    tone(196, 0, 0.18, { type: 'triangle', gain: 0.14 });
    tone(262, 0.12, 0.18, { type: 'triangle', gain: 0.12 });
  },
  done: () => [392, 523, 659].forEach((f, i) => tone(f, i * 0.09, 0.3, { type: 'sine', gain: 0.1 })),
  launch: () => {
    noise(0, 1.6, 0.18, 300, 2400);
    tone(110, 0, 1.4, { type: 'sine', gain: 0.1, slideTo: 330 });
  },
  land: () => {
    noise(0, 0.8, 0.12, 1800, 200);
    tone(330, 0.6, 0.25, { type: 'sine', gain: 0.1 });
  },
  chime: () => [659, 880, 988, 1319].forEach((f, i) => tone(f, i * 0.12, 0.5, { type: 'sine', gain: 0.1 })),
  stamp: () => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.08, 0.25, { type: 'triangle', gain: 0.09 })),
  soft: () => tone(440, 0, 0.15, { type: 'sine', gain: 0.06, slideTo: 392 }),
  hi: () => {
    tone(587, 0, 0.1, { type: 'sine', gain: 0.09 });
    tone(784, 0.09, 0.14, { type: 'sine', gain: 0.09 });
  },
};

/** A continuous engine hum for the Liftoff mini game. */
export function engineHum() {
  const a = audio();
  if (!a || !master) return { set: (_t: number) => {}, stop: () => {} };
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sawtooth';
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 400;
  g.gain.value = 0.0001;
  osc.frequency.value = 70;
  osc.connect(f).connect(g).connect(master);
  osc.start();
  g.gain.exponentialRampToValueAtTime(0.05, a.currentTime + 0.2);
  return {
    set(t: number) {
      osc.frequency.setTargetAtTime(70 + t * 90, a.currentTime, 0.05);
      f.frequency.setTargetAtTime(300 + t * 900, a.currentTime, 0.05);
    },
    stop() {
      g.gain.setTargetAtTime(0.0001, a.currentTime, 0.08);
      osc.stop(a.currentTime + 0.4);
    },
  };
}
