import { render } from '@testing-library/react';
import { QUIZ_GAMES } from '../registry';
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

test('the same quiz game always hands React the same thumbnail component', () => {
  const thumbs = QUIZ_GAMES.map((g) => g.Thumb);
  expect(new Set(thumbs).size).toBe(QUIZ_GAMES.length);
  expect(QUIZ_GAMES.map((g) => g.Thumb)).toEqual(thumbs);
});
