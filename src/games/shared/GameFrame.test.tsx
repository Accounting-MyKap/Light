import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { initI18n } from '../../i18n';
import { FeedbackProvider, useFeedback, useFeedbackSignal, type FeedbackKind } from './feedback';
import { GameFrame, type GameFrameProps } from './GameFrame';
import { PlayChromeContext, type PlayChrome } from './playChrome';

vi.mock('../../core/sound');

beforeEach(async () => {
  await initI18n('es');
});

/** Three buttons that emit the answer reactions, the way a game does through `useFeedback`. */
function Emitter() {
  const feedback = useFeedback();
  const kinds: FeedbackKind[] = ['correct', 'wrong', 'timeout'];
  return (
    <>
      {kinds.map((kind) => (
        <button key={kind} onClick={() => feedback(kind)}>
          emit {kind}
        </button>
      ))}
    </>
  );
}

const baseProps: Omit<GameFrameProps, 'children'> = { score: 0, level: 1 };

function frame(props: Partial<GameFrameProps>, chrome: PlayChrome | null = null, withEmitter = false): ReactNode {
  return (
    <FeedbackProvider>
      <PlayChromeContext.Provider value={chrome}>
        <GameFrame {...baseProps} {...props}>
          <p>juego</p>
        </GameFrame>
        {withEmitter && <Emitter />}
      </PlayChromeContext.Provider>
    </FeedbackProvider>
  );
}

function renderFrame(props: Partial<GameFrameProps> = {}, chrome: PlayChrome | null = null, withEmitter = false) {
  const view = render(frame(props, chrome, withEmitter));
  return {
    ...view,
    update: (next: Partial<GameFrameProps>) => view.rerender(frame(next, chrome, withEmitter)),
  };
}

const flash = (container: HTMLElement) => container.querySelectorAll('[data-flash]');

test('points are a dt/dd pair whose dd holds only the number', () => {
  renderFrame({ score: 120 });
  const dt = screen.getByText('Puntos');
  expect(dt.tagName).toBe('DT');
  expect(dt.nextElementSibling?.tagName).toBe('DD');
  expect(dt.nextElementSibling?.textContent).toBe('120');
});

test('level shows as "Nivel 3"', () => {
  renderFrame({ level: 3 });
  const dt = screen.getByText('Nivel');
  expect(dt.tagName).toBe('DT');
  expect(dt.nextElementSibling?.tagName).toBe('DD');
  expect(dt.nextElementSibling?.textContent).toBe('3');
});

test('the time bar tells screen readers the seconds left', () => {
  renderFrame({ time: { remainingMs: 41_200, totalMs: 60_000 } });
  const bar = screen.getByRole('progressbar', { name: 'Tiempo' });
  expect(bar).toHaveAttribute('aria-valuetext', 'Quedan 42 segundos');
  expect(bar).toHaveAttribute('aria-valuemin', '0');
  expect(bar).toHaveAttribute('aria-valuemax', '60');
  expect(bar).toHaveAttribute('aria-valuenow', '42');
});

test('the time bar fill shrinks with the time left', () => {
  const { container } = renderFrame({ time: { remainingMs: 15_000, totalMs: 60_000 } });
  expect(container.querySelector('[role="progressbar"] > *')).toHaveStyle({ transform: 'scaleX(0.25)' });
});

test('the time bar texts follow the language', async () => {
  await initI18n('en');
  renderFrame({ time: { remainingMs: 41_200, totalMs: 60_000 } });
  expect(screen.getByRole('progressbar', { name: 'Time' })).toHaveAttribute('aria-valuetext', '42 seconds left');
});

