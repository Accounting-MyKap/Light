import { expect, test } from '@playwright/test';
import { finishQuizRound } from './helpers';

test('plays a quiz round from the Quiz tab to the review', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('link', { name: 'Preguntas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Preguntas' })).toBeVisible();
  await page.getByRole('link', { name: /^Historia/ }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();

  await finishQuizRound(page);

  await expect(page.getByRole('button', { name: 'Jugar de nuevo' })).toBeVisible();
  // The review section is always shown; whether it lists errors depends on which option 1 happened to be.
  await expect(page.getByRole('heading', { name: 'Repasa tus errores' })).toBeVisible();

  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/#\/quiz$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Preguntas' })).toBeVisible();
});

test('a quiz round works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Light' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Preguntas' }).click();
  // A category the player never opened online: its bank chunk has to come from the precache.
  await page.getByRole('link', { name: /^Ciencias/ }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
});
