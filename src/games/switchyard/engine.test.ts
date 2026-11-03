import { createRng, type Rng } from '../../core/rng';
import {
  FIRST_TRAIN_MS,
  SWITCH_GRACE,
  TRAIN_LENGTH,
  advanceSwitchyard,
  arrivalPoints,
  createSwitchyardGame,
  destinationOf,
  pickStation,
  spawnIntervalMs,
  switchyardResult,
  toggleSwitch,
  trainPose,
  trainSpeed,
  type Arrival,
  type SwitchyardState,
} from './engine';
import { poseAt } from './geometry';
import { ALL_MAPS, mapFor, stationCountForLevel } from './maps';

/** Sets every switch so the tracks lead to the given station. */
function routeTo(state: SwitchyardState, stationId: number): SwitchyardState {
  let s = state;
  for (const [sw, option] of s.map.stations[stationId].route) if (s.switches[sw] !== option) s = toggleSwitch(s, sw);
  return s;
}

/** A perfect player: every switch points the way the first train that still has to cross it needs. */
function steer(state: SwitchyardState): SwitchyardState {
  let s = state;
  const claimed = new Set<number>();
  for (const train of [...s.trains].sort((x, y) => x.id - y.id)) {
    if (train.arrived) continue;
    for (const [sw, option] of s.map.stations[train.station].route) {
      const crossed = s.map.switches[sw].exits.some((exit) => train.route.includes(exit));
      if (crossed || claimed.has(sw)) continue;
      claimed.add(sw);
      if (s.switches[sw] !== option) s = toggleSwitch(s, sw);
    }
  }
  return s;
}

/** Advances in frames of `frame` ms up to `to`, collecting the arrivals. */
function run(state: SwitchyardState, to: number, rng: Rng, frame = 16): { state: SwitchyardState; arrivals: Arrival[] } {
  let s = state;
  const arrivals: Arrival[] = [];
  while (s.now < to) {
    const res = advanceSwitchyard(s, Math.min(to, s.now + frame), rng);
    s = res.state;
    arrivals.push(...res.arrivals);
  }
  return { state: s, arrivals };
}

/** Advances until the first arrival. */
function untilArrival(state: SwitchyardState, rng: Rng): { state: SwitchyardState; arrival: Arrival } {
  let s = state;
  for (let guard = 0; guard < 2000; guard++) {
    const res = advanceSwitchyard(s, s.now + 16, rng);
    s = res.state;
    if (res.arrivals.length > 0) return { state: s, arrival: res.arrivals[0] };
  }
  throw new Error('no arrival');
}

describe('level parameters', () => {
  test('trains leave every 4 s at level 1 and every 1.6 s at level 10', () => {
    expect(spawnIntervalMs(1)).toBe(4000);
    expect(spawnIntervalMs(10)).toBe(1600);
    expect(spawnIntervalMs(5)).toBe(Math.round(4000 - (4 * 2400) / 9));
  });
  test('trains run at 70 u/s at level 1 and 130 u/s at level 10', () => {
    expect(trainSpeed(1)).toBe(70);
    expect(trainSpeed(10)).toBe(130);
  });
  test('a train home is worth 10 points at level 1 and 28 at level 10', () => {
    expect(arrivalPoints(1)).toBe(10);
    expect(arrivalPoints(10)).toBe(28);
  });
});

describe('a new game', () => {
  test('uses the map for its starting level and sets every switch', () => {
    for (const level of [1, 4, 10]) {
      const s = createSwitchyardGame(level, createRng(level), 0);
      expect(s.map.stations).toHaveLength(stationCountForLevel(level));
      expect(s.switches).toHaveLength(s.map.switches.length);
      expect(s.staircase.level).toBe(level);
      expect(s).toMatchObject({ trains: [], score: 0, correct: 0, total: 0, now: 0 });
    }
  });

  test('picks the plain or the mirrored map at random', () => {
    const keys = new Set(Array.from({ length: 40 }, (_, i) => createSwitchyardGame(1, createRng(i), 0).map.key));
    expect(keys).toEqual(new Set(['3', '3m']));
  });
});

