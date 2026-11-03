import { act, fireEvent, render, screen } from '@testing-library/react';
import { playTone } from '../../core/sound';
import { DEFAULT_SETTINGS, useSettings } from '../../data/settings';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { PRACTICE_NEXT_MS } from '../shared/practice/usePracticeRounds';
import { destinationOf, spawnIntervalMs } from './engine';
import { mapFor } from './maps';
import { PRACTICE_ROUNDS, RESTART_MS, SwitchyardPractice } from './Practice';

// Each test plays seconds of trains frame by frame: room to spare on a loaded runner.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('../../core/sound');
vi.mock('../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settings')>();
  return { ...actual, useSettings: vi.fn(() => ({ ...actual.DEFAULT_SETTINGS, sound: false, haptics: false })) };
});

const TAP = 'Toca el cambio (el círculo con flecha) para que el tren rojo vaya a la estación roja, la del círculo';
const MOVING = 'Ahora el tren avanza solo: cambia la vía antes de que llegue al cambio';
const TWO = 'Pueden venir varios a la vez: lleva cada uno a su estación';
const HINT_YELLOW = 'El tren amarillo va a la estación amarilla, la del cuadrado. Inténtalo otra vez';
const HINT_EACH = 'Cada tren va a la estación de su color y forma. Inténtalo otra vez';

function setup() {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  const view = render(
    <FeedbackProvider>
      <SwitchyardPractice onComplete={onComplete} onSkip={onSkip} />
    </FeedbackProvider>,
  );
  return { onComplete, onSkip, view };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/**
 * Moves time on in steps until `check` holds; fails if it never does. A step is shorter than anything the tests wait
 * for: «¡Bien!» stays up 700 ms and an arrival mark 900 ms, and a hint until the round is right.
 */
const STEP_MS = 500;
function until(check: () => boolean, maxMs = 20_000) {
  for (let t = 0; t < maxMs && !check(); t += STEP_MS) advance(STEP_MS);
  expect(check()).toBe(true);
}
const switchButton = (index: number) => document.querySelector<HTMLButtonElement>(`[data-switch="${index}"]`)!;
const options = () => [0, 1].map((i) => Number(switchButton(i).dataset.option));
const trains = () => [...document.querySelectorAll<SVGElement>('[data-train]')];
const locoOf = (train: Element) => train.querySelector('[data-car="loco"]')!.getAttribute('transform')!;
/** How far down the board the locomotive is drawn (the tunnel is at the top, at y 40). */
const locoY = (train: Element) => Number(/translate\(\S+ (\S+)\)/.exec(locoOf(train))![1]);
const tone = () => document.querySelector('[data-tone]')?.getAttribute('data-tone');
const key = (k: string) => fireEvent.keyDown(window, { key: k });
/** The guide's bubble says `text` (cheaper than searching the whole board on every step). */
const says = (text: string) => () => document.querySelector('[data-tone]')?.textContent === text;
/** A few frames: the yard takes up a new round on the frame after the round is drawn, and starts a round over on the
    first frame RESTART_MS after the miss. */
const frames = () => advance(50);

/** Round 1 done right: switch 1 sends the red train home, then the next round comes. */
function passRound1() {
  advance(100);
  fireEvent.click(switchButton(0));
  until(says('¡Bien!'));
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  frames();
}

/** Round 2 done right: switch 2 sends the yellow train home. */
function passRound2() {
  advance(100);
  key('2');
  until(says('¡Bien!'));
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  frames();
}

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  vi.mocked(playTone).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(useSettings).mockReset();
});

test('the rounds start wrong, and one tap on the right switch sends each train home', () => {
  const map = mapFor(3, false);
  const flip = (switches: readonly (0 | 1)[], i: number) => switches.map((v, j) => (j === i ? 1 - v : v) as 0 | 1);
  const [tap, moving, two] = PRACTICE_ROUNDS;

  expect(tap.trains).toEqual([{ station: 0, at: 0 }]);
  expect(destinationOf(map, tap.switches, 0)).not.toBe(0);
  expect(destinationOf(map, flip(tap.switches, 0), 0)).toBe(0);

  expect(moving.trains).toEqual([{ station: 1, at: 0 }]);
  expect(destinationOf(map, moving.switches, 0)).not.toBe(1);
  expect(destinationOf(map, flip(moving.switches, 1), 0)).toBe(1);

  // Green first, sent the wrong way; red one train interval later, at the game's level-1 pace.
  expect(two.trains).toEqual([
    { station: 2, at: 0 },
    { station: 0, at: spawnIntervalMs(1) },
  ]);
  expect(destinationOf(map, two.switches, 0)).not.toBe(2);
  expect(destinationOf(map, flip(two.switches, 1), 0)).toBe(2);
  expect(destinationOf(map, flip(flip(two.switches, 1), 0), 0)).toBe(0);
});

