import type { ReactNode } from 'react';
import type { SymbolId } from './engine';

const dotFrame = (cx: number | null, cy: number | null) => (
  <>
    <rect x="14" y="14" width="72" height="72" rx="8" fill="none" stroke="currentColor" strokeWidth="6" />
    {cx !== null && cy !== null && <circle cx={cx} cy={cy} r="11" />}
  </>
);

const SHAPES: Record<SymbolId, ReactNode> = {
  circle: <circle cx="50" cy="50" r="36" />,
  square: <rect x="16" y="16" width="68" height="68" rx="6" />,
  triangle: <polygon points="50,12 88,84 12,84" />,
  star: <polygon points="50,8 61,38 93,38 67,57 77,89 50,70 23,89 33,57 7,38 39,38" />,
  heart: <path d="M50 86 14 50a20 20 0 0 1 36-28 20 20 0 0 1 36 28z" />,
  cross: <path d="M38 12h24v26h26v24H62v26H38V62H12V38h26z" />,
  'tri-up': <polygon points="50,14 88,82 12,82" />,
  'tri-down': <polygon points="50,86 88,18 12,18" />,
  'tri-left': <polygon points="14,50 82,12 82,88" />,
  'tri-right': <polygon points="86,50 18,12 18,88" />,
  diamond: <polygon points="50,8 92,50 50,92 8,50" />,
  'dot-tl': dotFrame(34, 34),
  'dot-tr': dotFrame(66, 34),
  'dot-bl': dotFrame(34, 66),
  'dot-br': dotFrame(66, 66),
  'dot-center': dotFrame(50, 50),
  'dot-none': dotFrame(null, null),
};

export function SymbolGlyph({ id, label, className }: { id: SymbolId; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label} data-testid="symbol" data-symbol={id}>
      <g fill="currentColor">{SHAPES[id]}</g>
    </svg>
  );
}