describe('trains leave the tunnel', () => {
  test('the first one after 1 s, then one every interval', () => {
    const rng = createRng(1);
    let s = createSwitchyardGame(1, rng, 0);
    s = run(s, FIRST_TRAIN_MS - 20, rng).state;
    expect(s.trains).toHaveLength(0);
    s = run(s, FIRST_TRAIN_MS, rng).state;
    expect(s.trains).toHaveLength(1);
    expect(s.trains[0]).toMatchObject({ id: 0, route: [0] });
    s = run(s, FIRST_TRAIN_MS + spawnIntervalMs(1) - 20, rng).state;
    expect(s.trains).toHaveLength(1);
    s = run(s, FIRST_TRAIN_MS + spawnIntervalMs(1), rng).state;
    expect(s.trains).toHaveLength(2);
  });

  test('they move at the speed of the current level', () => {
    const rng = createRng(2);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    s = run(s, FIRST_TRAIN_MS + 1000, rng).state;
    expect(s.trains[0].distance).toBeCloseTo(70);
  });

  test('never three in a row for the same station', () => {
    const rng = createRng(3);
    const recent: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const station = pickStation(rng, 5, recent);
      if (recent.length >= 2) expect(recent[recent.length - 1] === station && recent[recent.length - 2] === station).toBe(false);
      recent.push(station);
      seen.add(station);
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4]));
  });
});

describe('arrivals', () => {
  test('a train sent to its station scores the level points', () => {
    const rng = createRng(4);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    s = routeTo(s, s.trains[0].station);
    const { state, arrival } = untilArrival(s, rng);
    expect(arrival).toMatchObject({ trainId: 0, station: s.trains[0].station, correct: true, points: 10 });
    expect(state).toMatchObject({ score: 10, correct: 1, total: 1 });
  });

  test('a train sent elsewhere is a miss and costs nothing', () => {
    const rng = createRng(5);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    const wrong = s.map.stations.find((st) => st.id !== s.trains[0].station)!;
    s = routeTo(s, wrong.id);
    const { state, arrival } = untilArrival(s, rng);
    expect(arrival).toMatchObject({ station: wrong.id, target: s.trains[0].station, correct: false, points: 0 });
    expect(state).toMatchObject({ score: 0, correct: 0, total: 1 });
  });

  test('points follow the level at the moment of arrival', () => {
    const rng = createRng(6);
    let s = run(createSwitchyardGame(7, rng, 0), FIRST_TRAIN_MS, rng).state;
    s = routeTo(s, s.trains[0].station);
    expect(untilArrival(s, rng).arrival.points).toBe(arrivalPoints(7));
  });

  test('four trains home in a row move the level up', () => {
    const rng = createRng(7);
    let s = createSwitchyardGame(1, rng, 0);
    let homes = 0;
    while (homes < 4) {
      s = steer(s);
      const res = advanceSwitchyard(s, s.now + 16, rng);
      s = res.state;
      homes += res.arrivals.filter((a) => a.correct).length;
    }
    expect(s.staircase.level).toBe(2);
    expect(s.total).toBe(4);
  });

  test('the train keeps rolling into the station and leaves once its tail is inside', () => {
    const rng = createRng(8);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    s = routeTo(s, s.trains[0].station);
    s = untilArrival(s, rng).state;
    const train = s.trains.find((t) => t.id === 0)!;
    expect(train.arrived).toBe(true);
    s = run(s, s.now + ((TRAIN_LENGTH + 4) / trainSpeed(1)) * 1000, rng).state;
    expect(s.trains.find((t) => t.id === 0)).toBeUndefined();
  });
});

describe('switches', () => {
  test('a train takes the way the switch shows when its front reaches it', () => {
    const rng = createRng(9);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    const firstSwitch = s.map.switches[0];
    // Point the first switch at option 1 and let the train go past it: it takes option 1 and keeps it once it has
    // left the switch behind, whatever the switch does next.
    if (s.switches[0] !== 1) s = toggleSwitch(s, 0);
    const toSwitch = s.map.segments[0].line.length;
    s = run(s, FIRST_TRAIN_MS + ((toSwitch + SWITCH_GRACE + 4) / 70) * 1000, rng, 20).state;
    expect(s.trains[0].route).toEqual([0, firstSwitch.exits[1]]);
    s = toggleSwitch(s, 0);
    s = run(s, s.now + 1000, rng).state;
    expect(s.trains[0].route).toEqual([0, firstSwitch.exits[1]]);
  });

  test('a train still over the switch takes the new way when the switch flips (time to react)', () => {
    const rng = createRng(9);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    const firstSwitch = s.map.switches[0];
    if (s.switches[0] !== 1) s = toggleSwitch(s, 0);
    const toSwitch = s.map.segments[0].line.length;
    s = run(s, FIRST_TRAIN_MS + ((toSwitch + SWITCH_GRACE - 6) / 70) * 1000, rng, 20).state;
    expect(s.trains[0].route).toEqual([0, firstSwitch.exits[1]]);
    const distance = s.trains[0].distance;
    s = toggleSwitch(s, 0);
    // Same distance along the other exit: both start on the same stretch, so the train barely moves.
    expect(s.trains[0]).toMatchObject({ route: [0, firstSwitch.exits[0]], distance });
    s = run(s, s.now + 1000, rng).state;
    expect(s.trains[0].route[1]).toBe(firstSwitch.exits[0]);
  });

  test('the grace over a switch is short: 24 units, under half a second even at the slowest speed', () => {
    expect(SWITCH_GRACE).toBe(24);
    expect((SWITCH_GRACE / trainSpeed(1)) * 1000).toBeLessThan(500);
  });

  test('flipping a switch before the train reaches it changes its way', () => {
    const rng = createRng(10);
    let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
    if (s.switches[0] !== 1) s = toggleSwitch(s, 0);
    const toSwitch = s.map.segments[0].line.length;
    s = run(s, FIRST_TRAIN_MS + ((toSwitch - 4) / 70) * 1000, rng, 20).state;
    s = toggleSwitch(s, 0);
    s = run(s, s.now + 500, rng).state;
    expect(s.trains[0].route).toEqual([0, s.map.switches[0].exits[0]]);
  });

  test('toggling flips one switch; an unknown index changes nothing', () => {
    const s = createSwitchyardGame(5, createRng(11), 0);
    const flipped = toggleSwitch(s, 1);
    expect(flipped.switches[1]).toBe(1 - s.switches[1]);
    expect(flipped.switches.filter((v, i) => v !== s.switches[i])).toHaveLength(1);
    expect(toggleSwitch(s, 9)).toBe(s);
    expect(toggleSwitch(s, -1)).toBe(s);
  });
});

