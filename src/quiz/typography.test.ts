import { keepNumbersTogether } from './typography';

const NNBSP = ' ';

test('joins the digit groups of a number with a narrow no-break space', () => {
  expect(keepNumbersTogether('Cuesta 120 000 pesos')).toBe(`Cuesta 120${NNBSP}000 pesos`);
  expect(keepNumbersTogether('1 000 000 de habitantes')).toBe(`1${NNBSP}000${NNBSP}000 de habitantes`);
  expect(keepNumbersTogether('Unas 3 400 personas')).toBe(`Unas 3${NNBSP}400 personas`);
});

test('keeps a percentage with its number', () => {
  expect(keepNumbersTogether('La tarifa general es 19 %.')).toBe(`La tarifa general es 19${NNBSP}%.`);
  expect(keepNumbersTogether('Del 4 % al 1 000 %')).toBe(`Del 4${NNBSP}% al 1${NNBSP}000${NNBSP}%`);
});

test('leaves other spaces between numbers alone', () => {
  for (const text of ['Ley 100 de 1993', 'Entre 1 y 2', 'Año 2024 2025', 'Pregunta 12 34', 'Sin números', '']) {
    expect(keepNumbersTogether(text)).toBe(text);
  }
  // «1810 1» is not followed by a group of exactly three digits; «1 200» is.
  expect(keepNumbersTogether('En 1810 1 200 soldados')).toBe(`En 1810 1${NNBSP}200 soldados`);
});
