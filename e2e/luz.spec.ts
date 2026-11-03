import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { finishRunningGame, startGame } from './helpers';

const GAMES = ['sequence-lights', 'arrows', 'same-different', 'rule-switch', 'quick-math', 'switchyard'] as const;
const CLOCK_TIME = new Date('2026-10-20T10:00:00');
const LUZ_BACKGROUND = 'rgb(9, 11, 25)'; // #090b19
const SCREENSHOT_DIR = 'test-results/luz';

/** True when nothing of the page sticks out sideways. */
const hasNoSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Solves a two-number Quick Math problem as the game writes it («7 − 3»). */
function solve(problem: string): number {
  const [, a, op, b] = /^(\d+) ([+−×÷]) (\d+)$/.exec(problem) ?? [];
  expect(op, `«${problem}» is a two-number problem`).toBeDefined();
  const [x, y] = [Number(a), Number(b)];
  return { '+': x + y, '−': x - y, '×': x * y, '÷': x / y }[op as '+' | '−' | '×' | '÷'];
}

/**
 * Answers `count` Quick Math problems correctly, so the game ends with a score above zero. A fresh install starts
 * at level 1 and a few right answers lift it to 2 and 3, which only add and subtract two numbers. Returns once
 * the last answer was taken.
 */
async function solveQuickMath(page: Page, count: number): Promise<void> {
  const problem = page.getByTestId('problem');
  const answer = page.getByTestId('answer');
  for (let i = 0; i < count; i++) {
    const result = String(solve((await problem.textContent()) ?? ''));
    await page.keyboard.type(result);
    await expect(answer).toHaveText(result);
    await page.keyboard.press('Enter');
    // The answer box empties in the same render that brings the next problem.
    await expect(answer).toHaveText('?');
  }
}

/** Answers `count` Cambio de regla trials correctly: the card that matches the stimulus in the current rule. */
async function solveRuleSwitch(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const rule = await page.getByTestId('rule-banner').getAttribute('data-rule');
    const attribute = `data-${rule}`;
    const wanted = await page.getByTestId('stimulus').getAttribute(attribute);
    await page.locator(`[data-testid^="target-"][${attribute}="${wanted}"]`).click();
  }
}

/** Points every switch on the way to the station of the oldest train on the board. */
async function routeOldestTrain(page: Page): Promise<void> {
  await page.evaluate(() => {
    const train = document.querySelector('[data-train]');
    if (!train) return;
    const station = document.querySelector(`[data-station-id="${train.getAttribute('data-station')}"]`);
    for (const step of station?.getAttribute('data-route')?.split(' ').filter(Boolean) ?? []) {
      const [sw, option] = step.split(':');
      const button = document.querySelector<HTMLButtonElement>(`[data-switch="${sw}"]`);
      if (button && button.dataset.option !== option) button.click();
    }
  });
}

/** Sends trains home until `count` of them made it, so Guardagujas has points on the board. */
async function playSwitchyard(page: Page, count: number): Promise<void> {
  const score = page.locator('[data-game] dd').last();
  for (let i = 0; i < 600 && Number(await score.textContent()) < count * 10; i++) {
    await routeOldestTrain(page);
    await page.waitForTimeout(50);
  }
  expect(Number(await score.textContent())).toBeGreaterThanOrEqual(count * 10);
}

/**
 * A few answers, so the screens have a score and an accuracy worth looking at. Same or different gets a few taps
 * instead of right answers (its previous symbol is not on the page); Sequence Lights is left to the helper.
 */
async function answerSome(page: Page, id: (typeof GAMES)[number]): Promise<void> {
  if (id === 'sequence-lights') return;
  if (id === 'switchyard') return playSwitchyard(page, 2);
  if (id === 'quick-math') return solveQuickMath(page, 4);
  if (id === 'rule-switch') return solveRuleSwitch(page, 6);
  const buttons = page.locator('[data-game] [data-zone="controls"] button');
  if (id === 'arrows') {
    // «Izquierda» is the first button, «Derecha» the second: tap the one the center arrow points to.
    for (let i = 0; i < 6; i++) {
      const direction = await page.getByTestId('arrows-row').getAttribute('data-direction');
      await buttons.nth(direction === 'left' ? 0 : 1).click();
    }
    return;
  }
  for (let i = 0; i < 6; i++) await buttons.nth(i % 2).click();
}

/** The score that screen readers get on the result screen («Puntaje: N»). */
async function announcedScore(page: Page): Promise<number> {
  const text = (await page.getByText(/^Puntaje: \d+$/).textContent()) ?? '';
  return Number(/\d+/.exec(text)?.[0]);
}

test.describe('light app theme', () => {
  test.use({ colorScheme: 'light' });

  test('games are dark even when the app is light', async ({ page }) => {
    const themeColor = page.locator('meta[name="theme-color"]');
    const html = page.locator('html');

    await page.goto('./#/games');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The app itself is light here: its background is not the dark one.
    await expect(page.locator('body')).not.toHaveCSS('background-color', LUZ_BACKGROUND);
    await expect(html).not.toHaveAttribute('data-luz-active', /.*/);
    await expect(themeColor).toHaveAttribute('content', '#090b19');

    await page.goto('./#/play/arrows');
    await expect(page.locator('[data-luz]')).toHaveCSS('background-color', LUZ_BACKGROUND);
    await expect(html).toHaveAttribute('data-luz-active', '');
    await expect(themeColor).toHaveAttribute('content', '#090b19');

    await page.goto('./#/games');
    await expect(page.locator('[data-luz]')).toHaveCount(0);
    await expect(html).not.toHaveAttribute('data-luz-active', /.*/);
    await expect(themeColor).toHaveAttribute('content', '#090b19');
  });
});

