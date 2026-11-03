import { useTranslation } from 'react-i18next';
import { weekOf } from '../../core/dates';
import styles from './WeekStrip.module.css';

type DayState = 'done' | 'today' | 'future' | 'missed';

export function WeekStrip({ today, completed }: { today: string; completed: readonly string[] }) {
  const { t } = useTranslation();
  const week = weekOf(today);
  const initials = t('today.weekdays', { returnObjects: true }) as string[];
  const stateOf = (day: string): DayState =>
    completed.includes(day) ? 'done' : day === today ? 'today' : day > today ? 'future' : 'missed';
  const done = week.filter((day) => completed.includes(day)).length;

  return (
    <div className={styles.week}>
      <p className="visually-hidden">{t('today.week', { done })}</p>
      <ol aria-hidden="true">
        {week.map((day, i) => (
          <li key={day} data-state={stateOf(day)}>
            <span>{initials[i]}</span>
            <i />
          </li>
        ))}
      </ol>
    </div>
  );
}
