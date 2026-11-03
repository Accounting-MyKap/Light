import { clampLevel } from '../../core/difficulty';
import { randInt, type Rng } from '../../core/rng';

export type Op = '+' | '-' | '×' | '÷' | '+×';

export interface Problem {
  a: number;
  b: number;
  c?: number;
  op: Op;
  answer: number;
}

const add = (a: number, b: number): Problem => ({ a, b, op: '+', answer: a + b });
const sub = (x: number, y: number): Problem => {
  const [a, b] = x >= y ? [x, y] : [y, x];
  return { a, b, op: '-', answer: a - b };
};
const mul = (a: number, b: number): Problem => ({ a, b, op: '×', answer: a * b });

export function makeProblem(level: number, rng: Rng): Problem {
  const n = (min: number, max: number) => randInt(rng, min, max);
  switch (clampLevel(level)) {
    case 1:
      return add(n(1, 9), n(1, 9));
    case 2:
      return rng() < 0.5 ? add(n(1, 9), n(1, 9)) : sub(n(1, 9), n(1, 9));
    case 3:
      return rng() < 0.5 ? add(n(10, 20), n(1, 9)) : sub(n(10, 20), n(1, 9));
    case 4:
      return mul(n(2, 5), n(2, 5));
    case 5:
      return mul(n(2, 9), n(2, 9));
    case 6:
      return add(n(10, 99), n(10, 99));
    case 7:
      return sub(n(10, 99), n(10, 99));
    case 8:
      return mul(n(11, 19), n(2, 9));
    case 9: {
      const b = n(2, 9);
      const quotient = n(2, 12);
      return { a: b * quotient, b, op: '÷', answer: quotient };
    }
    default: {
      const a = n(1, 20);
      const b = n(2, 9);
      const c = n(2, 9);
      return { a, b, c, op: '+×', answer: a + b * c };
    }
  }
}

export function formatProblem(p: Problem): string {
  switch (p.op) {
    case '+':
      return `${p.a} + ${p.b}`;
    case '-':
      return `${p.a} − ${p.b}`;
    case '×':
      return `${p.a} × ${p.b}`;
    case '÷':
      return `${p.a} ÷ ${p.b}`;
    case '+×':
      return `${p.a} + ${p.b} × ${p.c}`;
  }
}
