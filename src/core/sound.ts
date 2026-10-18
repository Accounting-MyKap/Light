type ToneKind = 'correct' | 'wrong' | 'finish';

const TONES: Record<ToneKind, Array<{ freq: number; start: number; duration: number }>> = {
  correct: [{ freq: 880, start: 0, duration: 0.08 }],
  wrong: [{ freq: 220, start: 0, duration: 0.15 }],
  finish: [
    { freq: 660, start: 0, duration: 0.1 },
    { freq: 990, start: 0.12, duration: 0.14 },
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
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.12, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + tone.duration);
    }
  } catch {
    // Sound is optional; never let it break a game.
  }
}
