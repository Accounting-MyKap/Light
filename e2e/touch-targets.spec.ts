import { test } from '@playwright/test';
import { expectTall, startGame } from './helpers';

test('settings controls are at least 44 px tall', async ({ page }) => {
  await page.goto('./#/settings');
  await expectTall(page.locator('main').locator('select, button, label:has(input)'));
});

test('the way back from a missing game is at least 44 px tall', async ({ page }) => {
  await page.goto('./#/play/nope');
  await expectTall(page.getByRole('link', { name: 'Volver al inicio' }));
});

test('game controls are at least 44 px tall', async ({ page }) => {
  for (const id of ['arrows', 'quick-math']) {
    await page.goto(`./#/play/${id}`);
    await startGame(page);
    // Arrows: «Izquierda» and «Derecha». Quick Math: the whole keypad and «Saltar».
    await expectTall(page.locator('[data-game] [data-zone="controls"] button'));
  }
});
