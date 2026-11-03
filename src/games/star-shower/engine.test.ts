import { createRng } from '../../core/rng';
import {
  advance,
  BREAK_MS,
  MAX_GAME_MS,
  STAR_SHOWER_MAX_SCORE,
  createStarShower,
  deleteDigit,
  LANES,
  paceAt,
  starShowerResult,
  submitAnswer,
  typeDigit,
  type Star,
  type StarShowerEvent,
  type StarShowerState,
} from './engine';

function star(partial: Partial<Star>): Star {
  return {
    id: 1,
    problem: { a: 1, b: 1, op: '+', answer: 2 },
    level: 1,
    lane: 0,
    bornAt: 0,
    fallMs: 9000,
    comet: false,
    ...partial,
  };
}

function typed(state: StarShowerState, text: string): StarShowerState {
  return [...text].reduce((s, ch) => typeDigit(s, Number(ch)), state);
}

function withStars(stars: Star[], extra: Partial<StarShowerState> = {}): StarShowerState {
  return { ...createStarShower(1, createRng(1)), stars, ...extra };
}

test('pace: 3200/9000 at start, 2300/7500 halfway, 1400/6000 from 150 s on', () => {
  expect(paceAt(0)).toEqual({ intervalMs: 3200, fallMs: 9000 });
  expect(paceAt(75_000)).toEqual({ intervalMs: 2300, fallMs: 7500 });
  expect(paceAt(150_000)).toEqual({ intervalMs: 1400, fallMs: 6000 });
  expect(paceAt(400_000)).toEqual({ intervalMs: 1400, fallMs: 6000 });
});

test('the first star is born at 0, the next one an interval later', () => {
  const rng = createRng(1);
  const first = advance(createStarShower(1, rng), 0, rng);
  expect(first.state.stars).toHaveLength(1);
  expect(first.state.stars[0]).toMatchObject({ bornAt: 0, fallMs: 9000, level: 1 });
  expect(first.events.map((e) => e.kind)).toEqual(['spawn']);
  expect(advance(first.state, 3199, rng).state).toBe(first.state);
  expect(advance(first.state, 3200, rng).state.stars[1].bornAt).toBe(3200);
});

test('one call catches up several spawns, each at its scheduled time', () => {
  const rng = createRng(3);
  const { state, events } = advance(createStarShower(1, rng), 7000, rng);
  const second = 3200;
  const third = second + paceAt(second).intervalMs;
  expect(state.stars.map((s) => s.bornAt)).toEqual([0, second, third]);
  expect(events).toHaveLength(3);
});

test('over many spawns: lane never repeats, answers on screen are unique, at most one comet, ~10 % comets', () => {
  let spawns = 0;
  let comets = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    let s = createStarShower(1, rng);
    let lastLane: number | null = null;
    for (let now = 0; now <= 150_000; now += 100) {
      const r = advance(s, now, rng);
      s = r.state;
      for (const e of r.events) {
        if (e.kind !== 'spawn') continue;
        spawns++;
        if (e.star.comet) comets++;
        expect(e.star.lane).not.toBe(lastLane);
        expect(e.star.lane).toBeGreaterThanOrEqual(0);
        expect(e.star.lane).toBeLessThan(LANES);
        lastLane = e.star.lane;
      }
      const answers = s.stars.map((x) => x.problem.answer);
      expect(new Set(answers).size).toBe(answers.length);
      expect(s.stars.filter((x) => x.comet).length).toBeLessThanOrEqual(1);
      if (now % 2000 === 0) {
        while (s.stars.length > 0) {
          const target = String(s.stars[0].problem.answer);
          s = submitAnswer(typed(s, target)).state;
        }
      }
    }
  }
  expect(spawns).toBeGreaterThan(1000);
  expect(comets / spawns).toBeGreaterThan(0.05);
  expect(comets / spawns).toBeLessThan(0.15);
});

test('a spawn that cannot get a unique answer waits 200 ms', () => {
  const rng = createRng(1);
  const stars = Array.from({ length: 17 }, (_, i) =>
    star({ id: i + 1, problem: { a: 1, b: 1, op: '+', answer: i + 2 } }),
  );
  const s = withStars(stars, { nextSpawnAt: 5000, nextId: 18 });
  const r = advance(s, 5000, rng);
  expect(r.state.stars).toHaveLength(17);
  expect(r.state.nextSpawnAt).toBe(5200);
  expect(r.events).toEqual([]);
});

