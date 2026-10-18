import { expect, test } from '@playwright/test';
import { finishCurrentGame } from './helpers';

test('completes the daily training and starts a streak', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T10:00:00') });
  await page.goto('./');
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('link', { name: 'Comenzar' }).click();

  for (let i = 0; i < 3; i++) {
    await finishCurrentGame(page);
    await page.getByRole('button', { name: /Siguiente juego|Ver resumen/ }).click();
  }

  await expect(page.getByRole('heading', { name: '¡Entrenamiento de hoy completado!' })).toBeVisible();
  await expect(page.getByText('1 día seguido')).toBeVisible();
});
