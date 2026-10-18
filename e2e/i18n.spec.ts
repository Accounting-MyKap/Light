import { expect, test } from '@playwright/test';

test.describe('English browser', () => {
  test.use({ locale: 'en-US' });
  test('shows the app in English', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Today' })).toBeVisible();
    await expect(page.getByText('Light up your brain')).toBeVisible();
  });
});

test.describe('Spanish browser', () => {
  test.use({ locale: 'es-CO' });
  test('shows the app in Spanish', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Hoy' })).toBeVisible();
    await expect(page.getByText('Ilumina tu cerebro')).toBeVisible();
  });
});