test.describe('narrow English screen', () => {
  test.use({ locale: 'en-US', viewport: { width: 320, height: 640 } });

  // Review Focus #3
  test('no sideways scroll at 320 px in English', async ({ page }) => {
    for (const id of GAMES) {
      await page.goto(`./#/play/${id}`);
      // First visit: the practice invitation, or the instructions with their example for Guardagujas, which has no
      // practice.
      const first =
        id === 'switchyard'
          ? page.getByRole('button', { name: 'Start', exact: true })
          : page.getByRole('button', { name: 'Skip practice', exact: true });
      await expect(first, `${id} first visit`).toBeVisible();
      expect(await hasNoSidewaysScroll(page), `${id} first visit scrolls sideways`).toBe(true);

      await first.click();
      await expect(page.locator('[data-game]'), `${id} playing`).toBeVisible();
      expect(await hasNoSidewaysScroll(page), `${id} in play scrolls sideways`).toBe(true);
    }
  });
});

test.describe('reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: CLOCK_TIME });
  });

  // Review Focus #5
  test('reduced motion shows the final score at once', async ({ page }) => {
    await page.goto('./#/play/quick-math');
    await startGame(page);
    await expect(page.locator('[data-game]')).toBeVisible();
    // From here the page's time only moves when the test moves it, and only in small steps once the game is about to
    // end. Otherwise the seconds still left on the clock when the result appears would let a count-up finish by
    // itself, and this test would pass without reduced motion.
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100));
    await solveQuickMath(page, 5);
    await page.clock.runFor(55_000);
    const playAgain = page.getByRole('button', { name: 'Jugar de nuevo' });
    for (let i = 0; i < 300 && !(await playAgain.isVisible()); i++) await page.clock.runFor(100);
    await expect(playAgain).toBeVisible();

    // Read straight away, with no waiting: the animated count-up (frozen near 0 here) would still be on its way.
    const announced = await announcedScore(page);
    expect(announced).toBeGreaterThan(0);
    expect(await page.getByTestId('result-score').textContent()).toBe(String(announced));
  });
});

test.describe('result at a large root font size', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Ledger Ruling L12
  test('a new best at 390 px with a 24 px root font does not scroll sideways', async ({ page }) => {
    await page.clock.install({ time: CLOCK_TIME });
    await page.goto('./#/play/quick-math');
    await page.addStyleTag({ content: 'html { font-size: 24px !important }' });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('24px');

    await startGame(page);
    await expect(page.locator('[data-game]')).toBeVisible();
    await solveQuickMath(page, 5);
    expect(await hasNoSidewaysScroll(page), 'the game scrolls sideways').toBe(true);
    await finishRunningGame(page);

    // The first play of a game is always a new best.
    await expect(page.locator('[data-celebrate="true"]')).toBeAttached();
    // Rays and sparks keep moving for a while (CSS animations ignore the fake clock): look at several moments.
    for (let i = 0; i < 12; i++) {
      expect(await hasNoSidewaysScroll(page), `the result scrolls sideways (sample ${i})`).toBe(true);
      await page.waitForTimeout(150);
    }
  });
});

test.describe('arrows rows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Regression lock for the final review's Critical finding: in a session's first game the signal id equaled the trial
  // count, two siblings shared a key, and every answer left one more old row in the page, pushing the buttons away.
  test('Arrows keeps a single row after many answers and its buttons stay on screen', async ({ page }) => {
    await page.goto('./#/play/arrows');
    await startGame(page);
    await expect(page.locator('[data-game]')).toBeVisible();
    const rows = page.getByTestId('arrows-row');
    const buttons = page.locator('[data-game] [data-zone="controls"] button');
    await expect(rows).toHaveCount(1);

    for (let i = 0; i < 8; i++) {
      await buttons.nth(i % 2).click();
      await expect(rows, `rows after answer ${i + 1}`).toHaveCount(1);
    }

    const viewportHeight = page.viewportSize()?.height ?? 0;
    for (let i = 0; i < 2; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect((box?.y ?? Infinity) + (box?.height ?? 0), `button ${i} bottom edge`).toBeLessThanOrEqual(viewportHeight);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  });
});

test.describe('review screenshots', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

  test('screenshots of the six games for review', async ({ page }) => {
    // Six games one after the other, Guardagujas with two trains sent home first: more than the default 90 s.
    test.setTimeout(180_000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.clock.install({ time: CLOCK_TIME });

    for (const id of GAMES) {
      await page.goto(`./#/play/${id}`);
      await startGame(page);
      const game = page.locator('[data-game]');
      await expect(game).toBeVisible();
      if (id === 'sequence-lights') {
        // A cell is lit for 600 ms at a time, far longer than the wait polls.
        await expect(game.locator('[data-lit="true"]').first()).toBeVisible();
      } else if (id === 'switchyard') {
        // A game in progress: two trains home, with smoke and the next trains on the way.
        await answerSome(page, id);
        await page.waitForTimeout(300);
      } else {
        // Same or different shows its symbol first, with the answers off; wait for them, then let the trial settle.
        await expect(game.locator('[data-zone="controls"] button').first()).toBeEnabled();
        await page.waitForTimeout(1000);
        // The play screenshot shows a game in progress: a few answers in, with points on the board.
        await answerSome(page, id);
        if (id === 'arrows') await expect(page.getByTestId('arrows-row')).toHaveCount(1);
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${id}-play.png` });

      await finishRunningGame(page);
      // Wait for the count-up to land (and the celebration to settle) before looking at it.
      await expect(page.getByTestId('result-score')).toHaveText(String(await announcedScore(page)));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${id}-result.png` });
    }
  });
});
