import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectTall, freezeClock } from './helpers';

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
type GameId = (typeof GAMES)[number];

const SCREENSHOT_DIR = 'test-results/practice';

const hasNoSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** The guide's bubble (the only polite live region with a tone), and the buttons of the controls zone. */
const bubble = (page: Page) => page.locator('[data-tone]');
const controls = (page: Page) => page.locator('[data-zone="controls"] button');
/** Guardagujas has no controls zone: its controls are the switches on the board. */
const switches = (page: Page) => page.locator('[data-switch]');
const targets = (page: Page, id: GameId) => (id === 'switchyard' ? switches(page) : controls(page));
/**
 * How far down the sky each live star of Lluvia de estrellas is, in % (0 at the top, 100 on the horizon): each one
 * hangs from a rail that the sky moves with `translateY(<height>%)`.
 */
const starHeights = (page: Page) =>
  page.getByTestId('star').evaluateAll((els) =>
    els.map((el) => {
      const rail = el.closest<HTMLElement>('[data-rail]');
      return Number(/translateY\((-?[\d.]+)%\)/.exec(rail?.style.transform ?? '')?.[1]);
    }),
  );

/** Opens a game for the first time and starts its practice, in any language. */
async function openPractice(page: Page, id: GameId, startName: string | RegExp) {
  await page.goto(`./#/play/${id}`);
  await page.getByRole('button', { name: startName, exact: typeof startName === 'string' }).click();
  await expect(page.getByText(/^(Práctica|Practice) 1 (de|of) \d$/)).toBeVisible();
}

/** Waits until the practice accepts answers (Same or different and Sequence lights show something first). */
async function waitForInput(page: Page, id: GameId) {
  if (id === 'same-different') await expect(controls(page).first()).toBeEnabled();
  if (id === 'sequence-lights') await page.waitForTimeout(2 * 850 + 300); // the two-cell sequence plays once
}

/**
 * Moves the stopped page clock on `ms`, in 100 ms jumps that each draw one frame of the Guardagujas practice: the
 * largest step its clock takes in a frame, as on a slow device. runFor would draw a frame every 16 ms, six times the
 * work, which on a busy machine took longer than the tests allow.
 */
async function play(page: Page, ms: number) {
  for (let t = 0; t < ms; t += 100) await page.clock.fastForward(100);
}

/** Moves the stopped clock on as `play` does until `done`, for at most `seconds`, looking every `every` ms. */
async function playUntil(page: Page, what: string, done: () => Promise<boolean>, every: number, seconds = 15) {
  for (let t = 0; t < seconds * 1000 && !(await done()); t += every) await play(page, every);
  expect(await done(), `${what} within ${seconds} s`).toBe(true);
}

/**
 * A wrong answer in round 1 of each practice, which brings up the hint. Locale-free. Guardagujas and Sequence lights
 * need page.clock and leave it stopped, so the hint stays up for whatever the caller checks next.
 */