test('the time bar says «1 segundo» in the singular and «0 segundos» at the end', async () => {
  const { update } = renderFrame({ time: { remainingMs: 700, totalMs: 60_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Queda 1 segundo');
  update({ time: { remainingMs: 0, totalMs: 60_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Quedan 0 segundos');
});

test('the time bar says «1 second left» in the singular in English', async () => {
  await initI18n('en');
  renderFrame({ time: { remainingMs: 700, totalMs: 60_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 second left');
});

test('the last 10 seconds mark the bar as urgent', () => {
  const { update } = renderFrame({ time: { remainingMs: 10_000, totalMs: 60_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'true');
  update({ time: { remainingMs: 10_001, totalMs: 60_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'false');
});

test('a game can set a shorter urgent window', () => {
  const { update } = renderFrame({ time: { remainingMs: 6_000, totalMs: 20_000, urgentMs: 5_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'false');
  update({ time: { remainingMs: 4_000, totalMs: 20_000, urgentMs: 5_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'true');
});

test('a stopped clock is never urgent, whatever time it kept', () => {
  const { update } = renderFrame({ time: { remainingMs: 4_000, totalMs: 20_000, stopped: true } });
  const bar = screen.getByRole('progressbar');
  expect(bar).toHaveAttribute('data-urgent', 'false');
  expect(bar).toHaveAttribute('aria-valuenow', '4');
  update({ time: { remainingMs: 4_000, totalMs: 20_000 } });
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-urgent', 'true');
});

test('without a time there is no time bar', () => {
  renderFrame({ rounds: { current: 1, total: 8 } });
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('rounds render as 8 dots with an accessible label', () => {
  renderFrame({ rounds: { current: 3, total: 8 } });
  const dots = screen.getByRole('list', { name: 'Ronda 3 de 8' });
  const items = Array.from(dots.querySelectorAll('li'));
  expect(items).toHaveLength(8);
  expect(items.map((item) => item.dataset.state)).toEqual([
    'done',
    'done',
    'now',
    'pending',
    'pending',
    'pending',
    'pending',
    'pending',
  ]);
});

test('a score change floats the real difference; no change floats nothing', () => {
  const { update } = renderFrame({ score: 0 });
  expect(screen.queryByText(/^[+−]\d/)).toBeNull();

  update({ score: 10 });
  const gain = screen.getByText('+10');
  expect(gain).toHaveAttribute('aria-hidden', 'true');
  expect(gain.closest('dd')).toBeNull();
  expect(screen.getByText('Puntos').nextElementSibling?.textContent).toBe('10');

  update({ score: 0 });
  expect(screen.queryByText('+10')).toBeNull();
  expect(screen.getByText('−10')).toBeInTheDocument();

  // The same score again is not a change: the float that is already there is left alone, not restarted.
  const loss = screen.getByText('−10');
  update({ score: 0 });
  expect(screen.getByText('−10')).toBe(loss);
});

test('a level change alone does not float anything', () => {
  const { update } = renderFrame({ score: 10, level: 1 });
  update({ score: 10, level: 2 });
  expect(screen.queryByText(/^[+−]\d/)).toBeNull();
});

test('two quick changes keep only the latest float', () => {
  const { update } = renderFrame({ score: 0 });
  update({ score: 10 });
  update({ score: 30 });
  expect(screen.getByText('+20')).toBeInTheDocument();
  expect(screen.queryByText('+10')).toBeNull();
  expect(screen.getAllByText(/^[+−]\d/)).toHaveLength(1);
});

test('feedback signals draw a flash of their kind and restart on each one', async () => {
  const { container } = renderFrame({}, null, true);
  expect(flash(container)).toHaveLength(0);

  await userEvent.click(screen.getByRole('button', { name: 'emit correct' }));
  expect(container.querySelectorAll('[data-flash="correct"]')).toHaveLength(1);
  const first = container.querySelector('[data-flash]');
  expect(first).toHaveAttribute('aria-hidden', 'true');

  // The same kind twice in a row is a new element, so its animation starts over.
  await userEvent.click(screen.getByRole('button', { name: 'emit correct' }));
  const second = container.querySelector('[data-flash]');
  expect(flash(container)).toHaveLength(1);
  expect(second).not.toBe(first);

  await userEvent.click(screen.getByRole('button', { name: 'emit wrong' }));
  expect(flash(container)).toHaveLength(1);
  expect(container.querySelectorAll('[data-flash="wrong"]')).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'emit timeout' }));
  expect(flash(container)).toHaveLength(1);
  expect(container.querySelectorAll('[data-flash="timeout"]')).toHaveLength(1);
});

test('a game that draws its own reactions can turn the flash off', async () => {
  const { container } = renderFrame({ stageFlash: false }, null, true);
  await userEvent.click(screen.getByRole('button', { name: 'emit correct' }));
  await userEvent.click(screen.getByRole('button', { name: 'emit timeout' }));
  expect(flash(container)).toHaveLength(0);
});

test("a game's keyed child never collides with the flash: its old copies are removed, not piled up", async () => {
  // Like Arrows: one child keyed by a counter that moves in step with the signal ids, so the child and the
  // flash would both be keyed 1, 2, 3... if they were siblings in the same list.
  function KeyedGame() {
    const key = useFeedbackSignal()?.id ?? 0;
    return (
      <GameFrame {...baseProps}>
        <p key={key} data-testid="row">
          fila {key}
        </p>
      </GameFrame>
    );
  }
  const { container } = render(
    <FeedbackProvider>
      <Emitter />
      <KeyedGame />
    </FeedbackProvider>,
  );
  const stage = container.querySelector('[data-zone="stage"]') as HTMLElement;
  expect(screen.getAllByTestId('row')).toHaveLength(1);

  for (const name of ['emit correct', 'emit wrong', 'emit correct', 'emit timeout', 'emit correct']) {
    await userEvent.click(screen.getByRole('button', { name }));
    expect(screen.getAllByTestId('row')).toHaveLength(1);
    // The stage holds the game's one element and the one flash, nothing left over.
    expect(stage.children).toHaveLength(2);
    expect(flash(container)).toHaveLength(1);
  }
  expect(screen.getByTestId('row')).toHaveTextContent('fila 5');
});

test('a reaction left over from before the frame mounted is not replayed', async () => {
  // The frame is mounted by a button while the provider (and its last signal) stays put, like a game
  // that starts again inside the same game screen.
  function Restart() {
    const [started, setStarted] = useState(false);
    return (
      <>
        <button onClick={() => setStarted(true)}>start</button>
        {started && (
          <GameFrame {...baseProps}>
            <p>juego</p>
          </GameFrame>
        )}
      </>
    );
  }
  const { container } = render(
    <FeedbackProvider>
      <Emitter />
      <Restart />
    </FeedbackProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'emit wrong' }));
  await userEvent.click(screen.getByRole('button', { name: 'start' }));
  expect(screen.getByText('juego')).toBeInTheDocument();
  expect(flash(container)).toHaveLength(0);

  await userEvent.click(screen.getByRole('button', { name: 'emit timeout' }));
  expect(container.querySelectorAll('[data-flash="timeout"]')).toHaveLength(1);
});

describe('the shake of a wrong answer', () => {
  const animate = vi.fn();

  function setReducedMotion(reduce: boolean | null) {
    if (reduce === null) {
      Reflect.deleteProperty(window, 'matchMedia');
    } else {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => ({ matches: reduce })),
        configurable: true,
      });
    }
  }

  beforeEach(() => {
    animate.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    setReducedMotion(false);
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    setReducedMotion(null);
  });

  test('shakes the game zone sideways once, without remounting its children', async () => {
    renderFrame({}, null, true);
    const child = screen.getByText('juego');
    await userEvent.click(screen.getByRole('button', { name: 'emit wrong' }));
    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.contexts[0]).toBe(child.parentElement);
    const [keyframes, options] = animate.mock.calls[0] as [Array<{ transform: string }>, { duration: number }];
    expect(keyframes.map((frame) => frame.transform)).toEqual([
      'translateX(0px)',
      'translateX(-12px)',
      'translateX(12px)',
      'translateX(-8px)',
      'translateX(8px)',
      'translateX(0px)',
    ]);
    expect(options.duration).toBe(350);
    expect(screen.getByText('juego')).toBe(child);
  });

  test('a right answer or a timeout does not shake', async () => {
    renderFrame({}, null, true);
    await userEvent.click(screen.getByRole('button', { name: 'emit correct' }));
    await userEvent.click(screen.getByRole('button', { name: 'emit timeout' }));
    expect(animate).not.toHaveBeenCalled();
  });

  test('does not shake when the person asked for reduced motion', async () => {
    setReducedMotion(true);
    renderFrame({}, null, true);
    await userEvent.click(screen.getByRole('button', { name: 'emit wrong' }));
    expect(animate).not.toHaveBeenCalled();
  });

  test('does not shake when the browser cannot tell about motion preferences', async () => {
    setReducedMotion(null);
    renderFrame({}, null, true);
    await userEvent.click(screen.getByRole('button', { name: 'emit wrong' }));
    expect(animate).not.toHaveBeenCalled();
  });

  test('without element.animate a wrong answer still draws its flash and nothing breaks', async () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    const { container } = renderFrame({}, null, true);
    await userEvent.click(screen.getByRole('button', { name: 'emit wrong' }));
    expect(container.querySelectorAll('[data-flash="wrong"]')).toHaveLength(1);
  });
});

describe('with a play chrome', () => {
  const onPause = vi.fn();
  const reportHud = vi.fn();
  const chrome: PlayChrome = { title: 'Flechas', onPause, reportHud };

  beforeEach(() => {
    onPause.mockReset();
    reportHud.mockReset();
  });

  test('it shows the title and a pause button, and reports the hud', async () => {
    renderFrame({ score: 120, level: 3, time: { remainingMs: 41_200, totalMs: 60_000 } }, chrome);
    expect(screen.getByRole('heading', { name: 'Flechas' })).toBeInTheDocument();
    expect(screen.getByText('Nivel').nextElementSibling?.textContent).toBe('3');
    await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
    expect(onPause).toHaveBeenCalledOnce();
    expect(reportHud).toHaveBeenCalledWith({ score: 120, remainingMs: 41_200 });
  });

  test('it reports again only when the score or the time left change', () => {
    const { update } = renderFrame({ score: 0, level: 1, time: { remainingMs: 50_000, totalMs: 60_000 } }, chrome);
    expect(reportHud).toHaveBeenCalledTimes(1);

    update({ score: 0, level: 2, time: { remainingMs: 50_000, totalMs: 60_000 } });
    expect(reportHud).toHaveBeenCalledTimes(1);

    update({ score: 10, level: 2, time: { remainingMs: 50_000, totalMs: 60_000 } });
    expect(reportHud).toHaveBeenLastCalledWith({ score: 10, remainingMs: 50_000 });
    update({ score: 10, level: 2, time: { remainingMs: 49_900, totalMs: 60_000 } });
    expect(reportHud).toHaveBeenLastCalledWith({ score: 10, remainingMs: 49_900 });
    expect(reportHud).toHaveBeenCalledTimes(3);
  });

  test('a game without a clock reports no time left', () => {
    renderFrame({ score: 5, rounds: { current: 1, total: 8 } }, chrome);
    expect(reportHud).toHaveBeenCalledExactlyOnceWith({ score: 5, remainingMs: null });
  });
});

test('without a chrome there is no title and no pause button', () => {
  renderFrame({ score: 120, level: 3 });
  expect(screen.queryByRole('button', { name: 'Salir del juego' })).toBeNull();
  expect(screen.queryByRole('heading')).toBeNull();
  expect(screen.getByText('juego')).toBeInTheDocument();
});

test('the controls sit below the game zone', () => {
  const { container } = render(
    <FeedbackProvider>
      <GameFrame {...baseProps} controls={<button>Izquierda</button>}>
        <p>juego</p>
      </GameFrame>
    </FeedbackProvider>,
  );
  const game = screen.getByText('juego');
  const controls = screen.getByRole('button', { name: 'Izquierda' });
  expect(game.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.querySelector('[data-flash]')).toBeNull();
});

test('the game zone and the controls are marked, so a game can tell where its pieces sit', () => {
  const { container } = render(
    <FeedbackProvider>
      <GameFrame {...baseProps} controls={<button>Izquierda</button>}>
        <p>juego</p>
      </GameFrame>
    </FeedbackProvider>,
  );
  const stage = container.querySelector('[data-zone="stage"]');
  const controls = container.querySelector('[data-zone="controls"]');
  expect(stage).toContainElement(screen.getByText('juego'));
  expect(controls).toContainElement(screen.getByRole('button', { name: 'Izquierda' }));
  expect(stage).not.toContainElement(screen.getByRole('button', { name: 'Izquierda' }));
});

test('without controls there is no controls zone', () => {
  const { container } = renderFrame();
  expect(container.querySelector('[data-zone="stage"]')).not.toBeNull();
  expect(container.querySelector('[data-zone="controls"]')).toBeNull();
});
