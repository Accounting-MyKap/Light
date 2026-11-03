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