test('round 1: the red train waits until the switch leads it home, then arrives and the next round comes', () => {
  setup();
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();
  expect(screen.getByText(TAP)).toBeInTheDocument();
  expect(tone()).toBe('normal');
  expect(trains()).toHaveLength(1);
  expect(trains()[0].dataset.station).toBe('0');
  const waiting = locoOf(trains()[0]);

  advance(3000);
  expect(locoOf(trains()[0])).toBe(waiting);
  // Switch 2 alone still leads elsewhere: the train keeps waiting.
  key('2');
  advance(1000);
  expect(locoOf(trains()[0])).toBe(waiting);

  fireEvent.click(switchButton(0));
  advance(200);
  expect(locoOf(trains()[0])).not.toBe(waiting);
  until(says('¡Bien!'));
  expect(tone()).toBe('ok');
  expect(document.querySelector('[data-arrival="correct"]')).not.toBeNull();
  // It keeps rolling in under the station while «¡Bien!» shows.
  expect(trains()).toHaveLength(1);
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();

  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  expect(screen.getByText(MOVING)).toBeInTheDocument();
  expect(tone()).toBe('normal');
});

test('a train home in the practice shows its check mark, but no points: the practice has none', () => {
  setup();
  advance(100);
  fireEvent.click(switchButton(0));
  until(() => document.querySelector('[data-arrival="correct"]') !== null);
  const texts = [...document.querySelectorAll('[data-arrival] text')].map((t) => t.textContent);
  expect(texts.filter((text) => text?.startsWith('+'))).toEqual([]);
});

test('round 1: a train sent back the wrong way before the switch counts as a miss and the round starts over', () => {
  setup();
  advance(100);
  fireEvent.click(switchButton(0));
  advance(32);
  // Flipped back while the train is still before the switch: it takes the new way.
  fireEvent.click(switchButton(0));
  until(says(HINT_EACH));
  expect(tone()).toBe('hint');
  expect(document.querySelector('[data-arrival="wrong"]')).not.toBeNull();
  advance(RESTART_MS);
  frames();
  expect(screen.getByText('Práctica 1 de 3')).toBeInTheDocument();
  expect(options()).toEqual(PRACTICE_ROUNDS[0].switches);
  const waiting = locoOf(trains()[0]);
  advance(1000);
  expect(locoOf(trains()[0])).toBe(waiting);
});

test('round 2: left alone, the yellow train reaches the wrong station, the hint shows and the round starts over', () => {
  const { onComplete } = setup();
  passRound1();
  expect(trains()).toHaveLength(1);
  expect(trains()[0].dataset.station).toBe('1');
  expect(options()).toEqual(PRACTICE_ROUNDS[1].switches);
  // It moves on its own.
  const start = locoY(trains()[0]);
  advance(500);
  expect(locoY(trains()[0])).toBeGreaterThan(start);

  until(says(HINT_YELLOW));
  expect(tone()).toBe('hint');
  expect(document.querySelector('[data-arrival="wrong"]')).not.toBeNull();
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();

  advance(RESTART_MS);
  frames();
  // Back at the tunnel, with the switches as the round began.
  expect(trains()).toHaveLength(1);
  expect(trains()[0].dataset.station).toBe('1');
  expect(locoY(trains()[0])).toBeLessThan(80);
  expect(options()).toEqual(PRACTICE_ROUNDS[1].switches);
  expect(screen.getByText('Práctica 2 de 3')).toBeInTheDocument();
  // The hint stays up through the new try, which it is about («Inténtalo otra vez»).
  expect(says(HINT_YELLOW)()).toBe(true);
  expect(onComplete).not.toHaveBeenCalled();

  // The second try counts like the first.
  key('2');
  until(says('¡Bien!'));
  advance(PRACTICE_NEXT_MS);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  frames();
});

test('a 10 s jump between frames (the app was hidden) moves the train by one short step at most', () => {
  setup();
  passRound1();
  const before = locoY(trains()[0]);
  vi.setSystemTime(Date.now() + 10_000);
  advance(20);
  // At most 100 ms of practice time for the jump, plus a frame: 70 units a second.
  expect(trains()).toHaveLength(1);
  expect(locoY(trains()[0]) - before).toBeLessThan(10);
  expect(says(MOVING)()).toBe(true);
});

