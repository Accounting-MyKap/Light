import { playTone, type ToneKind } from './sound';

const KINDS: ToneKind[] = ['correct', 'wrong', 'finish', 'whistle', 'clack', 'chime'];

test('playTone is a no-op without AudioContext', () => {
  for (const kind of KINDS) expect(() => playTone(kind)).not.toThrow();
});

/** A note as the fake context saw it scheduled, in seconds after the call. */
interface Scheduled {
  wave: string;
  freq: number;
  glide: number | null;
  start: number;
  stop: number;
  peak: number;
  /** Seconds from its start to its loudest point. */
  rise: number;
}

/**
 * A WebAudio stand-in that records every note scheduled on it. The module keeps its context once made, so each test
 * loads a fresh copy of it.
 */
async function withFakeAudio(state: AudioContextState = 'running') {
  const notes: Scheduled[] = [];
  const resume = vi.fn(() => Promise.resolve());
  const NOW = 10;
  class FakeAudioContext {
    currentTime = NOW;
    state = state;
    destination = {};
    resume = resume;
    createGain() {
      const events: Array<{ value: number; at: number }> = [];
      const record = (value: number, at: number) => events.push({ value, at });
      return {
        events,
        gain: { setValueAtTime: record, linearRampToValueAtTime: record, exponentialRampToValueAtTime: record },
        connect: <T,>(node: T) => node,
      };
    }
    createOscillator() {
      const note: Scheduled = { wave: 'sine', freq: 0, glide: null, start: 0, stop: 0, peak: 0, rise: 0 };
      let gain: ReturnType<FakeAudioContext['createGain']> | null = null;
      const osc = {
        set type(wave: string) {
          note.wave = wave;
        },
        frequency: {
          set value(freq: number) {
            note.freq = freq;
          },
          setValueAtTime: (freq: number) => {
            note.freq = freq;
          },
          exponentialRampToValueAtTime: (freq: number) => {
            note.glide = freq;
          },
        },
        connect: (node: ReturnType<FakeAudioContext['createGain']>) => {
          gain = node;
          return node;
        },
        start: (at: number) => {
          note.start = at - NOW;
        },
        stop: (at: number) => {
          note.stop = at - NOW;
          const loudest = gain!.events.reduce((a, b) => (b.value > a.value ? b : a));
          note.peak = loudest.value;
          note.rise = loudest.at - NOW - note.start;
          notes.push(note);
        },
      };
      return osc;
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.resetModules();
  const sound = await import('./sound');
  return { notes, resume, playTone: sound.playTone };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the answer tones stay as they were', async () => {
  const { notes, playTone: play } = await withFakeAudio();
  play('correct');
  expect(notes).toEqual([
    { wave: 'sine', freq: 880, glide: null, start: 0, stop: expect.closeTo(0.08), peak: 0.12, rise: 0 },
  ]);
});

test('the train cues are softer and shorter than the answer tones: at level 10 a train leaves each 1.6 s', async () => {
  const { notes, playTone: play } = await withFakeAudio();
  for (const kind of ['whistle', 'clack', 'chime'] as const) {
    notes.length = 0;
    play(kind);
    expect(notes.length, kind).toBeGreaterThan(0);
    for (const note of notes) expect(note.peak, kind).toBeLessThanOrEqual(0.08);
    expect(Math.max(...notes.map((n) => n.stop)), kind).toBeLessThanOrEqual(kind === 'clack' ? 0.1 : 0.4);
  }
});

test('the whistle is two notes, one after the other, that swell in instead of starting with a click', async () => {
  const { notes, playTone: play } = await withFakeAudio();
  play('whistle');
  expect(notes).toHaveLength(2);
  expect(notes[1].start).toBeGreaterThanOrEqual(notes[0].stop - 0.02);
  for (const note of notes) expect(note.rise).toBeGreaterThan(0);
});

test('the clack is a short knock that drops in pitch, and the chime rings high', async () => {
  const { notes, playTone: play } = await withFakeAudio();
  play('clack');
  for (const note of notes) {
    expect(note.stop - note.start).toBeLessThanOrEqual(0.05);
    expect(note.glide).toBeLessThan(note.freq);
  }
  notes.length = 0;
  play('chime');
  expect(Math.min(...notes.map((n) => n.freq))).toBeGreaterThan(1000);
});

test('a context the browser left suspended is resumed, so a later tap can wake the sound on a phone', async () => {
  const { resume, playTone: play } = await withFakeAudio('suspended');
  play('whistle');
  expect(resume).toHaveBeenCalled();
});

test('a context that fails never breaks the game', async () => {
  const { playTone: play } = await withFakeAudio();
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        throw new Error('no audio');
      }
    },
  );
  vi.resetModules();
  const { playTone: fresh } = await import('./sound');
  expect(() => fresh('chime')).not.toThrow();
  expect(() => play('clack')).not.toThrow();
});