test('a right answer pops its star and scores 10 + its level', () => {
  const s = withStars([star({ id: 1, level: 3, problem: { a: 4, b: 3, op: '+', answer: 7 } })]);
  const { state, outcome } = submitAnswer(typed(s, '7'));
  expect(outcome).toEqual({ kind: 'hit', popped: [s.stars[0]], points: 13 });
  expect(state).toMatchObject({ stars: [], score: 13, correct: 1, input: '' });
});

test('the comet pops every star and scores each one', () => {
  const stars = [
    star({ id: 1, level: 2, comet: true, problem: { a: 4, b: 5, op: '+', answer: 9 } }),
    star({ id: 2, level: 1, problem: { a: 1, b: 1, op: '+', answer: 2 } }),
    star({ id: 3, level: 4, problem: { a: 2, b: 3, op: '×', answer: 6 } }),
  ];
  const { state, outcome } = submitAnswer(typed(withStars(stars), '9'));
  expect(outcome).toEqual({ kind: 'comet', popped: stars, points: 37 });
  expect(state).toMatchObject({ stars: [], score: 37, correct: 1 });
});

test('a wrong number costs nothing, clears the input and counts for accuracy and the staircase', () => {
  const s = withStars([star({ problem: { a: 4, b: 3, op: '+', answer: 7 } })]);
  const { state, outcome } = submitAnswer(typed(s, '8'));
  expect(outcome).toEqual({ kind: 'wrong' });
  expect(state).toMatchObject({ score: 0, input: '', wrong: 1 });
  expect(state.stars).toHaveLength(1);

  let t = withStars([star({ problem: { a: 4, b: 3, op: '+', answer: 7 } })], {
    staircase: createStarShower(3, createRng(1)).staircase,
  });
  t = submitAnswer(typed(t, '8')).state;
  t = submitAnswer(typed(t, '8')).state;
  expect(t.staircase.level).toBe(2);
  expect(t.wrong).toBe(2);
});

test('Enter does nothing with an empty input, an empty sky or a finished game', () => {
  const s = withStars([star({})]);
  const empty = submitAnswer(s);
  expect(empty.outcome).toBeNull();
  expect(empty.state).toBe(s);

  const sky = typed(withStars([]), '7');
  const noStars = submitAnswer(sky);
  expect(noStars.outcome).toBeNull();
  expect(noStars.state.input).toBe('7');
  expect(noStars.state.wrong).toBe(0);

  const over = typed(withStars([star({})], { endedAt: 1000 }), '2');
  expect(submitAnswer(over).outcome).toBeNull();
});

test('answer 0 and leading zeros', () => {
  const s = withStars([star({ problem: { a: 5, b: 5, op: '-', answer: 0 } })]);
  expect(submitAnswer(typed(s, '0')).outcome).toMatchObject({ kind: 'hit' });
  expect(typed(s, '07').input).toBe('7');
  const full = typed(s, '123');
  expect(typeDigit(full, 4).input).toBe('123');
  expect(typeDigit(s, 12).input).toBe('');
  expect(deleteDigit(full).input).toBe('12');
});

test('four right answers in a row move the level up; new stars use it', () => {
  const rng = createRng(5);
  let s = withStars([]);
  for (let i = 0; i < 4; i++) {
    s = { ...s, stars: [star({ id: i + 1, problem: { a: 1, b: 1, op: '+', answer: 2 } })] };
    s = submitAnswer(typed(s, '2')).state;
  }
  expect(s.staircase.level).toBe(2);
  s = { ...s, nextSpawnAt: 0 };
  expect(advance(s, 0, rng).state.stars[0].level).toBe(2);
});

test('result: accuracy over right + wrong + lost, duration = endedAt', () => {
  const s = { ...createStarShower(4, createRng(1)), correct: 6, wrong: 1, lost: 3, score: 90, endedAt: 42_000 };
  expect(starShowerResult(s)).toEqual({ score: 90, accuracy: 0.6, levelReached: 4, durationMs: 42_000 });
});

test('result before the game ended throws', () => {
  expect(() => starShowerResult(createStarShower(1, createRng(1)))).toThrow();
});

/** Answers every star on screen right away. */
function answerAll(s: StarShowerState): StarShowerState {
  let cur = s;
  while (cur.stars.length > 0) {
    cur = submitAnswer(typed(cur, String(cur.stars[0].problem.answer))).state;
  }
  return cur;
}

