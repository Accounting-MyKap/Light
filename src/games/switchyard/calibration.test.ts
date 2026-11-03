import { createRng, type Rng } from '../../core/rng';
import {
  SWITCH_GRACE,
  SWITCHYARD_DURATION_MS,
  SWITCHYARD_MAX_SCORE,
  SWITCHYARD_REFERENCE_SCORE,
  advanceSwitchyard,
  arrivalPoints,
  createSwitchyardGame,
  spawnIntervalMs,
  toggleSwitch,
  trainSpeed,
  type SwitchyardState,
  type Train,
} from './engine';

/*
 * Calibration by simulation: scripted players play whole 90 s games at 60 fps, so the score limits and the time there
 * is to react can be checked against what the engine really allows, not against estimates. What 8 seeds gave when
 * this was written (score, mean and range; the perfect player sends every train home):
 *
 *   start level   perfect            9 in 10 home        7 in 10 home
 *   1             396 (382–404)      294 (168–404)       182 (122–254)
 *   5             1074 (1056–1084)   801 (464–1056)      431 (236–618)
 *   10            1498 (1484–1512)   1293 (1162–1456)    970 (520–1208)
 *
 * On average the reference (900) takes a flawless game from start level 4 (914), nine trains in ten home from level 6
 * (930), or seven in ten only from level 9 or 10. Between games the start level only rises with 85 % or more, so a
 * player seven in ten home stays where they started. At level 10 two trains reach the same switch 1.6 s apart at the
 * least, which leaves about 1.4 s to turn it once the first is past the grace.
 */

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const FRAME_MS = 1000 / 60;

/**
 * Sets every switch the way the first train that still has to cross it is sent: a train within SWITCH_GRACE past a
 * switch still has to cross it, so the switch waits for it to clear before turning for the next one.
 */
function steer(state: SwitchyardState, sendTo: (train: Train) => number): SwitchyardState {
  let s = state;
  const claimed = new Set<number>();
  for (const train of [...s.trains].sort((x, y) => x.id - y.id)) {
    if (train.arrived) continue;
    const current = train.route[train.route.length - 1];
    for (const [sw, option] of s.map.stations[sendTo(train)].route) {
      const { exits } = s.map.switches[sw];
      const overIt = exits.includes(current) && train.distance <= SWITCH_GRACE;
      const crossed = !overIt && exits.some((exit) => train.route.includes(exit));
      if (crossed || claimed.has(sw)) continue;
      claimed.add(sw);
      if (s.switches[sw] !== option) s = toggleSwitch(s, sw);
    }
  }
  return s;
}

/**
 * A player who sends each train home with the odds given and otherwise to another station at random, decided once
 * per train. Its timing is perfect: only the choice goes wrong.
 */
function playerSending(home: number, rng: Rng, stations: number): (train: Train) => number {
  const plan = new Map<number, number>();
  return (train) => {
    let station = plan.get(train.id);
    if (station === undefined) {
      const others = Array.from({ length: stations }, (_, i) => i).filter((i) => i !== train.station);
      station = rng() < home ? train.station : others[Math.floor(rng() * others.length)];
      plan.set(train.id, station);
    }
    return station;
  };
}

interface Played {
  score: number;
  accuracy: number;
  /** The shortest time between two trains reaching the same switch, in ms. */
  switchGap: number;
}

