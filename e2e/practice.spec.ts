import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectTall } from './helpers';

const GAMES = [
  'sequence-lights',
  'arrows',
  'same-different',
  'rule-switch',
  'quick-math',
  'switchyard',
  'star-shower',
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

/** A wrong answer in round 1 of each practice, which brings up the hint. Locale-free. */
async function answerWrong(page: Page, id: GameId) {
  if (id === 'switchyard') {
    // Key 1 sends the waiting red train off, and back the wrong way while it is still before the switch (it gets
    // there some 370 ms after it sets off). It reaches the yellow station some seven seconds later.
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');
  }
  if (id === 'arrows') await controls(page).nth(0).click(); // the middle arrow points right
  if (id === 'same-different') await controls(page).nth(0).click(); // the star is the same: «No» is wrong
  if (id === 'rule-switch') await page.getByTestId('target-right').click(); // the left card matches
  if (id === 'sequence-lights') await controls(page).nth(0).click(); // the sequence starts at cell 2
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

test.describe('Arrows practice, start to finish', () => {
  test('practice, «¡Listo!», then the real game', async ({ page }) => {
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
      await expect(page.getByText(`Práctica ${n} de 4`)).toBeVisible();
      await answerArrowsRound(page, direction);
      await expect(bubble(page)).toHaveText('¡Bien!');
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
      await answerWrong(page, id);
      if (id === 'sequence-lights') {
        await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 50)); // keep the hint up
      }
      await shot(page, `${id}-2-hint`, page.getByText(HINT[id]));
    }
    await page.clock.resume();

    // «¡Listo!» after the Arrows practice.
    await page.goto('./#/play/arrows');
    await page.getByRole('button', { name: 'Empezar práctica', exact: true }).click();
    for (const direction of ['right', 'left', 'right', 'left'] as const) {
      await answerArrowsRound(page, direction);
      await expect(bubble(page)).toHaveText('¡Bien!');
      await page.waitForTimeout(800);
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
    // Three rounds of trains in real time, with a miss in round 2: about half a minute.
    test.setTimeout(120_000);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.clock.install({ time: new Date('2026-10-20T10:00:00') });
    /** The first train's locomotive is near the tunnel, at the top of the board: for about a second after it sets
        off, so the polls that wait for it look every 50 ms. */
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

    // Round 2, left alone: the yellow train reaches the green station. The clock stops here and moves on in short
    // steps until the miss, so the shot has the hint and the mark of the miss on the station.
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 50));
    for (let i = 0; i < 150 && !(await wrongMark.isVisible()); i++) await page.clock.runFor(100);
    // 400 ms more: the train has rolled into the station, and the mark (up for 900 ms) is still whole.
    await page.clock.runFor(400);
    await expect(wrongMark).toBeVisible();
    await expect(bubble(page)).toHaveText(/^El tren amarillo va a la estación amarilla/);
    await shot(page, 'switchyard-2-hint', wrongMark);
    await page.clock.resume();

    // The round starts over with the yellow train back at the tunnel; switch 2 sends it home this time.
    await expect.poll(trainAtTunnel, { intervals: [50], timeout: 5_000 }).toBe(true);
    await page.keyboard.press('2');

    // Round 3: green goes on to green (switch 2). Once it is well past switch 1 (it gets there after 1.3 s), switch
    // 1 turns back to the left for red, which comes out 4 s into the round and reaches switch 1 at 5.3 s.
    await expect(page.getByText('Práctica 3 de 3')).toBeVisible({ timeout: 15_000 });
    await expect.poll(trainAtTunnel, { intervals: [50], timeout: 5_000 }).toBe(true);
    await page.keyboard.press('2');
    await page.waitForTimeout(2500);
    await page.keyboard.press('1');
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
    await shot(page, 'star-shower-1-guide', page.getByText(/^Escribe el resultado de la estrella/));

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
    await shot(page, 'star-shower-3-comet', page.getByText(/^La estrella dorada es un cometa/));
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
