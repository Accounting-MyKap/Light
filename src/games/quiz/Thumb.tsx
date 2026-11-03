import type { ReactNode } from 'react';
import type { QuizBank, QuizCategory } from '../../quiz/types';
import { GameThumb } from '../shared/GameThumb';

/** What a quiz thumbnail draws: its category, or the question mark of a bank's mix. */
export type QuizMotif = QuizCategory | 'mix';

const LABEL_FONT = "'Sora Variable', system-ui, sans-serif";

/** A country code in a rounded badge (the national accounting categories). */
const countryBadge = (code: string) => (
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <text x="12" y="15.2" textAnchor="middle" fontFamily={LABEL_FONT} fontSize="8" fontWeight="800" fill="currentColor">
      {code}
    </text>
  </>
);

/** One small night-scene drawing per motif, on a 24 × 24 grid, in the colour of the bank. */
const MOTIFS: Record<QuizMotif, ReactNode> = {
  mix: (
    <>
      <path d="M8.5 8.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.2v.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="18.6" r="1.5" fill="currentColor" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" opacity=".4" />
      <circle cx="19.5" cy="7.5" r="1" fill="currentColor" opacity=".4" />
      <circle cx="18.5" cy="18" r="1.3" fill="currentColor" opacity=".4" />
    </>
  ),
  // A classical building: pediment, three columns and a base.
  history: (
    <>
      <path d="M3 9.2 12 3.5l9 5.7z" fill="currentColor" />
      <rect x="5" y="10.6" width="2.6" height="7.4" rx=".6" fill="currentColor" />
      <rect x="10.7" y="10.6" width="2.6" height="7.4" rx=".6" fill="currentColor" />
      <rect x="16.4" y="10.6" width="2.6" height="7.4" rx=".6" fill="currentColor" />
      <rect x="3" y="19" width="18" height="2" rx=".6" fill="currentColor" />
    </>
  ),
  // An atom.
  science: (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="12" rx="9.5" ry="3.6" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(120 12 12)" />
      </g>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
    </>
  ),
  // A globe.
  geography: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.8" ry="8.5" />
      <path d="M3.5 12h17" />
      <path d="M5.2 7.5h13.6M5.2 16.5h13.6" opacity=".6" />
    </g>
  ),
  // π.
  math: (
    <path
      d="M5 7.5h14M9.5 7.5V18M14.5 7.5v8.3c0 1.4.7 2.2 2.2 2.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  ),
  // A painter's palette.
  arts: (
    <>
      <path
        d="M12 3.5c-4.9 0-8.5 3.6-8.5 8.2 0 4.4 3.6 7.8 8 7.8 1.4 0 2.1-.8 2.1-1.8 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7h2.1c2.4 0 4.1-1.8 4.1-4.1 0-3.2-3.8-5.7-8.5-5.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="7.6" cy="11.4" r="1.3" fill="currentColor" />
      <circle cx="9.6" cy="7.6" r="1.3" fill="currentColor" />
      <circle cx="13.9" cy="6.9" r="1.3" fill="currentColor" />
      <circle cx="17.3" cy="9.6" r="1.3" fill="currentColor" />
    </>
  ),
  // A screen with a play button.
  entertainment: (
    <>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.2 8.1v5.3l4.6-2.65z" fill="currentColor" />
      <path d="M8.5 20.3h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  // A football.
  sports: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9l2.85 2.07-1.09 3.36h-3.52l-1.09-3.36z" fill="currentColor" />
      <path
        d="M12 9V3.5M14.85 11.07l5.25-1.7M13.76 14.43l3.24 4.5M10.24 14.43 7 18.93M9.15 11.07 3.9 9.37"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </>
  ),
  // A chip.
  technology: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="10" y="10" width="4" height="4" rx=".6" fill="currentColor" />
      <path
        d="M9.5 3.5v2.5M12 3.5v2.5M14.5 3.5v2.5M9.5 18v2.5M12 18v2.5M14.5 18v2.5M3.5 9.5H6M3.5 12H6M3.5 14.5H6M18 9.5h2.5M18 12h2.5M18 14.5h2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  // A balance: debits equal credits.
  concepts: (
    <>
      <path d="M12 5v14.5M8 19.5h8M4.5 7.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="4.6" r="1.3" fill="currentColor" />
      <path d="M4.5 7.5 2.4 13M4.5 7.5 6.6 13M19.5 7.5 17.4 13M19.5 7.5l2.1 5.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 13h5a2.5 2.5 0 0 1-5 0zM17 13h5a2.5 2.5 0 0 1-5 0z" fill="currentColor" />
    </>
  ),
  colombia: countryBadge('CO'),
  us: countryBadge('US'),
  // A coin with a percent sign: interest on a loan.
  lending: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="9.2" cy="9.2" r="1.6" />
        <circle cx="14.8" cy="14.8" r="1.6" />
        <path d="M15.4 8.6 8.6 15.4" />
      </g>
    </>
  ),
};

/** The thumbnail of a quiz game: the motif of its category (or the mix) in the colour of its bank. */
export function QuizThumb({ bank, motif }: { bank: QuizBank; motif: QuizMotif }) {
  return (
    <GameThumb area={bank}>
      <svg viewBox="0 0 24 24" focusable="false" data-motif={motif}>
        {MOTIFS[motif]}
      </svg>
    </GameThumb>
  );
}