function playGame(startLevel: number, seed: number, home: number): Played {
  const rng = createRng(seed);
  let s = createSwitchyardGame(startLevel, rng, 0);
  const sendTo = playerSending(home, createRng(1000 + seed), s.map.stations.length);
  const reached = new Map<number, number[]>();
  while (s.now < SWITCHYARD_DURATION_MS) {
    s = steer(s, sendTo);
    const before = new Map(s.trains.map((train) => [train.id, train.route.length]));
    s = advanceSwitchyard(s, Math.min(SWITCHYARD_DURATION_MS, s.now + FRAME_MS), rng).state;
    for (const train of s.trains) {
      const was = before.get(train.id);
      if (was === undefined || was === train.route.length) continue;
      const from = s.map.segments[train.route[was]].from;
      if (from === 'tunnel') continue;
      // Its front reached the switch this frame, as far back as it has run onto the exit since.
      const at = s.now - (train.distance / trainSpeed(s.staircase.level)) * 1000;
      reached.set(from.switch, [...(reached.get(from.switch) ?? []), at]);
    }
  }
  let switchGap = Infinity;
  for (const times of reached.values()) {
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) switchGap = Math.min(switchGap, times[i] - times[i - 1]);
  }
  return { score: s.score, accuracy: s.correct / s.total, switchGap };
}

const alreadyPlayed = new Map<string, Played[]>();
/** One game per seed, played once and shared by the tests that look at it. */
function games(startLevel: number, home: number): Played[] {
  const key = `${startLevel}:${home}`;
  if (!alreadyPlayed.has(key)) alreadyPlayed.set(key, SEEDS.map((seed) => playGame(startLevel, seed, home)));
  return alreadyPlayed.get(key)!;
}
const scores = (played: Played[]) => played.map((p) => p.score);

describe.each([1, 5, 10])('from start level %i', (level) => {
  test('a perfect player sends every train home and stays under the maximum score the database accepts', () => {
    const played = games(level, 1);
    for (const p of played) expect(p.accuracy).toBe(1);
    // The ceiling written next to SWITCHYARD_MAX_SCORE: 57 trains at level 10's 28 points.
    expect(Math.max(...scores(played))).toBeLessThanOrEqual(57 * arrivalPoints(10));
    expect(Math.max(...scores(played))).toBeLessThan(SWITCHYARD_MAX_SCORE);
  });

  test('a player who sends 7 trains in 10 home really is that sloppy', () => {
    const played = games(level, 0.7);
    const mean = played.reduce((sum, p) => sum + p.accuracy, 0) / played.length;
    expect(mean).toBeGreaterThan(0.62);
    expect(mean).toBeLessThan(0.78);
  });
});

describe('the reference score', () => {
  test('is reached by strong play: every flawless game from level 5, every game 9 in 10 home from level 10', () => {
    expect(Math.min(...scores(games(5, 1)))).toBeGreaterThanOrEqual(SWITCHYARD_REFERENCE_SCORE);
    expect(Math.min(...scores(games(10, 1)))).toBeGreaterThanOrEqual(SWITCHYARD_REFERENCE_SCORE);
    expect(Math.min(...scores(games(10, 0.9)))).toBeGreaterThanOrEqual(SWITCHYARD_REFERENCE_SCORE);
  });

  test('is far out of reach of a sloppy player from level 1, and of any game from level 1', () => {
    expect(Math.max(...scores(games(1, 0.7)))).toBeLessThan(SWITCHYARD_REFERENCE_SCORE / 2);
    expect(Math.max(...scores(games(5, 0.7)))).toBeLessThan(SWITCHYARD_REFERENCE_SCORE);
    // Even a flawless first game climbs from level 1 only to about 7, so the area's top waits for a higher start.
    expect(Math.max(...scores(games(1, 1)))).toBeLessThan(SWITCHYARD_REFERENCE_SCORE);
  });
});

test('at level 10 two trains reach the same switch at least 1.6 s apart: about 1.4 s to turn it between them', () => {
  const gaps = [...games(10, 1), ...games(10, 0.7)].map((p) => p.switchGap);
  const shortest = Math.min(...gaps);
  // Every train runs at the same speed, so they keep the spacing they left the tunnel with.
  expect(shortest).toBeGreaterThanOrEqual(spawnIntervalMs(10) - 1);
  // The switch can only turn once the first train is past the grace.
  const window = shortest - (SWITCH_GRACE / trainSpeed(10)) * 1000;
  expect(window).toBeGreaterThan(1400);
});
