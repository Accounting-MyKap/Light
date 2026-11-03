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
export const TRAIN_LENGTH = 52;

export function spawnIntervalMs(level: number): number {
  return Math.round(4000 - ((clampLevel(level) - 1) * 2400) / 9);
}

/** Board units per second. */
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

export function toggleSwitch(state: SwitchyardState, index: number): SwitchyardState {
  if (!Number.isInteger(index) || index < 0 || index >= state.switches.length) return state;
  const switches = [...state.switches];
  switches[index] = switches[index] === 0 ? 1 : 0;
  return { ...state, switches };
}

/**
 * Moves the game forward to `to` (game time), in steps of at most STEP_MS so a long gap between frames plays out
 * exactly like many short ones. A train follows the way its next switch points at the step its front reaches it.
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
    const dt = Math.min(STEP_MS, to - t);
    t += dt;
    const level = staircase.level;
    const move = (trainSpeed(level) * dt) / 1000;

    for (const train of trains) {
      train.distance += move;
      for (;;) {
        const segment = map.segments[train.route[train.route.length - 1]];
        if (train.distance < segment.line.length) break;
        if ('switch' in segment.end) {
          const sw = map.switches[segment.end.switch];
          train.distance -= segment.line.length;
          train.route.push(sw.exits[switches[sw.id]]);
          continue;
        }
        if (!train.arrived) {
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
  return poseAt(map.segments[train.route[index]].line, distance);
}

export function switchyardResult(state: SwitchyardState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
