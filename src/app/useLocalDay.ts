import { useEffect, useState } from 'react';
import { localDay } from '../core/dates';

/**
 * Today's local day ('YYYY-MM-DD'), kept current: it rolls over at midnight and is re-checked when the
 * app comes back to the foreground (an installed PWA can sit in the background for days).
 */
export function useLocalDay(): string {
  const [day, setDay] = useState(() => localDay(new Date()));

  useEffect(() => {
    const refresh = () => setDay(localDay(new Date()));
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
    const timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [day]);

  return day;
}
