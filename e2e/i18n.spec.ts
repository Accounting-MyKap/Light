import { expect, test } from '@playwright/test';

test.describe('English browser', () => {
  test.use({ locale: 'en-US' });
  test('shows the app in English', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Today’s training' })).toBeVisible();
  });

  test('shows the Quiz tab in English', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('navigation').getByRole('link', { name: 'Quiz' }).click();
    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Quiz' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'General knowledge' })).toBeVisible();
  });
});

test.describe('Spanish browser', () => {
  test.use({ locale: 'es-CO' });
  test('shows the app in Spanish', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Hoy' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Entrenamiento de hoy' })).toBeVisible();
  });
});
