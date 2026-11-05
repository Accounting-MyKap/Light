import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectTall, freezeClock } from './helpers';

const GAMES = ['sequence-lights', 'arrows', 'same-different', 'rule-switch', 'quick-math', 'switchyard'] as const;
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

// Lluvia de estrellas and the quiz games have no practice: they keep the instructions, also from the pause.
test.describe('a game without a practice', () => {
  const FIRST_STEP = /^Caen estrellas con operaciones\./;

  test('Lluvia de estrellas shows its instructions the first time, from «¿Cómo se juega?» and from the pause', async ({
    page,
  }) => {
    await page.goto('./#/play/star-shower');
    await expect(page.getByRole('heading', { level: 1, name: 'Lluvia de estrellas' })).toBeVisible();
    await expect(page.getByText(FIRST_STEP)).toBeVisible();
    await expect(page.getByText('Ejemplo', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saltar práctica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    const game = page.locator('[data-game="star-shower"]');
    await expect(game).toBeVisible();
    const stars = game.getByTestId('star');
    await expect(stars.first()).toBeVisible();

    await page.getByRole('button', { name: 'Salir del juego', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Pausado' });
    const readSheet = async () => (await sheet.locator('dl').innerText()).replace(/\s+/g, ' ');
    // The game has no clock: the stars, frozen where they were, show that it stays paused. A star falls through the
    // sky in 9 s, some 11 % a second, so 2 s of falling would move it far more than the half percent allowed for
    // the last frame drawn before the pause.
    // Each star hangs from a rail that the game moves with `translateY(<height>%)` (0 at the top of the sky, 100 on
    // the horizon); read that height.
    const readStars = () =>
      stars.evaluateAll((els) =>
        els.map((el) => {
          const rail = el.closest<HTMLElement>('[data-rail]');
          return Number(/translateY\((-?[\d.]+)%\)/.exec(rail?.style.transform ?? '')?.[1]);
        }),
      );
    const before = await readSheet();
    const starsBefore = await readStars();
    expect(starsBefore.length).toBeGreaterThan(0);
    starsBefore.forEach((height, i) => expect(Number.isFinite(height), `star ${i + 1} has a readable height`).toBe(true));
    const buttons = await sheet.getByRole('button').allTextContents();
    expect(buttons).toEqual(['Continuar', '¿Cómo se juega?', 'Salir']);

    await sheet.getByRole('button', { name: '¿Cómo se juega?', exact: true }).click();
    const layer = page.getByRole('dialog', { name: '¿Cómo se juega?' });
    await expect(layer.getByText(FIRST_STEP)).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(layer.getByRole('button', { name: 'Comenzar', exact: true })).toHaveCount(0);
    // Both the ✕ and the main button are «Volver»; the main one is the one that says it.
    await expect(layer.getByRole('button', { name: 'Volver', exact: true })).toHaveCount(2);
    await page.waitForTimeout(2000); // stars that kept falling would have moved by now
    await layer.getByRole('button', { name: 'Volver', exact: true }).filter({ hasText: 'Volver' }).click();
    await expect(sheet).toBeVisible();
    await expect(layer).toHaveCount(0);
    expect(await readSheet()).toBe(before);
    const starsAfter = await readStars();
    expect(starsAfter).toHaveLength(starsBefore.length);
    starsAfter.forEach((top, i) =>
      expect(Math.abs(top - starsBefore[i]), `star ${i + 1} stayed where it was during the instructions`).toBeLessThan(0.5),
    );

    // The sheet is only a snapshot: resume, and read the game's own HUD once the 3-2-1 is over.
    const pointsBefore = Number(/puntos (\d+)/.exec(before)?.[1]);
    await sheet.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('[data-dimmed="false"]')).toBeVisible({ timeout: 10_000 });
    await expect(game.locator('dt', { hasText: 'Puntos' }).locator('xpath=following-sibling::dd')).toHaveText(
      String(pointsBefore),
    );

    // A second visit (the address is the same, so reload): the intro, whose «¿Cómo se juega?» opens the instructions.
    await page.reload();
    const howTo = page.getByRole('button', { name: '¿Cómo se juega?', exact: true });
    await expect(howTo).toBeVisible();
    await expect(page.getByText(FIRST_STEP)).toHaveCount(0);
    await howTo.click();
    await expect(page.getByText(FIRST_STEP)).toBeVisible();
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await expect(page.locator('[data-game="star-shower"]')).toBeVisible();
  });

  for (const [locale, names] of [
    ['es-CO', { start: 'Comenzar', pause: 'Salir del juego', howTo: '¿Cómo se juega?' }],
    ['en-US', { start: 'Start', pause: 'Quit game', howTo: 'How to play' }],
  ] as const) {
    test.describe(`narrow ${locale}`, () => {
      test.use({ locale, viewport: { width: 320, height: 640 } });

      test('the instructions in the pause do not scroll sideways', async ({ page }) => {
        await page.goto('./#/play/star-shower');
        await page.getByRole('button', { name: names.start, exact: true }).click();
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
  // Sequence lights goes last: its hint is held by freezing the clock. Guardagujas has its own shots below.
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

    // Lluvia de estrellas has no practice: its instructions the first time, then over the paused game.
    const firstStep = /^Caen estrellas con operaciones\./;
    await page.goto('./#/play/star-shower');
    await shot(page, 'star-shower-1-instructions', page.getByText(firstStep));
    await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
    await page.getByRole('button', { name: 'Salir del juego', exact: true }).click();
    await page.getByRole('button', { name: '¿Cómo se juega?', exact: true }).click();
    await shot(page, 'star-shower-2-pause-instructions', page.getByRole('dialog').getByText(firstStep));
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
});
