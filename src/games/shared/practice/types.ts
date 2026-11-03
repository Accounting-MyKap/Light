/** What every game's guided practice receives from the play screen. */
export interface PracticeProps {
  /** The person went through every practice round. */
  onComplete: () => void;
  /** The person left the practice early. */
  onSkip: () => void;
}
