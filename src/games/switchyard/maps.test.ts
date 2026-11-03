import { poseAt, segmentsIntersect, type Point } from './geometry';
import {
  ALL_MAPS,
  BOARD,
  STATION_STYLES,
  TUNNEL,
  mapFor,
  mirrorMap,
  stationCountForLevel,
  type TrackMap,
  type TrackSegment,
} from './maps';

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function distToLine(p: Point, points: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, distToSegment(p, points[i - 1], points[i]));
  return best;
}

/** Points every ~4 units along a segment. */
function samples(segment: TrackSegment): Point[] {
  const out: Point[] = [];
  for (let d = 0; d <= segment.line.length; d += 4) out.push(poseAt(segment.line, d));
  return out;
}

/** The nodes (junction points) at both ends of a segment. */
function ends(segment: TrackSegment): Point[] {
  const pts = segment.line.points;
  return [pts[0], pts[pts.length - 1]];
}

/** Follows a station's route from the tunnel and returns the station it reaches. */
function follow(map: TrackMap, route: [number, 0 | 1][]): number {
  const choice = new Map(route);
  let segment = map.segments[0];
  for (let guard = 0; guard < 20; guard++) {
    if ('station' in segment.end) return segment.end.station;
    const sw = map.switches[segment.end.switch];
    segment = map.segments[sw.exits[choice.get(sw.id) ?? 0]];
  }
  throw new Error('route does not end');
}

test('the number of stations follows the starting level', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stationCountForLevel)).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  expect(stationCountForLevel(0)).toBe(3);
  expect(stationCountForLevel(42)).toBe(7);
});

test('there are seven station styles with distinct colors and shapes', () => {
  expect(STATION_STYLES).toHaveLength(7);
  expect(new Set(STATION_STYLES.map((s) => s.color)).size).toBe(7);
  expect(new Set(STATION_STYLES.map((s) => s.shape)).size).toBe(7);
});

test('there is a normal and a mirrored map for 3 to 7 stations', () => {
  expect(ALL_MAPS).toHaveLength(10);
  for (let n = 3; n <= 7; n++) {
    expect(mapFor(n, false).stations).toHaveLength(n);
    expect(mapFor(n, true).stations).toHaveLength(n);
    expect(mapFor(n, false)).toBe(mapFor(n, false));
  }
});

