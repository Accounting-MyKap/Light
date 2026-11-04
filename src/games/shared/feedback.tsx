import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { playTone, type ToneKind } from '../../core/sound';
import { VIBRATION, vibrate, type VibrationPattern } from '../../core/vibrate';
import { useSettings } from '../../data/settings';

export type FeedbackKind = 'correct' | 'wrong' | 'timeout';

/** The latest answer reaction. `id` grows with every emission, so two equal kinds in a row stay distinguishable. */
export interface FeedbackSignal {
  kind: FeedbackKind;
  id: number;
}

// Two contexts: callers of `useFeedback` only need `emit`, which never changes, so a new signal re-renders
// only the components that draw it.
const EmitContext = createContext<((kind: FeedbackKind) => void) | null>(null);
const SignalContext = createContext<FeedbackSignal | null>(null);

/** Publishes every `useFeedback` call below it as a signal for the visual layer to draw. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [signal, setSignal] = useState<FeedbackSignal | null>(null);
  const emit = useCallback((kind: FeedbackKind) => setSignal((last) => ({ kind, id: (last?.id ?? 0) + 1 })), []);
  return (
    <EmitContext.Provider value={emit}>
      <SignalContext.Provider value={signal}>{children}</SignalContext.Provider>
    </EmitContext.Provider>
  );
}

/** The latest signal, or null before the first answer or outside a `FeedbackProvider`. */
export function useFeedbackSignal(): FeedbackSignal | null {
  return useContext(SignalContext);
}

/**
 * Reacts to an answer: sound and vibration each follow their own setting, and the signal is published
 * when there is a provider (the games work without one). `tone` plays instead of the usual sound of the answer
 * (Guardagujas rings a small chime when a train is home).
 */
export function useFeedback(): (kind: FeedbackKind, tone?: ToneKind) => void {
  const { sound, vibration } = useSettings();
  const emit = useContext(EmitContext);
  return useCallback(
    (kind, tone) => {
      if (sound) playTone(tone ?? (kind === 'correct' ? 'correct' : 'wrong'));
      if (vibration) vibrate(VIBRATION[kind]);
      emit?.(kind);
    },
    [sound, vibration, emit],
  );
}

/**
 * A cue that is not an answer (a train leaving, a switch flipping): its sound and its vibration follow the same
 * settings as the answers, and it publishes no signal, so the frame draws nothing for it.
 */
export function useCue(): (tone: ToneKind, pattern?: VibrationPattern) => void {
  const { sound, vibration } = useSettings();
  return useCallback(
    (tone, pattern) => {
      if (sound) playTone(tone);
      if (vibration && pattern !== undefined) vibrate(pattern);
    },
    [sound, vibration],
  );
}
