import { createRng, seedFromString } from '../../core/rng';
import { clampLevel } from '../../core/difficulty';
import { polyline, poseAt, roundCorners, type Point, type Polyline } from './geometry';

/*
 * The track maps, drawn by hand on a 360 × 500 board. Each map is a tree: the trains leave the tunnel at the top
 * and every switch splits the track in two until it ends at a station. Every switch sits on a track that arrives
 * heading down, and both of its exits start heading down too, so a train never turns sharply at a junction.
 */

export const BOARD = { width: 360, height: 500 } as const;

/** The mouth of the tunnel, where every train comes out. */
export const TUNNEL: Point = { x: 180, y: 34 };

/** Radius of the curves, in board units. */
const CURVE_RADIUS = 26;

/** How far along an exit the switch arrow looks to decide where it points. */
const ARROW_LOOKAHEAD = 48;

export type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'heart' | 'cross';

/** Station looks, in the order maps use them: a map with N stations uses the first N. */
export const STATION_STYLES: readonly { color: string; shape: Shape }[] = [
  { color: '#ff5a5a', shape: 'circle' },
  { color: '#ffd23f', shape: 'square' },
  { color: '#4ddc84', shape: 'triangle' },
  { color: '#b48cff', shape: 'diamond' },
  { color: '#ff9a3c', shape: 'star' },
  { color: '#ff6fcf', shape: 'heart' },
  { color: '#5b8cff', shape: 'cross' },
];

export interface TrackSegment {
  id: number;
  line: Polyline;
  from: 'tunnel' | { switch: number };
  end: { switch: number } | { station: number };
}

export interface TrackSwitch {
  id: number;
  at: Point;
  /** The two segments a train can take: option 0 and option 1. */
  exits: [number, number];
  /** Where each exit heads, in degrees, a little way past the junction (for the arrow and the spoken name). */
  exitAngles: [number, number];
}

export interface TrackStation {
  id: number;
  at: Point;
  /** Index in STATION_STYLES. */
  style: number;
  /** The switch settings that lead here from the tunnel. */
  route: [number, 0 | 1][];
  /** Heading of the track as it reaches the station. */
  approachAngle: number;
}

export interface Tree {
  x: number;
  y: number;
  r: number;
}

export interface TrackMap {
  key: string;
  segments: TrackSegment[];
  switches: TrackSwitch[];
  stations: TrackStation[];
  trees: Tree[];
}

/** A hand-drawn leg: the points after its start (the tunnel, or the switch it leaves) and what it ends in. */
export interface Blueprint {
  path: [number, number][];
  to: { station: number } | { left: Blueprint; right: Blueprint };
}

const station = (style: number, path: [number, number][]): Blueprint => ({ path, to: { station: style } });
const fork = (path: [number, number][], left: Blueprint, right: Blueprint): Blueprint => ({ path, to: { left, right } });

/* Columns and rows used below. Stations end at y 446–452 along the bottom, or at x 36 / 324 on the sides. */
const BLUEPRINTS: Record<number, Blueprint> = {
  3: fork(
    [[180, 120]],
    station(0, [
      [180, 132],
      [70, 242],
      [70, 446],
    ]),
    fork(
      [[180, 240]],
      station(1, [[180, 446]]),
      station(2, [
        [180, 252],
        [290, 362],
        [290, 446],
      ]),
    ),
  ),
  4: fork(
    [[180, 110]],
    fork(
      [
        [180, 122],
        [110, 192],
        [110, 230],
      ],
      station(2, [
        [110, 242],
        [50, 302],
        [50, 446],
      ]),
      station(0, [
        [110, 330],
        [145, 365],
        [145, 446],
      ]),
    ),
    fork(
      [
        [180, 122],
        [265, 207],
        [265, 300],
      ],
      station(3, [
        [265, 312],
        [225, 352],
        [225, 446],
      ]),
      station(1, [
        [265, 312],
        [315, 362],
        [315, 446],
      ]),
    ),
  ),
  5: fork(
    [[180, 105]],
    fork(
      [
        [180, 117],
        [110, 187],
        [110, 205],
      ],
      station(4, [
        [110, 217],
        [74, 253],
        [36, 253],
      ]),
      fork(
        [[110, 320]],
        station(1, [
          [110, 332],
          [50, 392],
          [50, 450],
        ]),
        station(3, [
          [110, 332],
          [150, 372],
          [150, 450],
        ]),
      ),
    ),
    fork(
      [
        [180, 117],
        [260, 197],
        [260, 300],
      ],
      station(0, [
        [260, 312],
        [225, 347],
        [225, 450],
      ]),
      station(2, [
        [260, 312],
        [315, 367],
        [315, 450],
      ]),
    ),
  ),
  6: fork(
    [[180, 105]],
    fork(
      [
        [180, 117],
        [105, 192],
        [105, 210],
      ],
      station(5, [
        [105, 222],
        [67, 260],
        [36, 260],
      ]),
      fork(
        [[105, 320]],
        station(2, [
          [105, 332],
          [45, 392],
          [45, 450],
        ]),
        station(0, [
          [105, 332],
          [135, 362],
          [135, 450],
        ]),
      ),
    ),
    fork(
      [
        [180, 117],
        [255, 192],
        [255, 210],
      ],
      fork(
        [[255, 320]],
        station(1, [
          [255, 332],
          [225, 362],
          [225, 450],
        ]),
        station(3, [
          [255, 332],
          [315, 392],
          [315, 450],
        ]),
      ),
      station(4, [
        [255, 222],
        [293, 260],
        [324, 260],
      ]),
    ),
  ),
  7: fork(
    [[180, 105]],
    fork(
      [
        [180, 117],
        [105, 192],
        [105, 205],
      ],
      station(6, [
        [105, 217],
        [67, 255],
        [36, 255],
      ]),
      fork(
        [[105, 300]],
        station(3, [
          [105, 312],
          [40, 377],
          [40, 452],
        ]),
        station(1, [[105, 452]]),
      ),
    ),
    fork(
      [
        [180, 117],
        [255, 192],
        [255, 205],
      ],
      fork(
        [[255, 280]],
        station(0, [
          [255, 292],
          [180, 367],
          [180, 452],
        ]),
        fork(
          [[255, 360]],
          station(4, [[255, 452]]),
          station(2, [
            [255, 372],
            [320, 437],
            [320, 452],
          ]),
        ),
      ),
      station(5, [
        [255, 217],
        [293, 255],
        [324, 255],
      ]),
    ),
  ),
};

