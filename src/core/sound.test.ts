import { playTone } from './sound';

test('playTone is a no-op without AudioContext', () => {
  for (const kind of ['correct', 'wrong', 'finish', 'tilt', 'levelUp'] as const) {
    expect(() => playTone(kind)).not.toThrow();
  }
});

interface FakeOsc {
  type: string;
  startAt: number;
  ramps: [number, number][];
  freq: number;
}

/** A minimal AudioContext that records every oscillator it makes. */
function installFakeAudio(): FakeOsc[] {
  const made: FakeOsc[] = [];
  class FakeContext {
    currentTime = 10;
    destination = {};
    createOscillator() {
      const osc: FakeOsc = { type: 'sine', startAt: -1, ramps: [], freq: 0 };
      made.push(osc);
      return {
        set type(value: string) {
          osc.type = value;
        },
        frequency: {
          set value(v: number) {
            osc.freq = v;
          },
          setValueAtTime: (v: number) => {
            osc.freq = v;
          },
          exponentialRampToValueAtTime: (v: number, at: number) => osc.ramps.push([v, at]),
        },
        connect: (node: unknown) => node,
        start: (at: number) => {
          osc.startAt = at;
        },
        stop: () => {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: (node: unknown) => node,
      };
    }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  return made;
}

describe('with an AudioContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('levelUp plays a rising four-note arpeggio that starts 120 ms in, after the hit tone', async () => {
    const made = installFakeAudio();
    const { playTone: play } = await import('./sound');
    play('levelUp');
    expect(made).toHaveLength(4);
    expect(made[0].startAt).toBeCloseTo(10.12);
    expect(made.map((o) => o.freq)).toEqual([523.25, 659.25, 783.99, 1046.5]);
    expect(made.every((o) => o.type === 'triangle')).toBe(true);
  });

  test('tilt is a low triangle «clonk» that slides from 190 to 120 Hz, over a deeper sine', async () => {
    const made = installFakeAudio();
    const { playTone: play } = await import('./sound');
    play('tilt');
    expect(made[0].type).toBe('triangle');
    expect(made[0].freq).toBe(190);
    expect(made[0].ramps).toEqual([[120, expect.closeTo(10.12)]]);
    expect(made[1]).toMatchObject({ type: 'sine', freq: 95 });
  });
});
