import { expect, test, type Locator } from '@playwright/test';

async function expectTall(targets: Locator) {
  await expect(targets.first()).toBeVisible(); // the app renders after an async bootstrap
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const target = targets.nth(i);
    const box = await target.boundingBox();
    expect(box?.height ?? 0, `${await target.textContent()} height`).toBeGreaterThanOrEqual(44);
  }
}

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
    await page.getByRole('button', { name: 'Comenzar' }).click();
    // Arrows: «Izquierda» and «Derecha». Quick Math: the whole keypad and «Saltar».
    await expectTall(page.locator('[data-game] [data-zone="controls"] button'));
  }
});

test('track switches are at least 44 px wide and tall, even on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./#/play/switchyard');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  const switches = page.locator('[data-game] [data-switch]');
  await expectTall(switches);
  for (let i = 0; i < (await switches.count()); i++) {
    const box = await switches.nth(i).boundingBox();
    expect(box?.width ?? 0, `switch ${i + 1} width`).toBeGreaterThanOrEqual(44);
  }
});
