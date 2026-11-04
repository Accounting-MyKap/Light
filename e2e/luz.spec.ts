import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { finishRunningGame, startGame } from './helpers';

const GAMES = [
  'sequence-lights',
  'arrows',
  'same-different',
  'rule-switch',
  'quick-math',
  'switchyard',
  'star-shower',
  'balance',
] as const;
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

/** Answers `count` Star Shower stars correctly: reads the first star's sum, types its result and presses Enter. */
async function solveStarShower(page: Page, count: number): Promise<void> {
  const stars = page.getByTestId('star');
  const answer = page.getByTestId('answer');
  for (let i = 0; i < count; i++) {
    await expect(stars.first()).toBeVisible();
    const result = String(solve((await stars.first().textContent()) ?? ''));
    await page.keyboard.type(result);
    await expect(answer).toHaveText(result);
    await page.keyboard.press('Enter');
    await expect(answer).toHaveText('?');
  }
}

/** Waits until at least one live star is fully inside the sky, so a screenshot shows one. */
async function waitForStarInSky(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const sky = await page.locator('[data-zone="stage"]').boundingBox();
      const stars = page.getByTestId('star');
      for (let i = 0, n = await stars.count(); i < n; i++) {
        const box = await stars.nth(i).boundingBox();
        if (sky && box && box.y >= sky.y && box.y + box.height <= sky.y + sky.height) return true;
      }
      return false;
    })
    .toBe(true);
}

/**
 * Answers `count` Balanza challenges correctly: each one is read once it accepts answers (past the 150 ms guard),
 * and the next is waited for (the answered one stays up while its buttons are marked).
 */
async function solveBalance(page: Page, count: number): Promise<void> {
  const marked = page.locator('[data-game] [data-state]');
  for (let i = 0; i < count; i++) {
    await expect(marked).toHaveCount(0);
    await page.waitForTimeout(250);
    const answer = await page.getByTestId('balance-challenge').getAttribute('data-answer');
    await page.locator(`[data-game] [data-choice="${answer}"]`).click();
    await expect(marked.first()).toBeVisible();
  }
  await expect(marked).toHaveCount(0);
}

