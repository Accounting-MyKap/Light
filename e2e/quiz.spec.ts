import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { finishQuizRound, startGame } from './helpers';

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
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Hoy' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Preguntas' }).click();
  // A category the player never opened online: its bank chunk has to come from the precache.
  await page.getByRole('link', { name: /^Ciencias/ }).click();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
});

test('after a pause the focus goes back to the question, or to «Siguiente» once it is answered', async ({ page }) => {
  await page.goto('./#/play/trivia-history');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
  const prompt = page.getByRole('heading', { level: 2 });
  const next = page.getByRole('button', { name: 'Siguiente', exact: true });
  // Every element that takes the focus. On the way back from the pause the play region must never have it: a screen
  // reader would announce the name of the region before the question.
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { focusLog: string[] }).focusLog = log;
    document.addEventListener('focusin', (event) => {
      const target = event.target as Element;
      log.push(target.matches('[data-game]') ? 'play region' : (target.textContent ?? '').slice(0, 40));
    });
  });
  const takeFocusLog = () => page.evaluate(() => (window as unknown as { focusLog: string[] }).focusLog.splice(0));
  // The ✕ opens the pause sheet; «Continuar» starts the 3-2-1 (three 1 s steps), and then the game runs again.
  const pauseAndResume = async () => {
    await page.locator('[data-game]').getByRole('button', { name: 'Salir del juego' }).click();
    await takeFocusLog();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Pausado')).toBeHidden();
  };

  await expect(prompt).toBeFocused();
  await pauseAndResume();
  await expect(prompt).toBeFocused({ timeout: 6000 });
  expect(await takeFocusLog()).not.toContain('play region');

  await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
  await page.getByRole('button', { name: /^Opción 1: / }).click();
  await expect(next).toBeFocused();
  await pauseAndResume();
  await expect(next).toBeFocused({ timeout: 6000 });
  expect(await takeFocusLog()).not.toContain('play region');
});