describe('destinationOf', () => {
  test('follows the switches from a segment to the station a train there would reach', () => {
    const map = mapFor(3, false);
    // Out of the tunnel: switch 1 sends left to red (0) or on to switch 2, which sends to yellow (1) or green (2).
    expect(destinationOf(map, [0, 0], 0)).toBe(0);
    expect(destinationOf(map, [0, 1], 0)).toBe(0);
    expect(destinationOf(map, [1, 0], 0)).toBe(1);
    expect(destinationOf(map, [1, 1], 0)).toBe(2);
    // From a segment past the first switch, only the switches ahead count.
    const middle = map.switches[0].exits[1];
    expect(destinationOf(map, [0, 1], middle)).toBe(2);
    // A segment that ends at a station leads there whatever the switches say.
    expect(destinationOf(map, [1, 1], map.switches[0].exits[0])).toBe(0);
  });

  test('agrees with every station route, on every map', () => {
    for (const map of ALL_MAPS) {
      for (const station of map.stations) {
        const switches = map.switches.map(() => 0 as 0 | 1);
        for (const [sw, option] of station.route) switches[sw] = option;
        expect(destinationOf(map, switches, 0), `${map.key} station ${station.id}`).toBe(station.id);
      }
    }
  });
});

test('no train ever leaves the tunnel while the next one is due at Infinity', () => {
  const rng = createRng(18);
  const s = { ...createSwitchyardGame(1, rng, 0), nextSpawnAt: Infinity };
  const later = run(s, 60_000, rng, 50).state;
  expect(later.trains).toHaveLength(0);
  expect(later.nextTrainId).toBe(0);
});

test('trains on the same track stay at least 112 units apart, whatever the switches and the level do', () => {
  for (const level of [1, 10]) {
    const rng = createRng(100 + level);
    const player = createRng(200 + level);
    let s = createSwitchyardGame(level, rng, 0);
    while (s.now < 90_000) {
      if (player() < 0.08) s = toggleSwitch(s, Math.floor(player() * s.switches.length));
      // Play well about half of the time, so the level moves both ways.
      if (Math.floor(s.now / 10_000) % 2 === 0) s = steer(s);
      s = advanceSwitchyard(s, s.now + 16, rng).state;
      for (const a of s.trains) {
        for (const b of s.trains) {
          if (a.id < b.id && a.route.at(-1) === b.route.at(-1)) {
            expect(Math.abs(a.distance - b.distance)).toBeGreaterThanOrEqual(112 - 1e-6);
          }
        }
      }
    }
  }
});

test('one long jump gives the same result as many short frames (the phone froze for 5 s)', () => {
  const start = createSwitchyardGame(3, createRng(12), 0);
  const long = advanceSwitchyard(start, 30_000, createRng(13));
  const rng = createRng(13);
  let short = start;
  const arrivals: Arrival[] = [];
  for (let t = 20; t <= 30_000; t += 20) {
    const res = advanceSwitchyard(short, t, rng);
    short = res.state;
    arrivals.push(...res.arrivals);
  }
  expect(long.state).toEqual(short);
  expect(long.arrivals).toEqual(arrivals);
});

