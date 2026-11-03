import { clampLevel, createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import type { Rng } from '../../core/rng';
import { accuracyOf } from '../shared/scoring';
import type { GameResult } from '../types';
import { poseAt, type Pose } from './geometry';
import { mapFor, stationCountForLevel, type TrackMap } from './maps';

export const SWITCHYARD_DURATION_MS = 90_000;
export const SWITCHYARD_REFERENCE_SCORE = 900;
/** Theoretical ceiling ≈ 57 trains × 28 points = 1596, with room to spare. */
export const SWITCHYARD_MAX_SCORE = 2000;

export const FIRST_TRAIN_MS = 1000;
/** The engine moves the trains in steps of at most this long, however far apart the frames are. */
export const STEP_MS = 20;
/** From the front of the locomotive to the back of its wagon, in board units. */
export const TRAIN_LENGTH = 66;
/**
 * A train whose front went past a switch by at most this much is still over it: flipping the switch then sends it
 * the new way, so a tap a moment late still counts. Both exits of a switch start on the same short stretch, so the
 * train barely moves when it changes over.
 */
export const SWITCH_GRACE = 24;

export function spawnIntervalMs(level: number): number {
  return Math.round(4000 - ((clampLevel(level) - 1) * 2400) / 9);
}

/** Board units per second (the board is 360 × 600). */
export function trainSpeed(level: number): number {
  return 70 + ((clampLevel(level) - 1) * 60) / 9;
}

export function arrivalPoints(level: number): number {
  return 10 + 2 * (clampLevel(level) - 1);
}

export interface Train {
  id: number;
  /** The station it should reach (its color). */
  station: number;
  /** Segments it has been on, the current one last. */
  route: number[];
  /** Distance of its front along the current segment. */
  distance: number;
  /** It reached a station and is rolling in under the building. */
  arrived: boolean;
}

export interface Arrival {
  trainId: number;
  /** The station it reached. */
  station: number;
  /** The station it should have reached. */
  target: number;
  correct: boolean;
  points: number;
  at: number;
}

export interface SwitchyardState {
  map: TrackMap;
  /** The option (0 or 1) each switch points to. */
  switches: (0 | 1)[];
  trains: Train[];
  nextTrainId: number;
  nextSpawnAt: number;
  /** Stations of the latest trains, newest last (at most two). */
  recentStations: number[];
  staircase: Staircase;
  score: number;
  correct: number;
  total: number;
  /** Game time the state has been advanced to. */
  now: number;
}

export function createSwitchyardGame(startLevel: number, rng: Rng, now: number): SwitchyardState {
  const staircase = createStaircase(startLevel);
  const map = mapFor(stationCountForLevel(staircase.level), rng() < 0.5);
  return {
    map,
    switches: map.switches.map(() => (rng() < 0.5 ? 0 : 1)),
    trains: [],
    nextTrainId: 0,
    nextSpawnAt: now + FIRST_TRAIN_MS,
    recentStations: [],
    staircase,
    score: 0,
    correct: 0,
    total: 0,
    now,
  };
}

/** A station at random, but never a third train in a row for the same one. */
export function pickStation(rng: Rng, count: number, recent: readonly number[]): number {
  const n = recent.length;
  const banned = n >= 2 && recent[n - 1] === recent[n - 2] ? recent[n - 1] : null;
  const candidates = Array.from({ length: count }, (_, i) => i).filter((i) => i !== banned);
  return candidates[Math.floor(rng() * candidates.length)];
}

/** The station a train on `segmentId` would reach if the switches ahead of it stayed as they are. */
export function destinationOf(map: TrackMap, switches: readonly (0 | 1)[], segmentId: number): number {
  let segment = map.segments[segmentId];
  while ('switch' in segment.end) {
    const sw = map.switches[segment.end.switch];
    segment = map.segments[sw.exits[switches[sw.id]]];
  }
  return segment.end.station;
}

export function toggleSwitch(state: SwitchyardState, index: number): SwitchyardState {
  if (!Number.isInteger(index) || index < 0 || index >= state.switches.length) return state;
  const switches = [...state.switches];
  switches[index] = switches[index] === 0 ? 1 : 0;
  const sw = state.map.switches[index];
  const trains = state.trains.map((train) => {
    const current = train.route[train.route.length - 1];
    const overIt = !train.arrived && train.distance <= SWITCH_GRACE && sw.exits.includes(current);
    if (!overIt) return train;
    return { ...train, route: [...train.route.slice(0, -1), sw.exits[switches[index]]] };
  });
  return { ...state, switches, trains };
}

/**
 * A front this close to the end of its station's track has reached it: a step that ends the moment a train arrives
 * can leave it a rounding error short.
 */
const ARRIVAL_SLACK = 1e-6;

/** How far the front of a train still has to run to reach a station, if the switches ahead stay as they are. */
function distanceToStation(map: TrackMap, switches: readonly (0 | 1)[], train: Train): number {
  let segment = map.segments[train.route[train.route.length - 1]];
  let left = segment.line.length - train.distance;
  while ('switch' in segment.end) {
    const sw = map.switches[segment.end.switch];
    segment = map.segments[sw.exits[switches[sw.id]]];
    left += segment.line.length;
  }
  return left;
}

/**
 * Moves the game forward to `to` (game time), in steps of at most STEP_MS on a fixed 20 ms grid, so a long gap
 * between frames plays out exactly like many short ones. A step also ends the moment a train is due out of the
 * tunnel or reaches a station: an arrival moves the staircase, and with it the speed of every train and the points of
 * the next arrival, so it has to take effect at that moment and not at the end of whatever frame it fell in. That
 * keeps a game the same at any frame rate. A train follows the way its next switch points when its front reaches it.
 */
export function advanceSwitchyard(
  state: SwitchyardState,
  to: number,
  rng: Rng,
): { state: SwitchyardState; arrivals: Arrival[] } {
  if (to <= state.now) return { state, arrivals: [] };
  const { map, switches } = state;
  let { staircase, score, correct, total, nextSpawnAt, nextTrainId } = state;
  let recentStations = state.recentStations;
  let trains = state.trains.map((train) => ({ ...train, route: [...train.route] }));
  const arrivals: Arrival[] = [];

  let t = state.now;
  while (t < to) {
    const level = staircase.level;
    const speed = trainSpeed(level);
    let end = Math.min(to, (Math.floor(t / STEP_MS) + 1) * STEP_MS);
    if (nextSpawnAt > t) end = Math.min(end, nextSpawnAt);
    for (const train of trains) {
      if (!train.arrived) end = Math.min(end, t + (distanceToStation(map, switches, train) / speed) * 1000);
    }
    const move = (speed * (end - t)) / 1000;
    t = end;

    for (const train of trains) {
      train.distance += move;
      for (;;) {
        const segment = map.segments[train.route[train.route.length - 1]];
        if ('switch' in segment.end) {
          if (train.distance < segment.line.length) break;
          const sw = map.switches[segment.end.switch];
          train.distance -= segment.line.length;
          train.route.push(sw.exits[switches[sw.id]]);
          continue;
        }
        if (!train.arrived && train.distance >= segment.line.length - ARRIVAL_SLACK) {
          train.arrived = true;
          const reached = segment.end.station;
          const home = reached === train.station;
          const points = home ? arrivalPoints(level) : 0;
          arrivals.push({ trainId: train.id, station: reached, target: train.station, correct: home, points, at: t });
          score += points;
          total += 1;
          if (home) correct += 1;
          staircase = stepStaircase(staircase, home);
        }
        break;
      }
    }

    trains = trains.filter(
      (train) =>
        !train.arrived || train.distance < map.segments[train.route[train.route.length - 1]].line.length + TRAIN_LENGTH,
    );

    if (t >= nextSpawnAt) {
      const station = pickStation(rng, map.stations.length, recentStations);
      recentStations = [...recentStations, station].slice(-2);
      trains.push({
        id: nextTrainId,
        station,
        route: [0],
        distance: (trainSpeed(staircase.level) * (t - nextSpawnAt)) / 1000,
        arrived: false,
      });
      nextTrainId += 1;
      nextSpawnAt += spawnIntervalMs(staircase.level);
    }
  }

  return {
    state: { ...state, trains, nextTrainId, nextSpawnAt, recentStations, staircase, score, correct, total, now: to },
    arrivals,
  };
}

/** Where a point `back` units behind the train's front is, following its route back around the curves. */
export function trainPose(map: TrackMap, train: Train, back: number): Pose {
  let index = train.route.length - 1;
  let distance = train.distance - back;
  while (distance < 0 && index > 0) {
    index -= 1;
    distance += map.segments[train.route[index]].line.length;
  }
  const line = map.segments[train.route[index]].line;
  if (distance < 0) {
    // Still inside the tunnel: carry on straight back from its mouth (hidden by the portal), so a train comes out
    // whole instead of squeezed onto the mouth.
    const start = poseAt(line, 0);
    const rad = (start.angle * Math.PI) / 180;
    return { x: start.x + Math.cos(rad) * distance, y: start.y + Math.sin(rad) * distance, angle: start.angle };
  }
  return poseAt(line, distance);
}

export function switchyardResult(state: SwitchyardState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
