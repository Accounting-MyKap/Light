import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { playTone } from '../../core/sound';
import { VIBRATION, vibrate } from '../../core/vibrate';
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
 * when there is a provider (the games work without one).
 */
export function useFeedback(): (kind: FeedbackKind) => void {
  const { sound, vibration } = useSettings();
  const emit = useContext(EmitContext);
  return useCallback(
    (kind) => {
      if (sound) playTone(kind === 'correct' ? 'correct' : 'wrong');
      if (vibration) vibrate(VIBRATION[kind]);
      emit?.(kind);
    },
    [sound, vibration, emit],
  );
}
