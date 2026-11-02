import { useState } from 'react';
import { GameFrame } from '../games/shared/GameFrame';
import type { GameDefinition, GameProps } from '../games/types';
import { i18n } from '../i18n';

/** The seconds the fake game reports as left, so the pause sheet has a clock to show. */
export const FAKE_REMAINING_MS = 34_200;

function FakeGameComponent({ paused, onFinish }: GameProps) {
  const [score, setScore] = useState(0);
  return (
    <GameFrame score={score} level={1} time={{ remainingMs: FAKE_REMAINING_MS, totalMs: 60_000 }}>
      <p>paused:{String(paused)}</p>
      <button onClick={() => setScore((s) => s + 10)}>Acertar</button>
      <button onClick={() => onFinish({ score: 120, accuracy: 0.9, levelReached: 2, durationMs: 60000 })}>Terminar</button>
    </GameFrame>
  );
}

function FakeExample() {
  return <p>fake example</p>;
}

export const fakeGame: GameDefinition = {
  id: 'fake',
  area: 'memory',
  referenceScore: 100,
  maxScore: 1000,
  Component: FakeGameComponent,
  Example: FakeExample,
};

export const fakeGame2: GameDefinition = { ...fakeGame, id: 'fake2' };

export function registerFakeGameTranslations(): void {
  const texts = {
    games: {
      fake: {
        title: 'Juego falso',
        description: 'Un juego para pruebas',
        instructions: ['Primera instrucción falsa', 'Segunda instrucción falsa'],
      },
      fake2: {
        title: 'Segundo juego falso',
        description: 'Otro juego para pruebas',
        instructions: ['Instrucción A', 'Instrucción B'],
      },
    },
  };
  i18n.addResourceBundle('es', 'translation', texts, true, true);
  i18n.addResourceBundle('en', 'translation', texts, true, true);
}
