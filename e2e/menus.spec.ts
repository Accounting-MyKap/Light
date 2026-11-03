import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { finishCurrentGame } from './helpers';

const CLOCK_TIME = new Date('2026-10-20T10:00:00');
const SCREENSHOT_DIR = 'test-results/menus';
const MENUS = ['./#/', './#/games', './#/progress', './#/settings'] as const;

/** True when nothing of the page sticks out sideways. */
const hasNoSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

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

test('menu touch targets are at least 44 px', async ({ page }) => {
  await page.goto('./#/');
  await expectTall(page.getByRole('navigation').getByRole('link'));
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(4);
  await expectTall(page.getByRole('link', { name: 'Comenzar' }));

  await page.goto('./#/games');
  await expectTall(page.getByRole('group').getByRole('button'));
  await expectTall(page.locator('main a'));

  await page.goto('./#/settings');
  await expectTall(page.locator('label:has(input)'));
});

for (const locale of ['es-CO', 'en-US']) {
  test.describe(`narrow ${locale} menus`, () => {
    test.use({ locale, viewport: { width: 320, height: 640 } });

    test('no sideways scroll on the four menus', async ({ page }) => {
      for (const url of MENUS) {
        await page.goto(url);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await hasNoSidewaysScroll(page), `${url} scrolls sideways`).toBe(true);
      }
    });
  });
}

test.describe('large root font menus', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no sideways scroll with a 24 px root font', async ({ page }) => {
    for (const url of ['./#/', './#/games']) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '24px';
      });
      expect(await hasNoSidewaysScroll(page), `${url} scrolls sideways at 24 px`).toBe(true);
    }
  });
});

test('back from a game keeps the catalog filter', async ({ page }) => {
  await page.goto('./#/games');
  await page.getByRole('button', { name: 'Memoria' }).click();
  await page.getByRole('link', { name: /Secuencia de luces/ }).click();
  await expect(page).toHaveURL(/#\/play\/sequence-lights/);
  await page.getByRole('button', { name: 'Salir del juego' }).click();
  await expect(page).toHaveURL(/area=memory/);
  await expect(page.getByRole('button', { name: 'Memoria' })).toHaveAttribute('aria-pressed', 'true');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} screenshots`, () => {
    test.use({ colorScheme, viewport: { width: 390, height: 844 } });

    test('screenshots of the menus for review', async ({ page }) => {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const shot = async (name: string, fullPage = true) => {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${colorScheme}-${name}.png`, fullPage });
      };
      await page.clock.install({ time: CLOCK_TIME });

      await page.goto('./#/');
      await shot('1-today-fresh');

      await page.getByRole('link', { name: 'Comenzar' }).click();
      await finishCurrentGame(page);
      // After the first game the result offers only «Siguiente juego»: go back to Today by the address.
      await page.goto('./#/');
      await expect(page.getByRole('link', { name: /Continuar/ })).toBeVisible();
      await shot('2-today-one-done');

      await page.goto('./#/games');
      await shot('3-games');
      await page.goto('./#/progress');
      await shot('4-progress');
      await page.goto('./#/settings');
      await shot('5-settings');
      await page.getByRole('button', { name: 'Borrar mis datos' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await shot('6-settings-delete');
    });
  });
}