async function answerWrong(page: Page, id: GameId) {
  if (id === 'switchyard') {
    // Key 1 sends the waiting red train off, and back the wrong way while it is still before the switch (it gets
    // there some 370 ms after it sets off). The clock stands still between the two keys but for 100 ms, so a busy
    // machine cannot let the train past the switch first. It reaches the yellow station some seven seconds later.
    // (The minute the clock jumps as it stops is one frame to the practice, and the waiting train does not move.)
    await freezeClock(page);
    await page.keyboard.press('1');
    await page.clock.runFor(100);
    await page.keyboard.press('1');
    // The test moves the clock on to the miss: in real time a slow machine drew too few frames (the practice moves at
    // most 100 ms a frame), and the seven seconds took longer than the 15 s the check below allows.
    await playUntil(page, 'the miss', async () => (await bubble(page).getAttribute('data-tone')) === 'hint', 500);
  }
  if (id === 'arrows') await controls(page).nth(0).click(); // the middle arrow points right
  if (id === 'balance') await controls(page).nth(1).click(); // the circle is heavier: the square is wrong
  if (id === 'same-different') await controls(page).nth(0).click(); // the star is the same: «No» is wrong
  if (id === 'rule-switch') await page.getByTestId('target-right').click(); // the left card matches
  if (id === 'sequence-lights') {
    // Its hint is up for 800 ms only, then the sequence plays again: less than a busy machine can take from the tap to
    // the check below. So the tap goes in on a stopped clock (the sequence has played and the board waits for it).
    await freezeClock(page);
    await controls(page).nth(0).click(); // the sequence starts at cell 2
  }
  if (id === 'quick-math') {
    await page.keyboard.press('9');
    await page.keyboard.press('Enter'); // 2 + 3 is 5
  }
  if (id === 'star-shower') {
    await page.keyboard.press('6');
    await page.keyboard.press('Enter'); // the still star is 3 + 4
  }
  // The guide's bubble shows the hint (its tone says so in any language), not just any other message.
  await expect(bubble(page)).toHaveAttribute('data-tone', 'hint', { timeout: 15_000 });
}

/** Answers round 1 of the Arrows practice with the buttons. */
async function answerArrowsRound(page: Page, direction: 'left' | 'right') {
  await controls(page)
    .nth(direction === 'left' ? 0 : 1)
    .click();
}

/**
 * Answers Arrows practice round `n` right and checks its «¡Bien!». That shows for 700 ms only, less than a busy machine
 * can take from the click to the check, so the answer goes in on a stopped clock (the round has no timer running while
 * it asks) and the round moves on once the check is done. Needs page.clock.
 */
async function answerArrowsRight(page: Page, n: number, direction: 'left' | 'right') {
  await expect(page.getByText(`Práctica ${n} de 4`)).toBeVisible();
  await freezeClock(page);
  await answerArrowsRound(page, direction);
  await expect(bubble(page)).toHaveText('¡Bien!');
  await page.clock.resume();
}

