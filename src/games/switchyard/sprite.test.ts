import type { Train } from './engine';
import { trainPose } from './engine';
import { ALL_MAPS, compileMap, mirrorMap, type Blueprint } from './maps';
import { LOCO_SPAN, WAGON_SPAN, chimneyOf, trainSprite } from './sprite';

/** From the tunnel (180, 40): down, then a long run to the right, then down to a station. */
const LEVEL: Blueprint = {
  path: [
    [180, 100],
    [340, 100],
    [340, 400],
  ],
  to: { station: 0 },
};
/** From the tunnel: down, then a long diagonal down and to the right, then down. */
const DIAGONAL: Blueprint = {
  path: [
    [180, 80],
    [330, 230],
    [330, 400],
  ],
  to: { station: 0 },
};
const level = compileMap(LEVEL, 'sprite-level');
const levelMirrored = mirrorMap(level);
const diagonal = compileMap(DIAGONAL, 'sprite-diagonal');
const diagonalMirrored = mirrorMap(diagonal);
const at = (distance: number): Train => ({ id: 1, station: 0, route: [0], distance, arrived: false });

/** The distance that puts the front of the train at the point of the track nearest to `target`. */
function frontAt(map: typeof level, target: { x: number; y: number }): number {
  const line = map.segments[0].line;
  let best = 0;
  let bestDist = Infinity;
  for (let d = 0; d <= line.length; d += 1) {
    const p = trainPose(map, at(d), 0);
    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    if (dist < bestDist) [best, bestDist] = [d, dist];
  }
  return best;
}

test('each car sits between its two ends on the track, so it follows the rails through a curve', () => {
  for (const d of [40, 90, 130, 200]) {
    const train = at(d);
    const sprite = trainSprite(diagonal, train);
    for (const [car, span] of [
      [sprite.loco, LOCO_SPAN],
      [sprite.wagon, WAGON_SPAN],
    ] as const) {
      const a = trainPose(diagonal, train, span.front);
      const b = trainPose(diagonal, train, span.back);
      expect(car.x).toBeCloseTo((a.x + b.x) / 2);
      expect(car.y).toBeCloseTo((a.y + b.y) / 2);
    }
  }
});

test('on a run across the board both cars are seen from the side, level, facing the way they go', () => {
  const right = trainSprite(level, at(frontAt(level, { x: 300, y: 100 })));
  for (const car of [right.loco, right.wagon]) expect(car).toMatchObject({ view: 'side', facing: 1 });
  expect(right.loco.rotation).toBeCloseTo(0);
  expect(right.wagon.rotation).toBeCloseTo(0);
  const left = trainSprite(levelMirrored, at(frontAt(level, { x: 300, y: 100 })));
  for (const car of [left.loco, left.wagon]) expect(car).toMatchObject({ view: 'side', facing: -1 });
  expect(left.loco.rotation).toBeCloseTo(0);
});

test('going straight down, the train comes toward us and is seen from the front', () => {
  const down = trainSprite(level, at(frontAt(level, { x: 340, y: 320 })));
  expect(down.loco).toMatchObject({ view: 'front', rotation: 0 });
  expect(down.wagon).toMatchObject({ view: 'front', rotation: 0 });
});

test('on a diagonal the cars tilt exactly with the track', () => {
  const right = trainSprite(diagonal, at(frontAt(diagonal, { x: 280, y: 180 })));
  expect(right.loco).toMatchObject({ view: 'side', facing: 1 });
  expect(right.loco.rotation).toBeCloseTo(45, 0);
  expect(right.wagon.rotation).toBeCloseTo(45, 0);
  const left = trainSprite(diagonalMirrored, at(frontAt(diagonal, { x: 280, y: 180 })));
  expect(left.loco).toMatchObject({ view: 'side', facing: -1 });
  expect(left.loco.rotation).toBeCloseTo(-45, 0);
});

test('seen from the side, a car is never tilted more than 50 degrees, on any map', () => {
  for (const map of ALL_MAPS) {
    for (const station of map.stations) {
      const choice = new Map(station.route);
      const route = [0];
      for (let seg = map.segments[0]; !('station' in seg.end); ) {
        const sw = map.switches[seg.end.switch];
        seg = map.segments[sw.exits[choice.get(sw.id) ?? 0]];
        route.push(seg.id);
      }
      for (let i = 0; i < route.length; i++) {
        const length = map.segments[route[i]].line.length;
        for (let d = 0; d < length; d += 3) {
          const train = { id: 0, station: station.id, route: route.slice(0, i + 1), distance: d, arrived: false };
          const sprite = trainSprite(map, train);
          for (const car of [sprite.loco, sprite.wagon]) {
            if (car.view === 'side') expect(Math.abs(car.rotation)).toBeLessThanOrEqual(50.5);
          }
        }
      }
    }
  }
});

test('the chimney is on top of the locomotive, toward its front when seen from the side', () => {
  const right = trainSprite(level, at(frontAt(level, { x: 300, y: 100 })));
  const c = chimneyOf(right);
  expect(c.x).toBeGreaterThan(right.loco.x);
  expect(c.y).toBeLessThan(right.loco.y - 20);
  const left = trainSprite(levelMirrored, at(frontAt(level, { x: 300, y: 100 })));
  expect(chimneyOf(left).x).toBeLessThan(left.loco.x);
  const down = trainSprite(level, at(frontAt(level, { x: 340, y: 320 })));
  expect(chimneyOf(down).x).toBeCloseTo(down.loco.x);
  expect(chimneyOf(down).y).toBeLessThan(down.loco.y - 25);
});
