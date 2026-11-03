import { headingName, offsetPolyline, polyline, poseAt, roundCorners, segmentsIntersect } from './geometry';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('polyline and poseAt', () => {
  test('measures the length of a polyline', () => {
    expect(polyline([{ x: 0, y: 0 }, { x: 30, y: 40 }]).length).toBe(50);
    expect(polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]).cumulative).toEqual([0, 10, 20]);
  });

  test('gives the point and the heading at a distance', () => {
    const pose = poseAt(polyline([{ x: 0, y: 0 }, { x: 30, y: 40 }]), 25);
    expect(pose.x).toBeCloseTo(15);
    expect(pose.y).toBeCloseTo(20);
    expect(pose.angle).toBeCloseTo(53.13, 1);
  });

  test('follows the right piece of a bent line', () => {
    const line = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(poseAt(line, 15)).toMatchObject({ x: 10, y: 5, angle: 90 });
  });

  test('clamps distances outside the line to its ends', () => {
    const line = polyline([{ x: 0, y: 0 }, { x: 30, y: 40 }]);
    expect(poseAt(line, -5)).toMatchObject({ x: 0, y: 0 });
    const end = poseAt(line, 999);
    expect(end.x).toBeCloseTo(30);
    expect(end.y).toBeCloseTo(40);
  });
});

describe('roundCorners', () => {
  const ell = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  test('keeps both ends', () => {
    const points = roundCorners(ell, 20);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 100, y: 100 });
  });

  test('replaces a right angle with a quarter circle', () => {
    expect(polyline(roundCorners(ell, 20)).length).toBeCloseTo(160 + 10 * Math.PI, 0);
  });

  test('samples the arc finely', () => {
    const points = roundCorners(ell, 20);
    for (let i = 1; i < points.length; i++) {
      const insideArc = points[i].x > 80 && points[i].y < 20;
      if (insideArc) expect(dist(points[i], points[i - 1])).toBeLessThanOrEqual(3.01);
    }
  });

  test('stays inside the corner (the curve is never farther than the radius from both legs)', () => {
    for (const p of roundCorners(ell, 20)) {
      expect(p.x).toBeLessThanOrEqual(100 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  test('shrinks the radius when the legs are short', () => {
    const points = roundCorners(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      20,
    );
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 10, y: 10 });
  });

  test('leaves straight runs alone', () => {
    expect(
      roundCorners(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
        20,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });
});

test('offsetPolyline moves a line along its normal', () => {
  const moved = offsetPolyline(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    3,
  );
  expect(moved[0].x).toBeCloseTo(0);
  expect(moved[0].y).toBeCloseTo(3);
  expect(moved[1].x).toBeCloseTo(10);
  expect(moved[1].y).toBeCloseTo(3);
});

describe('segmentsIntersect', () => {
  test('a cross intersects', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
  });
  test('touching at a shared end does not count', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })).toBe(false);
  });
  test('parallel segments do not intersect', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
  });
  test('apart segments do not intersect', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: -5 }, { x: 20, y: 5 })).toBe(false);
  });
});

test('headingName names the eight screen directions', () => {
  expect(headingName(0)).toBe('right');
  expect(headingName(90)).toBe('down');
  expect(headingName(135)).toBe('down-left');
  expect(headingName(180)).toBe('left');
  expect(headingName(-90)).toBe('up');
  expect(headingName(-45)).toBe('up-right');
  expect(headingName(100)).toBe('down');
});