test('round 2: switch 2 flipped in time sends the yellow train home', () => {
  setup();
  passRound1();
  key('2');
  until(says('¡Bien!'));
  expect(document.querySelector('[data-arrival="correct"]')).not.toBeNull();
  expect(screen.queryByText(HINT_YELLOW)).not.toBeInTheDocument();
});

test('round 3: both trains home completes the practice once', () => {
  const { onComplete } = setup();
  passRound1();
  passRound2();
  expect(screen.getByText(TWO)).toBeInTheDocument();
  expect(trains().map((t) => t.dataset.station)).toEqual(['2']);

  key('2'); // the green train goes on to the green station
  advance(2000); // past switch 1
  key('1'); // the red one, still to come, goes to the red station
  advance(spawnIntervalMs(1) - 2000);
  expect(trains().map((t) => t.dataset.station)).toEqual(['2', '0']);

  until(() => document.querySelector('[data-arrival="correct"]') !== null);
  // The green one is home; the round waits for the red one.
  expect(screen.queryByText('¡Bien!')).not.toBeInTheDocument();
  until(says('¡Bien!'));
  expect(onComplete).not.toHaveBeenCalled();
  advance(PRACTICE_NEXT_MS);
  expect(onComplete).toHaveBeenCalledTimes(1);
  advance(5000);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('round 3: one train at the wrong station shows the hint and starts the round over', () => {
  const { onComplete } = setup();
  passRound1();
  passRound2();
  until(says(HINT_EACH));
  expect(tone()).toBe('hint');
  advance(RESTART_MS);
  frames();
  expect(trains().map((t) => t.dataset.station)).toEqual(['2']);
  expect(locoY(trains()[0])).toBeLessThan(80);
  expect(options()).toEqual(PRACTICE_ROUNDS[2].switches);
  expect(screen.getByText('Práctica 3 de 3')).toBeInTheDocument();
  // The red train comes again, one interval into the new try.
  advance(spawnIntervalMs(1) + 100);
  expect(trains().map((t) => t.dataset.station)).toEqual(['2', '0']);
  expect(onComplete).not.toHaveBeenCalled();
});

test('the switches hold still while «¡Bien!» shows and in the second before the round starts over', () => {
  setup();
  advance(100);
  fireEvent.click(switchButton(0));
  until(says('¡Bien!'));
  const home = options();
  // Not used, so the browser keeps the key.
  expect(key('1')).toBe(true);
  fireEvent.click(switchButton(1));
  expect(options()).toEqual(home);

  advance(PRACTICE_NEXT_MS);
  frames();
  until(says(HINT_YELLOW));
  const missed = options();
  expect(key('2')).toBe(true);
  fireEvent.click(switchButton(0));
  expect(options()).toEqual(missed);

  // Once the round has started over, they answer again.
  advance(RESTART_MS);
  frames();
  key('2');
  expect(options()).toEqual([PRACTICE_ROUNDS[1].switches[0], 1 - PRACTICE_ROUNDS[1].switches[1]]);
});

test('a switch clacks when it flips, but not while it holds still', () => {
  vi.mocked(useSettings).mockReturnValue(DEFAULT_SETTINGS);
  setup();
  advance(100);
  fireEvent.click(switchButton(1));
  key('2');
  const clacks = () => vi.mocked(playTone).mock.calls.filter(([kind]) => kind === 'clack').length;
  expect(clacks()).toBe(2);
  fireEvent.click(switchButton(0));
  until(says('¡Bien!'));
  expect(clacks()).toBe(3);
  // Decided: the switches hold still, and so they make no sound.
  fireEvent.click(switchButton(1));
  key('2');
  expect(clacks()).toBe(3);
  // The practice has no whistle.
  expect(playTone).not.toHaveBeenCalledWith('whistle');
});

test('the keys 1 and 2 flip the switches; a number without a switch does nothing', () => {
  setup();
  const before = options();
  key('1');
  expect(options()).toEqual([1 - before[0], before[1]]);
  key('2');
  expect(options()).toEqual([1 - before[0], 1 - before[1]]);
  // fireEvent returns false when the handler prevented the browser default.
  expect(key('3')).toBe(true);
  expect(options()).toEqual([1 - before[0], 1 - before[1]]);
});

test('«Saltar práctica» calls onSkip, and after unmount no timer nor frame is left', () => {
  const { onSkip, view } = setup();
  advance(500);
  fireEvent.click(switchButton(0));
  advance(500);
  fireEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
