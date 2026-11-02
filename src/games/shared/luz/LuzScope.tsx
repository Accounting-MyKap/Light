import { useEffect, type ReactNode } from 'react';
import type { Area } from '../../types';
import { FeedbackProvider } from '../feedback';
import './luz.css';

export const LUZ_THEME_COLOR = '#090b19';

const ACTIVE_ATTRIBUTE = 'data-luz-active';

/**
 * The dark Luz look for a game screen. While mounted it also darkens the page behind it and the browser
 * bar (theme-color), and puts both back exactly as it found them on unmount. Answer reactions inside it are
 * published as signals (see `FeedbackProvider`).
 */
export function LuzScope({ area, children }: { area: Area; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousColor = meta?.getAttribute('content') ?? null;
    const previousMarker = root.getAttribute(ACTIVE_ATTRIBUTE);

    meta?.setAttribute('content', LUZ_THEME_COLOR);
    root.setAttribute(ACTIVE_ATTRIBUTE, '');

    return () => {
      if (meta) {
        if (previousColor === null) meta.removeAttribute('content');
        else meta.setAttribute('content', previousColor);
      }
      if (previousMarker === null) root.removeAttribute(ACTIVE_ATTRIBUTE);
      else root.setAttribute(ACTIVE_ATTRIBUTE, previousMarker);
    };
  }, []);

  return (
    <div className="luz" data-luz="" data-area={area}>
      <FeedbackProvider>{children}</FeedbackProvider>
    </div>
  );
}
