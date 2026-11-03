import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { formatProblem } from '../shared/arithmetic';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { MAX_STEP_MS, PRACTICE_FALL_MS, PRACTICE_ROUNDS, RESTART_MS, StarShowerPractice } from './Practice';

// Each test plays seconds of falling stars frame by frame: room to spare on a loaded runner.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('../../core/sound');
vi.mock('../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settings')>();
  return { ...actual, useSettings: () => ({ ...actual.DEFAULT_SETTINGS, sound: false, haptics: false }) };
});

const POP = 'Escribe el resultado de la estrella y pulsa OK para reventarla';
const FALLING = 'Las estrellas caen: revienta las dos antes de que toquen el horizonte';
const COMET = 'La estrella dorada es un cometa: si la revientas, revienta todas';
const HINT_FIRST = 'Ese número no está en el cielo: 3 + 4 = 7. Inténtalo otra vez';
const HINT_WRONG = 'Ese número no está en ninguna estrella. Inténtalo otra vez';
const HINT_LOST = 'Si una estrella toca el horizonte, pierdes una vida. Inténtalo otra vez';

function setup() {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  const view = render(
    <FeedbackProvider>
      <StarShowerPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip, view };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/**
 * Moves time on in steps until `check` holds; fails if it never does. A step is shorter than anything the tests wait
 * for: «¡Bien!» stays up 700 ms, and a hint until the round is right.
 */
const STEP_MS = 500;
function until(check: () => boolean, maxMs = 20_000) {
  for (let t = 0; t < maxMs && !check(); t += STEP_MS) advance(STEP_MS);
  expect(check()).toBe(true);
}
/** A few frames: the sky takes up a new round on the frame after the round is drawn. */
const frames = () => advance(50);

/** The live stars (not the bursts of popped ones), by their operation. */
const stars = () => screen.queryAllByTestId('star');
const texts = () => stars().map((star) => star.textContent);
const star = (text: string) => stars().find((el) => el.textContent === text)!;
/** How far down the sky a star hangs, in percent: 0 at the top, 100 on the horizon. */
const height = (text: string) => parseFloat(star(text).style.top);
const slot = () => screen.getByTestId('answer').textContent;
const tone = () => document.querySelector('[data-tone]')?.getAttribute('data-tone');
/** The guide's bubble says `text` (cheaper than searching the whole sky on every step). */
const says = (text: string) => () => document.querySelector('[data-tone]')?.textContent === text;
/** fireEvent returns false when the handler used the key (it prevented the browser default). */
const key = (k: string) => fireEvent.keyDown(window, { key: k });
const type = (digits: string) => [...digits].forEach(key);
const answer = (digits: string) => {
  type(digits);
  key('Enter');
};
const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

/** Round 1 done right: 7 pops the still star, then the next round comes. */
function passRound1() {
  answer('7');
  expect(says('¡Bien!')()).toBe(true);
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  frames();
}

/** Round 2 done right: 7 pops the first star; 6 the second, once it is in the sky. */
function passRound2() {
  answer('7');
  until(() => stars().length === 1 && texts()[0] === '9 − 3');
  answer('6');
  expect(says('¡Bien!')()).toBe(true);
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  frames();
}

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('the rounds: a still star, two that fall slowly, then two and a comet; every answer on screen is unique', () => {
  const [pop, falling, comet] = PRACTICE_ROUNDS;
  const shown = (round: typeof pop) =>
    round.stars.map((s) => ({ text: formatProblem(s.problem), answer: s.problem.answer, lane: s.lane, at: s.at }));

  expect(pop.still).toBe(true);
  expect(shown(pop)).toEqual([{ text: '3 + 4', answer: 7, lane: 1, at: 0 }]);
  expect(falling.still).toBe(false);
  expect(shown(falling)).toEqual([
    { text: '5 + 2', answer: 7, lane: 0, at: 0 },
    { text: '9 − 3', answer: 6, lane: 2, at: 2000 },
  ]);
  expect(comet.still).toBe(false);
  expect(shown(comet)).toEqual([
    { text: '8 − 5', answer: 3, lane: 0, at: 0 },
    { text: '2 + 6', answer: 8, lane: 2, at: 0 },
    { text: '4 + 5', answer: 9, lane: 1, at: 1500 },
  ]);
  expect(comet.stars.map((s) => Boolean(s.comet))).toEqual([false, false, true]);
  for (const round of PRACTICE_ROUNDS) {
    const answers = round.stars.map((s) => s.problem.answer);
    expect(new Set(answers).size).toBe(answers.length);
  }
  // Slower than the game, whose stars start at 9 s: the practice teaches.
  expect(PRACTICE_FALL_MS).toBe(14_000);
  // The hint of round 1 writes the operation as the star does.
  expect(HINT_FIRST).toContain(`${formatProblem(pop.stars[0].problem)} = ${pop.stars[0].problem.answer}`);
});

test('round 1: the star floats still a third of the way down, and 7 with Enter pops it', () => {
  setup();
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();
  expect(screen.getByText(POP)).toBeInTheDocument();
  expect(tone()).toBe('normal');
  expect(texts()).toEqual(['3 + 4']);
  expect(star('3 + 4').dataset.lane).toBe('1');
  expect(star('3 + 4').dataset.comet).toBe('false');
  expect(height('3 + 4')).toBeCloseTo(100 / 3, 1);

  // It does not fall, and it cannot be lost.
  advance(20_000);
  expect(texts()).toEqual(['3 + 4']);
  expect(height('3 + 4')).toBeCloseTo(100 / 3, 1);
  expect(says(POP)()).toBe(true);

  type('7');
  expect(slot()).toBe('7');
  key('Enter');
  expect(stars()).toHaveLength(0);
  // It bursts where it floated.
  const burst = document.querySelector<HTMLElement>('[data-kind="pop"]');
  expect(burst?.textContent).toBe('3 + 4');
  expect(parseFloat(burst!.style.top)).toBeCloseTo(100 / 3, 1);
  expect(says('¡Bien!')()).toBe(true);
  expect(tone()).toBe('ok');
  expect(slot()).toBe('?');
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();

  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  expect(screen.getByText(FALLING)).toBeInTheDocument();
  expect(tone()).toBe('normal');
});

test('round 1: a number on no star shows the first hint, the star stays, and the keypad answers too', () => {
  setup();
  answer('6');
  expect(says(HINT_FIRST)()).toBe(true);
  expect(tone()).toBe('hint');
  expect(slot()).toBe('?');
  expect(screen.getByTestId('answer').dataset.wrong).toBe('1');
  expect(texts()).toEqual(['3 + 4']);
  expect(height('3 + 4')).toBeCloseTo(100 / 3, 1);
  advance(3000);
  expect(says(HINT_FIRST)()).toBe(true);

  tap('7');
  tap('OK');
  expect(says('¡Bien!')()).toBe(true);
  expect(stars()).toHaveLength(0);
});

test('Backspace and the keypad ⌫ delete the last digit', () => {
  setup();
  type('73');
  expect(slot()).toBe('73');
  expect(key('Backspace')).toBe(false);
  expect(slot()).toBe('7');
  type('1');
  tap('Borrar');
  expect(slot()).toBe('7');
  key('Enter');
  expect(says('¡Bien!')()).toBe(true);
});

test('round 2: the stars fall, the second two seconds after the first, and popping both is right', () => {
  const { onComplete } = setup();
  passRound1();
  expect(texts()).toEqual(['5 + 2']);
  expect(star('5 + 2').dataset.lane).toBe('0');
  const start = height('5 + 2');
  expect(start).toBeLessThan(2);
  advance(1000);
  // About 7 % of the sky a second: 14 s from the top to the horizon.
  expect(height('5 + 2') - start).toBeGreaterThan(5);
  expect(height('5 + 2') - start).toBeLessThan(9);

  advance(1100);
  expect(texts()).toEqual(['5 + 2', '9 − 3']);
  expect(star('9 − 3').dataset.lane).toBe('2');
  expect(height('9 − 3')).toBeLessThan(2);

  // One popped is not the round yet: no reaction until both are.
  answer('7');
  expect(texts()).toEqual(['9 − 3']);
  expect(says(FALLING)()).toBe(true);
  answer('6');
  expect(stars()).toHaveLength(0);
  expect(says('¡Bien!')()).toBe(true);
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  expect(screen.getByText(COMET)).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
});

test('round 2: a wrong number shows its hint, and the stars keep falling', () => {
  setup();
  passRound1();
  advance(500);
  answer('4');
  expect(says(HINT_WRONG)()).toBe(true);
  expect(tone()).toBe('hint');
  expect(slot()).toBe('?');
  const before = height('5 + 2');
  advance(1000);
  expect(height('5 + 2')).toBeGreaterThan(before + 5);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  advance(1000);
  expect(texts()).toEqual(['5 + 2', '9 − 3']);
  // The round goes on: popping both is still right, and the hint stays until then.
  answer('6');
  expect(says(HINT_WRONG)()).toBe(true);
  answer('7');
  expect(says('¡Bien!')()).toBe(true);
});

test('round 2: a star on the horizon shows its hint, and the round starts over with the answer cleared', () => {
  const { onComplete } = setup();
  passRound1();
  // Something half typed when the first star lands.
  advance(PRACTICE_FALL_MS - 1000);
  type('1');
  expect(slot()).toBe('1');
  until(says(HINT_LOST));
  expect(tone()).toBe('hint');
  expect(stars()).toHaveLength(0);
  // It fades on the horizon, in its lane.
  const fading = [...document.querySelectorAll<HTMLElement>('[data-kind="clear"]')];
  expect(fading.some((burst) => burst.textContent === '5 + 2' && parseFloat(burst.style.top) === 100)).toBe(true);
  expect(slot()).toBe('?');
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();

  // The keys hold still until the round starts over.
  expect(key('7')).toBe(true);
  expect(slot()).toBe('?');

  advance(RESTART_MS);
  frames();
  // Back on top, as the round began, with the hint still up through the new try.
  expect(texts()).toEqual(['5 + 2']);
  expect(height('5 + 2')).toBeLessThan(2);
  expect(slot()).toBe('?');
  expect(says(HINT_LOST)()).toBe(true);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  advance(2100);
  expect(texts()).toEqual(['5 + 2', '9 − 3']);
  expect(height('9 − 3')).toBeLessThan(2);

  // The new try counts like the first.
  answer('7');
  answer('6');
  expect(says('¡Bien!')()).toBe(true);
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  expect(onComplete).not.toHaveBeenCalled();
});

test('as in the game, a lost star lights the horizon only with full motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  setup();
  passRound1();
  until(says(HINT_LOST));
  const flash = screen.getByTestId('horizon').querySelector<HTMLElement>('[data-sky-flash="loss"]');
  expect(flash?.dataset.lane).toBe('0');
  advance(600);
  expect(screen.getByTestId('horizon').querySelector('[data-sky-flash]')).toBeNull();
});