/** Opens Balanza at the given start level, by setting it in the local database first. */
async function openBalanceAt(page: Page, level: number): Promise<void> {
  await page.goto('./#/games');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(
    (startLevel) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('light');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('gameLevels', 'readwrite');
          tx.objectStore('gameLevels').put({ gameId: 'balance', startLevel });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    level,
  );
  await page.goto('./#/play/balance');
  await startGame(page);
  await expect(page.getByTestId('balance-challenge')).toBeVisible();
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
  if (id === 'star-shower') return solveStarShower(page, 3);
  if (id === 'balance') return solveBalance(page, 3);
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
      // First visit: the practice invitation, or the instructions with their example for the game without a
      // practice (Lluvia de estrellas).
      const first =
        id === 'star-shower'
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

test.describe('Star Shower at 320 px', () => {
  test.use({ locale: 'en-US', viewport: { width: 320, height: 640 } });

  test('Star Shower at level 10 keeps its longest sums inside the sky at 320 px', async ({ page }) => {
    await page.goto('./#/games');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('light');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('gameLevels', 'readwrite');
            tx.objectStore('gameLevels').put({ gameId: 'star-shower', startLevel: 10 });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );

    await page.goto('./#/play/star-shower');
    await page.getByRole('button', { name: 'Start' }).click();
    const stars = page.getByTestId('star');
    await expect(stars).toHaveCount(3, { timeout: 15_000 });
    // A star is born above the sky and comes down anchored by its bottom edge, so wait until the newest one has
    // fully entered before looking at the boxes.
    const stage = page.locator('[data-zone="stage"]');
    await expect
      .poll(async () => {
        const sky = await stage.boundingBox();
        const newest = await stars.last().boundingBox();
        return newest !== null && sky !== null && newest.y >= sky.y;
      })
      .toBe(true);
    const sky = await stage.boundingBox();
    expect(sky).not.toBeNull();
    const count = await stars.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const box = await stars.nth(i).boundingBox();
      const text = await stars.nth(i).textContent();
      expect(text, `star ${i} is a level-10 sum`).toMatch(/^\d+ \+ \d+ × \d+$/);
      expect(box, `star ${i} «${text}»`).not.toBeNull();
      expect(box!.x, `«${text}» left edge`).toBeGreaterThanOrEqual(sky!.x);
      expect(box!.y, `«${text}» top edge`).toBeGreaterThanOrEqual(sky!.y);
      expect(box!.x + box!.width, `«${text}» right edge`).toBeLessThanOrEqual(sky!.x + sky!.width);
      expect(box!.y + box!.height, `«${text}» bottom edge`).toBeLessThanOrEqual(sky!.y + sky!.height);
    }
    expect(await hasNoSidewaysScroll(page)).toBe(true);
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

test.describe('Star Shower on short phones', () => {
  // iPhone SE in Safari, a 360×640 Android in Chrome and a 320×568 phone: the visible height under the browser bars.
  const SHORT_PHONES = [
    { width: 375, height: 548 },
    { width: 360, height: 560 },
    { width: 320, height: 568 },
  ];

  for (const viewport of SHORT_PHONES) {
    test(`Star Shower fits ${viewport.width}×${viewport.height} without scrolling`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('./#/play/star-shower');
      await page.getByRole('button', { name: 'Comenzar' }).click();
      await expect(page.locator('[data-game]')).toBeVisible();
      await expect(page.getByTestId('star').first()).toBeAttached();

      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      const controls = {
        pause: page.locator('[data-game]').getByRole('button', { name: 'Salir del juego' }),
        ok: page.locator('[data-game]').getByRole('button', { name: 'OK' }),
      };
      for (const [name, control] of Object.entries(controls)) {
        const box = await control.boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.y, `${name} top edge`).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height);
      }
      // The keys are shorter here, but never under the 44 px touch minimum.
      const keys = page.locator('[data-game] [data-zone="controls"] button');
      await expect(keys).toHaveCount(12);
      for (const key of await keys.all()) expect((await key.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
  }
});

test.describe('review screenshots', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

  test('screenshots of the training games for review', async ({ page }) => {
    // Eight games one after the other, Guardagujas with two trains sent home first: more than the default 90 s.
    test.setTimeout(300_000);
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
      if (id === 'star-shower') await waitForStarInSky(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${id}-play.png` });

      await finishRunningGame(page);
      // Wait for the count-up to land (and the celebration to settle) before looking at it.
      await expect(page.getByTestId('result-score')).toHaveText(String(await announcedScore(page)));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/${id}-result.png` });
    }
  });
});

test.describe('Balanza on short phones', () => {
  const SHORT_PHONES = [
    { width: 375, height: 548 },
    { width: 320, height: 568 },
  ];

  for (const viewport of SHORT_PHONES) {
    // Level 4 has the most figure buttons (5), level 10 the tallest scene (3 clues and the new balance).
    for (const level of [4, 10]) {
      test(`Balanza at level ${level} fits ${viewport.width}×${viewport.height} without scrolling`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openBalanceAt(page, level);
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
        expect(await hasNoSidewaysScroll(page)).toBe(true);
        const buttons = page.locator('[data-game] [data-zone="controls"] button');
        await expect(buttons).toHaveCount(level === 4 ? 5 : 3);
        for (const button of await buttons.all()) {
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        }
        // The whole scene is on screen, above the question.
        const scene = (await page.getByTestId('balance-challenge').locator('svg').first().boundingBox())!;
        const prompt = (await page.getByText(/^¿(Cuál pesa más|Hacia dónde se inclina)\?$/).boundingBox())!;
        expect(scene.y).toBeGreaterThanOrEqual(0);
        expect(scene.y + scene.height).toBeLessThanOrEqual(prompt.y);
      });
    }
  }
});

test.describe('level-up notice', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

  test('four right answers in a row in Balanza bring up «¡Nivel 2!»', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await openBalanceAt(page, 1);
    const badge = page.getByTestId('level-up');
    const marked = page.locator('[data-game] [data-state]');
    for (let i = 0; i < 4; i++) {
      await expect(marked).toHaveCount(0);
      await page.waitForTimeout(250);
      const answer = await page.getByTestId('balance-challenge').getAttribute('data-answer');
      await page.locator(`[data-game] [data-choice="${answer}"]`).click();
    }
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('¡Nivel 2!');
    await expect(page.locator('[data-game]').getByText('Nivel', { exact: true }).locator('xpath=..')).toContainText('2');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/balance-level-up.png` });
    // It never takes a tap: the controls under it still answer.
    await expect(badge).toHaveCSS('pointer-events', 'none');
    await expect(badge).toBeHidden({ timeout: 3_000 });
  });
});
