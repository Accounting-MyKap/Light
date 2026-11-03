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

test('quiz controls are at least 44 px tall on a 320 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });

  await page.goto('./#/quiz');
  await expectTall(page.getByRole('navigation').getByRole('link'));
  await expectTall(page.locator('main').getByRole('link')); // the game cards

  await page.goto('./#/play/trivia-history');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
  await expectTall(page.getByRole('button', { name: /^Opción \d: / })); // the options
  await expectTall(page.getByRole('button', { name: 'No sé' }));

  await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
  await page.getByRole('button', { name: /^Opción 1: / }).click();
  await expectTall(page.getByRole('button', { name: 'Siguiente' }));
});

test('after «Siguiente» the new question starts in view on a 320 × 568 screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); // an instant scroll, so the checks need not wait for it
  await page.goto('./#/play/trivia-history');
  await page.getByRole('button', { name: 'Comenzar' }).click();

  for (let n = 1; n <= 5; n++) {
    await expect(page.getByText(`Pregunta ${n} de 10`)).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeInViewport({ ratio: 1 });
    await expect(page.getByText('Puntos', { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
    await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
    await page.getByRole('button', { name: /^Opción 1: / }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }
});

for (const width of [320, 360, 375, 430]) {
  test(`no tab label overflows its column on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto('./');
    // Pin a phone-like font (Arial metrics): the CI fallback for system-ui (DejaVu Sans) is far wider than any phone font.
    await page.addStyleTag({ content: 'nav a { font-family: "Liberation Sans", Arial, sans-serif !important; }' });
    await page.evaluate(() => document.fonts.ready);
    const links = page.getByRole('navigation').getByRole('link');
    await expect(links).toHaveCount(5);

    const measures = await links.evaluateAll((els) =>
      els.map((el) => ({
        label: el.textContent,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        left: el.getBoundingClientRect().left,
        right: el.getBoundingClientRect().right,
      })),
    );
    for (const m of measures) {
      expect(m.scrollWidth, `${m.label} fits its tab`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.left, `${m.label} starts on screen`).toBeGreaterThanOrEqual(0);
      expect(m.right, `${m.label} ends on screen`).toBeLessThanOrEqual(width);
    }
    // Equal columns: no label made its track wider than the others.
    const widths = measures.map((m) => m.clientWidth);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });
}
