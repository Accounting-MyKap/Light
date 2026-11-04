export type ToneKind = 'correct' | 'wrong' | 'finish' | 'whistle' | 'clack' | 'chime';

interface Note {
  freq: number;
  /** Seconds after the call. */
  start: number;
  duration: number;
  /** Sine unless said otherwise. */
  wave?: OscillatorType;
  /** The loudest gain; 0.12 unless said otherwise. */
  peak?: number;
  /** Seconds to swell to the peak; without it the note starts at the peak. */
  attack?: number;
  /** The frequency it slides to by its end. */
  glide?: number;
}

const TONES: Record<ToneKind, Note[]> = {
  correct: [{ freq: 880, start: 0, duration: 0.08 }],
  wrong: [{ freq: 220, start: 0, duration: 0.15 }],
  finish: [
    { freq: 660, start: 0, duration: 0.1 },
    { freq: 990, start: 0.12, duration: 0.14 },
  ],
  // Guardagujas. Softer and shorter than the answer tones, so they never tire: at level 10 a train leaves every 1.6 s.
  /** A steam whistle as a train comes out of the tunnel: two soft notes, the second higher, that swell in. */
  whistle: [
    { freq: 587, start: 0, duration: 0.14, wave: 'triangle', peak: 0.05, attack: 0.03 },
    { freq: 740, start: 0.15, duration: 0.22, wave: 'triangle', peak: 0.05, attack: 0.03, glide: 698 },
  ],
  /** The lever of a switch: two dull knocks a few hundredths of a second long, each dropping in pitch. */
  clack: [
    { freq: 300, start: 0, duration: 0.03, wave: 'square', peak: 0.035, glide: 90 },
    { freq: 210, start: 0.04, duration: 0.035, wave: 'square', peak: 0.03, glide: 70 },
  ],
  /** A small bell when a train is home: a high note with a fainter one above it. */
  chime: [
    { freq: 1319, start: 0, duration: 0.3, peak: 0.07 },
    { freq: 1976, start: 0.06, duration: 0.24, peak: 0.035 },
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
    // A context made outside a tap (a train leaving the tunnel) starts suspended on some phones (iPhone); asking on
    // every tone lets the next one played from a tap wake it. Its clock stands still meanwhile, so tones scheduled now
    // would all burst out together once it wakes: until then, play nothing.
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined);
      return;
    }
    for (const note of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + note.start;
      const end = at + note.duration;
      const peak = note.peak ?? 0.12;
      osc.type = note.wave ?? 'sine';
      osc.frequency.setValueAtTime(note.freq, at);
      if (note.glide) osc.frequency.exponentialRampToValueAtTime(note.glide, end);
      if (note.attack) {
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(peak, at + note.attack);
      } else {
        gain.gain.setValueAtTime(peak, at);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(end);
    }
  } catch {
    // Sound is optional; never let it break a game.
  }
}
