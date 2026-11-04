import { expect, test } from '@playwright/test';
import { expectTall, startGame } from './helpers';

test('settings controls are at least 44 px tall', async ({ page }) => {
  await page.goto('./#/settings');
  await expectTall(page.locator('main').locator('select, button, label:has(input)'));
});

test('the way back from a missing game is at least 44 px tall', async ({ page }) => {
  await page.goto('./#/play/nope');
  await expectTall(page.getByRole('link', { name: 'Volver al inicio' }));
});

test('game controls are at least 44 px tall', async ({ page }) => {
  for (const id of ['arrows', 'quick-math', 'star-shower']) {
    await page.goto(`./#/play/${id}`);
    await startGame(page);
    // Arrows: «Izquierda» and «Derecha». Quick Math: the whole keypad and «Saltar». Lluvia de estrellas: its keypad.
    await expectTall(page.locator('[data-game] [data-zone="controls"] button'));
  }
});

test('track switches are at least 44 px wide and tall, even on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('./#/play/switchyard');
  await startGame(page);
  const switches = page.locator('[data-game] [data-switch]');
  await expectTall(switches);
  for (let i = 0; i < (await switches.count()); i++) {
    const box = await switches.nth(i).boundingBox();
    expect(box?.width ?? 0, `switch ${i + 1} width`).toBeGreaterThanOrEqual(44);
  }
});

test('track switches never overlap, even at level 10 on a short landscape phone', async ({ page }) => {
  // 640 × 360 leaves a board about 140 px wide, where 44 px buttons on the closest switches (110 of 360 board units
  // apart on the 7-station map) would cover each other: a tap meant for one could flip its neighbor.
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('./#/games');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('light');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('gameLevels', 'readwrite');
          tx.objectStore('gameLevels').put({ gameId: 'switchyard', startLevel: 10 });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto('./#/play/switchyard');
  await startGame(page);
  const switches = page.locator('[data-game] [data-switch]');
  // Level 10 brings the 7-station map, with its 6 switches.
  await expect(switches).toHaveCount(6);
  await expect(page.locator('[data-game] [role="group"]')).toBeVisible();
  const boxes = await switches.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const n = Number(el.getAttribute('data-switch')) + 1;
      return { n, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  );
  for (const a of boxes) {
    for (const b of boxes) {
      if (a.n >= b.n) continue;
      const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      expect(overlap, `switches ${a.n} and ${b.n}: ${JSON.stringify([a, b])}`).toBe(false);
    }
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

test('the five tab icons stay in one row and labels stay whole on one line: 320 px screen, 24 px root font', async ({ page }) => {
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
  // The labels grow with the root font only as far as their column allows, so none wraps («Pregun-tas» before).
  for (const t of tabs) expect(t.lines, `${t.label} is on one line`).toBe(1);
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

// A word split over two lines (hyphenated or not) looks broken, so no word on a tab screen may do that.
for (const locale of ['es', 'en'] as const) {
  test.describe(`no word broken across lines or spilling out of its box: 320 px screen, ${locale}`, () => {
    test.use({ locale });
    for (const rootPx of [16, 24]) {
      test(`${rootPx} px root font`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        const broken: string[] = [];
        for (const [name, url] of TAB_ROUTES) {
          await page.goto(url);
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate((px) => {
            document.documentElement.style.fontSize = `${px}px`;
          }, rootPx);
          await page.waitForTimeout(100);
          const found = await page.evaluate(() => {
            const out: string[] = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              const parent = n.parentElement;
              if (!parent || !parent.closest('main, nav')) continue;
              if (parent.closest('script, style, .visually-hidden') || parent.getClientRects().length === 0) continue;
              const text = n.textContent ?? '';
              for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
                const range = document.createRange();
                range.setStart(n, m.index!);
                range.setEnd(n, m.index! + m[0].length);
                const rects = [...range.getClientRects()].filter((r) => r.width > 0);
                const tops = new Set(rects.map((r) => Math.round(r.top)));
                // One line's rects share a top; a split word has tops a line apart.
                if (rects.length > 1 && Math.max(...tops) - Math.min(...tops) > 3) {
                  out.push(`«${m[0]}» split in <${parent.tagName.toLowerCase()} class="${parent.className}">`);
                  continue;
                }
                // A whole word must also stay inside the box of its nearest non-inline ancestor.
                let box: HTMLElement = parent;
                while (getComputedStyle(box).display === 'inline' && box.parentElement) box = box.parentElement;
                const b = box.getBoundingClientRect();
                if (rects.some((r) => r.left < b.left - 0.5 || r.right > b.right + 0.5)) {
                  out.push(`«${m[0]}» spills out of <${box.tagName.toLowerCase()} class="${box.className}">`);
                }
              }
            }
            // A select must be wide enough to show its whole selected option.
            const ctx = document.createElement('canvas').getContext('2d')!;
            for (const sel of document.querySelectorAll('main select, nav select')) {
              const el = sel as HTMLSelectElement;
              if (el.getClientRects().length === 0) continue;
              const cs = getComputedStyle(el);
              ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
              const need = ctx.measureText(el.selectedOptions[0]?.text ?? '').width;
              const have = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
              // The native arrow takes room too, so the content box must exceed the text, not just match it.
              if (have < need) out.push(`select «${el.selectedOptions[0]?.text}» is clipped: ${have.toFixed(1)} px for ${need.toFixed(1)} px of text`);
            }
            return out;
          });
          for (const f of found) broken.push(`${name}: ${f}`);
        }
        expect(broken, `${locale} ${rootPx}px`).toEqual([]);
      });
    }
  });
}