test('a star reaching the horizon costs a life, clears the sky without points and opens a 1.5 s break', () => {
  const rng = createRng(7);
  const s0 = createStarShower(1, rng);
  const r = advance(s0, 9000, rng);
  const last = r.events[r.events.length - 1];
  expect(last.kind).toBe('lost');
  if (last.kind !== 'lost') throw new Error('unreachable');
  expect(last.star.bornAt).toBe(0);
  expect(last.cleared.map((c) => c.bornAt)).toEqual([3200, 6362]);
  expect(r.state).toMatchObject({
    lives: 2,
    lost: 1,
    stars: [],
    score: 0,
    wrong: 0,
    correct: 0,
    breakUntil: 9000 + BREAK_MS,
    endedAt: null,
  });
  expect(r.state.staircase).toEqual(s0.staircase);

  const during = advance(r.state, 10_499, rng);
  expect(during.state.stars).toEqual([]);
  expect(during.events).toEqual([]);
  const after = advance(during.state, 10_500, rng);
  expect(after.state.stars).toHaveLength(1);
  expect(after.state.stars[0]).toMatchObject({ bornAt: 10_500, fallMs: paceAt(9000).fallMs });
  expect(after.state.breakUntil).toBeNull();
  expect(after.state.breakMs).toBe(BREAK_MS);
});

test('the third lost star ends the game at that moment, with no break', () => {
  const rng = createRng(11);
  const r = advance(createStarShower(1, rng), 60_000, rng);
  const lost = r.events.filter((e) => e.kind === 'lost');
  expect(lost).toHaveLength(3);
  expect(r.events[r.events.length - 1]).toEqual({ kind: 'over', reason: 'lives' });
  expect(r.events.filter((e) => e.kind === 'over')).toHaveLength(1);
  expect(r.state).toMatchObject({ lives: 0, lost: 3, breakUntil: null });
  const thirdLost = lost[2];
  if (thirdLost.kind !== 'lost') throw new Error('unreachable');
  expect(r.state.endedAt).toBe(thirdLost.star.bornAt + thirdLost.star.fallMs);
  expect(lost.map((e) => e.kind === 'lost' && e.star.bornAt + e.star.fallMs).slice(0, 2)).toEqual([9000, 19_320]);
  expect(r.state.endedAt).toBeCloseTo(29_463.6, 0);
  const again = advance(r.state, 90_000, rng);
  expect(again.state).toBe(r.state);
  expect(again.events).toEqual([]);
});

test('the 5-minute cap ends the game', () => {
  const rng = createRng(2);
  let s = createStarShower(1, rng);
  const events: StarShowerEvent[] = [];
  for (let now = 0; now <= MAX_GAME_MS && s.endedAt === null; now += 100) {
    const r = advance(s, now, rng);
    events.push(...r.events);
    s = answerAll(r.state);
  }
  expect(events.filter((e) => e.kind === 'lost')).toEqual([]);
  expect(events[events.length - 1]).toEqual({ kind: 'over', reason: 'time' });
  expect(s.endedAt).toBe(MAX_GAME_MS);
});

test('a perfect 5-minute game stays under the max score', () => {
  const rng = createRng(4);
  let s = createStarShower(10, rng);
  let births = 0;
  for (let now = 0; s.endedAt === null; now += 100) {
    const r = advance(s, now, rng);
    births += r.events.filter((e) => e.kind === 'spawn').length;
    s = answerAll(r.state);
  }
  expect(births).toBeLessThanOrEqual(176);
  expect(s.score).toBeLessThanOrEqual(STAR_SHOWER_MAX_SCORE);
});

test('one big jump equals many small steps', () => {
  const rngA = createRng(9);
  const rngB = createRng(9);
  const big = advance(createStarShower(1, rngA), 40_000, rngA);
  let s = createStarShower(1, rngB);
  const kinds: string[] = [];
  for (let now = 0; now < 40_000; now += 16) {
    const r = advance(s, now, rngB);
    s = r.state;
    kinds.push(...r.events.map((e) => e.kind));
  }
  const last = advance(s, 40_000, rngB);
  kinds.push(...last.events.map((e) => e.kind));
  expect(last.state).toEqual(big.state);
  expect(kinds).toEqual(big.events.map((e) => e.kind));
});
