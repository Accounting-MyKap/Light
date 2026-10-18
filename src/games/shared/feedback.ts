import { useCallback } from 'react';
import { playTone } from '../../core/sound';
import { useSettings } from '../../data/settings';

export function useFeedback(): (kind: 'correct' | 'wrong') => void {
  const { sound } = useSettings();
  return useCallback(
    (kind) => {
      if (sound) playTone(kind);
    },
    [sound],
  );
}
