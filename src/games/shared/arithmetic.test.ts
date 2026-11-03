import { createRng } from '../../core/rng';
import { formatProblem, makeProblem, type Problem } from './arithmetic';

const inRange = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

function evaluate(p: Problem): number {
  switch (p.op) {
    case '+':
      return p.a + p.b;
    case '-':
      return p.a - p.b;
    case '×':
      return p.a * p.b;
    case '÷':
      return p.a / p.b;
    case '+×':
      return p.a + p.b * (p.c ?? NaN);
  }
}

const RULES: Record<number, (p: Problem) => boolean> = {
  1: (p) => p.op === '+' && inRange(p.a, 1, 9) && inRange(p.b, 1, 9),
  2: (p) => ['+', '-'].includes(p.op) && inRange(p.a, 1, 9) && inRange(p.b, 1, 9) && (p.op === '+' || p.a >= p.b),
  3: (p) => ['+', '-'].includes(p.op) && inRange(p.a, 10, 20) && inRange(p.b, 1, 9),
  4: (p) => p.op === '×' && inRange(p.a, 2, 5) && inRange(p.b, 2, 5),
  5: (p) => p.op === '×' && inRange(p.a, 2, 9) && inRange(p.b, 2, 9),
  6: (p) => p.op === '+' && inRange(p.a, 10, 99) && inRange(p.b, 10, 99),
  7: (p) => p.op === '-' && inRange(p.a, 10, 99) && inRange(p.b, 10, 99) && p.a >= p.b,
  8: (p) => p.op === '×' && inRange(p.a, 11, 19) && inRange(p.b, 2, 9),
  9: (p) => p.op === '÷' && inRange(p.b, 2, 9) && p.a % p.b === 0 && inRange(p.answer, 2, 12),
  10: (p) => p.op === '+×' && inRange(p.a, 1, 20) && inRange(p.b, 2, 9) && inRange(p.c ?? 0, 2, 9),
};

test.each(Array.from({ length: 10 }, (_, i) => i + 1))('level %d problems respect the table', (level) => {
  const r = createRng(level);
  for (let i = 0; i < 200; i++) {
    const p = makeProblem(level, r);
    expect(Number.isInteger(p.answer)).toBe(true);
    expect(p.answer).toBeGreaterThanOrEqual(0);
    expect(p.answer).toBe(evaluate(p));
    expect(RULES[level](p), JSON.stringify(p)).toBe(true);
  }
});

test('formatProblem', () => {
  expect(formatProblem({ a: 3, b: 4, c: 5, op: '+×', answer: 23 })).toBe('3 + 4 × 5');
  expect(formatProblem({ a: 12, b: 4, op: '-', answer: 8 })).toBe('12 − 4');
  expect(formatProblem({ a: 7, b: 5, op: '+', answer: 12 })).toBe('7 + 5');
  expect(formatProblem({ a: 6, b: 7, op: '×', answer: 42 })).toBe('6 × 7');
  expect(formatProblem({ a: 56, b: 8, op: '÷', answer: 7 })).toBe('56 ÷ 8');
});
