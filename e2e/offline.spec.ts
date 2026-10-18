import { expect, test } from '@playwright/test';

test('keeps working offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Light' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Juegos' }).click();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5);
});
