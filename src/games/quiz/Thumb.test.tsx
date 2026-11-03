import { render } from '@testing-library/react';
import { getGame, QUIZ_GAMES } from '../registry';
import type { GameDefinition } from '../types';

function drawingOf(game: GameDefinition) {
  const { container, unmount } = render(<game.Thumb />);
  const svg = container.querySelector('svg')!;
  const drawing = { motif: svg.getAttribute('data-motif'), shapes: svg.children.length, markup: svg.innerHTML };
  unmount();
  return drawing;
}

test('each quiz category has a motif of its own; both mixes share the mix motif', () => {
  const drawings = new Map(QUIZ_GAMES.map((g) => [g.id, drawingOf(g)]));
  expect(drawings.get('trivia-mix')?.motif).toBe('mix');
  expect(drawings.get('accounting-mix')?.motif).toBe('mix');

  const single = QUIZ_GAMES.filter((g) => g.quiz!.categories.length === 1);
  expect(single).toHaveLength(12);
  expect(single.map((g) => drawings.get(g.id)?.motif)).toEqual(single.map((g) => g.quiz!.categories[0]));

  // Twelve category drawings and the mix one, all different and none empty.
  expect(new Set([...drawings.values()].map((d) => d.markup)).size).toBe(13);
  for (const [id, d] of drawings) expect(d.shapes, id).toBeGreaterThan(0);
});

test('each quiz thumbnail wears the colour of its bank and survives a re-render in place', () => {
  const thumbnails = QUIZ_GAMES.map((game) => {
    const { container, rerender, unmount } = render(<game.Thumb />);
    const svg = container.querySelector('svg')!;
    // A screen that renders again must update the same drawing, not mount a new one (a new component type would).
    rerender(<game.Thumb />);
    expect(container.querySelector('svg'), game.id).toBe(svg);
    const thumbnail = {
      id: game.id,
      area: svg.closest('[data-area]')?.getAttribute('data-area'),
      motif: svg.getAttribute('data-motif'),
      markup: container.innerHTML,
    };
    unmount();
    return thumbnail;
  });

  for (const { id, area, motif } of thumbnails) {
    const quiz = getGame(id)!.quiz!;
    expect(area, id).toBe(quiz.bank);
    expect(motif, id).toBe(quiz.categories.length === 1 ? quiz.categories[0] : 'mix');
  }
  // Twelve category motifs and the mix motif in each of the two bank colours: fourteen different thumbnails.
  expect(new Set(thumbnails.map((t) => t.markup)).size).toBe(14);
});