test('a training game puts the focus nowhere of its own, so after a pause it comes back to the play region', async ({
  page,
}) => {
  for (const id of ['arrows', 'switchyard']) {
    await page.goto(`./#/play/${id}`);
    await startGame(page);
    const game = page.locator(`[data-game="${id}"]`);
    await game.getByRole('button', { name: 'Salir del juego' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Pausado')).toBeHidden();
    await expect(game, id).toBeFocused({ timeout: 6000 });
  }
});

const LUZ_BACKGROUND = 'rgb(9, 11, 25)'; // #090b19
const CORAL = 'rgb(255, 123, 69)'; // trivia, #ff7b45
const SKY = 'rgb(51, 153, 255)'; // accounting, #3399ff

test.describe('the quiz in the Luz style', () => {
  test.use({ colorScheme: 'light' });

  test('a quiz game is dark and wears the color of its bank, even when the app is light', async ({ page }) => {
    await page.goto('./#/play/trivia-history');
    await expect(page.locator('[data-luz][data-area="trivia"]')).toHaveCSS('background-color', LUZ_BACKGROUND);
    await expect(page.getByRole('button', { name: 'Comenzar' })).toHaveCSS('background-color', CORAL);
    await expect(page.getByText('Cultura general', { exact: true })).toBeVisible(); // the area label of the intro

    await page.goto('./#/play/accounting-mix');
    await expect(page.locator('[data-luz][data-area="accounting"]')).toHaveCSS('background-color', LUZ_BACKGROUND);
    await expect(page.getByRole('button', { name: 'Comenzar' })).toHaveCSS('background-color', SKY);

    // The Quiz tab stays in the app theme.
    await page.goto('./#/quiz');
    await expect(page.getByRole('heading', { level: 1, name: 'Preguntas' })).toBeVisible();
    await expect(page.locator('[data-luz]')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('background-color', LUZ_BACKGROUND);
  });
});

test.describe('the quiz on a narrow English screen', () => {
  test.use({ locale: 'en-US', viewport: { width: 320, height: 640 } });

  test('no sideways scroll while asking and after an answer', async ({ page }) => {
    const noSidewaysScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    for (const id of ['trivia-mix', 'accounting-mix']) {
      await page.goto(`./#/play/${id}`);
      await page.getByRole('button', { name: 'Start' }).click();
      await expect(page.getByText('Question 1 of 10')).toBeVisible();
      expect(await noSidewaysScroll(), `${id} asking`).toBe(true);
      await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
      await page.getByRole('button', { name: /^Option 1: / }).click();
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
      expect(await noSidewaysScroll(), `${id} feedback`).toBe(true);
    }
  });
});

test.describe('quiz review screenshots', () => {
  test.use({ viewport: { width: 360, height: 740 }, colorScheme: 'dark' });

  test('the instructions, a question while asking, its feedback, a wrong answer, and the result with the review', async ({ page }) => {
    const dir = 'test-results/luz';
    mkdirSync(dir, { recursive: true });
    await page.goto('./#/play/trivia-mix');
    await expect(page.getByText('Ejemplo', { exact: true })).toBeVisible(); // first visit: the instructions
    await page.screenshot({ path: `${dir}/quiz-intro.png`, fullPage: true });
    await page.getByRole('button', { name: 'Comenzar' }).click();

    // Always option 1. The first feedback is shot whatever it was; the first wrong one too, to show both marks.
    let wrongShot = false;
    for (let n = 1; n <= 10; n++) {
      await expect(page.getByText(`Pregunta ${n} de 10`)).toBeVisible();
      await page.waitForTimeout(n === 1 ? 1500 : 200); // past MIN_RT_MS; for the shot, a little time off the bar
      if (n === 1) await page.screenshot({ path: `${dir}/quiz-asking.png` });
      await page.getByRole('button', { name: /^Opción 1: / }).click();
      const next = page.getByRole('button', { name: n === 10 ? 'Ver resultado' : 'Siguiente', exact: true });
      await expect(next).toBeFocused();
      if (n === 1) {
        await page.waitForTimeout(700); // let the flash fade
        await page.screenshot({ path: `${dir}/quiz-feedback.png` });
      }
      if (!wrongShot && (await page.getByText('✗ Tu respuesta').isVisible())) {
        wrongShot = true;
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${dir}/quiz-feedback-wrong.png` });
      }
      await next.click();
    }
    await expect(page.getByRole('heading', { name: 'Repasa tus errores' })).toBeVisible();
    await page.waitForTimeout(2000); // the count-up and the celebration
    await page.screenshot({ path: `${dir}/quiz-result.png` });
    await page.screenshot({ path: `${dir}/quiz-result-full.png`, fullPage: true });
  });
});

test.describe('the quiz result on a small screen', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('after the last «Ver resultado» the result opens at its title', async ({ page }) => {
    await page.goto('./#/play/trivia-history');
    await page.getByRole('button', { name: 'Comenzar' }).click();
    // On this screen the explanation pushes «Siguiente» below the fold, so the page is scrolled down at the end.
    await finishQuizRound(page);
    await expect(page.getByRole('heading', { name: 'Repasa tus errores' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: 'Historia' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('the time bar of a quiz on a small phone', () => {
  // Reduced motion, so the page jumps back up for each new question instead of gliding: every scroll is over at once.
  test.use({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });

  /** The box of what stays stuck to the top of the screen inside the game, or null while nothing is. */
  const stuckAtTop = (page: Page) =>
    page.evaluate(() => {
      for (const element of document.querySelectorAll('[data-game] *')) {
        if (getComputedStyle(element).position !== 'sticky') continue;
        const { top, bottom, height } = element.getBoundingClientRect();
        if (top <= 0.5) return { top, bottom, height };
      }
      return null;
    });

  test('a long question keeps only its time bar up, as a slim strip over neither the options nor «Siguiente»', async ({
    page,
  }) => {
    await page.goto('./#/play/accounting-lending');
    await page.getByRole('button', { name: 'Comenzar' }).click();
    const time = page.locator('[data-game]').getByRole('progressbar', { name: 'Tiempo' });
    const options = page.getByRole('button', { name: /^Opción \d: / });
    const dontKnow = page.getByRole('button', { name: 'No sé', exact: true });
    const next = page.getByRole('button', { name: 'Siguiente', exact: true });

    // A long question: scrolling down to «No sé» takes the page past the time bar's own place, so only a bar that
    // stays up is still on screen. Most of the lending bank does it on this screen; the first one that does is used.
    let long = false;
    for (let n = 1; n <= 9 && !long; n++) {
      await expect(page.getByText(`Pregunta ${n} de 10`)).toBeVisible();
      const barBottom = await time.evaluate((bar) => bar.getBoundingClientRect().bottom + window.scrollY);
      await dontKnow.evaluate((button) => button.scrollIntoView({ block: 'end' }));
      long = await page.evaluate((barBottom) => window.scrollY > barBottom, barBottom);
      if (long) break;
      await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
      await options.first().click();
      await next.click();
    }
    expect(long, 'a question long enough to scroll past the time bar').toBe(true);

    // Asking, with the last option and «No sé» in view: the running time bar is on screen, over none of them, and
    // what stays up is a strip of at most 40 px.
    await expect(time).toBeInViewport({ ratio: 1 });
    const bar = (await time.boundingBox())!;
    for (const control of [...(await options.all()), dontKnow]) {
      const box = (await control.boundingBox())!;
      const name = await control.textContent();
      expect(box.y >= bar.y + bar.height || box.y + box.height <= bar.y, `the time bar over ${name}`).toBe(true);
    }
    await expect(dontKnow).toBeInViewport({ ratio: 0.99 }); // scrolled to its bottom edge, give or take a subpixel
    const asking = await stuckAtTop(page);
    expect(asking, 'something stays up while the question is asked').not.toBeNull();
    expect(asking!.height, 'height of what stays up while asking').toBeLessThanOrEqual(40);

    // Answered: «Siguiente» is whole, below the strip, and the strip still takes no more than its 40 px.
    await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
    await options.first().click();
    await expect(next).toBeFocused();
    await expect(next).toBeInViewport({ ratio: 1 });
    await expect(time).toBeInViewport({ ratio: 1 });
    const answered = await stuckAtTop(page);
    expect(answered, 'something stays up after the answer').not.toBeNull();
    expect(answered!.height, 'height of what stays up after the answer').toBeLessThanOrEqual(40);
    expect((await next.boundingBox())!.y).toBeGreaterThanOrEqual(answered!.bottom);
  });

  test('an option that takes the focus while the strip is up is scrolled just clear of it, never left under it', async ({
    page,
  }) => {
    // Shorter still, so that from the bottom of any question its first option has gone up past the strip.
    await page.setViewportSize({ width: 320, height: 300 });
    await page.goto('./#/play/accounting-lending');
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    const options = page.getByRole('button', { name: /^Opción \d: / });
    const count = await options.count();

    // From the bottom of the page, the keyboard walks back up through the options.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.getByRole('button', { name: 'No sé', exact: true }).focus();
    for (let n = count; n >= 1; n--) {
      await page.keyboard.press('Shift+Tab');
      const option = page.getByRole('button', { name: new RegExp(`^Opción ${n}: `) });
      await expect(option).toBeFocused();
      await expect(option).toBeInViewport({ ratio: 1 });
      const stuck = await stuckAtTop(page);
      expect(stuck, 'the strip is up').not.toBeNull();
      const top = (await option.boundingBox())!.y;
      expect(top, `option ${n} below the strip`).toBeGreaterThanOrEqual(stuck!.bottom - 0.5);
      // The first option came from above the screen: it lands right under the strip, which pushes no more of the page
      // away than its own height.
      if (n === 1) expect(top - stuck!.bottom, 'room between the strip and option 1').toBeLessThanOrEqual(1);
    }
  });
});

test.describe('the top bar of a quiz on a 390 × 844 phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a question that fits leaves the top bar where it always was, before and after the answer', async ({ page }) => {
    await page.goto('./#/play/trivia-math');
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    const scope = page.locator('[data-luz]');
    const game = page.locator('[data-game]');
    const exit = game.getByRole('button', { name: 'Salir del juego' });
    const time = game.getByRole('progressbar', { name: 'Tiempo' });
    // Where the top bar sits in the screen: right under the top padding of the Luz scope, with the time bar under it.
    const offsets = async () => {
      const top = (await scope.boundingBox())!.y;
      return { exit: (await exit.boundingBox())!.y - top, time: (await time.boundingBox())!.y - top };
    };
    const asking = await offsets();
    expect(asking.exit).toBe(8); // the scope's top padding, 0.5rem
    expect(asking.time).toBe(8 + 44 + 16); // under the 44 px ✕ and the 1rem gap of the frame

    await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
    await page.getByRole('button', { name: /^Opción 1: / }).click();
    await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await offsets()).toEqual(asking);
  });
});