export function compileMap(blueprint: Blueprint, key: string): TrackMap {
  const segments: TrackSegment[] = [];
  const switches: TrackSwitch[] = [];
  const stations: TrackStation[] = [];

  const visit = (leg: Blueprint, start: Point, from: TrackSegment['from'], route: [number, 0 | 1][]): number => {
    const id = segments.length;
    const points = [start, ...leg.path.map(([x, y]) => ({ x, y }))];
    const line = polyline(roundCorners(points, CURVE_RADIUS));
    const end = line.points[line.points.length - 1];
    const segment: TrackSegment = { id, line, from, end: { station: -1 } };
    segments.push(segment);

    if ('station' in leg.to) {
      const stationId = stations.length;
      stations.push({
        id: stationId,
        at: end,
        style: leg.to.station,
        route,
        approachAngle: poseAt(line, line.length).angle,
      });
      segment.end = { station: stationId };
    } else {
      const switchId = switches.length;
      const sw: TrackSwitch = { id: switchId, at: end, exits: [-1, -1], exitAngles: [0, 0] };
      switches.push(sw);
      segment.end = { switch: switchId };
      const left = visit(leg.to.left, end, { switch: switchId }, [...route, [switchId, 0]]);
      const right = visit(leg.to.right, end, { switch: switchId }, [...route, [switchId, 1]]);
      sw.exits = [left, right];
      sw.exitAngles = [left, right].map((exit) => {
        const exitLine = segments[exit].line;
        return poseAt(exitLine, Math.min(ARROW_LOOKAHEAD, exitLine.length)).angle;
      }) as [number, number];
    }
    return id;
  };

  visit(blueprint, TUNNEL, 'tunnel', []);
  const map: TrackMap = { key, segments, switches, stations, trees: [] };
  map.trees = plantTrees(map);
  return map;
}

function distToPolyline(p: Point, points: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

/** Trees in the free space, from a random generator seeded with the map key so a map always looks the same. */
function plantTrees(map: TrackMap): Tree[] {
  const rng = createRng(seedFromString(`trees:${map.key}`));
  const trees: Tree[] = [];
  const step = 24;
  for (let gy = step / 2; gy < BOARD.height; gy += step) {
    for (let gx = step / 2; gx < BOARD.width; gx += step) {
      const r = 6 + rng() * 5;
      const x = gx + (rng() - 0.5) * 14;
      const y = gy + (rng() - 0.5) * 14;
      const keep = rng() < 0.5;
      if (!keep) continue;
      if (x - r < 4 || x + r > BOARD.width - 4 || y - r < 4 || y + r > BOARD.height - 4) continue;
      const p = { x, y };
      if (Math.hypot(x - TUNNEL.x, y - TUNNEL.y) < 48) continue;
      if (map.segments.some((s) => distToPolyline(p, s.line.points) < 32)) continue;
      if (map.stations.some((s) => Math.hypot(x - s.at.x, y - s.at.y) < 42)) continue;
      if (map.switches.some((s) => Math.hypot(x - s.at.x, y - s.at.y) < 40)) continue;
      if (trees.some((t) => Math.hypot(x - t.x, y - t.y) < t.r + r + 3)) continue;
      trees.push({ x, y, r });
    }
  }
  return trees;
}

const mirrorPoint = (p: Point): Point => ({ x: BOARD.width - p.x, y: p.y });
const mirrorAngle = (angle: number): number => 180 - angle;

/** The same map seen in a mirror (left and right swapped). Routes and option numbers stay the same. */
export function mirrorMap(map: TrackMap): TrackMap {
  return {
    key: `${map.key}m`,
    segments: map.segments.map((s) => ({ ...s, line: polyline(s.line.points.map(mirrorPoint)) })),
    switches: map.switches.map((s) => ({
      ...s,
      at: mirrorPoint(s.at),
      exitAngles: [mirrorAngle(s.exitAngles[0]), mirrorAngle(s.exitAngles[1])],
    })),
    stations: map.stations.map((s) => ({ ...s, at: mirrorPoint(s.at), approachAngle: mirrorAngle(s.approachAngle) })),
    trees: map.trees.map((t) => ({ ...t, x: BOARD.width - t.x })),
  };
}

/** Levels 1–2 → 3 stations, 3–4 → 4, 5–6 → 5, 7–8 → 6, 9–10 → 7. */
export function stationCountForLevel(level: number): number {
  return 3 + Math.floor((clampLevel(level) - 1) / 2);
}

export const ALL_MAPS: readonly TrackMap[] = [3, 4, 5, 6, 7].flatMap((n) => {
  const map = compileMap(BLUEPRINTS[n], String(n));
  return [map, mirrorMap(map)];
});

export function mapFor(stationCount: number, mirrored: boolean): TrackMap {
  const key = `${stationCount}${mirrored ? 'm' : ''}`;
  const map = ALL_MAPS.find((m) => m.key === key);
  if (!map) throw new Error(`No map with ${stationCount} stations`);
  return map;
}
