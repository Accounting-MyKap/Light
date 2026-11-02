import { expect, type Page } from '@playwright/test';

const RESULT_BUTTON = /Siguiente juego|Ver resumen|Jugar de nuevo/;

/** Plays whichever game is open until its result screen appears. Requires page.clock to be installed. */
export async function finishCurrentGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Comenzar' }).click();
  const root = page.locator('[data-game]');
  await expect(root).toBeVisible();
  const id = await root.getAttribute('data-game');
  await page.waitForTimeout(200); // let the game register its timers before moving the clock
  const result = page.getByRole('button', { name: RESULT_BUTTON });

  if (id === 'sequence-lights') {
    // Each round ends after at most two presses on cell 1 (a sequence never repeats a cell back to back).
    for (let i = 0; i < 40 && !(await result.isVisible()); i++) {
      await page.clock.runFor(15_000);
      await page.waitForTimeout(50);
      if (await result.isVisible()) break;
      await page.getByRole('button', { name: 'Casilla 1' }).click();
      await page.waitForTimeout(50);
    }
  } else {
    await page.clock.runFor(61_000);
  }
  await expect(result).toBeVisible();
}

const QUIZ_ROUND_LENGTH = 10;

/**
 * Plays the open quiz round to its result screen, always picking option 1. The wait before each tap is longer than
 * MIN_RT_MS (150 ms): the app ignores an answer given right after a question appears.
 */
export async function finishQuizRound(page: Page): Promise<void> {
  for (let n = 1; n <= QUIZ_ROUND_LENGTH; n++) {
    await expect(page.getByText(`Pregunta ${n} de ${QUIZ_ROUND_LENGTH}`)).toBeVisible();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /^1 / }).click();
    await page.getByRole('button', { name: n === QUIZ_ROUND_LENGTH ? 'Ver resultado' : 'Siguiente' }).click();
  }
}