describe('the frame rate never changes the game', () => {
  /** Plays a whole game from `level`, with frames as long as `frame()` says and the player acting after each one. */
  function play(level: number, seed: number, frame: () => number, player: (s: SwitchyardState) => SwitchyardState) {
    const rng = createRng(seed);
    let s = createSwitchyardGame(level, rng, 0);
    const arrivals: Arrival[] = [];
    while (s.now < 90_000) {
      s = player(s);
      const res = advanceSwitchyard(s, Math.min(90_000, s.now + frame()), rng);
      s = res.state;
      arrivals.push(...res.arrivals);
    }
    return { state: s, arrivals };
  }

  const players = { 'nobody at the switches': (s: SwitchyardState) => s, 'a perfect player': steer };
  const frames = {
    '60 fps': () => () => 1000 / 60,
    'random 5–50 ms frames': () => {
      const jitter = createRng(77);
      return () => 5 + jitter() * 45;
    },
  };

  describe.each(Object.entries(players))('%s', (_name, player) => {
    test.each(Object.entries(frames).flatMap(([name, make]) => [1, 5, 10].map((level) => [name, level, make] as const)))(
      '%s at level %i play out like 20 ms frames',
      (_frames, level, make) => {
        const reference = play(level, 40 + level, () => 20, player);
        const other = play(level, 40 + level, make(), player);
        const sum = ({ trainId, station, correct, points }: Arrival) => ({ trainId, station, correct, points });
        expect(other.arrivals.map(sum)).toEqual(reference.arrivals.map(sum));
        expect(other.arrivals.length).toBeGreaterThan(15);
        other.arrivals.forEach((a, i) => expect(Math.abs(a.at - reference.arrivals[i].at)).toBeLessThan(1e-6));
        expect(other.state.score).toBe(reference.state.score);
        expect(other.state.nextTrainId).toBe(reference.state.nextTrainId);
        expect(other.state.staircase).toEqual(reference.state.staircase);
        expect(other.state.trains.map((t) => [t.id, t.route, t.arrived])).toEqual(
          reference.state.trains.map((t) => [t.id, t.route, t.arrived]),
        );
        other.state.trains.forEach((t, i) =>
          expect(Math.abs(t.distance - reference.state.trains[i].distance)).toBeLessThan(1e-6),
        );
      },
    );
  });
});

test('going back in time changes nothing', () => {
  const rng = createRng(14);
  const s = run(createSwitchyardGame(1, rng, 0), 3000, rng).state;
  expect(advanceSwitchyard(s, 2000, rng)).toEqual({ state: s, arrivals: [] });
});

test('trainPose follows the route back around the curves', () => {
  const rng = createRng(15);
  let s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
  const root = s.map.segments[0].line;
  s = run(s, FIRST_TRAIN_MS + ((root.length + 20) / 70) * 1000, rng, 20).state;
  const train = s.trains[0];
  expect(train.route).toHaveLength(2);
  const tail = trainPose(s.map, train, 40);
  const expected = poseAt(root, root.length + train.distance - 40);
  expect(tail.x).toBeCloseTo(expected.x);
  expect(tail.y).toBeCloseTo(expected.y);
  const front = trainPose(s.map, train, 0);
  const onExit = poseAt(s.map.segments[train.route[1]].line, train.distance);
  expect(front.x).toBeCloseTo(onExit.x);
  expect(front.y).toBeCloseTo(onExit.y);
});

test('the result counts arrived trains only', () => {
  const rng = createRng(16);
  let s = createSwitchyardGame(1, rng, 0);
  let arrived = 0;
  while (arrived < 3) {
    s = steer(s);
    const res = advanceSwitchyard(s, s.now + 16, rng);
    s = res.state;
    arrived += res.arrivals.length;
  }
  expect(s.trains.some((t) => !t.arrived)).toBe(true);
  expect(switchyardResult(s, 90_000)).toEqual({
    score: s.score,
    accuracy: s.correct / s.total,
    levelReached: s.staircase.maxLevel,
    durationMs: 90_000,
  });
  expect(s.total).toBe(3);
});

test('a train still coming out of the tunnel lines up on the straight track behind the mouth', () => {
  const rng = createRng(17);
  const s = run(createSwitchyardGame(1, rng, 0), FIRST_TRAIN_MS, rng).state;
  const train = { ...s.trains[0], distance: 10 };
  const start = poseAt(s.map.segments[0].line, 0);
  const rad = (start.angle * Math.PI) / 180;
  const tail = trainPose(s.map, train, 40);
  expect(tail.x).toBeCloseTo(start.x - Math.cos(rad) * 30);
  expect(tail.y).toBeCloseTo(start.y - Math.sin(rad) * 30);
  expect(tail.angle).toBeCloseTo(start.angle);
  // The wagon's two ends never collapse into one point, so it is never drawn sideways.
  const wagonFront = trainPose(s.map, train, 40);
  const wagonBack = trainPose(s.map, train, 66);
  expect(Math.hypot(wagonFront.x - wagonBack.x, wagonFront.y - wagonBack.y)).toBeCloseTo(26);
});
