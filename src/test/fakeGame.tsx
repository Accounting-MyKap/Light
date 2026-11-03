import { useState } from 'react';
import { GameFrame } from '../games/shared/GameFrame';
import type { PracticeProps } from '../games/shared/practice/types';
import type { GameDefinition, GameProps } from '../games/types';
import { i18n } from '../i18n';

/** The seconds the fake game reports as left, so the pause sheet has a clock to show. */
export const FAKE_REMAINING_MS = 34_200;

function FakeGameComponent({ startLevel, paused, onFinish }: GameProps) {
  const [score, setScore] = useState(0);
  return (
    <GameFrame score={score} level={1} time={{ remainingMs: FAKE_REMAINING_MS, totalMs: 60_000 }}>
      <p>paused:{String(paused)}</p>
      <p>startLevel:{startLevel}</p>
      <button onClick={() => setScore((s) => s + 10)}>Acertar</button>
      <button onClick={() => onFinish({ score: 120, accuracy: 0.9, levelReached: 2, durationMs: 60000 })}>Terminar</button>
    </GameFrame>
  );
}

function FakePractice({ onComplete, onSkip }: PracticeProps) {
  return (
    <div>
      <p>fake practice</p>
      <button onClick={onComplete}>Terminar práctica</button>
      <button onClick={onSkip}>Saltar práctica</button>
    </div>
  );
}

function FakeExample() {
  return <p>fake example</p>;
}

function FakeThumb() {
  return <span aria-hidden="true" />;
}

export const fakeGame: GameDefinition = {
  id: 'fake',
  area: 'memory',
  referenceScore: 100,
  maxScore: 1000,
  Component: FakeGameComponent,
  Practice: FakePractice,
  Thumb: FakeThumb,
};

export const fakeGame2: GameDefinition = { ...fakeGame, id: 'fake2' };

/** A game without a practice, like Guardagujas and the quiz games: it keeps the instructions and their Example. */
export const fakeGameNoPractice: GameDefinition = {
  id: 'fakenp',
  area: 'memory',
  referenceScore: 100,
  maxScore: 1000,
  Component: FakeGameComponent,
  Example: FakeExample,
  Thumb: FakeThumb,
};

/** Takes its instructions from a shared i18n key, like the quiz games do. */
export const fakeGame3: GameDefinition = { ...fakeGameNoPractice, id: 'fake3', instructionsKey: 'quiz.instructions' };

/** A game of the quiz section: it has a `quiz` config, so leaving it goes to the Quiz tab. */
export const fakeQuizGame: GameDefinition = {
  ...fakeGameNoPractice,
  id: 'fakeq',
  area: 'trivia',
  instructionsKey: 'quiz.instructions',
  quiz: { bank: 'trivia', categories: ['history'] },
};

export function registerFakeGameTranslations(): void {
  const texts = {
    games: {
      fake: {
        title: 'Juego falso',
        description: 'Un juego para pruebas',
        practice: { recap: 'Resumen falso' },
      },
      fake2: {
        title: 'Segundo juego falso',
        description: 'Otro juego para pruebas',
        practice: { recap: 'Resumen falso 2' },
      },
      fakenp: {
        title: 'Juego falso sin práctica',
        description: 'Un juego con instrucciones',
        instructions: ['Primera instrucción falsa', 'Segunda instrucción falsa'],
      },
      // No `instructions` here on purpose: they come from the game's `instructionsKey`.
      fake3: {
        title: 'Tercer juego falso',
        description: 'Un juego con instrucciones compartidas',
      },
      fakeq: {
        title: 'Juego de preguntas falso',
        description: 'Un juego de preguntas para pruebas',
      },
    },
  };
  i18n.addResourceBundle('es', 'translation', texts, true, true);
  i18n.addResourceBundle('en', 'translation', texts, true, true);
}
