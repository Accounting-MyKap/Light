export type ToneKind = 'correct' | 'wrong' | 'finish' | 'tilt' | 'levelUp';

/** One note: its pitch (and the pitch it slides to), when it starts and how long it lasts (s), wave and volume. */
interface Note {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  endFreq?: number;
  gain?: number;
}

const TONES: Record<ToneKind, Note[]> = {
  correct: [{ freq: 880, start: 0, duration: 0.08 }],
  wrong: [{ freq: 220, start: 0, duration: 0.15 }],
  finish: [
    { freq: 660, start: 0, duration: 0.1 },
    { freq: 990, start: 0.12, duration: 0.14 },
  ],
  // A wooden «clonk» when a balance tips: a sliding triangle over a short low sine.
  tilt: [
    { freq: 190, endFreq: 120, start: 0, duration: 0.12, type: 'triangle', gain: 0.16 },
    { freq: 95, start: 0, duration: 0.18, gain: 0.1 },
  ],
  // C-E-G-C up, bright. It starts after the hit tone that comes with the same answer.
  levelUp: [
    { freq: 523.25, start: 0.12, duration: 0.09, type: 'triangle' },
    { freq: 659.25, start: 0.21, duration: 0.09, type: 'triangle' },
    { freq: 783.99, start: 0.3, duration: 0.09, type: 'triangle' },
    { freq: 1046.5, start: 0.39, duration: 0.18, type: 'triangle' },
  ],
};

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

export function playTone(kind: ToneKind): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    for (const tone of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + tone.start;
      if (tone.type) osc.type = tone.type;
      osc.frequency.value = tone.freq;
      if (tone.endFreq) osc.frequency.exponentialRampToValueAtTime(tone.endFreq, at + tone.duration);
      gain.gain.setValueAtTime(tone.gain ?? 0.12, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + tone.duration);
    }
  } catch {
    // Sound is optional; never let it break a game.
  }
}