test.describe('Arrows practice, start to finish', () => {
  test('practice, «¡Listo!», then the real game', async ({ page }) => {
    await page.clock.install(); // for the «¡Bien!» checks
    await page.goto('./#/play/arrows');
    await expect(page.getByRole('heading', { level: 1, name: 'Flechas' })).toBeVisible();
    await expect(page.getByText('Vamos a practicar un poco: sin reloj y sin puntos.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saltar práctica', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();

    // Round order in the practice: right, left, right (with distractors), left (with distractors).
    for (const [n, direction] of [
      [1, 'right'],
      [2, 'left'],
      [3, 'right'],
      [4, 'left'],
    ] as const) {
      await answerArrowsRight(page, n, direction);
    }

    await expect(page.getByRole('heading', { level: 1, name: '¡Listo! Ahora va en serio' })).toBeVisible();
    await expect(page.getByText(/^Tienes 60 segundos/)).toBeVisible();
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="arrows"]')).toBeVisible();
  });

  test('skipping the practice starts the game, and a second visit offers «Comenzar» and «¿Cómo se juega?»', async ({
    page,
  }) => {
    await page.goto('./#/play/arrows');
    await page.getByRole('button', { name: 'Saltar práctica', exact: true }).click();
    await expect(page.locator('[data-game="arrows"]')).toBeVisible();

    await page.goto('./#/games');
    await page.goto('./#/play/arrows');
    await expect(page.getByRole('button', { name: 'Comenzar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar práctica' })).toHaveCount(0);
    await page.getByRole('button', { name: '¿Cómo se juega?' }).click();
    await expect(page.getByText('Práctica 1 de 4')).toBeVisible();
    // From the intro, leaving the practice goes back to the intro.
    await page.getByRole('button', { name: 'Saltar práctica', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Comenzar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="arrows"]')).toBeVisible();
  });

  test('skipping in the middle of the practice starts the game', async ({ page }) => {
    await page.goto('./#/play/arrows');
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
    await answerArrowsRound(page, 'right');
    await expect(page.getByText('Práctica 2 de 4')).toBeVisible();
    await page.getByRole('button', { name: 'Saltar práctica', exact: true }).click();
    await expect(page.locator('[data-game="arrows"]')).toBeVisible();
  });
});

// Review Focus 3: the practice opened from the pause must not touch the paused game.
test('the practice opened from the pause leaves the paused game untouched', async ({ page }) => {
  await page.goto('./#/play/arrows');
  await page.getByRole('button', { name: 'Saltar práctica', exact: true }).click();
  await expect(page.locator('[data-game="arrows"]')).toBeVisible();

  // Two game rounds, answered right. The row is re-keyed per trial: wait for the old one to go before the next answer.
  // The game ignores an answer faster than MIN_RT_MS (150 ms) as a guess, and a fast runner clicks sooner than that, so
  // each answer waits a little first; otherwise the trial would time out and score nothing.
  for (let i = 0; i < 2; i++) {
    const row = page.getByTestId('arrows-row');
    const old = await row.elementHandle();
    const direction = await row.getAttribute('data-direction');
    await page.waitForTimeout(400);
    await controls(page)
      .nth(direction === 'left' ? 0 : 1)
      .click();
    await page.waitForFunction((el) => !el?.isConnected, old);
    await expect(row).toBeVisible();
  }

  await page.getByRole('button', { name: 'Salir del juego', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Pausado' });
  await expect(sheet).toBeVisible();
  const readSheet = async () => (await sheet.locator('dl').innerText()).replace(/\s+/g, ' ');
  const before = await readSheet();
  expect(before).toMatch(/quedan \d+ s/);
  expect(before).toMatch(/puntos \d+/);
  const pointsBefore = Number(/puntos (\d+)/.exec(before)?.[1]);
  const secondsBefore = Number(/quedan (\d+) s/.exec(before)?.[1]);
  expect(pointsBefore, 'two right answers score points').toBeGreaterThan(0);

  await sheet.getByRole('button', { name: '¿Cómo se juega?', exact: true }).click();
  const layer = page.getByRole('dialog', { name: '¿Cómo se juega?' });
  await expect(layer).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('Práctica 1 de 4')).toBeVisible();

  // These keys answer the practice (a wrong one, then a right one), never the game below.
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowLeft']) {
    await page.keyboard.press(key);
  }
  await page.waitForTimeout(4000); // a game clock that kept running would lose these seconds, and so would the countdown's

  await layer.getByRole('button', { name: 'Saltar práctica', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pausado' })).toBeVisible();
  await expect(layer).toHaveCount(0);
  expect(await readSheet()).toBe(before);

  // The sheet is only a snapshot: resume, and read the game's own HUD once the 3-2-1 is over.
  await sheet.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.locator('[data-dimmed="false"]')).toBeVisible({ timeout: 10_000 });
  const game = page.locator('[data-game="arrows"]');
  await expect(game.locator('dt', { hasText: 'Puntos' }).locator('xpath=following-sibling::dd')).toHaveText(
    String(pointsBefore),
  );
  const secondsNow = Number(await game.getByRole('progressbar', { name: 'Tiempo' }).getAttribute('aria-valuenow'));
  expect(secondsNow, 'the game clock stayed frozen during the practice and the countdown').toBeGreaterThanOrEqual(
    secondsBefore - 1,
  );
  expect(secondsNow).toBeLessThanOrEqual(secondsBefore);
});

// The quiz games have no practice: they keep the instructions, also from the pause. They share them, and the mark of
// having seen them, so the first of them stands for all 14.
test.describe('a game without a practice', () => {
  const FIRST_STEP = /^Responde 10 preguntas;/;

  test('a quiz game shows its instructions the first time, from «¿Cómo se juega?» and from the pause', async ({
    page,
  }) => {
    await page.goto('./#/play/trivia-mix');
    await expect(page.getByRole('heading', { level: 1, name: 'Mezcla de cultura general' })).toBeVisible();
    await expect(page.getByText(FIRST_STEP)).toBeVisible();
    await expect(page.getByText('Ejemplo', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saltar práctica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    const game = page.locator('[data-game="trivia-mix"]');
    await expect(game).toBeVisible();
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    // Some time off the question's clock, so the sheet's seconds are the clock's and not its start.
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Salir del juego', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Pausado' });
    const readSheet = async () => (await sheet.locator('dl').innerText()).replace(/\s+/g, ' ');
    const before = await readSheet();
    expect(before).toMatch(/quedan \d+ s/);
    const secondsBefore = Number(/quedan (\d+) s/.exec(before)?.[1]);
    expect(secondsBefore, 'the question clock was running').toBeLessThan(20);
    const buttons = await sheet.getByRole('button').allTextContents();
    expect(buttons).toEqual(['Continuar', '¿Cómo se juega?', 'Salir']);

    await sheet.getByRole('button', { name: '¿Cómo se juega?', exact: true }).click();
    const layer = page.getByRole('dialog', { name: '¿Cómo se juega?' });
    await expect(layer.getByText(FIRST_STEP)).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(layer.getByRole('button', { name: 'Comenzar', exact: true })).toHaveCount(0);
    // Both the ✕ and the main button are «Volver»; the main one is the one that says it.
    await expect(layer.getByRole('button', { name: 'Volver', exact: true })).toHaveCount(2);
    await page.waitForTimeout(3000); // a question clock that kept running would have lost these seconds
    await layer.getByRole('button', { name: 'Volver', exact: true }).filter({ hasText: 'Volver' }).click();
    await expect(sheet).toBeVisible();
    await expect(layer).toHaveCount(0);
    expect(await readSheet()).toBe(before);

    // The sheet is only a snapshot: resume, and read the game's own HUD once the 3-2-1 is over. The same question
    // is still asked, its points are the same and its clock lost no more than the moment it takes to read it.
    const pointsBefore = Number(/puntos (\d+)/.exec(before)?.[1]);
    await sheet.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('[data-dimmed="false"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    await expect(game.locator('dt', { hasText: 'Puntos' }).locator('xpath=following-sibling::dd')).toHaveText(
      String(pointsBefore),
    );
    const secondsNow = Number(await game.getByRole('progressbar', { name: 'Tiempo' }).getAttribute('aria-valuenow'));
    expect(secondsNow, 'the question clock stayed frozen during the instructions').toBeGreaterThanOrEqual(
      secondsBefore - 1,
    );
    expect(secondsNow).toBeLessThanOrEqual(secondsBefore);

    // A second visit (the address is the same, so reload): the intro, whose «¿Cómo se juega?» opens the instructions.
    await page.reload();
    const howTo = page.getByRole('button', { name: '¿Cómo se juega?', exact: true });
    await expect(howTo).toBeVisible();
    await expect(page.getByText(FIRST_STEP)).toHaveCount(0);
    await howTo.click();
    await expect(page.getByText(FIRST_STEP)).toBeVisible();
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="trivia-mix"]')).toBeVisible();
  });

  for (const [locale, names] of [
    ['es-CO', { start: 'Comenzar', pause: 'Salir del juego', howTo: '¿Cómo se juega?' }],
    ['en-US', { start: 'Start', pause: 'Quit game', howTo: 'How to play' }],
  ] as const) {
    test.describe(`narrow ${locale}`, () => {
      test.use({ locale, viewport: { width: 320, height: 640 } });

      test('the instructions in the pause do not scroll sideways', async ({ page }) => {
        await page.goto('./#/play/trivia-mix');
        await page.getByRole('button', { name: names.start, exact: true }).click();
        await expect(page.getByText(/^(Pregunta|Question) 1 (de|of) 10$/)).toBeVisible();
        await page.getByRole('button', { name: names.pause, exact: true }).click();
        await page.getByRole('button', { name: names.howTo, exact: true }).click();
        const layer = page.getByRole('dialog', { name: names.howTo });
        await expect(layer.getByRole('list')).toBeVisible();
        expect(await hasNoSidewaysScroll(page), 'the page scrolls sideways').toBe(true);
        expect(await layer.evaluate((el) => el.scrollWidth <= el.clientWidth), 'the layer scrolls sideways').toBe(true);
      });
    });
  }
});

test.describe('touch targets in the practice', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const id of GAMES) {
    test(`${id}: the controls and «Saltar práctica» are at least 44 px tall`, async ({ page }) => {
      await openPractice(page, id, 'Empezar práctica');
      await expectTall(targets(page, id));
      await expectTall(page.getByRole('button', { name: 'Saltar práctica', exact: true }));
      if (id === 'switchyard') {
        for (let i = 0; i < (await switches(page).count()); i++) {
          const box = await switches(page).nth(i).boundingBox();
          expect(box?.width ?? 0, `switch ${i + 1} width`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});

for (const [locale, startName] of [
  ['es-CO', 'Empezar práctica'],
  ['en-US', 'Start practice'],
] as const) {
  test.describe(`narrow ${locale} practices`, () => {
    test.use({ locale, viewport: { width: 320, height: 640 } });

    for (const id of GAMES) {
      test(`${id}: no sideways scroll`, async ({ page }) => {
        // Their wrong answers stop the clock: Guardagujas between two keys, Sequence lights to keep its hint up.
        if (id === 'switchyard' || id === 'sequence-lights') await page.clock.install();
        await page.goto(`./#/play/${id}`);
        await expect(page.getByRole('button', { name: startName, exact: true })).toBeVisible();
        expect(await hasNoSidewaysScroll(page), 'the intro scrolls sideways').toBe(true);

        await page.getByRole('button', { name: startName, exact: true }).click();
        await expect(page.getByText(/^(Práctica|Practice) 1 (de|of) \d$/)).toBeVisible();
        expect(await hasNoSidewaysScroll(page), 'the first round scrolls sideways').toBe(true);

        await waitForInput(page, id);
        await answerWrong(page, id);
        expect(await hasNoSidewaysScroll(page), 'the hint scrolls sideways').toBe(true);
      });
    }
  });
}

/** Grows the viewport to the page height, shoots, restores it; as in the menus spec. */
async function shot(page: Page, name: string, wait: Locator) {
  await expect(wait).toBeVisible();
  await page.mouse.move(0, 0);
  // Let the fade-ins and enters finish (looping animations, like glows, never end and are left out).
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running'),
      undefined,
      { timeout: 3000 },
    )
    .catch(() => undefined);
  // A layer over the paused game scrolls on its own, so its height counts too.
  const height = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      ...[...document.querySelectorAll('[role="dialog"]')].map((el) => el.scrollHeight),
    ),
  );
  await page.setViewportSize({ width: 390, height: Math.max(844, height) });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
}

test.describe('review screenshots', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const GUIDE = {
    'sequence-lights': /Mira qué casillas/,
    arrows: /Toca hacia dónde apunta/,
    'same-different': /¿Es igual a la anterior\?/,
    'rule-switch': /La regla dice COLOR/,
    'quick-math': /Escribe el resultado/,
  } as const;
  const HINT = {
    'sequence-lights': /Casi\. Mira otra vez/,
    arrows: /La del centro apunta a la derecha/,
    'same-different': /Antes había una estrella: es igual/,
    'rule-switch': /La regla es COLOR y el centro es azul/,
    'quick-math': /Casi: 2 \+ 3 = 5/,
  } as const;
  // Sequence lights goes last: its hint is held by freezing the clock. Guardagujas and Lluvia de estrellas have their
  // own shots below.
  const ORDER = ['arrows', 'same-different', 'rule-switch', 'quick-math', 'sequence-lights'] as const;

  test('screenshots of the practice for the owner', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    await page.clock.install({ time: new Date('2026-10-20T10:00:00') });
    for (const id of ORDER) {
      await page.goto(`./#/play/${id}`);
      if (id === 'arrows') {
        await shot(page, '1-intro', page.getByText('Vamos a practicar un poco: sin reloj y sin puntos.'));
      }
      await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
      await shot(page, `${id}-1-guide`, page.getByText(GUIDE[id]));

      await waitForInput(page, id);
      await answerWrong(page, id); // Sequence lights stops the clock here, so its hint stays up for the shot
      await shot(page, `${id}-2-hint`, page.getByText(HINT[id]));
    }
    await page.clock.resume();

    // «¡Listo!» after the Arrows practice.
    await page.goto('./#/play/arrows');
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
    for (const [n, direction] of [
      [1, 'right'],
      [2, 'left'],
      [3, 'right'],
      [4, 'left'],
    ] as const) {
      await answerArrowsRight(page, n, direction);
    }
    await shot(page, 'arrows-3-done', page.getByRole('heading', { level: 1, name: '¡Listo! Ahora va en serio' }));

    // The practice over the paused game.
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await page.getByRole('button', { name: 'Salir del juego', exact: true }).click();
    await shot(page, 'arrows-4-pause-sheet', page.getByRole('heading', { name: 'Pausado' }));
    await page.getByRole('button', { name: '¿Cómo se juega?', exact: true }).click();
    await shot(page, 'arrows-5-pause-practice', page.getByText(GUIDE.arrows));

    // The quiz games have no practice: their instructions the first time, then over the paused game.
    const firstStep = /^Responde 10 preguntas;/;
    await page.goto('./#/play/trivia-mix');
    await shot(page, 'trivia-mix-1-instructions', page.getByText(firstStep));
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    await page.getByRole('button', { name: 'Salir del juego', exact: true }).click();
    await page.getByRole('button', { name: '¿Cómo se juega?', exact: true }).click();
    await shot(page, 'trivia-mix-2-pause-instructions', page.getByRole('dialog').getByText(firstStep));
  });

  test('the Guardagujas practice from start to finish, with screenshots for the owner', async ({ page }) => {
    // Three rounds of trains, with a miss in round 2: about half a minute.
    test.setTimeout(120_000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.clock.install({ time: new Date('2026-10-20T10:00:00') });
    /** The first train's locomotive is near the tunnel, at the top of the board: for 1.1 s after it sets off, so the
        waits for it look every half second. */
    const trainAtTunnel = () =>
      page.evaluate(() => {
        const loco = document.querySelector('[data-train] [data-car="loco"]')?.getAttribute('transform') ?? '';
        return Number(/translate\(\S+ (\S+)\)/.exec(loco)?.[1] ?? Infinity) < 100;
      });
    const wrongMark = page.locator('[data-arrival="wrong"]');

    await page.goto('./#/play/switchyard');
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
    await expect(page.getByText('Práctica 1 de 3')).toBeVisible();
    await shot(page, 'switchyard-1-guide', page.getByText(/^Toca el cambio \(el círculo con flecha\)/));

    // Round 1: the red train waits until switch 1 sends it home. The next round's progress stays on screen, unlike
    // the 700 ms of «¡Bien!».
    await switches(page).nth(0).click();
    await expect(page.getByText('Práctica 2 de 3')).toBeVisible({ timeout: 15_000 });
    await expect(bubble(page)).toHaveText(/^Ahora el tren avanza solo/);

    // Round 2, left alone: the yellow train reaches the green station. From here to the last key of round 3 the clock
    // stands still and the test moves it on (see play), so the shots catch their moments and the keys go in where the
    // trains are, however slow the machine: in real time a busy test saw a train at the tunnel only after it had left.
    // The minute the stop jumps is one frame to the practice. The miss is seen at most 500 ms after the train arrives;
    // 300 ms more and it has rolled into the station, with its mark (up for 900 ms) still whole.
    await freezeClock(page);
    await playUntil(page, 'the miss', () => wrongMark.isVisible(), 500);
    await play(page, 300);
    await expect(wrongMark).toBeVisible();
    await expect(bubble(page)).toHaveText(/^El tren amarillo va a la estación amarilla/);
    await shot(page, 'switchyard-2-hint', wrongMark);

    // The round starts over with the yellow train back at the tunnel; switch 2 sends it home this time.
    await playUntil(page, 'the yellow train back at the tunnel', trainAtTunnel, 500);
    await page.keyboard.press('2');

    // Round 3 starts 700 ms after the yellow train is home («¡Bien!»). Looking once a second, the test sees «¡Bien!» or,
    // if a look jumped over it, round 3 at most 300 ms old: either way before the green train leaves the tunnel.
    const homeOrRound3 = () =>
      page.evaluate(
        () =>
          document.querySelector('[data-tone]')?.getAttribute('data-tone') === 'ok' ||
          document.body.innerText.includes('Práctica 3 de 3'),
      );
    await playUntil(page, 'the yellow train home', homeOrRound3, 1000);
    // Green goes on to green (switch 2). Once it is well past switch 1 (it gets there after 1.3 s), switch 1 turns
    // back to the left for red, which comes out 4 s into the round and reaches switch 1 at 5.3 s. After that nothing
    // depends on timing, and the rest runs in real time again.
    const round3 = page.getByText('Práctica 3 de 3');
    const round3AtTunnel = async () => (await round3.isVisible()) && (await trainAtTunnel());
    await playUntil(page, 'round 3 with the green train at the tunnel', round3AtTunnel, 500);
    await page.keyboard.press('2');
    await play(page, 2500);
    await page.keyboard.press('1');
    await page.clock.resume();
    await expect(page.locator('[data-train]')).toHaveCount(2, { timeout: 10_000 });
    await page.waitForTimeout(700); // the red locomotive out of the tunnel
    await shot(page, 'switchyard-3-two', page.getByText(/^Pueden venir varios a la vez/));

    await expect(page.getByRole('heading', { level: 1, name: '¡Listo! Ahora va en serio' })).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, 'switchyard-4-done', page.getByText(/^Tienes 90 segundos/));
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="switchyard"]')).toBeVisible();
  });

  test('the Lluvia de estrellas practice from start to finish, with screenshots for the owner', async ({ page }) => {
    // Round 2 is left alone until a star reaches the horizon (14 s of falling) before it is played right.
    test.setTimeout(120_000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.clock.install({ time: new Date('2026-10-20T10:00:00') });
    const stars = page.getByTestId('star');
    const comet = page.locator('[data-testid="star"][data-comet="true"]');
    /** Stops the page's clock: from here it only moves in the steps the test gives it. */
    const pauseClock = async () => page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 50));

    await page.goto('./#/play/star-shower');
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
    await expect(page.getByText('Práctica 1 de 3')).toBeVisible();
    await expect(stars).toHaveText(['3 + 4']);
    // The still star floats a third of the way down, and stays there.
    const [still] = await starHeights(page);
    expect(still).toBeCloseTo(100 / 3, 1);
    await shot(page, 'star-shower-1-guide', page.getByText(/^Escribe el resultado de la estrella/));
    expect(await starHeights(page)).toEqual([still]);

    // Round 1: the still star pops with 7 and Enter. The next round's progress stays on screen, unlike the 700 ms of
    // «¡Bien!».
    await page.keyboard.type('7');
    // The practice frame holds the focus but is not a control: after a key it draws no ring around the whole practice.
    const frame = bubble(page).locator('xpath=..');
    await expect(frame).toBeFocused();
    await expect(frame).toHaveCSS('outline-style', 'none');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Práctica 2 de 3')).toBeVisible();
    await expect(bubble(page)).toHaveText(/^Las estrellas caen/);

    // Round 2, left alone: the first star reaches the horizon after 14 s. The clock moves on in short steps until the
    // hint shows; the round starts over a second later, and 3.5 s on both stars are falling again under the hint.
    await pauseClock();
    for (let i = 0; i < 200 && (await bubble(page).getAttribute('data-tone')) !== 'hint'; i++) {
      await page.clock.runFor(100);
    }
    await expect(bubble(page)).toHaveText(/^Si una estrella toca el horizonte, pierdes una vida/);
    await page.clock.runFor(4500);
    await expect(stars).toHaveText(['5 + 2', '9 − 3']);
    // Both back from the top: 5 + 2 some 3.5 s down its 14 s fall, 9 − 3 born 2 s after it.
    const [first, second] = await starHeights(page);
    expect(first).toBeGreaterThan(20);
    expect(first).toBeLessThan(30);
    expect(second).toBeGreaterThan(5);
    expect(second).toBeLessThan(15);
    await expect(bubble(page)).toHaveText(/^Si una estrella toca el horizonte/);
    await shot(page, 'star-shower-2-hint', page.getByText(/^Si una estrella toca el horizonte/));
    await page.clock.resume();

    // The new try, played right: both popped.
    await page.keyboard.type('7');
    await page.keyboard.press('Enter');
    await expect(stars).toHaveText(['9 − 3']);
    await page.keyboard.type('6');
    await page.keyboard.press('Enter');

    // Round 3: two stars, then the comet a second and a half later. The shot waits until it is well inside the sky.
    await expect(page.getByText('Práctica 3 de 3')).toBeVisible();
    await pauseClock();
    for (let i = 0; i < 50 && (await comet.count()) === 0; i++) await page.clock.runFor(100);
    await page.clock.runFor(2000);
    await expect(stars).toHaveText(['8 − 5', '2 + 6', '4 + 5']);
    await shot(page, 'star-shower-3-comet', page.getByText(/^El cometa dorado revienta todas/));
    await page.clock.resume();

    // The comet pops them all, and the practice is done.
    await page.keyboard.type('9');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: '¡Listo! Ahora va en serio' })).toBeVisible();
    await shot(page, 'star-shower-4-done', page.getByText(/^Juegas hasta perder 3 vidas/));
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="star-shower"]')).toBeVisible();
    await expect(stars.first()).toBeAttached();
  });
});

