import { render, screen, within } from '@testing-library/react';
import { initI18n } from '../../i18n';
import type { GameResult, SwitchyardRoundDetails } from '../types';
import { STATION_STYLES } from './maps';
import { SwitchyardResultDetails } from './ResultDetails';

const resultOf = (switchyard?: SwitchyardRoundDetails): GameResult => ({
  score: 420,
  accuracy: 0.86,
  levelReached: 6,
  durationMs: 90_000,
  switchyard,
});

/** 18 of 21 home, 7 in a row at best; three trains for the blue cross station (style 6) and one for the red missed. */
const WITH_MISSES: SwitchyardRoundDetails = {
  home: 18,
  arrived: 21,
  bestStreak: 7,
  missed: [
    { style: 6, count: 3 },
    { style: 0, count: 1 },
  ],
};

beforeEach(async () => {
  await initI18n('es');
});

test('sums up the trains: home of arrived, the best run, and the station missed most', () => {
  render(<SwitchyardResultDetails result={resultOf(WITH_MISSES)} />);
  const summary = screen.getByRole('region', { name: 'Tus trenes' });
  const lines = within(summary)
    .getAllByRole('listitem')
    .map((li) => li.textContent);
  expect(lines).toEqual([
    'Trenes a su estación: 18 de 21',
    'Mejor racha: 7 trenes seguidos',
    'Donde más fallaste: la estación azul de la cruz (3 trenes)',
  ]);
});

test('the station missed most comes with a chip of its color and shape, hidden from screen readers', () => {
  const { container } = render(<SwitchyardResultDetails result={resultOf(WITH_MISSES)} />);
  const chips = container.querySelectorAll('svg');
  expect(chips).toHaveLength(1);
  const chip = chips[0];
  expect(chip).toHaveAttribute('aria-hidden', 'true');
  expect(chip.querySelector('circle')).toHaveAttribute('fill', STATION_STYLES[6].color);
  // The cross is drawn as a path in dark ink over the color.
  expect(chip.querySelector('path')).toBeInTheDocument();
});

test('without misses there is no station line, and one train home in a row reads in the singular', () => {
  render(<SwitchyardResultDetails result={resultOf({ home: 1, arrived: 1, bestStreak: 1, missed: [] })} />);
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Trenes a su estación: 1 de 1',
    'Mejor racha: 1 tren seguido',
  ]);
  expect(screen.queryByText(/Donde más fallaste/)).not.toBeInTheDocument();
});

test('a game with no train home has no best run to tell', () => {
  render(<SwitchyardResultDetails result={resultOf({ home: 0, arrived: 2, bestStreak: 0, missed: [{ style: 1, count: 2 }] })} />);
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Trenes a su estación: 0 de 2',
    'Donde más fallaste: la estación amarilla del cuadrado (2 trenes)',
  ]);
});

test('shows nothing when no train arrived, or when the result carries no train summary', () => {
  const none = render(<SwitchyardResultDetails result={resultOf({ home: 0, arrived: 0, bestStreak: 0, missed: [] })} />);
  expect(none.container).toBeEmptyDOMElement();
  none.unmount();
  const missing = render(<SwitchyardResultDetails result={resultOf(undefined)} />);
  expect(missing.container).toBeEmptyDOMElement();
});

test('every station has its spoken name, in both languages', async () => {
  const names = async () => {
    const out: string[] = [];
    for (let style = 0; style < STATION_STYLES.length; style++) {
      const view = render(
        <SwitchyardResultDetails result={resultOf({ home: 0, arrived: 1, bestStreak: 0, missed: [{ style, count: 1 }] })} />,
      );
      out.push(screen.getByText(/\(1 (tren|train)\)$/).textContent!);
      view.unmount();
    }
    return out;
  };
  expect(await names()).toEqual([
    'Donde más fallaste: la estación roja del círculo (1 tren)',
    'Donde más fallaste: la estación amarilla del cuadrado (1 tren)',
    'Donde más fallaste: la estación verde del triángulo (1 tren)',
    'Donde más fallaste: la estación morada del rombo (1 tren)',
    'Donde más fallaste: la estación naranja de la estrella (1 tren)',
    'Donde más fallaste: la estación rosada del corazón (1 tren)',
    'Donde más fallaste: la estación azul de la cruz (1 tren)',
  ]);
  await initI18n('en');
  expect(await names()).toEqual([
    'Missed most: the red circle station (1 train)',
    'Missed most: the yellow square station (1 train)',
    'Missed most: the green triangle station (1 train)',
    'Missed most: the purple diamond station (1 train)',
    'Missed most: the orange star station (1 train)',
    'Missed most: the pink heart station (1 train)',
    'Missed most: the blue cross station (1 train)',
  ]);
});

test('in English', async () => {
  await initI18n('en');
  render(<SwitchyardResultDetails result={resultOf(WITH_MISSES)} />);
  expect(screen.getByRole('region', { name: 'Your trains' })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Trains to their station: 18 of 21',
    'Best streak: 7 trains in a row',
    'Missed most: the blue cross station (3 trains)',
  ]);
});
