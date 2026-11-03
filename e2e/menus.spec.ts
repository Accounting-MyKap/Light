import { mkdirSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { finishCurrentGame } from './helpers';

const BASE_URL = 'http://localhost:4173/Light/';
const CLOCK_TIME = new Date('2026-10-20T10:00:00');
const SCREENSHOT_DIR = 'test-results/menus';
const MENUS = {
  'es-CO': [
    ['./#/', 'Entrenamiento de hoy'],
    ['./#/games', 'Juegos'],
    ['./#/progress', 'Progreso'],
    ['./#/settings', 'Ajustes'],
  ],
  'en-US': [
    ['./#/', 'Today’s training'],
    ['./#/games', 'Games'],
    ['./#/progress', 'Progress'],
    ['./#/settings', 'Settings'],
  ],
} as const;

/** The h1 of one screen. A hash change keeps the old screen's h1 for a moment, so always wait for the right one. */
const title = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });

/** True when nothing of the page sticks out sideways. */
const hasNoSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/**
 * A page of the given locale whose storage already holds one finished game. The helpers drive the Spanish UI, so the
 * game is played in an es-CO context and its storage (IndexedDB included) is carried over.
 */
async function seededPage(browser: Browser, locale: string, viewport: { width: number; height: number }) {
  const seeding = await browser.newContext({ baseURL: BASE_URL, locale: 'es-CO', viewport });
  const seed = await seeding.newPage();
  await seed.clock.install({ time: CLOCK_TIME });
  await seed.goto('./#/');
  await seed.getByRole('link', { name: 'Comenzar' }).click();
  await finishCurrentGame(seed);
  const storageState = await seeding.storageState({ indexedDB: true });
  await seeding.close();
  const context = await browser.newContext({ baseURL: BASE_URL, locale, viewport, storageState });
  const page = await context.newPage();
  await page.clock.install({ time: CLOCK_TIME });
  return { page, context };
}

/** Every meter on the page must keep a bar wide enough to read. */
async function expectMeterBars(page: Page) {
  const meters = page.getByRole('meter');
  const count = await meters.count();
  for (let i = 0; i < count; i++) {
    const box = await meters.nth(i).boundingBox();
    expect(box?.width ?? 0, `meter ${i} width`).toBeGreaterThan(40);
  }
}

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

    test('no sideways scroll on the four menus, Progress with data', async ({ browser }) => {
      const { page, context } = await seededPage(browser, locale, { width: 320, height: 640 });
      for (const [url, name] of MENUS[locale as keyof typeof MENUS]) {
        await page.goto(url);
        await expect(title(page, name)).toBeVisible();
        expect(await hasNoSidewaysScroll(page), `${url} scrolls sideways`).toBe(true);
        if (url.endsWith('/progress')) {
          await expect(page.getByRole('meter').first()).toBeVisible();
          await expectMeterBars(page);
        }
      }
      await context.close();
    });
  });
}

test.describe('large root font menus', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no sideways scroll with a 24 px root font on the four menus, Progress with data', async ({ browser }) => {
    const { page, context } = await seededPage(browser, 'es-CO', { width: 390, height: 844 });
    for (const [url, name] of MENUS['es-CO']) {
      await page.goto(url);
      await expect(title(page, name)).toBeVisible();
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '24px';
      });
      expect(await hasNoSidewaysScroll(page), `${url} scrolls sideways at 24 px`).toBe(true);
      if (url.endsWith('/progress')) {
        await expect(page.getByRole('meter').first()).toBeVisible();
        await expectMeterBars(page);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/24px-progress.png`, fullPage: true });
      }
      if (url.endsWith('/settings')) await page.screenshot({ path: `${SCREENSHOT_DIR}/24px-settings.png`, fullPage: true });
    }
    await context.close();
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

test('«Volver» on a finished free game keeps the catalog filter', async ({ page }) => {
  await page.clock.install({ time: CLOCK_TIME });
  await page.goto('./#/games');
  await page.getByRole('button', { name: 'Memoria' }).click();
  await page.getByRole('link', { name: /Secuencia de luces/ }).click();
  await finishCurrentGame(page);
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/area=memory/);
  await expect(page.getByRole('button', { name: 'Memoria' })).toHaveAttribute('aria-pressed', 'true');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} screenshots`, () => {
    test.use({ colorScheme, viewport: { width: 390, height: 844 } });

    test('screenshots of the menus for review', async ({ page }) => {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const shot = async (name: string, h1: string) => {
        await expect(title(page, h1)).toBeVisible();
        await page.mouse.move(0, 0); // no card should show its hover ring
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: 390, height: Math.max(844, height) });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${colorScheme}-${name}.png` });
        await page.setViewportSize({ width: 390, height: 844 });
      };
      await page.clock.install({ time: CLOCK_TIME });

      await page.goto('./#/');
      await shot('1-today-fresh', 'Entrenamiento de hoy');

      await page.getByRole('link', { name: 'Comenzar' }).click();
      await finishCurrentGame(page);
      // After the first game the result offers only «Siguiente juego»: go back to Today by the address.
      await page.goto('./#/');
      await expect(page.getByRole('link', { name: /Continuar/ })).toBeVisible();
      await shot('2-today-one-done', 'Entrenamiento de hoy');

      await page.goto('./#/games');
      await shot('3-games', 'Juegos');
      await page.goto('./#/progress');
      await shot('4-progress', 'Progreso');
      await page.goto('./#/settings');
      await shot('5-settings', 'Ajustes');
      await page.getByRole('button', { name: 'Borrar mis datos' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await shot('6-settings-delete', 'Ajustes');
    });
  });
}
