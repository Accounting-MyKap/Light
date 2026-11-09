import { headingName, poseAt, segmentsIntersect, type Point } from './geometry';
import {
  ALL_MAPS,
  BOARD,
  decorFootprint,
  STATION_STYLES,
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

/** A tunnel on a side: close to the left or right edge, with the trains coming out across the board. */
function onSide(map: TrackMap): boolean {
  const across = Math.abs(Math.cos((map.tunnel.angle * Math.PI) / 180)) > 0.99;
  return across && (map.tunnel.at.x <= 50 || map.tunnel.at.x >= BOARD.width - 50);
}

/** True when the point lies inside the pond's ellipse grown by `margin`. */
function insideEllipse(p: Point, pond: { x: number; y: number; rx: number; ry: number }, margin: number): boolean {
  return ((p.x - pond.x) / (pond.rx + margin)) ** 2 + ((p.y - pond.y) / (pond.ry + margin)) ** 2 < 1;
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
    expect(dist(map.segments[0].line.points[0], map.tunnel.at)).toBeLessThan(1e-6);
  });

  test('the first track leaves the tunnel the way the tunnel faces, from the top or from a side', () => {
    const start = poseAt(map.segments[0].line, 0);
    expect(dist(start, map.tunnel.at)).toBeLessThan(1e-6);
    expect(start.angle).toBeCloseTo(map.tunnel.angle);
    expect(onSide(map) || map.tunnel.at.y <= 50).toBe(true);
  });

  test('uses the first N styles once each', () => {
    expect(map.stations.map((s) => s.style).sort()).toEqual(Array.from({ length: n }, (_, i) => i));
  });

  test('every route leads to its station', () => {
    for (const station of map.stations) expect(follow(map, station.route)).toBe(station.id);
  });

  test('a route names exactly the switches on the way to its station, from the tunnel on', () => {
    for (const station of map.stations) {
      const met: number[] = [];
      let segment = map.segments[0];
      const choice = new Map(station.route);
      while ('switch' in segment.end) {
        const sw = map.switches[segment.end.switch];
        met.push(sw.id);
        segment = map.segments[sw.exits[choice.get(sw.id)!]];
      }
      expect(station.route.map(([sw]) => sw)).toEqual(met);
    }
  });

  test('every switch is reached by one track and left by its two exits', () => {
    map.switches.forEach((sw, i) => {
      expect(sw.id).toBe(i);
      const arriving = map.segments.filter((s) => 'switch' in s.end && s.end.switch === sw.id);
      const leaving = map.segments.filter((s) => s.from !== 'tunnel' && s.from.switch === sw.id);
      expect(arriving).toHaveLength(1);
      expect(dist(arriving[0].line.points[arriving[0].line.points.length - 1], sw.at)).toBeLessThan(1e-6);
      expect(leaving.map((s) => s.id).sort((a, b) => a - b)).toEqual([...sw.exits].sort((a, b) => a - b));
    });
  });

  test('switches are numbered in reading order: top to bottom, and left to right within a row', () => {
    for (const a of map.switches) {
      for (const b of map.switches) {
        if (a.id >= b.id) continue;
        if (Math.abs(a.at.y - b.at.y) < 20) expect(a.at.x, `${a.id} and ${b.id} share a row`).toBeLessThan(b.at.x);
        else expect(a.at.y, `${a.id} above ${b.id}`).toBeLessThan(b.at.y);
      }
    }
  });

  test('the two exits of a switch are spoken as different directions', () => {
    for (const sw of map.switches) {
      const [a, b] = sw.exitAngles.map(headingName);
      expect(a, `switch ${sw.id + 1}`).not.toBe(b);
    }
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
      expect(dist(sw.at, map.tunnel.at)).toBeGreaterThanOrEqual(70);
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

  test('nature fills the free space: trees, bushes, rocks, flowers and grass', () => {
    expect(map.decor.length).toBeGreaterThanOrEqual(14);
    expect(new Set(map.decor.map((d) => d.kind)).size).toBeGreaterThanOrEqual(4);
    for (const d of map.decor) {
      const f = decorFootprint(d);
      expect(f.x - f.r).toBeGreaterThanOrEqual(0);
      expect(f.x + f.r).toBeLessThanOrEqual(BOARD.width);
      expect(f.y - f.r).toBeGreaterThanOrEqual(0);
      expect(f.y + f.r).toBeLessThanOrEqual(BOARD.height);
      expect(dist(f, map.tunnel.at), `${d.kind} near the tunnel`).toBeGreaterThanOrEqual(f.r + 30);
      for (const segment of map.segments) {
        expect(distToLine(f, segment.line.points), `${d.kind} on a track`).toBeGreaterThanOrEqual(f.r + 8);
      }
      for (const st of map.stations) expect(dist(f, st.at), `${d.kind} on a station`).toBeGreaterThanOrEqual(f.r + 26);
      for (const sw of map.switches) expect(dist(f, sw.at), `${d.kind} on a switch`).toBeGreaterThanOrEqual(f.r + 28);
      for (const pond of map.ponds) expect(insideEllipse(f, pond, f.r), `${d.kind} in a pond`).toBe(false);
    }
  });

  test('decor is drawn back to front', () => {
    const ys = map.decor.map((d) => d.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  test('there is a pond, clear of the tracks, the stations and the switches', () => {
    expect(map.ponds.length).toBeGreaterThanOrEqual(1);
    for (const pond of map.ponds) {
      expect(pond.x - pond.rx).toBeGreaterThanOrEqual(8);
      expect(pond.x + pond.rx).toBeLessThanOrEqual(BOARD.width - 8);
      expect(pond.y + pond.ry).toBeLessThanOrEqual(BOARD.height - 8);
      for (const segment of map.segments) for (const p of samples(segment)) expect(insideEllipse(p, pond, 12)).toBe(false);
      for (const p of [map.tunnel.at, ...map.stations.map((st) => st.at), ...map.switches.map((sw) => sw.at)]) {
        expect(insideEllipse(p, pond, 30)).toBe(false);
      }
    }
  });

  test('fireflies hover over the free space', () => {
    expect(map.fireflies.length).toBeGreaterThanOrEqual(8);
    for (const f of map.fireflies) {
      expect(f.x).toBeGreaterThanOrEqual(8);
      expect(f.x).toBeLessThanOrEqual(BOARD.width - 8);
      expect(f.y).toBeGreaterThanOrEqual(8);
      expect(f.y).toBeLessThanOrEqual(BOARD.height - 8);
      for (const segment of map.segments) expect(distToLine(f, segment.line.points)).toBeGreaterThanOrEqual(16);
    }
  });

  test('stations wait on the sides as well as along the bottom', () => {
    const sides = map.stations.filter((st) => st.at.x <= 40 || st.at.x >= BOARD.width - 40);
    const bottom = map.stations.filter((st) => st.at.y >= BOARD.height - 60);
    expect(sides.length).toBeGreaterThanOrEqual(2);
    expect(bottom.length).toBeGreaterThanOrEqual(1);
    for (const st of sides) expect(Math.abs(Math.cos((st.approachAngle * Math.PI) / 180))).toBeCloseTo(1);
  });

  test('trains spend a good part of every route running sideways', () => {
    for (const segment of map.segments) {
      if (!('station' in segment.end)) continue;
      let sideways = 0;
      let total = 0;
      const route = map.stations[segment.end.station].route;
      // Walk the whole route from the tunnel to this station.
      const choice = new Map(route);
      let current = map.segments[0];
      for (;;) {
        for (let d = 0; d < current.line.length; d += 2) {
          const angle = (poseAt(current.line, d).angle * Math.PI) / 180;
          total += 2;
          if (Math.abs(Math.cos(angle)) > 0.5) sideways += 2;
        }
        if ('station' in current.end) break;
        const sw = map.switches[current.end.switch];
        current = map.segments[sw.exits[choice.get(sw.id) ?? 0]];
      }
      expect(sideways / total, `route to station ${segment.end.station}`).toBeGreaterThanOrEqual(0.15);
    }
  });
});

/** The switch of `mirrored` that stands where the mirror puts switch `id` of `map`. */
function mirroredSwitch(map: TrackMap, mirrored: TrackMap, id: number) {
  const at = map.switches[id].at;
  return mirrored.switches.find((sw) => dist(sw.at, { x: BOARD.width - at.x, y: at.y }) < 1e-6)!;
}

test('mirroring flips x and keeps the routes, with the switches numbered by their new places', () => {
  const map = mapFor(5, false);
  const mirrored = mirrorMap(map);
  expect(mirrored.key).toBe(`${map.key}m`);
  map.stations.forEach((st, i) => {
    expect(mirrored.stations[i].at.x).toBeCloseTo(BOARD.width - st.at.x);
    expect(mirrored.stations[i].at.y).toBeCloseTo(st.at.y);
    // Same options at the same (mirrored) switches, whatever their numbers now.
    expect(mirrored.stations[i].route).toEqual(st.route.map(([sw, option]) => [mirroredSwitch(map, mirrored, sw).id, option]));
  });
  map.switches.forEach((sw) => {
    const twin = mirroredSwitch(map, mirrored, sw.id);
    expect(twin.exitAngles[0]).toBeCloseTo(180 - sw.exitAngles[0]);
    expect(twin.exitAngles[1]).toBeCloseTo(180 - sw.exitAngles[1]);
    expect(twin.exits).toEqual(sw.exits);
  });
  expect(mirrored.tunnel.at.x).toBeCloseTo(BOARD.width - map.tunnel.at.x);
  expect(mirrored.tunnel.angle).toBeCloseTo(180 - map.tunnel.angle);
  expect(mirrored.decor[0].x).toBeCloseTo(BOARD.width - map.decor[0].x);
  expect(mirrored.ponds[0].x).toBeCloseTo(BOARD.width - map.ponds[0].x);
  expect(mirrored.fireflies[0].x).toBeCloseTo(BOARD.width - map.fireflies[0].x);
});

test('a mirrored map is numbered by its own positions, not by the ones it was mirrored from', () => {
  // Map 4 has two switches on the top row: 1 on the left, 2 on the right. In the mirror they swap places, and numbers.
  const [plain, mirrored] = [mapFor(4, false), mapFor(4, true)];
  expect(plain.switches.slice(0, 2).map((sw) => sw.at)).toEqual([
    { x: 120, y: 100 },
    { x: 230, y: 100 },
  ]);
  expect(mirrored.switches.slice(0, 2).map((sw) => sw.at)).toEqual([
    { x: 130, y: 100 },
    { x: 240, y: 100 },
  ]);
  expect(mirroredSwitch(plain, mirrored, 0).id).toBe(1);
  expect(mirroredSwitch(plain, mirrored, 1).id).toBe(0);
});

test('the big maps read 1, 2, 3… down the board instead of in the order they were drawn', () => {
  // Map 6: the tunnel on the left feeds a row of two switches; the others go down the board one by one.
  expect(mapFor(6, false).switches.map((sw) => [sw.at.x, sw.at.y])).toEqual([
    [112, 100],
    [220, 100],
    [150, 220],
    [258, 300],
    [150, 380],
  ]);
});

test('the level-1 map keeps switch 1 above switch 2, as the practice expects', () => {
  for (const map of [mapFor(3, false), mapFor(3, true)]) {
    expect(map.switches.map((sw) => sw.at)).toEqual([
      { x: 180, y: 130 },
      { x: 180, y: 270 },
    ]);
    expect(map.stations.map((st) => st.route)).toEqual([[[0, 0]], [[0, 1], [1, 0]], [[0, 1], [1, 1]]]);
  }
});

test('on some levels the trains come out of a tunnel on a side, left or right', () => {
  const side = ALL_MAPS.filter(onSide);
  expect(new Set(side.map((m) => m.stations.length)).size).toBeGreaterThanOrEqual(2);
  expect(side.some((m) => m.tunnel.at.x <= 50)).toBe(true);
  expect(side.some((m) => m.tunnel.at.x >= BOARD.width - 50)).toBe(true);
  // The easiest levels keep the tunnel at the top.
  expect(mapFor(3, false).tunnel).toEqual({ at: { x: 180, y: 40 }, angle: 90 });
});

test('on some levels a station waits in the middle of the map', () => {
  const inMiddle = (m: TrackMap) =>
    m.stations.some((st) => st.at.x >= 110 && st.at.x <= 250 && st.at.y >= 180 && st.at.y <= 450);
  expect(new Set(ALL_MAPS.filter(inMiddle).map((m) => m.stations.length)).size).toBeGreaterThanOrEqual(2);
});
