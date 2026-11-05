import { expect, type Locator, type Page } from '@playwright/test';

const RESULT_BUTTON = /Siguiente juego|Ver resumen|Jugar de nuevo/;

/** Plays whichever game is open until its result screen appears. Requires page.clock to be installed. */
export async function finishCurrentGame(page: Page): Promise<void> {
  await startGame(page);
  await finishRunningGame(page);
}

/**
 * Starts the open game from its intro: on a first visit by skipping the practice, afterwards with «Comenzar».
 * The names are exact, so «Comenzar» never matches anything longer.
 */
export async function startGame(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Saltar práctica', exact: true });
  const start = page.getByRole('button', { name: 'Comenzar', exact: true });
  await expect(skip.or(start)).toBeVisible();
  if (await skip.isVisible()) await skip.click();
  else await start.click();
}

/**
 * Stops the installed page clock, which runs on in real time until then. pauseAt needs a time still ahead of the
 * page's own clock when the call lands, and the page reads its time, hands it to the test and gets the pause back
 * while that clock keeps going: on a busy machine that took 130 to 490 ms, past the 50 or 100 ms the tests used to
 * aim ahead («Cannot fast-forward to the past»). So the pause aims a minute ahead, and each timer due in that minute
 * fires once, at the end of it. Call it only at a moment when no such timer changes what the test checks next.
 */
export async function freezeClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 60_000));
}

/** Every control of the list must be at least 44 px tall. */
export async function expectTall(targets: Locator): Promise<void> {
  await expect(targets.first()).toBeVisible(); // the app renders after an async bootstrap
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const target = targets.nth(i);
    const box = await target.boundingBox();
    expect(box?.height ?? 0, `${await target.textContent()} height`).toBeGreaterThanOrEqual(44);
  }
}

/** Same, for a game that is already running (its «Comenzar» was pressed). */
export async function finishRunningGame(page: Page): Promise<void> {
  const root = page.locator('[data-game]');
  await expect(root).toBeVisible();
  const id = await root.getAttribute('data-game');
  await page.waitForTimeout(200); // let the game register its timers before moving the clock
  const result = page.getByRole('button', { name: RESULT_BUTTON });

  if (id === 'sequence-lights') {
    // Each round ends after at most two presses on cell 1 (a sequence never repeats a cell back to back). Move the
    // clock until the board waits for a press («Tu turno»: it then holds still until one comes) or, after the last
    // round, the result is up (it comes after a save that may take a while). A press aimed at a board that is about to
    // go would wait for its cell until the test times out.
    const yourTurn = page.locator('[data-game]').getByText('Tu turno', { exact: true });
    const playOn = async () => {
      await page.clock.runFor(15_000);
      return (await result.isVisible()) || (await yourTurn.isVisible());
    };
    for (let i = 0; i < 40; i++) {
      await expect.poll(playOn).toBe(true);
      if (await result.isVisible()) break;
      await page.getByRole('button', { name: 'Casilla 1' }).click();
    }
  } else {
    // Guardagujas lasts 90 seconds; the other timed games 60. Lluvia de estrellas has no clock: left alone it
    // loses its 3 lives in about 30 seconds, so 61 seconds always reach its result.
    // A jump, not runFor: runFor fires every animation frame of the game one by one and waits a real timer tick
    // (at least 4 ms) after each, so 91 s of Guardagujas took 24 s even on an idle machine and over a minute on a busy
    // one. The game clocks read Date, and the engines catch up on a jump (Guardagujas counts the trains that arrive
    // after its last frame, Lluvia de estrellas lands every star that is due), so each due timer firing once at the
    // end gives the same result screen.
    await page.clock.fastForward(id === 'switchyard' ? 91_000 : 61_000);
  }
  await expect(result).toBeVisible();
}

const QUIZ_ROUND_LENGTH = 10;

/**
 * Plays the open quiz round to its result screen, always picking option 1. The wait before each tap is longer than
 * MIN_RT_MS (150 ms): the app ignores an answer given right after a question appears. «Siguiente» is matched exactly:
 * an option («Opción N: …») stays a button after the answer and its text may contain the word.
 */
export async function finishQuizRound(page: Page): Promise<void> {
  for (let n = 1; n <= QUIZ_ROUND_LENGTH; n++) {
    await expect(page.getByText(`Pregunta ${n} de ${QUIZ_ROUND_LENGTH}`)).toBeVisible();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /^Opción 1: / }).click();
    await page.getByRole('button', { name: n === QUIZ_ROUND_LENGTH ? 'Ver resultado' : 'Siguiente', exact: true }).click();
  }
}