test.describe('Balanza practice, start to finish', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

  test('four rounds with a hint, «¡Listo!», then the real game; screenshots for the owner', async ({ page }) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.goto('./#/play/balance');
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
    await shot(page, 'balance-1-guide', page.getByText('El lado que baja pesa más. ¿Cuál pesa más?'));

    await page.getByRole('button', { name: 'cuadrado cian' }).click();
    await shot(page, 'balance-2-hint', page.getByText('El platillo del círculo está más abajo: el círculo pesa más'));
    await page.getByRole('button', { name: 'círculo ámbar' }).click();
    await expect(bubble(page)).toHaveText('¡Bien!');

    await expect(page.getByText('Práctica 2 de 4')).toBeVisible();
    await page.getByRole('button', { name: 'círculo ámbar' }).click();
    await expect(bubble(page)).toHaveText('¡Bien!');

    await expect(page.getByText('Práctica 3 de 4')).toBeVisible();
    await shot(page, 'balance-3-tilt', page.getByText(/^Una balanza recta pesa igual/));
    await page.getByRole('button', { name: /Derecha/ }).click();
    await expect(page.locator('[data-question="true"]')).toHaveAttribute('data-outcome', 'right');
    await page.waitForTimeout(500); // the new balance has tipped
    await shot(page, 'balance-4-tipped', bubble(page));

    await expect(page.getByText('Práctica 4 de 4')).toBeVisible();
    await page.getByRole('button', { name: /Igual/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: '¡Listo! Ahora va en serio' })).toBeVisible();
    await shot(page, 'balance-5-done', page.getByText(/^Tienes 90 segundos/));
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="balance"]')).toBeVisible();
  });
});