test('round 3: popping the comet pops every star and completes the practice once', () => {
  const { onComplete } = setup();
  passRound1();
  passRound2();
  expect(screen.getByText(COMET)).toBeInTheDocument();
  expect(texts()).toEqual(['8 − 5', '2 + 6']);
  expect(stars().map((s) => s.dataset.lane)).toEqual(['0', '2']);
  advance(1600);
  expect(texts()).toEqual(['8 − 5', '2 + 6', '4 + 5']);
  expect(star('4 + 5').dataset.comet).toBe('true');
  expect(star('4 + 5').dataset.lane).toBe('1');

  answer('9');
  expect(stars()).toHaveLength(0);
  expect(document.querySelectorAll('[data-kind="pop"]')).toHaveLength(3);
  expect(says('¡Bien!')()).toBe(true);
  expect(onComplete).not.toHaveBeenCalled();
  advance(PRACTICE_NEXT_MS);
  expect(onComplete).toHaveBeenCalledTimes(1);
  advance(5000);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('round 3: a normal star popped first, then the comet, also completes it', () => {
  const { onComplete } = setup();
  passRound1();
  passRound2();
  answer('3');
  expect(texts()).toEqual(['2 + 6']);
  expect(says(COMET)()).toBe(true);
  advance(1600);
  expect(texts()).toEqual(['2 + 6', '4 + 5']);
  answer('9');
  expect(stars()).toHaveLength(0);
  expect(says('¡Bien!')()).toBe(true);
  advance(PRACTICE_NEXT_MS);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('round 3: a wrong number keeps the round going; a star on the horizon starts it over', () => {
  const { onComplete } = setup();
  passRound1();
  passRound2();
  answer('5');
  expect(says(HINT_WRONG)()).toBe(true);
  expect(texts()).toEqual(['8 − 5', '2 + 6']);
  until(says(HINT_LOST));
  advance(RESTART_MS);
  frames();
  expect(texts()).toEqual(['8 − 5', '2 + 6']);
  expect(height('8 − 5')).toBeLessThan(5);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  advance(1600);
  expect(texts()).toEqual(['8 − 5', '2 + 6', '4 + 5']);
  expect(onComplete).not.toHaveBeenCalled();
});

test('the practice shows no points and no lives: the stars and their bursts only show their operations', () => {
  setup();
  answer('7');
  expect(document.querySelector('[data-kind="pop"]')).not.toBeNull();
  expect(document.body.textContent).not.toMatch(/\+\d/);
  advance(PRACTICE_NEXT_MS);
  frames();
  passRound2();
  advance(1600);
  answer('9');
  expect(document.querySelectorAll('[data-kind="pop"]')).toHaveLength(3);
  expect(document.body.textContent).not.toMatch(/\+\d/);
  expect(screen.queryByText('Puntos')).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: /^Vidas/ })).not.toBeInTheDocument();
});

test('the keys and the keypad do nothing while «¡Bien!» shows', () => {
  setup();
  answer('7');
  expect(says('¡Bien!')()).toBe(true);
  // Not used, so the browser keeps the keys.
  expect(key('5')).toBe(true);
  expect(key('Backspace')).toBe(true);
  expect(key('Enter')).toBe(true);
  tap('5');
  tap('OK');
  expect(slot()).toBe('?');
  advance(PRACTICE_NEXT_MS);
  frames();
  // Once the next round is on, they answer again.
  expect(key('5')).toBe(false);
  expect(slot()).toBe('5');
});

test('a 10 s jump between frames (the app was hidden) moves the stars by one short step at most', () => {
  setup();
  passRound1();
  advance(500);
  const before = height('5 + 2');
  vi.setSystemTime(Date.now() + 10_000);
  advance(20);
  // At most MAX_STEP_MS of practice time for the jump, plus a frame: well under 2 % of the sky.
  expect(MAX_STEP_MS).toBe(100);
  expect(height('5 + 2') - before).toBeLessThan(2);
  expect(texts()).toEqual(['5 + 2']);
  expect(says(FALLING)()).toBe(true);
});

test('«Saltar práctica» calls onSkip, and after unmount no timer nor frame is left', () => {
  const { onSkip, view } = setup();
  answer('7');
  advance(PRACTICE_NEXT_MS);
  frames();
  advance(500);
  answer('4'); // a wrong number: the slot shakes
  answer('7'); // a pop: its burst is still on screen
  fireEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