describe.each(ALL_MAPS.map((m) => [m.key, m] as const))('map %s', (_key, map) => {
  const n = map.stations.length;

  test('is a tree with N stations, N − 1 switches and 2N − 1 segments', () => {
    expect(map.switches).toHaveLength(n - 1);
    expect(map.segments).toHaveLength(2 * n - 1);
    expect(map.segments[0].from).toBe('tunnel');
    expect(dist(map.segments[0].line.points[0], TUNNEL)).toBeLessThan(1e-6);
  });

  test('uses the first N styles once each', () => {
    expect(map.stations.map((s) => s.style).sort()).toEqual(Array.from({ length: n }, (_, i) => i));
  });

  test('every route leads to its station', () => {
    for (const station of map.stations) expect(follow(map, station.route)).toBe(station.id);
  });

  test('switch exits start at the switch and continue the heading of the track that arrives', () => {
    for (const sw of map.switches) {
      const incoming = map.segments.find((s) => 'switch' in s.end && s.end.switch === sw.id)!;
      const arriving = poseAt(incoming.line, incoming.line.length).angle;
      for (const exit of sw.exits) {
        const segment = map.segments[exit];
        expect(dist(segment.line.points[0], sw.at)).toBeLessThan(1e-6);
        expect(segment.from).toEqual({ switch: sw.id });
        expect(Math.abs(poseAt(segment.line, 0).angle - arriving)).toBeLessThan(1);
      }
    }
  });

  test('switch arrows point where each exit goes', () => {
    for (const sw of map.switches) {
      sw.exits.forEach((exit, i) => {
        const segment = map.segments[exit];
        expect(sw.exitAngles[i]).toBeCloseTo(poseAt(segment.line, Math.min(48, segment.line.length)).angle);
      });
      expect(Math.abs(sw.exitAngles[0] - sw.exitAngles[1])).toBeGreaterThanOrEqual(35);
    }
  });

  test('stays inside the board', () => {
    for (const segment of map.segments) {
      for (const p of segment.line.points) {
        expect(p.x).toBeGreaterThanOrEqual(14);
        expect(p.x).toBeLessThanOrEqual(BOARD.width - 14);
        expect(p.y).toBeGreaterThanOrEqual(14);
        expect(p.y).toBeLessThanOrEqual(BOARD.height - 14);
      }
    }
  });

  test('tracks never cross', () => {
    const pieces = map.segments.flatMap((s) =>
      s.line.points.slice(1).map((p, i) => ({ seg: s.id, a: s.line.points[i], b: p })),
    );
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        if (pieces[i].seg === pieces[j].seg) continue;
        expect(segmentsIntersect(pieces[i].a, pieces[i].b, pieces[j].a, pieces[j].b)).toBe(false);
      }
    }
  });

  test('tracks keep apart, except right next to the junction they share', () => {
    for (const a of map.segments) {
      for (const b of map.segments) {
        if (a === b) continue;
        const shared = ends(a).filter((p) => ends(b).some((q) => dist(p, q) < 1e-6));
        for (const p of samples(a)) {
          // Two exits of a switch part at 45°, so they only reach a comfortable distance some way from it.
          if (shared.some((s) => dist(p, s) < 70)) continue;
          expect(distToLine(p, b.line.points), `${a.id}→${b.id} at ${p.x},${p.y}`).toBeGreaterThanOrEqual(28);
        }
      }
    }
  });

  test('switches stand apart from each other, the stations and the tunnel', () => {
    for (const sw of map.switches) {
      expect(dist(sw.at, TUNNEL)).toBeGreaterThanOrEqual(70);
      for (const other of map.switches) if (other !== sw) expect(dist(sw.at, other.at)).toBeGreaterThanOrEqual(70);
      for (const st of map.stations) expect(dist(sw.at, st.at)).toBeGreaterThanOrEqual(70);
    }
  });

  test('stations stand apart and clear of the other tracks', () => {
    for (const st of map.stations) {
      expect(st.at.x).toBeGreaterThanOrEqual(30);
      expect(st.at.x).toBeLessThanOrEqual(BOARD.width - 30);
      expect(st.at.y).toBeLessThanOrEqual(BOARD.height - 40);
      for (const other of map.stations) if (other !== st) expect(dist(st.at, other.at)).toBeGreaterThanOrEqual(64);
      for (const segment of map.segments) {
        if ('station' in segment.end && segment.end.station === st.id) continue;
        expect(distToLine(st.at, segment.line.points)).toBeGreaterThanOrEqual(34);
      }
    }
  });

  test('trees grow in the free space', () => {
    expect(map.trees.length).toBeGreaterThanOrEqual(6);
    for (const tree of map.trees) {
      expect(tree.x - tree.r).toBeGreaterThanOrEqual(0);
      expect(tree.x + tree.r).toBeLessThanOrEqual(BOARD.width);
      expect(tree.y - tree.r).toBeGreaterThanOrEqual(0);
      expect(tree.y + tree.r).toBeLessThanOrEqual(BOARD.height);
      expect(dist(tree, TUNNEL)).toBeGreaterThanOrEqual(40);
      for (const segment of map.segments) expect(distToLine(tree, segment.line.points)).toBeGreaterThanOrEqual(30);
      for (const st of map.stations) expect(dist(tree, st.at)).toBeGreaterThanOrEqual(36);
      for (const sw of map.switches) expect(dist(tree, sw.at)).toBeGreaterThanOrEqual(36);
    }
  });
});

test('mirroring flips x and keeps the routes', () => {
  const map = mapFor(5, false);
  const mirrored = mirrorMap(map);
  expect(mirrored.key).toBe(`${map.key}m`);
  map.stations.forEach((st, i) => {
    expect(mirrored.stations[i].at.x).toBeCloseTo(BOARD.width - st.at.x);
    expect(mirrored.stations[i].at.y).toBeCloseTo(st.at.y);
    expect(mirrored.stations[i].route).toEqual(st.route);
  });
  expect(mirrored.switches[0].exitAngles[0]).toBeCloseTo(180 - map.switches[0].exitAngles[0]);
  expect(mirrored.trees[0].x).toBeCloseTo(BOARD.width - map.trees[0].x);
});
