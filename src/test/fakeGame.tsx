import type { GameDefinition, GameProps } from '../games/types';
import { i18n } from '../i18n';

function FakeGameComponent({ paused, onFinish }: GameProps) {
  return (
    <div>
      <p>paused:{String(paused)}</p>
      <button onClick={() => onFinish({ score: 120, accuracy: 0.9, levelReached: 2, durationMs: 60000 })}>Terminar</button>
    </div>
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

/** Takes its instructions from a shared i18n key, like the quiz games do. */
export const fakeGame3: GameDefinition = { ...fakeGame, id: 'fake3', instructionsKey: 'quiz.instructions' };

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
      // No `instructions` here on purpose: they come from the game's `instructionsKey`.
      fake3: {
        title: 'Tercer juego falso',
        description: 'Un juego con instrucciones compartidas',
      },
    },
  };
  i18n.addResourceBundle('es', 'translation', texts, true, true);
  i18n.addResourceBundle('en', 'translation', texts, true, true);
}
