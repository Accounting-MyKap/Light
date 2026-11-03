export type FigureId = 0 | 1 | 2 | 3 | 4 | 5;
export type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'hexagon';

export interface Figure {
  id: FigureId;
  shape: Shape;
  /** Its own color, from the Luz palette; the shape alone also tells it apart. */
  color: string;
}

export const FIGURES: readonly Figure[] = [
  { id: 0, shape: 'circle', color: '#ffb52e' },
  { id: 1, shape: 'square', color: '#3fd4ff' },
  { id: 2, shape: 'triangle', color: '#ff5fd2' },
  { id: 3, shape: 'diamond', color: '#8dff6a' },
  { id: 4, shape: 'star', color: '#ff8f5e' },
  { id: 5, shape: 'hexagon', color: '#eef1ff' },
];

export const FIGURE_IDS: readonly FigureId[] = FIGURES.map((f) => f.id);

/**
 * The outline of each shape as an SVG path, centered on 0,0 in a box of about 20 × 20 units, all with about the
 * same visual weight.
 */
export const SHAPE_PATHS: Record<Shape, string> = {
  circle: 'M0 -9.5a9.5 9.5 0 1 1 0 19a9.5 9.5 0 1 1 0 -19z',
  square: 'M-8.5 -8.5h17v17h-17z',
  triangle: 'M0 -10.5L10.5 8.5H-10.5z',
  diamond: 'M0 -11L10 0L0 11L-10 0z',
  star: 'M0 -11L3.1 -4.2L10.5 -3.4L4.9 1.6L6.5 8.9L0 5.2L-6.5 8.9L-4.9 1.6L-10.5 -3.4L-3.1 -4.2z',
  hexagon: 'M0 -10L8.7 -5V5L0 10L-8.7 5V-5z',
};
