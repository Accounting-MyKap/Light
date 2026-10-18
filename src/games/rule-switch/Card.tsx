import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { COLOR_STYLE, type Card } from './engine';
import styles from './rule-switch.module.css';

function CardShape({ card }: { card: Card }) {
  const patternId = `p${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { hex, pattern } = COLOR_STYLE[card.color];
  const fill = pattern === 'solid' ? hex : `url(#${patternId})`;
  const common = { fill, stroke: 'var(--text)', strokeWidth: 3 };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        {pattern === 'stripes' && (
          <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="12" height="12" fill={hex} />
            <rect width="5" height="12" fill="rgba(255,255,255,0.6)" />
          </pattern>
        )}
        {pattern === 'dots' && (
          <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill={hex} />
            <circle cx="7" cy="7" r="3.2" fill="rgba(255,255,255,0.75)" />
          </pattern>
        )}
      </defs>
      {card.shape === 'circle' && <circle cx="50" cy="50" r="38" {...common} />}
      {card.shape === 'square' && <rect x="14" y="14" width="72" height="72" rx="6" {...common} />}
      {card.shape === 'triangle' && <polygon points="50,10 90,86 10,86" {...common} />}
    </svg>
  );
}

export function useCardLabel(): (card: Card) => string {
  const { t } = useTranslation();
  return (card) =>
    t('games.rule-switch.card', {
      shape: t(`games.rule-switch.shapes.${card.shape}`),
      color: t(`games.rule-switch.colors.${card.color}`),
    });
}

interface CardViewProps {
  card: Card;
  testId?: string;
  className?: string;
  onSelect?: () => void;
}

export function CardView({ card, testId, className = '', onSelect }: CardViewProps) {
  const label = useCardLabel()(card);
  const data = {
    'data-testid': testId,
    'data-shape': card.shape,
    'data-color': card.color,
    'data-pattern': COLOR_STYLE[card.color].pattern,
  };
  if (onSelect) {
    return (
      <button type="button" className={`${styles.card} ${styles.target} ${className}`} aria-label={label} onClick={onSelect} {...data}>
        <CardShape card={card} />
      </button>
    );
  }
  return (
    <div className={`${styles.card} ${className}`} role="img" aria-label={label} {...data}>
      <CardShape card={card} />
    </div>
  );
}

export function RuleIcon({ rule }: { rule: 'color' | 'shape' }) {
  return rule === 'color' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7" cy="12" r="4" fill="#3D7BFF" />
      <circle cx="12" cy="7" r="4" fill="#FF9F1C" />
      <circle cx="17" cy="12" r="4" fill="#B05CFF" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6.5" cy="7" r="3.5" />
      <rect x="14" y="3.5" width="7" height="7" />
      <polygon points="12,13 17,21 7,21" />
    </svg>
  );
}
