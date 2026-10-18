import { useTranslation } from 'react-i18next';
import styles from '../Screens.module.css';

const W = 300;
const H = 80;
const PAD = 6;

export function LineChart({ values, label }: { values: readonly number[]; label: string }) {
  const { t } = useTranslation();
  if (values.length < 2) return <p className={styles.muted}>{t('progress.notEnoughData')}</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = PAD + (i * (W - 2 * PAD)) / (values.length - 1);
      const y = H - PAD - ((v - min) * (H - 2 * PAD)) / span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
