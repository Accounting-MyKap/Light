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

test('quiz controls are at least 44 px tall on a 320 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });

  await page.goto('./#/quiz');
  await expectTall(page.getByRole('navigation').getByRole('link'));
  await expectTall(page.locator('main').getByRole('link')); // the game cards

  await page.goto('./#/play/trivia-history');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
  await expectTall(page.getByRole('button', { name: /^Opción \d: / })); // the options
  await expectTall(page.getByRole('button', { name: 'No sé', exact: true }));

  await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
  await page.getByRole('button', { name: /^Opción 1: / }).click();
  await expectTall(page.getByRole('button', { name: 'Siguiente', exact: true }));
});

test('after «Siguiente» the new question starts in view on a 320 × 568 screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); // an instant scroll, so the checks need not wait for it
  await page.goto('./#/play/trivia-history');
  await page.getByRole('button', { name: 'Comenzar' }).click();

  for (let n = 1; n <= 5; n++) {
    await expect(page.getByText(`Pregunta ${n} de 10`)).toBeVisible();
    // The top of the game frame: the ✕, the level and the time bar.
    await expect(page.locator('[data-game]').getByRole('button', { name: 'Salir del juego' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByText('Nivel', { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('progressbar')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
    await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
    await page.getByRole('button', { name: /^Opción 1: / }).click();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
});

test('the five tab icons stay in one row when labels wrap: 320 px screen, 24 px root font', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  const links = page.getByRole('navigation').getByRole('link');
  await expect(links).toHaveCount(5);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '24px';
  });

  const tabs = await links.evaluateAll((els) =>
    els.map((el) => {
      const tab = el.getBoundingClientRect();
      const label = el.querySelector('span')!;
      const box = label.getBoundingClientRect();
      return {
        label: el.textContent,
        iconTop: el.querySelector('svg')!.getBoundingClientRect().top,
        lines: Math.round(box.height / parseFloat(getComputedStyle(label).lineHeight)),
        inside: box.left >= tab.left - 0.5 && box.right <= tab.right + 0.5 && el.scrollWidth <= el.clientWidth,
      };
    }),
  );
  // The case at stake: here some labels wrap to two lines («Pregun-tas») and «Hoy» does not.
  expect(tabs.some((t) => t.lines > 1), JSON.stringify(tabs)).toBe(true);
  expect(tabs.some((t) => t.lines === 1), JSON.stringify(tabs)).toBe(true);
  const tops = tabs.map((t) => t.iconTop);
  expect(Math.max(...tops) - Math.min(...tops), JSON.stringify(tabs)).toBeLessThanOrEqual(1);
  // Still tall enough, each label inside its own column, and the bar no wider than the screen.
  await expectTall(links);
  for (const t of tabs) expect(t.inside, `${t.label} stays in its tab`).toBe(true);
  const bar = await page.getByRole('navigation').evaluate((nav) => ({ scroll: nav.scrollWidth, client: nav.clientWidth }));
  expect(bar.scroll).toBeLessThanOrEqual(bar.client);
  expect(bar.client).toBeLessThanOrEqual(320);
});

for (const width of [320, 360, 375, 430]) {
  test(`every tab label fits its column on one line on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto('./');
    // The app font (Sora) is bundled, so this measures what a phone shows.
    await page.evaluate(() => document.fonts.ready);
    const links = page.getByRole('navigation').getByRole('link');
    await expect(links).toHaveCount(5);
    await expectTall(links);

    const measures = await links.evaluateAll((els) =>
      els.map((el) => {
        const label = el.querySelector('span')!;
        return {
          label: el.textContent,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          left: el.getBoundingClientRect().left,
          right: el.getBoundingClientRect().right,
          labelHeight: label.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(label).lineHeight),
        };
      }),
    );
    for (const m of measures) {
      expect(m.scrollWidth, `${m.label} fits its tab`).toBeLessThanOrEqual(m.clientWidth);
      // A label may wrap only with a large root font: at the default size every label is one line.
      expect(m.labelHeight, `${m.label} is on one line`).toBeLessThan(1.5 * m.lineHeight);
      expect(m.left, `${m.label} starts on screen`).toBeGreaterThanOrEqual(0);
      expect(m.right, `${m.label} ends on screen`).toBeLessThanOrEqual(width);
    }
    // Equal columns: no label made its track wider than the others.
    const widths = measures.map((m) => m.clientWidth);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });
}

const TAB_ROUTES: Array<[string, string]> = [
  ['Hoy', './#/'],
  ['Juegos', './#/games'],
  ['Preguntas', './#/quiz'],
  ['Progreso', './#/progress'],
  ['Ajustes', './#/settings'],
];

for (const rootPx of [16, 24]) {
  test(`no sideways scroll on any tab: 320 px screen, ${rootPx} px root font`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const [name, url] of TAB_ROUTES) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((px) => {
        document.documentElement.style.fontSize = `${px}px`;
      }, rootPx);
      await page.waitForTimeout(100);
      const m = await page.evaluate(() => {
        const vw = window.innerWidth;
        const wide = [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((el) => el.getBoundingClientRect().right > vw + 0.5)
          .slice(0, 5)
          .map((el) => `${el.tagName}.${el.className}`);
        return { scroll: document.documentElement.scrollWidth, vw, wide };
      });
      expect(m.scroll, `${name}: ${JSON.stringify(m.wide)}`).toBeLessThanOrEqual(m.vw);
    }
  });
}
