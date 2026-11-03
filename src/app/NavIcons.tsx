import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const TodayIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const GamesIcon = () => (
  <Svg>
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </g>
  </Svg>
);

/** A speech bubble with a question mark: the Preguntas (quiz) tab. */
export const QuizIcon = () => (
  <Svg>
    <path
      d="M6 4h12a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 18 17h-6.5L7 20.5V17H6a2.5 2.5 0 0 1-2.5-2.5v-8A2.5 2.5 0 0 1 6 4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M9.8 8.6a2.3 2.3 0 1 1 3.3 2.1c-.7.3-1.1.8-1.1 1.5v.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="14.6" r="1.1" fill="currentColor" />
  </Svg>
);

export const ProgressIcon = () => (
  <Svg>
    <path d="M4 20V11M10 20V5M16 20v-7M21 20H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const SettingsIcon = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
  </Svg>
);

export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <path
      d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);
