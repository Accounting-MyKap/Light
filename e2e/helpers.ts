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
