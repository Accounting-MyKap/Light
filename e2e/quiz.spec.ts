import { mkdirSync } from 'node:fs';
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
  // The ✕ opens the pause sheet; «Continuar» starts the 3-2-1 (three 1 s steps), and then the game runs again.
  const pauseAndResume = async () => {
    await page.locator('[data-game]').getByRole('button', { name: 'Salir del juego' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Pausado')).toBeHidden();
  };

  await expect(prompt).toBeFocused();
  await pauseAndResume();
  await expect(prompt).toBeFocused({ timeout: 6000 });

  await page.waitForTimeout(200); // longer than MIN_RT_MS, or the app ignores the tap
  await page.getByRole('button', { name: /^Opción 1: / }).click();
  await expect(next).toBeFocused();
  await pauseAndResume();
  await expect(next).toBeFocused({ timeout: 6000 });
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
